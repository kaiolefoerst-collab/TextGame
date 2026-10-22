# StoryGame

Ein elementbasiertes Erzählspiel mit grafischem Editor. Ein lokaler Python-Server liefert ein Web-Frontend aus. Dort spielt man Geschichten, die als YAML-Dateien unter `Stories/` liegen, und bearbeitet sie im Editor. Gemini-Skripte erzeugen aus den Texten Sprachaufnahmen und Bilder.

Enthaltene Geschichten:

- **Die verfluchte Mühle**: Ein Dorf im Nebel, aus dem kein Weg hinausführt, und eine Flut, die vor vierzig Jahren anders geschah, als der Gedenkstein behauptet.
- **Space Trace**: Ein Pilot mit leerem Tank entdeckt im äußeren Sonnensystem ein verschollenes Kolonieschiff.

## Einrichten

1. Python-Abhängigkeiten installieren (am besten in einer virtuellen Umgebung):
   ```
   python3 -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   ```
2. [ffmpeg](https://ffmpeg.org/download.html) installieren und in den `PATH` legen. Es wird für mp3 und JPEG gebraucht.
3. Nur für Sprache und Bilder: eine Datei `.env` mit dem eigenen Gemini-API-Key anlegen:
   ```
   GEMINI_API_KEY=dein-key
   ```
   Die `.env` steht in `.gitignore` und wird nie committet.

## Spielen und bearbeiten

```
python game.py [--port 8000] [--no-browser]
```

Öffnet http://127.0.0.1:8000/. Auf der Startseite wählt man eine Geschichte oder öffnet mit „🛠 Editor“ den Editor.

- Der Server liest die Geschichten nur beim Start. Nach einer Änderung an einer YAML-Datei muss er neu gestartet werden.
- Änderungen an `web/*` brauchen nur einen Browser-Reload (Strg+F5).
- Es gibt noch keinen Spielstand: Wer eine Geschichte verlässt, beginnt beim nächsten Mal von vorn.

## Sprache und Bilder erzeugen

Beide Skripte fragen nach der Geschichte, exportieren die Texte bzw. Bild-Prompts selbst und fragen vor den (kostenpflichtigen) API-Aufrufen nach. Unveränderte Dateien werden übersprungen.

```
python generate_samples.py  [--story <Name>|alle] [--dry-run] [--yes] [--force]
python generate_pictures.py [--story <Name>|alle] [--dry-run] [--yes] [--force]
```

- `--dry-run` zeigt nur an, was erzeugt würde.
- `--force` erzeugt alles neu.
- Ergebnis: `Stories/<Name>/samples/sample_NNNNN.mp3` bzw. `Stories/<Name>/pictures/pic_NNNNN.jpg`.
- Die Dateien `samples_index.json` und `pictures_index.json` ordnen jedem Text bzw. Bild seine feste Nummer zu. Sie dürfen nicht von Hand zurückgesetzt werden.

## Weitere Dokumentation

- [CLAUDE.md](CLAUDE.md): Architektur, Story-Format, Editor- und Medien-Konventionen (für Entwickler und KI-Assistenten)
- [Game-Description/](Game-Description/): Spielkonzept und Autorenregeln für neue Geschichten
