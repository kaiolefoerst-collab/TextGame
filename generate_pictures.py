"""Erzeugt Bilder via Gemini Bildgenerierung.

Standard (ohne --input): fragt, welche Geschichte (Ordner unter Stories/) illustriert werden
soll, exportiert vorher automatisch ihre Bild-Prompts (wie export_pics.py) und legt die Bilder
in Stories/<Name>/pictures/ ab. Unveraenderte Bilder werden uebersprungen (Manifest), vor den
API-Aufrufen wird nachgefragt.

    python generate_pictures.py                      # Auswahl im Terminal
    python generate_pictures.py --story cursed_mill  # ohne Rueckfrage nach der Geschichte
    python generate_pictures.py --story alle --yes   # alles, ohne jede Rueckfrage
    python generate_pictures.py --dry-run            # nur anzeigen, was erzeugt wuerde

Klassisch: --input datei.txt --output-dir ordner  liest Zeilen im Format  Nummer "Prompt";"Zusatzinfo".
"""

import argparse
import hashlib
import json
import os
import re
import subprocess
import sys
from pathlib import Path

from dotenv import load_dotenv
from google import genai
from google.genai import types

from story_files import load_story, story_folders

ROOT_DIR = Path(__file__).resolve().parent
DEFAULT_MODEL = "gemini-2.5-flash-image"

MANIFEST_FILENAME = ".manifest.json"

# Alle Bilder im Querformat 16:9. Gemini liefert dafuer z.B. 1344x768 (nur annaehernd 16:9),
# darum schneidet image_to_jpeg zusaetzlich mittig exakt auf 16:9 zu. Das Format geht in den
# Aenderungs-Hash ein: Bilder in einem anderen Format werden beim naechsten Lauf neu erzeugt.
ASPECT_RATIO = "16:9"
CROP_16_9 = (
    "crop='if(gt(iw/ih,16/9),trunc(ih*16/9/2)*2,trunc(iw/2)*2)'"
    ":'if(gt(iw/ih,16/9),trunc(ih/2)*2,trunc(iw*9/16/2)*2)'"
)

# Zeilenformat: Nummer "Prompt";"Zusatzinfo"  (Zusatzinfo optional)
LINE_RE = re.compile(r'^(\d+)\s*"(.*)"\s*;\s*(?:"(.*)")?\s*$')


def parse_lines(path):
    entries = []
    with open(path, "r", encoding="utf-8") as f:
        for line_no, raw_line in enumerate(f, start=1):
            line = raw_line.strip()
            if not line or line.startswith("#"):
                continue
            match = LINE_RE.match(line)
            if not match:
                print(f"Warnung: Zeile {line_no} entspricht nicht dem Format 'Nummer \"Prompt\";\"Zusatzinfo\"' und wird uebersprungen: {line!r}", file=sys.stderr)
                continue
            number_str, prompt, extra = match.groups()
            number = int(number_str)
            entries.append((number, prompt, extra or ""))
    return entries


def content_hash(prompt, extra, model):
    payload = f"{prompt}\x1f{extra}\x1f{model}\x1f{ASPECT_RATIO}".encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


def load_manifest(output_dir):
    path = os.path.join(output_dir, MANIFEST_FILENAME)
    if not os.path.exists(path):
        return {}
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def save_manifest(output_dir, manifest):
    path = os.path.join(output_dir, MANIFEST_FILENAME)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2, sort_keys=True)


def image_to_jpeg(image_bytes, out_path):
    result = subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-i", "pipe:0", "-vf", CROP_16_9, "-q:v", "3", "-f", "mjpeg", out_path],
        input=image_bytes,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg fehlgeschlagen: {result.stderr.decode(errors='replace')}")


def synthesize(client, model, prompt, extra):
    response = client.models.generate_content(
        model=model,
        contents=prompt,
        config=types.GenerateContentConfig(
            response_modalities=["IMAGE"],
            system_instruction=extra if extra else None,
            image_config=types.ImageConfig(aspect_ratio=ASPECT_RATIO),
        ),
    )
    candidate = response.candidates[0]
    if candidate.content is None:
        raise RuntimeError(f"Keine Antwort erhalten (finish_reason={candidate.finish_reason}).")
    for part in candidate.content.parts:
        if part.inline_data is not None:
            return part.inline_data.data
    raise RuntimeError(f"Antwort enthielt kein Bild (finish_reason={candidate.finish_reason}).")


def is_up_to_date(manifest, output_dir, number, prompt, extra, model):
    key = f"{number:05d}"
    out_path = os.path.join(output_dir, f"pic_{key}.jpg")
    return manifest.get(key) == content_hash(prompt, extra, model) and os.path.exists(out_path)


def story_jobs():
    """Exportiert alle Geschichten und liefert je Geschichte einen Auftrag
    (titel, [(nummer, prompt, masterprompt)], pictures-ordner)."""
    import export_pics  # erst hier: wird nur im Geschichten-Modus gebraucht

    jobs = []
    for folder in story_folders():
        story = load_story(folder)
        if story is None:
            continue
        jobs.append((story["header"].get("title") or folder.name, export_pics.export_story(folder), folder.pictures_dir))
    return jobs


def ask(prompt):
    try:
        return input(prompt).strip()
    except EOFError:
        return ""


