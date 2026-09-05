# SpeechGenerator

Liest `input_vocs.txt` zeilenweise und erzeugt für jede Zeile ein mp3-Sample über die Gemini TTS API. Liest `input_pics.txt` zeilenweise und erzeugt für jede Zeile ein Bild über die Gemini Bildgenerierung.

## Setup

1. Python-Abhängigkeiten installieren:
   ```
   pip install -r requirements.txt
   ```
2. [ffmpeg](https://ffmpeg.org/download.html) installieren und sicherstellen, dass es im `PATH` liegt (wird für die mp3-Kodierung per Subprocess benötigt).
3. `.env.example` nach `.env` kopieren und den eigenen Gemini API-Key eintragen:
   ```
   cp .env.example .env
   ```

## Eingabeformat (`input_vocs.txt`)

- Eine Zeile = ein Sample, Format: `Nummer "Text";Sprecher`
- `Nummer`: 5-stellig (z. B. `00001`), bestimmt den Dateinamen des Samples.
- `Text`: in Anführungszeichen.
- `Sprecher` (optional, nach dem Semikolon): `male1`, `male2`, `female1`, `female2` oder `standard`
  (Platzhalter-Sprecher, aktuell identisch zu `male1`, gedacht fuer Elemente, die noch keine
  eigene Stimme zugewiesen bekommen sollen). Zuordnung zu tatsaechlichen Gemini-Stimmen siehe
  `SPEAKER_VOICES` in `generate_samples.py`.
  Ohne Sprecher wird die Standardstimme verwendet (`--voice`, Default entspricht Sprecher `male1`).
- Zeilen, die mit `#` beginnen, oder leere Zeilen werden ignoriert.

Beispiel:

```
00001 "Hallo und herzlich willkommen zu diesem Sprachsample.";female1
00002 "Das hier verwendet die Standardstimme.";
```

## Ausführen

```
python generate_samples.py
```

Optionen:

```
python generate_samples.py --input input_vocs.txt --output-dir output_vocs --voice Puck --model gemini-2.5-flash-preview-tts
```

Die Ergebnisse landen als `output_vocs/sample_00001.mp3`, `output_vocs/sample_00002.mp3`, usw. (Nummer aus `input_vocs.txt`).

Bereits generierte Samples werden übersprungen, solange sich Text/Sprecher/Modell nicht geändert haben (siehe `output_vocs/.manifest.json`). Mit `--force` werden alle Samples neu generiert.

## Eingabeformat (`input_pics.txt`)

- Eine Zeile = ein Bild, Format: `Nummer "Prompt";"Zusatzinfo"`
- `Nummer`: 5-stellig, bestimmt den Dateinamen des Bildes.
- `Prompt`: Bildbeschreibung in Anführungszeichen.
- `Zusatzinfo` (optional, nach dem Semikolon, in Anführungszeichen): zusätzlicher System-Prompt/Kontext für die Bildgenerierung.
- Zeilen, die mit `#` beginnen, oder leere Zeilen werden ignoriert.

Beispiel:

```
00001 "Ein ruhiger Bergsee bei Sonnenaufgang.";"Fotorealistisch, warmes Licht."
00002 "Ein gemütliches Wohnzimmer mit Kamin.";
```

### Ausführen

```
python generate_pictures.py
```

Optionen:

```
python generate_pictures.py --input input_pics.txt --output-dir output_pics --model gemini-2.5-flash-image
```

Die Ergebnisse landen als `output_pics/pic_00001.jpg`, `output_pics/pic_00002.jpg`, usw. Bereits generierte Bilder werden übersprungen, solange sich Prompt/Zusatzinfo/Modell nicht geändert haben (siehe `output_pics/.manifest.json`). Mit `--force` werden alle Bilder neu generiert.
