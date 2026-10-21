# StoryGame (Text-Adventure-Engine + Editor)

Elementbasiertes Erzählspiel: Ein lokaler Python-Server liefert ein Web-Frontend aus, in dem man Geschichten aus `Stories/*.yaml` spielt und in einem grafischen Editor bearbeitet. Dazu kommen Gemini-Tools, die aus den Story-Texten Sprachsamples (TTS) und Bilder erzeugen.

GitHub: https://github.com/kaiolefoerst-collab/TextGame (Remote `origin`). Konzept und Autorenregeln stehen in [Game-Description/](Game-Description/).

## Ausführen

```
pip install -r requirements.txt
python game.py [--port 8000] [--no-browser]
```
Öffnet http://127.0.0.1:8000/ (Spiel und Editor). **Story-YAMLs werden nur beim Serverstart eingelesen.** Wer eine YAML-Datei von Hand ändert, muss den Server neu starten. Änderungen an `web/*` brauchen nur einen Browser-Reload (Strg+F5).

## Architektur

- [game.py](game.py): HTTP-Server (stdlib `ThreadingHTTPServer`). Endpunkte:
  - `GET /api/stories`: Liste mit Titel, Autor und Teaser für die Startseite
  - `GET /api/story/<id>`: Story als JSON. Jedes Element bekommt zusätzlich `_samples: {feld: nummer}` für vorhandene mp3s.
  - `POST /api/story/<id>`: Editor speichert. Schreibt die YAML per `yaml.safe_dump` zurück. **Nur der Kommentarblock am Dateianfang bleibt erhalten, Kommentare im Dateiinneren gehen beim Speichern aus dem Editor verloren.**
  - `/output_vocs/...` statisch, sonst Dateien aus `web/`
- [web/game.js](web/game.js): Die gesamte Spiellogik läuft im Browser. Datengetrieben, ohne story-spezifischen Code.
- [web/editor.js](web/editor.js): Editor mit Ortsgraph, Detailfenstern, Tooltips, Speichern und Verlassen-Dialog.
- [web/editor-triggers.js](web/editor-triggers.js): Editor-Teil für Startzustand (`initialState`) und Reaktionen (`onUse`). Die Bausteine stehen in `CONDITION_DEFS` / `EFFECT_DEFS`.
- [web/index.html](web/index.html), [web/style.css](web/style.css): alle Bildschirme und Dialoge
- **Alle drei JS-Dateien teilen sich einen globalen Scope** (klassische `<script>`-Tags in der Reihenfolge game.js → editor.js → editor-triggers.js). Keine doppelten `const`-Namen auf oberster Ebene, sonst fällt das ganze Skript aus. Beispiel: `PLAYER_ID` ist nur in game.js definiert und wird im Editor mitbenutzt.

## Story-Format (YAML, eine Datei = eine Geschichte)

- `header`: `id` (muss eindeutig sein und zur URL passen), `title`, `author`, `version`, `teaser`, `partOf`, `chapterIndex`, `startElement`
- `layers`, `resolution` (globale Lösungsbedingung mit `conditions` + `effects`, wird nach jeder Aktion geprüft und greift einmal), `elements`
- Element: `id`, `name`, `type`, `physical`, `layers`, `locatedIn`, `initialState` (`visible` + frei benannte Zustände), `initialPartOf`, `presentation` (Textfelder), `onUse` (Reaktionen), optional `fragments`, `exitLabel`, `voice`, `image`, `portable`
- **Typen:** Orte `room`/`area`/`building` (Ellipsen im Editor-Graph) · `door` (Weg, im Graph ein Pfeil; das Ziel ist ein `setCurrentElement`-Effekt) · `object`, `container`, `mechanism`, `object_collection` · `feature` = „Details“ (fest, nur anschauen; der alte Name `furniture` ist als Alias weiter gültig) · `document`, `document_entry`, `document_collection`, `inscription` · `person`, `group` · `player` (Inventar) · nicht-physische Story-Elemente (`event`, `rumor`, `story` …)
- **Reaktion:** `{id, enabled, conditions: [...], effects: [...]}`. Bei `use()` feuern **alle** aktiven Reaktionen, deren Bedingungen (UND-verknüpft) erfüllt sind, von oben nach unten.
- **Bedingungen:** `stateEquals [id, prop, wert]`, `partOfExists/partOfMissing [id, ziel]`, `inInventory id`, `notInInventory id`
- **Effekte:** `revealElement`, `hideElement`, `showText`, `showTextFrom "id.presentation.feld"`, `setCurrentElement`, `setElementState [id, prop, wert]`, `setLocatedIn [id, ziel]`, `discoverFragment`, `addPartOf`/`removePartOf [id, ziel]`, `replacePartOf {elementId, remove, add}`, `enableTrigger`/`disableTrigger [id, triggerId]`, `disableSelfTrigger triggerId` (= „nur beim ersten Mal“), `finishGame`
- **Neue Bedingungs- oder Effekttypen** müssen an drei Stellen ergänzt werden: `evalCondition`/`applyEffect` in game.js, `CONDITION_DEFS`/`EFFECT_DEFS` in editor-triggers.js und der Kommentarkopf in den Story-YAMLs.
- **Textauswahl** (`pickPresentationText`): `completeView/Use` (bei `investigation = complete`) > `openLeadView/Use` (ein frisch sichtbar gewordenes, noch nicht benutztes Kind) > `firstView/Use` > `blockedUse` > `repeatView/Use`. `contentText` wird immer angehängt. `blockedText`, `exitText`, `releaseText` und `heading` erscheinen nur per `showTextFrom`.
- **Inventar:** Inhalt des Elements `player`. game.js und der Editor legen es automatisch an, wenn es fehlt. Für Elemente mit `portable: true` zeigt das Spiel „✋ Aufnehmen“ bzw. „⬇ Ablegen“. Abgelegt wird im obersten offenen Ort oder Behälter (`DROP_TARGET_TYPES`). Die Texte `takeText`/`dropText` werden nicht vorgelesen.
- **Spielmenü:** Die Auswahl ist nach Typ gruppiert (`MENU_CATEGORIES` in game.js: Personen, Details, Gegenstände, Schriftstücke, Bereiche, Wege, Sonstiges), jede Gruppe mit eigener Farbe.

