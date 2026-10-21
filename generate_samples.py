"""Erzeugt mp3-Sprachsamples via Gemini TTS.

Standard (ohne --input): fragt, welche Geschichte aus Stories/*.yaml vertont werden soll,
exportiert vorher automatisch alle vorlesbaren Texte (wie export_vocs.py: input_vocs.txt +
.vocs_index.json) und erzeugt dann nur die Samples dieser Geschichte. Unveraenderte Samples
werden uebersprungen (Manifest), vor den API-Aufrufen wird nachgefragt.

    python generate_samples.py                      # Auswahl im Terminal
    python generate_samples.py --story cursed_mill  # ohne Rueckfrage nach der Geschichte
    python generate_samples.py --story alle --yes   # alles, ohne jede Rueckfrage
    python generate_samples.py --dry-run            # nur anzeigen, was erzeugt wuerde

Klassisch: --input datei.txt liest Zeilen im Format  Nummer "Text";Sprecher.

Sprecher (Kuerzel wie male1/female2) und ihre Gemini-Stimmen stehen in vocs_fields.SPEAKERS.
"""

import argparse
import hashlib
import io
import json
import os
import re
import subprocess
import sys
import time
import wave
from pathlib import Path

from dotenv import load_dotenv
from google import genai
from google.genai import errors as genai_errors
from google.genai import types

from vocs_fields import DEFAULT_SPEAKER, SPEAKERS

ROOT_DIR = Path(__file__).resolve().parent

MAX_RETRIES = 4
RETRY_BASE_DELAY_SECONDS = 2
# Serverseitige Fehler, bei denen ein Retry sinnvoll ist (Google-Ausfaelle/Ueberlastung).
RETRYABLE_STATUS_CODES = {429, 500, 503}

DEFAULT_MODEL = "gemini-2.5-flash-preview-tts"

MANIFEST_FILENAME = ".manifest.json"

# Zuordnung der Sprecher-Kuerzel (Story-Datei / input_vocs.txt) zu Gemini-Stimmen.
SPEAKER_VOICES = {key: voice for key, _label, voice in SPEAKERS}
DEFAULT_VOICE = SPEAKER_VOICES[DEFAULT_SPEAKER]

# Sprechtempo: Originalgeschwindigkeit von Gemini - keine Stilanweisung, keine
# Beschleunigung (vom Autor so gewuenscht, 2026-10-21). Hinweis fuer spaetere Versuche:
# Eine system_instruction beantwortet das TTS-Modell mit 500 INTERNAL.

# Zeilenformat: Nummer "Text";Sprecher  (Sprecher optional)
LINE_RE = re.compile(r'^(\d+)\s*"(.*)"\s*;\s*(\w*)\s*$')

PCM_SAMPLE_RATE = 24000
PCM_SAMPLE_WIDTH = 2  # 16 bit
PCM_CHANNELS = 1


def voice_for_speaker(speaker, default_voice, context=""):
    speaker = (speaker or "").strip().lower()
    if not speaker:
        return default_voice
    voice = SPEAKER_VOICES.get(speaker)
    if voice is None:
        print(f"Warnung: {context}unbekannter Sprecher {speaker!r}, verwende Standardstimme.", file=sys.stderr)
        return default_voice
    return voice


def parse_lines(path, default_voice):
    entries = []
    with open(path, "r", encoding="utf-8") as f:
        for line_no, raw_line in enumerate(f, start=1):
            line = raw_line.strip()
            if not line or line.startswith("#"):
                continue
            match = LINE_RE.match(line)
            if not match:
                print(f"Warnung: Zeile {line_no} entspricht nicht dem Format 'Nummer \"Text\";Sprecher' und wird uebersprungen: {line!r}", file=sys.stderr)
                continue
            number_str, text, speaker = match.groups()
            entries.append((int(number_str), voice_for_speaker(speaker, default_voice, f"Zeile {line_no}: "), text))
    return entries


def content_hash(text, voice, model):
    payload = f"{text}\x1f{voice}\x1f{model}".encode("utf-8")
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


def pcm_to_wav_bytes(pcm_data):
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as wav_file:
        wav_file.setnchannels(PCM_CHANNELS)
        wav_file.setsampwidth(PCM_SAMPLE_WIDTH)
        wav_file.setframerate(PCM_SAMPLE_RATE)
        wav_file.writeframes(pcm_data)
    return buffer.getvalue()


def wav_to_mp3(wav_bytes, out_path):
    result = subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-i", "pipe:0", "-f", "mp3", out_path],
        input=wav_bytes,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg fehlgeschlagen: {result.stderr.decode(errors='replace')}")


