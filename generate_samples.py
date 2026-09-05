"""Liest eine Textdatei zeilenweise und erzeugt pro Zeile ein mp3-Sample via Gemini TTS."""

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

from dotenv import load_dotenv
from google import genai
from google.genai import errors as genai_errors
from google.genai import types

MAX_RETRIES = 4
RETRY_BASE_DELAY_SECONDS = 2
# Serverseitige Fehler, bei denen ein Retry sinnvoll ist (Google-Ausfaelle/Ueberlastung).
RETRYABLE_STATUS_CODES = {429, 500, 503}

DEFAULT_MODEL = "gemini-2.5-flash-preview-tts"
DEFAULT_SPEAKER = "male1"

MANIFEST_FILENAME = ".manifest.json"

# Von Gemini TTS unterstützte Stimmennamen.
KNOWN_VOICES = {
    "zephyr", "puck", "charon", "kore", "fenrir", "leda", "orus", "aoede",
    "callirrhoe", "autonoe", "enceladus", "iapetus", "umbriel", "algieba",
    "despina", "erinome", "algenib", "rasalgethi", "laomedeia", "achernar",
    "alnilam", "schedar", "gacrux", "pulcherrima", "achird", "zubenelgenubi",
    "vindemiatrix", "sadachbia", "sadaltager", "sulafat",
}

# Zuordnung der Sprecher-Kuerzel aus input_vocs.txt zu tatsaechlichen Gemini-Stimmen.
SPEAKER_VOICES = {
    "male1": "Puck",
    "male2": "Fenrir",
    "female1": "Kore",
    "female2": "Leda",
}
# "standard" ist ein bewusster Platzhalter-Sprecher (aktuell identisch zu male1), solange
# alle Figuren einer Geschichte noch dieselbe Stimme teilen sollen.
SPEAKER_VOICES["standard"] = SPEAKER_VOICES["male1"]

DEFAULT_VOICE = SPEAKER_VOICES[DEFAULT_SPEAKER]

# Wird der TTS als Systemanweisung mitgegeben, um das Sprechtempo spuerbar zu erhoehen.
SPEED_SYSTEM_INSTRUCTION = (
    "Sprich das folgende ohne inhaltliche Aenderung etwa 30% schneller vor als in "
    "normalem, natuerlichem Erzaehltempo, ohne dabei die Verstaendlichkeit zu verlieren."
)

# Zeilenformat: Nummer "Text";Sprecher  (Sprecher optional)
LINE_RE = re.compile(r'^(\d+)\s*"(.*)"\s*;\s*(\w*)\s*$')

PCM_SAMPLE_RATE = 24000
PCM_SAMPLE_WIDTH = 2  # 16 bit
PCM_CHANNELS = 1


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
            number = int(number_str)
            speaker = speaker.strip().lower()
            if speaker:
                voice = SPEAKER_VOICES.get(speaker)
                if voice is None:
                    print(f"Warnung: Zeile {line_no} hat unbekannten Sprecher {speaker!r}, verwende Standardstimme.", file=sys.stderr)
                    voice = default_voice
            else:
                voice = default_voice
            entries.append((number, voice, text))
    return entries


def content_hash(text, voice, model):
    # SPEED_SYSTEM_INSTRUCTION ist Teil des Hashes, damit eine spaetere Anpassung des
    # Sprechtempos automatisch alle Samples per Manifest-Vergleich neu erzeugt.
    payload = f"{text}\x1f{voice}\x1f{model}\x1f{SPEED_SYSTEM_INSTRUCTION}".encode("utf-8")
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
                    system_instruction=SPEED_SYSTEM_INSTRUCTION,
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


def main():
    parser = argparse.ArgumentParser(description="Erzeugt mp3-Sprachsamples aus einer Textdatei via Gemini TTS.")
    parser.add_argument("--input", default="input_vocs.txt", help="Pfad zur Eingabe-Textdatei (default: input_vocs.txt)")
    parser.add_argument("--output-dir", default="output_vocs", help="Zielordner fuer die mp3-Dateien (default: output_vocs)")
    parser.add_argument("--voice", default=DEFAULT_VOICE, help=f"Standardstimme, falls Zeile keine angibt (default: {DEFAULT_VOICE}, entspricht Sprecher {DEFAULT_SPEAKER!r})")
    parser.add_argument("--model", default=DEFAULT_MODEL, help=f"Gemini TTS Modell (default: {DEFAULT_MODEL})")
    parser.add_argument("--force", action="store_true", help="Ignoriert das Manifest und generiert alle Samples neu")
    args = parser.parse_args()

    load_dotenv()
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        sys.exit("Fehler: Umgebungsvariable GEMINI_API_KEY ist nicht gesetzt (siehe .env.example).")

    entries = parse_lines(args.input, args.voice)
    if not entries:
        sys.exit(f"Keine verwendbaren Zeilen in {args.input} gefunden.")

    os.makedirs(args.output_dir, exist_ok=True)
    manifest = {} if args.force else load_manifest(args.output_dir)
    client = genai.Client(api_key=api_key)

    for number, voice, text in entries:
        key = f"{number:05d}"
        out_path = os.path.join(args.output_dir, f"sample_{key}.mp3")
        current_hash = content_hash(text, voice, args.model)

        if not args.force and manifest.get(key) == current_hash and os.path.exists(out_path):
            print(f"[sample_{key}] unveraendert, ueberspringe")
            continue

        print(f"[sample_{key}] Stimme={voice!r} Text={text[:60]!r} -> {out_path}")
        try:
            pcm_data = synthesize(client, args.model, voice, text)
            wav_bytes = pcm_to_wav_bytes(pcm_data)
            wav_to_mp3(wav_bytes, out_path)
            manifest[key] = current_hash
            save_manifest(args.output_dir, manifest)
        except Exception as exc:
            print(f"  Fehler bei Sample {key}: {exc}", file=sys.stderr)

    print("Fertig.")


if __name__ == "__main__":
    main()