## Editor-Konventionen

- Die Tooltip-Texte (`FIELD_INFO`, `TYPE_INFO`, `BASE_TIPS`, `STATE_TIPS`, Baustein-`tip`s) beschreiben das tatsächliche Verhalten in game.js. **Bei Änderungen an der Spiellogik die Tooltips mitpflegen.**
- Tooltips laufen über das Attribut `data-tip` und ein einziges, per JS positioniertes `.ed-tooltip` (keine `title`-Attribute im Editor).
- Die Anordnung im Graph wird berechnet und nicht gespeichert: Zeile = Verschachtelungstiefe, innerhalb einer Zeile von links nach rechts ab dem Startort, neue Orte rechts.
- Der Editor erhält beim Speichern alle Felder, die er nicht kennt. Unbekannte Bausteine werden als „Unbekannt“ angezeigt und unverändert gespeichert. Verweise auf fehlende Elemente erscheinen als „⚠ fehlt: id“.
- **Offen bzw. geplant** (in dieser Reihenfolge abgesprochen): Rückverweise („wird freigeschaltet durch …“) und eine Prüfung auf toten Inhalt, eine Ansicht für die Wissensebene (nicht-physische Elemente, Fragmente, `partOf`), ein Editor für die `resolution`, ein „▶ Testen“-Knopf.

## Sprachsamples und Bilder (Gemini)

- [export_vocs.py](export_vocs.py): Liest alle vorlesbaren Textfelder aus den Stories (Liste `NARRATED_FIELDS` in [vocs_fields.py](vocs_fields.py)) und schreibt `input_vocs.txt`. Die Nummern sind dauerhaft in `.vocs_index.json` festgehalten (wird in git getrackt, Nummern werden nie wiederverwendet).
- [generate_samples.py](generate_samples.py): Für jede Zeile ein Gemini-TTS-Aufruf, dann PCM (24 kHz, 16 Bit, mono) → WAV → mp3 per `ffmpeg`-Subprocess.
  - Eingabeformat in [input_vocs.txt](input_vocs.txt): `Nummer "Text";Sprecher`, geparst per `LINE_RE`
  - Sprecher optional: `male1`/`male2`/`female1`/`female2`/`standard`, Zuordnung in `SPEAKER_VOICES`. Standard ist `male1` = Puck.
  - Ausgabe nach `output_vocs/sample_NNNNN.mp3`, Modell `gemini-2.5-flash-preview-tts`
- [generate_pictures.py](generate_pictures.py): Gemini-Bildgenerierung, Ausgabe per `ffmpeg` als JPEG.
  - Eingabeformat in [input_pics.txt](input_pics.txt): `Nummer "Prompt";"Zusatzinfo"`. Die Zusatzinfo wird als `system_instruction` übergeben.
  - Ausgabe nach `output_pics/pic_NNNNN.jpg`, Modell `gemini-2.5-flash-image`
  - Ein Export aus den Stories (wie bei den Vocs) fehlt noch.
- Beide Skripte führen ein Manifest (`<output-dir>/.manifest.json`, Hash pro Nummer) und überspringen unveränderte Einträge. `--force` erzeugt alles neu.

```
python export_vocs.py
python generate_samples.py [--input input_vocs.txt] [--output-dir output_vocs] [--voice Puck] [--force]
python generate_pictures.py [--input input_pics.txt] [--output-dir output_pics] [--force]
```

## Wichtige Entscheidungen und Einschränkungen

- **Kein pydub und kein Pillow:** pydub ist unter Python 3.14 kaputt (das Modul `audioop` wurde entfernt). Alle Konvertierungen laufen über `ffmpeg`-Subprocess (`wav_to_mp3()`, `image_to_jpeg()`). `ffmpeg` muss im PATH liegen (hier installiert über `winget install Gyan.FFmpeg`).
- Der API-Key steht in `.env` (`GEMINI_API_KEY=...`) und wird per `python-dotenv` geladen. `.env` ist in `.gitignore`, `.env.example` enthält nur einen Platzhalter. **Nie einen echten Key committen.**
- `output_vocs/` und `output_pics/` werden nicht getrackt.
- Für Code-Kommentare in den JS- und Python-Dateien werden Umlaute umschrieben (ae/oe/ue). Für Texte in der Oberfläche echte Umlaute und deutsche Anführungszeichen („…“) verwenden.
- Beim Bearbeiten von JS-Dateien per Shell-Heredoc/Python **keine `\n`-Escapes durchreichen**. Das hat schon zweimal echte Zeilenumbrüche in JS-Strings erzeugt und die Skripte lahmgelegt. Danach immer `node --check web/<datei>.js` ausführen.