def synthesize(client, model, voice, text):
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            response = client.models.generate_content(
                model=model,
                contents=text,
                config=types.GenerateContentConfig(
                    response_modalities=["AUDIO"],
                    speech_config=types.SpeechConfig(
                        voice_config=types.VoiceConfig(
                            prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name=voice)
                        )
                    ),
                ),
            )
            return response.candidates[0].content.parts[0].inline_data.data
        except genai_errors.APIError as exc:
            code = getattr(exc, "code", None)
            if code not in RETRYABLE_STATUS_CODES or attempt == MAX_RETRIES:
                raise
            delay = RETRY_BASE_DELAY_SECONDS * (2 ** (attempt - 1))
            print(f"  Serverfehler ({code}), Versuch {attempt}/{MAX_RETRIES} fehlgeschlagen, warte {delay}s...", file=sys.stderr)
            time.sleep(delay)


def is_up_to_date(manifest, output_dir, number, voice, text, model):
    key = f"{number:05d}"
    out_path = os.path.join(output_dir, f"sample_{key}.mp3")
    return manifest.get(key) == content_hash(text, voice, model) and os.path.exists(out_path)


def export_story_entries(stories_dir, default_voice):
    """Exportiert alle vorlesbaren Texte (input_vocs.txt, .vocs_index.json) und liefert pro
    Geschichte (id, titel, [(nummer, stimme, text)]). Die Nummern muessen fuer alle
    Geschichten gemeinsam vergeben werden, darum wird immer komplett exportiert."""
    import export_vocs  # erst hier: wird nur im Geschichten-Modus gebraucht

    stories = export_vocs.load_stories(stories_dir)
    entries = export_vocs.collect_entries(stories)
    index_path = ROOT_DIR / ".vocs_index.json"
    index = export_vocs.load_index(index_path)
    assigned = export_vocs.assign_numbers(entries, index)
    if entries:
        export_vocs.save_index(index_path, index)
        export_vocs.write_input_vocs(ROOT_DIR / "input_vocs.txt", entries, assigned)

    per_story = []
    for story in stories:
        story_id = story["header"]["id"]
        own = [
            (assigned[key], voice_for_speaker(speaker, default_voice, f"{key}: "), text)
            for key, text, speaker in entries
            if key.startswith(story_id + ":")
        ]
        per_story.append((story_id, story["header"].get("title") or story_id, own))
    return per_story, set(assigned.values())


SAMPLE_FILE_RE = re.compile(r"^sample_(\d+)\.mp3$")


def find_orphans(output_dir, needed_numbers):
    """mp3s, zu denen es in keiner Geschichte mehr einen zu sprechenden Text gibt."""
    orphans = []
    for name in sorted(os.listdir(output_dir)):
        match = SAMPLE_FILE_RE.match(name)
        if match and int(match.group(1)) not in needed_numbers:
            orphans.append(name)
    return orphans


def remove_orphans(output_dir, orphans):
    manifest = load_manifest(output_dir)
    for name in orphans:
        os.remove(os.path.join(output_dir, name))
        manifest.pop(SAMPLE_FILE_RE.match(name).group(1), None)
    save_manifest(output_dir, manifest)
    print(f"Aufgeraeumt: {len(orphans)} nicht mehr benoetigte Sprachdatei(en) geloescht.")


def ask(prompt):
    try:
        return input(prompt).strip()
    except EOFError:
        return ""


def choose_story(per_story, preset, pending_count):
    """Liefert (eintraege, beschriftung) oder (None, None) bei Abbruch."""
    narrated = [(sid, title, own) for sid, title, own in per_story if own]
    if not narrated:
        sys.exit("Keine Geschichte enthaelt vorlesbare Texte.")
    all_entries = [e for _, _, own in narrated for e in own]

    if preset:
        if preset.lower() in ("alle", "all"):
            return all_entries, "Alle Geschichten"
        for sid, title, own in narrated:
            if sid == preset:
                return own, title
        known = ", ".join(sid for sid, _, _ in narrated)
        sys.exit(f"Unbekannte Geschichte '{preset}'. Moeglich: {known}, alle")

    print("Welche Geschichte soll vertont werden?")
    for i, (sid, title, own) in enumerate(narrated, start=1):
        print(f"  {i}) {title} [{sid}] - {len(own)} Text(e), davon {pending_count(own)} neu oder geaendert")
    if len(narrated) > 1:
        print(f"  a) Alle Geschichten - {len(all_entries)} Text(e), davon {pending_count(all_entries)} neu oder geaendert")
    choice = ask("Auswahl (Nummer, a = alle, Enter = Abbruch): ").lower()
    if not choice:
        return None, None
    if choice in ("a", "alle") and len(narrated) > 1:
        return all_entries, "Alle Geschichten"
    if choice.isdigit() and 1 <= int(choice) <= len(narrated):
        _, title, own = narrated[int(choice) - 1]
        return own, title
    sys.exit(f"Ungueltige Auswahl: {choice!r}")


