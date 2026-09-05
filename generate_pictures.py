"""Liest eine Textdatei zeilenweise und erzeugt pro Zeile ein Bild via Gemini Bildgenerierung."""

import argparse
import hashlib
import json
import os
import re
import subprocess
import sys

from dotenv import load_dotenv
from google import genai
from google.genai import types

DEFAULT_MODEL = "gemini-2.5-flash-image"

MANIFEST_FILENAME = ".manifest.json"

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
    payload = f"{prompt}\x1f{extra}\x1f{model}".encode("utf-8")
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
        ["ffmpeg", "-y", "-loglevel", "error", "-i", "pipe:0", "-f", "mjpeg", out_path],
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
        ),
    )
    candidate = response.candidates[0]
    if candidate.content is None:
        raise RuntimeError(f"Keine Antwort erhalten (finish_reason={candidate.finish_reason}).")
    for part in candidate.content.parts:
        if part.inline_data is not None:
            return part.inline_data.data
    raise RuntimeError(f"Antwort enthielt kein Bild (finish_reason={candidate.finish_reason}).")


def main():
    parser = argparse.ArgumentParser(description="Erzeugt Bilder aus einer Textdatei via Gemini Bildgenerierung.")
    parser.add_argument("--input", default="input_pics.txt", help="Pfad zur Eingabe-Textdatei (default: input_pics.txt)")
    parser.add_argument("--output-dir", default="output_pics", help="Zielordner fuer die Bilder (default: output_pics)")
    parser.add_argument("--model", default=DEFAULT_MODEL, help=f"Gemini Bildmodell (default: {DEFAULT_MODEL})")
    parser.add_argument("--force", action="store_true", help="Ignoriert das Manifest und generiert alle Bilder neu")
    args = parser.parse_args()

    load_dotenv()
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        sys.exit("Fehler: Umgebungsvariable GEMINI_API_KEY ist nicht gesetzt (siehe .env.example).")

    entries = parse_lines(args.input)
    if not entries:
        sys.exit(f"Keine verwendbaren Zeilen in {args.input} gefunden.")

    os.makedirs(args.output_dir, exist_ok=True)
    manifest = {} if args.force else load_manifest(args.output_dir)
    client = genai.Client(api_key=api_key)

    for number, prompt, extra in entries:
        key = f"{number:05d}"
        out_path = os.path.join(args.output_dir, f"pic_{key}.jpg")
        current_hash = content_hash(prompt, extra, args.model)

        if not args.force and manifest.get(key) == current_hash and os.path.exists(out_path):
            print(f"[pic_{key}] unveraendert, ueberspringe")
            continue

        print(f"[pic_{key}] Prompt={prompt[:60]!r} -> {out_path}")
        try:
            image_bytes = synthesize(client, args.model, prompt, extra)
            image_to_jpeg(image_bytes, out_path)
            manifest[key] = current_hash
            save_manifest(args.output_dir, manifest)
        except Exception as exc:
            print(f"  Fehler bei Bild {key}: {exc}", file=sys.stderr)

    print("Fertig.")


if __name__ == "__main__":
    main()
