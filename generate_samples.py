"""Erzeugt mp3-Sprachsamples via Gemini TTS.

Standard (ohne --input): fragt, welche Geschichte (Ordner unter Stories/) vertont werden soll,
exportiert vorher automatisch ihre zu sprechenden Texte (wie export_vocs.py) und legt die
Sprachdateien in Stories/<Name>/samples/ ab. Unveraenderte Samples werden uebersprungen
(Manifest), mp3s ohne zugehoerigen Text werden aufgeraeumt, vor den API-Aufrufen wird
nachgefragt.

    python generate_samples.py                      # Auswahl im Terminal
    python generate_samples.py --story cursed_mill  # ohne Rueckfrage nach der Geschichte
    python generate_samples.py --story alle --yes   # alles, ohne jede Rueckfrage
    python generate_samples.py --dry-run            # nur anzeigen, was erzeugt wuerde

Klassisch: --input datei.txt --output-dir ordner  liest Zeilen im Format  Nummer "Text";Sprecher.

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

from story_files import load_story, story_folders
from vocs_fields import DEFAULT_SPEAKER, SPEAKERS

ROOT_DIR = Path(__file__).resolve().parent

MAX_RETRIES = 4
RETRY_BASE_DELAY_SECONDS = 2
# Serverseitige Fehler, bei denen ein Retry sinnvoll ist (Google-Ausfaelle/Ueberlastung).
RETRYABLE_STATUS_CODES = {429, 500, 503}

DEFAULT_MODEL = "gemini-2.5-flash-preview-tts"

MANIFEST_FILENAME = ".manifest.json"

# Zuordnung der Sprecher-Kuerzel (Story-Datei / samples_input.txt) zu Gemini-Stimmen.
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


def audio_from_response(response):
    """PCM-Daten aus der Gemini-Antwort, oder None, wenn die Antwort kein Audio enthaelt."""
    for candidate in response.candidates or []:
        for part in (candidate.content.parts or []) if candidate.content else []:
            if part.inline_data and part.inline_data.data:
                return part.inline_data.data
    return None


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
            audio = audio_from_response(response)
            if audio is not None:
                return audio
            # Das TTS-Modell liefert bei sehr kurzen Texten gelegentlich eine Antwort ohne Audio
            # (Kandidat ohne content). Ein neuer Versuch klappt meist.
            reason = response.candidates[0].finish_reason if response.candidates else "keine Kandidaten"
            if attempt == MAX_RETRIES:
                raise RuntimeError(f"Gemini lieferte kein Audio (finish_reason={reason}), {MAX_RETRIES} Versuche")
            print(f"  Kein Audio erhalten ({reason}), Versuch {attempt}/{MAX_RETRIES}, versuche es erneut...", file=sys.stderr)
            time.sleep(RETRY_BASE_DELAY_SECONDS)
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


def story_jobs(default_voice):
    """Exportiert alle Geschichten und liefert je Geschichte einen Auftrag
    (titel, [(nummer, stimme, text)], samples-ordner)."""
    import export_vocs  # erst hier: wird nur im Geschichten-Modus gebraucht

    jobs = []
    for folder in story_folders():
        story = load_story(folder)
        if story is None:
            continue
        entries = [
            (number, voice_for_speaker(speaker, default_voice, f"{folder.name} {number:05d}: "), text)
            for number, text, speaker in export_vocs.export_story(folder)
        ]
        jobs.append((story["header"].get("title") or folder.name, entries, folder.samples_dir))
    return jobs


SAMPLE_FILE_RE = re.compile(r"^sample_(\d+)\.mp3$")


def find_orphans(output_dir, needed_numbers):
    """mp3s, zu denen es in dieser Geschichte keinen zu sprechenden Text mehr gibt."""
    if not os.path.isdir(output_dir):
        return []
    return [
        name for name in sorted(os.listdir(output_dir))
        if (m := SAMPLE_FILE_RE.match(name)) and int(m.group(1)) not in needed_numbers
    ]


def remove_orphans(output_dir, orphans):
    manifest = load_manifest(output_dir)
    for name in orphans:
        os.remove(os.path.join(output_dir, name))
        manifest.pop(SAMPLE_FILE_RE.match(name).group(1), None)
    save_manifest(output_dir, manifest)
    print(f"Aufgeraeumt: {len(orphans)} nicht mehr benoetigte Sprachdatei(en) in {output_dir} geloescht.")


def ask(prompt):
    try:
        return input(prompt).strip()
    except EOFError:
        return ""


def choose_jobs(jobs, preset, pending_count):
    """Liefert die gewaehlten Auftraege oder None bei Abbruch."""
    narrated = [job for job in jobs if job[1]]
    if not narrated:
        sys.exit("Keine Geschichte enthaelt vorlesbare Texte.")

    if preset:
        if preset.lower() in ("alle", "all"):
            return narrated
        chosen = [job for job in narrated if Path(job[2]).parent.name == preset]
        if chosen:
            return chosen
        known = ", ".join(Path(job[2]).parent.name for job in narrated)
        sys.exit(f"Unbekannte Geschichte '{preset}'. Moeglich: {known}, alle")

    print("Welche Geschichte soll vertont werden?")
    for i, job in enumerate(narrated, start=1):
        print(f"  {i}) {job[0]} [{Path(job[2]).parent.name}] - {len(job[1])} Text(e), davon {pending_count(job)} neu oder geaendert")
    if len(narrated) > 1:
        total = sum(len(job[1]) for job in narrated)
        print(f"  a) Alle Geschichten - {total} Text(e), davon {sum(pending_count(j) for j in narrated)} neu oder geaendert")
    choice = ask("Auswahl (Nummer, a = alle, Enter = Abbruch): ").lower()
    if not choice:
        return None
    if choice in ("a", "alle") and len(narrated) > 1:
        return narrated
    if choice.isdigit() and 1 <= int(choice) <= len(narrated):
        return [narrated[int(choice) - 1]]
    sys.exit(f"Ungueltige Auswahl: {choice!r}")


def generate(entries, output_dir, model, force, client):
    os.makedirs(output_dir, exist_ok=True)
    manifest = {} if force else load_manifest(output_dir)
    made = failed = skipped = 0
    for number, voice, text in entries:
        key = f"{number:05d}"
        out_path = os.path.join(output_dir, f"sample_{key}.mp3")
        if not force and is_up_to_date(manifest, output_dir, number, voice, text, model):
            skipped += 1
            continue

        print(f"[sample_{key}] Stimme={voice!r} Text={text[:60]!r}")
        try:
            pcm_data = synthesize(client, model, voice, text)
            wav_to_mp3(pcm_to_wav_bytes(pcm_data), out_path)
            manifest[key] = content_hash(text, voice, model)
            save_manifest(output_dir, manifest)
            made += 1
        except Exception as exc:
            print(f"  Fehler bei Sample {key}: {exc}", file=sys.stderr)
            failed += 1
    print(f"Fertig ({output_dir}): {made} erzeugt, {skipped} unveraendert, {failed} fehlgeschlagen.")
    return made


def main():
    parser = argparse.ArgumentParser(description="Erzeugt mp3-Sprachsamples via Gemini TTS (Standard: Auswahl einer Geschichte).")
    parser.add_argument("--story", help="Name der Geschichte (Ordnername unter Stories/) oder 'alle' statt der Auswahl im Terminal")
    parser.add_argument("--input", help="Klassischer Modus: Eingabe-Textdatei im Format Nummer \"Text\";Sprecher (braucht --output-dir)")
    parser.add_argument("--output-dir", help="Nur mit --input: Zielordner fuer die mp3-Dateien")
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

    def pending(job):
        _label, entries, output_dir = job
        manifest = {} if args.force else load_manifest(output_dir)
        return [e for e in entries if args.force or not is_up_to_date(manifest, output_dir, *e, args.model)]

    if args.input:
        if not args.output_dir:
            sys.exit("Mit --input bitte auch --output-dir angeben.")
        entries = parse_lines(args.input, args.voice)
        if not entries:
            sys.exit(f"Keine verwendbaren Zeilen in {args.input} gefunden.")
        jobs = [(args.input, entries, args.output_dir)]
    else:
        jobs = choose_jobs(story_jobs(args.voice), args.story, lambda job: len(pending(job)))
        if jobs is None:
            print("Abgebrochen.")
            return
        # Aufraeumen: mp3s ohne zugehoerigen Text in der jeweiligen Geschichte.
        for _label, entries, output_dir in jobs:
            orphans = find_orphans(output_dir, {number for number, _v, _t in entries})
            if orphans and args.dry_run:
                print(f"Probelauf: {len(orphans)} nicht mehr benoetigte Sprachdatei(en) in {output_dir} wuerden geloescht.")
            elif orphans:
                remove_orphans(output_dir, orphans)

    todo = [(job, pending(job)) for job in jobs]
    total = sum(len(t) for _, t in todo)
    for (label, entries, _dir), t in todo:
        print(f"{label}: {len(entries)} Text(e), davon {len(t)} zu vertonen.")
    if not total:
        print("Alle Samples sind aktuell - nichts zu tun.")
        return
    if args.dry_run:
        for _job, t in todo:
            for number, voice, text in t:
                print(f"  sample_{number:05d} [{voice}]: {text[:70]}")
        print("Probelauf - es wurde nichts erzeugt.")
        return
    if not args.yes:
        answer = ask(f"{total} Sample(s) jetzt erzeugen? Das kostet API-Aufrufe. [j/N] ").lower()
        if answer not in ("j", "ja", "y", "yes"):
            print("Abgebrochen.")
            return

    client = genai.Client(api_key=api_key)
    made = sum(generate(entries, output_dir, args.model, args.force, client) for _label, entries, output_dir in jobs)
    if made:
        print("Im Spiel die Seite neu laden (Strg+F5) und 'Vorlesen' einschalten.")


if __name__ == "__main__":
    main()