def generate(entries, output_dir, model, force, client):
    manifest = {} if force else load_manifest(output_dir)
    made = failed = skipped = 0
    for number, voice, text in entries:
        key = f"{number:05d}"
        out_path = os.path.join(output_dir, f"sample_{key}.mp3")
        if not force and is_up_to_date(manifest, output_dir, number, voice, text, model):
            print(f"[sample_{key}] unveraendert, ueberspringe")
            skipped += 1
            continue

        print(f"[sample_{key}] Stimme={voice!r} Text={text[:60]!r} -> {out_path}")
        try:
            pcm_data = synthesize(client, model, voice, text)
            wav_to_mp3(pcm_to_wav_bytes(pcm_data), out_path)
            manifest[key] = content_hash(text, voice, model)
            save_manifest(output_dir, manifest)
            made += 1
        except Exception as exc:
            print(f"  Fehler bei Sample {key}: {exc}", file=sys.stderr)
            failed += 1
    print(f"Fertig: {made} erzeugt, {skipped} unveraendert, {failed} fehlgeschlagen.")
    if made:
        print("Im Spiel die Seite neu laden (Strg+F5) und 'Vorlesen' einschalten.")


def main():
    parser = argparse.ArgumentParser(description="Erzeugt mp3-Sprachsamples via Gemini TTS (Standard: Auswahl einer Geschichte).")
    parser.add_argument("--story", help="ID der Geschichte (oder 'alle') statt der Auswahl im Terminal")
    parser.add_argument("--input", help="Klassischer Modus: Eingabe-Textdatei im Format Nummer \"Text\";Sprecher")
    parser.add_argument("--stories-dir", default=str(ROOT_DIR / "Stories"), help="Ordner mit den Story-Dateien")
    parser.add_argument("--output-dir", default=str(ROOT_DIR / "output_vocs"), help="Zielordner fuer die mp3-Dateien (default: output_vocs)")
    parser.add_argument("--voice", default=DEFAULT_VOICE, help=f"Gemini-Stimme fuer Texte ohne Sprecher (default: {DEFAULT_VOICE})")
    parser.add_argument("--model", default=DEFAULT_MODEL, help=f"Gemini TTS Modell (default: {DEFAULT_MODEL})")
    parser.add_argument("--force", action="store_true", help="Ignoriert das Manifest und generiert alle Samples neu")
    parser.add_argument("--yes", "-y", action="store_true", help="Keine Rueckfrage vor dem Erzeugen")
    parser.add_argument("--dry-run", action="store_true", help="Nur anzeigen, was erzeugt wuerde - keine API-Aufrufe")
    args = parser.parse_args()

    load_dotenv(ROOT_DIR / ".env")
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key and not args.dry_run:
        sys.exit("Fehler: GEMINI_API_KEY ist nicht gesetzt. Lege eine .env an (Vorlage: .env.example).")

    os.makedirs(args.output_dir, exist_ok=True)
    manifest = {} if args.force else load_manifest(args.output_dir)

    def pending(entries):
        return [e for e in entries if args.force or not is_up_to_date(manifest, args.output_dir, *e, args.model)]

    orphans = []
    if args.input:
        entries = parse_lines(args.input, args.voice)
        if not entries:
            sys.exit(f"Keine verwendbaren Zeilen in {args.input} gefunden.")
        label = args.input
    else:
        per_story, needed_numbers = export_story_entries(Path(args.stories_dir), args.voice)
        entries, label = choose_story(per_story, args.story, lambda e: len(pending(e)))
        if entries is None:
            print("Abgebrochen.")
            return
        # Aufraeumen nur im Geschichten-Modus: Dort ist bekannt, welche Nummern ueber ALLE
        # Geschichten hinweg noch gebraucht werden.
        orphans = find_orphans(args.output_dir, needed_numbers)
        if orphans and args.dry_run:
            print(f"Probelauf: {len(orphans)} nicht mehr benoetigte Sprachdatei(en) wuerden geloescht.")
        elif orphans:
            remove_orphans(args.output_dir, orphans)

    todo = pending(entries)
    print(f"{label}: {len(entries)} Text(e), davon {len(todo)} zu vertonen.")
    if not todo:
        print("Alle Samples sind aktuell - nichts zu tun.")
        return
    if args.dry_run:
        for number, voice, text in todo:
            print(f"  sample_{number:05d} [{voice}]: {text[:70]}")
        print("Probelauf - es wurde nichts erzeugt.")
        return
    if not args.yes:
        answer = ask(f"{len(todo)} Sample(s) jetzt erzeugen? Das kostet API-Aufrufe. [j/N] ").lower()
        if answer not in ("j", "ja", "y", "yes"):
            print("Abgebrochen.")
            return

    generate(entries, args.output_dir, args.model, args.force, genai.Client(api_key=api_key))


if __name__ == "__main__":
    main()
