# SpeechGenerator

Python-Tool: liest `input_vocs.txt` bzw. `input_pics.txt` zeilenweise und erzeugt pro Zeile ein mp3-Sprachsample (Gemini TTS) bzw. ein Bild (Gemini Bildgenerierung).

## Kernkomponenten

### Sprachsamples

- [generate_samples.py](generate_samples.py) — Liest Zeilen, ruft Gemini TTS auf, konvertiert das zurückgegebene rohe PCM-Audio (24kHz, 16-bit, mono) in WAV und dann per `ffmpeg`-Subprocess nach mp3.
- [input_vocs.txt](input_vocs.txt) — Eingabedatei. Format pro Zeile: `Nummer "Text";Sprecher` (per `LINE_RE` geparst). `Nummer` ist 5-stellig und bestimmt direkt den Ausgabedateinamen. `Sprecher` ist optional und einer von `male1`/`male2`/`female1`/`female2` (Mapping auf echte Gemini-Stimmen in `SPEAKER_VOICES`); ohne Sprecher greift die Standardstimme (`--voice`). Zeilen mit `#` oder leere Zeilen werden ignoriert; Zeilen, die nicht dem Format entsprechen, werden übersprungen (Warnung auf stderr).
- Output landet in `output_vocs/sample_00001.mp3`, `sample_00002.mp3`, ... (Nummer aus `input_vocs.txt`, kein git-Tracking).
- Standardsprecher ist `male1` (`DEFAULT_SPEAKER`), aufgelöst über `SPEAKER_VOICES` zu `Puck`.
- Modell-Default: `gemini-2.5-flash-preview-tts`.

### Bilder

- [generate_pictures.py](generate_pictures.py) — Liest Zeilen, ruft Gemini Bildgenerierung (`generate_content`, `response_modalities=["IMAGE"]`) auf und speichert das Ergebnis per `ffmpeg`-Subprocess als JPEG.
- [input_pics.txt](input_pics.txt) — Eingabedatei. Format pro Zeile: `Nummer "Prompt";"Zusatzinfo"` (per `LINE_RE` in `generate_pictures.py` geparst). `Zusatzinfo` ist optional, frei formulierbar und wird als `system_instruction` (nicht als Teil des Prompts) an das Modell übergeben. Zeilen mit `#` oder leere Zeilen werden ignoriert.
- Output landet in `output_pics/pic_00001.jpg`, `pic_00002.jpg`, ... (Nummer aus `input_pics.txt`, kein git-Tracking).
- Modell-Default: `gemini-2.5-flash-image`.

### Gemeinsam (beide Scripts)

- **Manifest / Change-Detection**: `<output-dir>/.manifest.json` speichert pro Sample-/Bild-Nummer einen Hash der Eingabefelder (`content_hash()`). Stimmt der Hash beim nächsten Lauf überein und existiert die Ausgabedatei noch, wird der Eintrag übersprungen — spart API-Calls bei unveränderten Zeilen. `--force` ignoriert das Manifest und generiert alles neu.

## Wichtige Entscheidungen / Constraints

- **Kein pydub**: `pydub` ist unter Python 3.14 kaputt, weil das `audioop`-Modul aus der Standardbibliothek entfernt wurde. Deshalb läuft jede Audio-/Bild-Konvertierung direkt über einen `ffmpeg`-Subprocess-Aufruf (siehe `wav_to_mp3()` bzw. `image_to_jpeg()`). Nicht wieder auf pydub oder Pillow umstellen, ohne das zu berücksichtigen.
- `ffmpeg` muss separat installiert und im PATH sein (auf diesem Rechner via `winget install Gyan.FFmpeg` erledigt).
- API-Key liegt in `.env` (`GEMINI_API_KEY=...`), wird über `python-dotenv` geladen. `.env` ist in `.gitignore`, nie einen echten Key committen.

## Setup

```
pip install -r requirements.txt
```
ffmpeg muss zusätzlich systemweit installiert sein.

## Ausführen

```
python generate_samples.py [--input input_vocs.txt] [--output-dir output_vocs] [--voice Puck] [--model gemini-2.5-flash-preview-tts]
python generate_pictures.py [--input input_pics.txt] [--output-dir output_pics] [--model gemini-2.5-flash-image]
```