def choose_jobs(jobs, preset, pending_count):
    """Liefert die gewaehlten Auftraege oder None bei Abbruch."""
    illustrated = [job for job in jobs if job[1]]
    if not illustrated:
        sys.exit("Keine Geschichte enthaelt Bild-Prompts. Im Editor bei einem Element unter "
                 "'Bilder' ein Standardbild beschreiben und speichern.")

    if preset:
        if preset.lower() in ("alle", "all"):
            return illustrated
        chosen = [job for job in illustrated if Path(job[2]).parent.name == preset]
        if chosen:
            return chosen
        known = ", ".join(Path(job[2]).parent.name for job in illustrated)
        sys.exit(f"Unbekannte oder bildlose Geschichte '{preset}'. Moeglich: {known}, alle")

    print("Welche Geschichte soll illustriert werden?")
    for i, job in enumerate(illustrated, start=1):
        print(f"  {i}) {job[0]} [{Path(job[2]).parent.name}] - {len(job[1])} Bild(er), davon {pending_count(job)} neu oder geaendert")
    if len(illustrated) > 1:
        total = sum(len(job[1]) for job in illustrated)
        print(f"  a) Alle Geschichten - {total} Bild(er), davon {sum(pending_count(j) for j in illustrated)} neu oder geaendert")
    choice = ask("Auswahl (Nummer, a = alle, Enter = Abbruch): ").lower()
    if not choice:
        return None
    if choice in ("a", "alle") and len(illustrated) > 1:
        return illustrated
    if choice.isdigit() and 1 <= int(choice) <= len(illustrated):
        return [illustrated[int(choice) - 1]]
    sys.exit(f"Ungueltige Auswahl: {choice!r}")


def generate(entries, output_dir, model, force, client):
    os.makedirs(output_dir, exist_ok=True)
    manifest = {} if force else load_manifest(output_dir)
    made = failed = skipped = 0
    for number, prompt, extra in entries:
        key = f"{number:05d}"
        out_path = os.path.join(output_dir, f"pic_{key}.jpg")
        if not force and is_up_to_date(manifest, output_dir, number, prompt, extra, model):
            skipped += 1
            continue

        print(f"[pic_{key}] Prompt={prompt[:60]!r}")
        try:
            image_bytes = synthesize(client, model, prompt, extra)
            image_to_jpeg(image_bytes, out_path)
            manifest[key] = content_hash(prompt, extra, model)
            save_manifest(output_dir, manifest)
            made += 1
        except Exception as exc:
            print(f"  Fehler bei Bild {key}: {exc}", file=sys.stderr)
            failed += 1
    print(f"Fertig ({output_dir}): {made} erzeugt, {skipped} unveraendert, {failed} fehlgeschlagen.")
    return made


def main():
    parser = argparse.ArgumentParser(description="Erzeugt Bilder via Gemini Bildgenerierung (Standard: Auswahl einer Geschichte).")
    parser.add_argument("--story", help="Name der Geschichte (Ordnername unter Stories/) oder 'alle' statt der Auswahl im Terminal")
    parser.add_argument("--input", help="Klassischer Modus: Eingabe-Textdatei im Format Nummer \"Prompt\";\"Zusatzinfo\" (braucht --output-dir)")
    parser.add_argument("--output-dir", help="Nur mit --input: Zielordner fuer die Bilder")
    parser.add_argument("--model", default=DEFAULT_MODEL, help=f"Gemini Bildmodell (default: {DEFAULT_MODEL})")
    parser.add_argument("--force", action="store_true", help="Ignoriert das Manifest und generiert alle Bilder neu")
    parser.add_argument("--yes", "-y", action="store_true", help="Keine Rueckfrage vor dem Erzeugen")
    parser.add_argument("--dry-run", action="store_true", help="Nur anzeigen, was erzeugt wuerde - keine API-Aufrufe")
    args = parser.parse_args()

    load_dotenv(ROOT_DIR / ".env")
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key and not args.dry_run:
        sys.exit("Fehler: GEMINI_API_KEY ist nicht gesetzt. Lege eine .env an (Vorlage: .env.example).")

    def pending(job):
        _label, entries, output_dir = job
        manifest = {} if args.force else load_manifest(output_dir)
        return [e for e in entries if args.force or not is_up_to_date(manifest, output_dir, *e, args.model)]

    if args.input:
        if not args.output_dir:
            sys.exit("Mit --input bitte auch --output-dir angeben.")
        entries = parse_lines(args.input)
        if not entries:
            sys.exit(f"Keine verwendbaren Zeilen in {args.input} gefunden.")
        jobs = [(args.input, entries, args.output_dir)]
    else:
        jobs = choose_jobs(story_jobs(), args.story, lambda job: len(pending(job)))
        if jobs is None:
            print("Abgebrochen.")
            return

    todo = [(job, pending(job)) for job in jobs]
    total = sum(len(t) for _, t in todo)
    for (label, entries, _dir), t in todo:
        print(f"{label}: {len(entries)} Bild(er), davon {len(t)} zu erzeugen.")
    if not total:
        print("Alle Bilder sind aktuell - nichts zu tun.")
        return
    if args.dry_run:
        for _job, t in todo:
            for number, prompt, _extra in t:
                print(f"  pic_{number:05d}: {prompt[:70]}")
        print("Probelauf - es wurde nichts erzeugt.")
        return
    if not args.yes:
        answer = ask(f"{total} Bild(er) jetzt erzeugen? Das kostet API-Aufrufe. [j/N] ").lower()
        if answer not in ("j", "ja", "y", "yes"):
            print("Abgebrochen.")
            return

    client = genai.Client(api_key=api_key)
    made = sum(generate(entries, output_dir, args.model, args.force, client) for _label, entries, output_dir in jobs)
    if made:
        print("Im Spiel die Seite neu laden (Strg+F5), dann erscheinen die Bilder.")


if __name__ == "__main__":
    main()
