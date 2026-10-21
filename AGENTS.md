# StoryGame (Text-Adventure-Engine + Editor)

Elementbasiertes Erzählspiel: Ein lokaler Python-Server liefert ein Web-Frontend aus, in dem man Geschichten aus `Stories/<Name>/` spielt und in einem grafischen Editor bearbeitet. Dazu kommen Gemini-Tools, die aus den Story-Texten Sprachsamples (TTS) und Bilder erzeugen.

GitHub: https://github.com/kaiolefoerst-collab/TextGame (Remote `origin`). Konzept und Autorenregeln stehen in [Game-Description/](Game-Description/).

## Ausführen

```
pip install -r requirements.txt
python game.py [--port 8000] [--no-browser]
```
Öffnet http://127.0.0.1:8000/ (Spiel und Editor). **Story-YAMLs werden nur beim Serverstart eingelesen.** Wer eine YAML-Datei von Hand ändert, muss den Server neu starten. Änderungen an `web/*` brauchen nur einen Browser-Reload (Strg+F5).

## Ordnerstruktur der Geschichten

Jede Geschichte ist ein eigener Ordner unter `Stories/`, benannt wie ihre YAML-Datei. Eine Geschichte existiert genau dann, wenn der Ordner samt gleichnamiger YAML-Datei existiert. **Ordnername = `header.id`.** Weicht die ID ab, warnt `story_files.load_story` und verwendet den Ordnernamen. Alles zu einer Geschichte liegt in ihrem Ordner:

```
Stories/<Name>/
  <Name>.yaml            die Geschichte
  samples/               sample_NNNNN.mp3 + .manifest.json
  pictures/              pic_NNNNN.jpg + .manifest.json
  samples_index.json     feste Nummer je Text  (element:feld)
  pictures_index.json    feste Nummer je Bild  (element:image[@zustand])
  samples_input.txt      Exportliste für generate_samples.py
  pictures_input.txt     Exportliste für generate_pictures.py
```

Die **einzige Stelle**, die diese Struktur kennt, ist [story_files.py](story_files.py) (`StoryFolder`, `story_folders()`, `load_story()`, `assign_numbers()`). Alle Programme (game.py, Exporte, Generatoren) gehen darüber. Neue Pfade dort ergänzen, nicht in den einzelnen Programmen. Aktuelle Geschichten: `cursed_mill` (Die verfluchte Mühle) und `SpaceTrace` (Space Trace).

## Architektur

- [game.py](game.py): HTTP-Server (stdlib `ThreadingHTTPServer`). Endpunkte:
  - `GET /api/stories`: Liste mit Titel, Autor und Teaser für die Startseite
  - `GET /api/story/<id>`: Story als JSON. Jedes Element bekommt zusätzlich `_samples: {feld: nummer}` für vorhandene mp3s.
  - `POST /api/story/<id>`: Editor speichert. Schreibt die YAML per `yaml.safe_dump` zurück. **Nur der Kommentarblock am Dateianfang bleibt erhalten, Kommentare im Dateiinneren gehen beim Speichern aus dem Editor verloren.**
  - Zusätzlich `_image` (Bildnummer) am Element bzw. am `stateImages`-Eintrag, wenn `Stories/<Name>/pictures/pic_NNNNN.jpg` existiert. Der Editor macht diese Eigenschaft nicht-aufzählbar, damit sie nicht in die YAML-Datei geschrieben wird.
  - `/stories/<Name>/samples/<datei>` und `/stories/<Name>/pictures/<datei>` statisch (nur diese beiden Unterordner, mit Schutz gegen `../`), sonst Dateien aus `web/`
- [web/game.js](web/game.js): Die gesamte Spiellogik läuft im Browser. Datengetrieben, ohne story-spezifischen Code.
- [web/editor.js](web/editor.js): Editor mit Ortsgraph, Detailfenstern, Tooltips, Speichern und Verlassen-Dialog.
- [web/editor-images.js](web/editor-images.js): Editor-Teil für Bild-Prompts (Standardbild und Zustandsbilder). Der Knopf „📝 Beschreibung übernehmen“ hängt den Text für den ersten Besuch als Block `Szene laut Geschichte: „…“ Das Bild darf dem nicht widersprechen.` an den Prompt. Ein vorhandener Block wird ersetzt. Das geschieht bewusst nur per Knopf und ohne automatischen Abgleich (so abgestimmt), der Level-Designer kürzt den Block von Hand auf das Sichtbare.
- [web/editor-triggers.js](web/editor-triggers.js): Editor-Teil für Startzustand (`initialState`) und Reaktionen (`onUse`). Die Bausteine stehen in `CONDITION_DEFS` / `EFFECT_DEFS`.
- [web/index.html](web/index.html), [web/style.css](web/style.css): alle Bildschirme und Dialoge
- **Alle drei JS-Dateien teilen sich einen globalen Scope** (klassische `<script>`-Tags in der Reihenfolge game.js → editor.js → editor-triggers.js → editor-images.js). Keine doppelten `const`-Namen auf oberster Ebene, sonst fällt das ganze Skript aus. Beispiel: `PLAYER_ID` ist nur in game.js definiert und wird im Editor mitbenutzt.

## Story-Format (YAML, eine Datei = eine Geschichte)

- `header`: `id` (muss eindeutig sein und zur URL passen), `title`, `author`, `version`, `teaser`, `partOf`, `chapterIndex`, `startElement`, `imageMasterPrompt` (Bildstil für alle Bilder)
- `layers`, `resolution` (globale Lösungsbedingung mit `conditions` + `effects`, wird nach jeder Aktion geprüft und greift einmal), `elements`
- Element: `id`, `name`, `type`, `physical`, `layers`, `locatedIn`, `initialState` (`visible` + frei benannte Zustände), `initialPartOf`, `presentation` (Textfelder), `onUse` (Reaktionen), optional `fragments`, `exitLabel`, `voice`, `image` (Prompt des Standardbilds), `stateImages` (`[{state: {name: wert}, prompt}]`), `portable`
- **Typen:** Orte `room`/`area`/`building` (Ellipsen im Editor-Graph) · `door` (Weg, im Graph ein Pfeil; das Ziel ist ein `setCurrentElement`-Effekt) · `object`, `container`, `mechanism`, `object_collection` · `feature` = „Details“ (fest, nur anschauen; der alte Name `furniture` ist als Alias weiter gültig) · `document`, `document_entry`, `document_collection`, `inscription` · `person`, `group` · `player` (Inventar) · nicht-physische Story-Elemente (`event`, `rumor`, `story` …)
- **Reaktion:** `{id, enabled, conditions: [...], effects: [...]}`. Bei `use()` feuern **alle** aktiven Reaktionen, deren Bedingungen (UND-verknüpft) erfüllt sind, von oben nach unten.
- **Bedingungen:** `stateEquals [id, prop, wert]`, `partOfExists/partOfMissing [id, ziel]`, `inInventory id`, `notInInventory id`
- **Effekte:** `revealElement`, `hideElement`, `showText`, `showTextFrom "id.presentation.feld"`, `setCurrentElement`, `setElementState [id, prop, wert]`, `setLocatedIn [id, ziel]`, `discoverFragment`, `addPartOf`/`removePartOf [id, ziel]`, `replacePartOf {elementId, remove, add}`, `enableTrigger`/`disableTrigger [id, triggerId]`, `disableSelfTrigger triggerId` (= „nur beim ersten Mal“), `finishGame`
- **Neue Bedingungs- oder Effekttypen** müssen an drei Stellen ergänzt werden: `evalCondition`/`applyEffect` in game.js, `CONDITION_DEFS`/`EFFECT_DEFS` in editor-triggers.js und der Kommentarkopf in den Story-YAMLs.
- **Textauswahl** (`pickPresentationText`): `completeView/Use` (bei `investigation = complete`) > `openLeadView/Use` (ein frisch sichtbar gewordenes, noch nicht benutztes Kind) > `firstView/Use` > `blockedUse` > `repeatView/Use`. `contentText` wird immer angehängt. `blockedText`, `exitText`, `releaseText` und `heading` erscheinen nur per `showTextFrom`.
- **Inventar:** Inhalt des Elements `player`. game.js und der Editor legen es automatisch an, wenn es fehlt. Für Elemente mit `portable: true` zeigt das Spiel „✋ Aufnehmen“ bzw. „⬇ Ablegen“. Abgelegt wird im obersten offenen Ort oder Behälter (`DROP_TARGET_TYPES`). Die Texte `takeText`/`dropText` werden nicht vorgelesen.
- **Bilder** (`pickImage` in game.js): Es gilt das erste `stateImages`-Bild, dessen Zustandswerte alle zutreffen, sonst `image`. Ist das passende Zustandsbild noch nicht erzeugt, wird auf das Standardbild zurückgegriffen, sonst erscheint „[Bild noch nicht erzeugt]“. Bilder sind optional, nicht jedes Element und schon gar nicht jeder Zustand braucht eins. Videos sind bewusst nicht vorgesehen.
- **Kein Spielstand**: Es wird noch nichts gespeichert. Darum fragt das Spiel beim Verlassen nach („← Geschichten“ → `quit-dialog`, Browser schließen/neu laden → `beforeunload`), sobald `engine.actionCount > 0` und die Geschichte nicht beendet ist. Wenn es einmal Spielstände gibt, kann die Abfrage entfallen.
- **Spielmenü:** Die Auswahl ist nach Typ gruppiert (`MENU_CATEGORIES` in game.js: Personen, Details, Gegenstände, Schriftstücke, Bereiche, Wege, Sonstiges), jede Gruppe mit eigener Farbe.

## Editor-Konventionen

- Die Tooltip-Texte (`FIELD_INFO`, `TYPE_INFO`, `BASE_TIPS`, `STATE_TIPS`, Baustein-`tip`s) beschreiben das tatsächliche Verhalten in game.js. **Bei Änderungen an der Spiellogik die Tooltips mitpflegen.**
- Tooltips laufen über das Attribut `data-tip` und ein einziges, per JS positioniertes `.ed-tooltip` (keine `title`-Attribute im Editor).
- Die Anordnung im Graph wird berechnet und nicht gespeichert: Zeile = Verschachtelungstiefe, innerhalb einer Zeile von links nach rechts ab dem Startort, neue Orte rechts.
- Der Editor erhält beim Speichern alle Felder, die er nicht kennt. Unbekannte Bausteine werden als „Unbekannt“ angezeigt und unverändert gespeichert. Verweise auf fehlende Elemente erscheinen als „⚠ fehlt: id“.
- **Offen bzw. geplant** (in dieser Reihenfolge abgesprochen): Rückverweise („wird freigeschaltet durch …“) und eine Prüfung auf toten Inhalt, eine Ansicht für die Wissensebene (nicht-physische Elemente, Fragmente, `partOf`), ein Editor für die `resolution`, ein „▶ Testen“-Knopf.

## Sprachsamples und Bilder (Gemini)

- **Was gesprochen wird** (mit dem Autor abgestimmt; die einzige Regel steht in `narrated_texts()` in [vocs_fields.py](vocs_fields.py) und wird von Export, Aufräumen und game.py gemeinsam genutzt):
  - **Ja:** alle Fenstertexte (erster und zweiter Besuch, „Neue Spur“, „Nichts Neues mehr“, „Abgeschlossen“) und der Wortlaut (`contentText`, z.B. Inschriften, Briefe, Logbücher in der Geschichte). Dazu **erzählende Meldungen** = Textfelder, die per `showTextFrom` eingeblendet werden (Weg versperrt, Abschied, Auflösung), egal an welchem Element. Das Spiel spielt sie **nach** dem Fenstertext ab, einen Abschiedstext auch auf dem Endbildschirm.
  - **Nein:** Wege (Typ `door` oder ein bedingungsloser Klick führt woanders hin), nicht-physische Elemente bzw. das Logbuch-Menü, verdeckte Use-Felder (z.B. `firstUse` neben `firstView`), frei geschriebene `showText`-Meldungen, `takeText`/`dropText`.
- [export_vocs.py](export_vocs.py): Schreibt die zu sprechenden Texte einer Geschichte nach `samples_input.txt`. Die Nummern stehen dauerhaft in `samples_index.json` (Schlüssel `element:feld`, Nummern werden nie wiederverwendet).
- [generate_samples.py](generate_samples.py): Gleicher Ablauf wie generate_pictures.py: Auswahl der Geschichte, eigener Export, Rückfrage vor den API-Aufrufen. Im Geschichten-Modus löscht es außerdem automatisch `sample_*.mp3`, die in keiner Geschichte mehr gebraucht werden (auch die Manifest-Einträge; im `--dry-run` wird nur angezeigt). Pro Text ein Gemini-TTS-Aufruf, dann PCM (24 kHz, 16 Bit, mono) → WAV → mp3 per `ffmpeg`-Subprocess.
  - **Sprecher**: Die einzige Quelle ist `SPEAKERS` in [vocs_fields.py](vocs_fields.py) (Kürzel, Anzeigename, Gemini-Stimme). Daraus entstehen `SPEAKER_VOICES` im Generator und `GET /api/voices` für den Editor. Bestehende Kürzel nie umbenennen. Pro Element `voice:`, sonst `header.narratorVoice`, sonst `standard` (Puck). Beides ist im Editor einstellbar („Sprecher“ im Elementfenster, „Erzählstimme“ unter „📝 Geschichte“).
  - **Tempo: Originalgeschwindigkeit von Gemini**, keine Stilanweisung und keine Nachbearbeitung (vom Autor nach Versuchen mit Beschleunigung ausdrücklich so gewünscht). Eine `system_instruction` beantwortet das TTS-Modell mit 500 INTERNAL.
  - Der Server schickt `Cache-Control: no-store`, damit neu erzeugte Dateien mit gleichem Namen im Browser nicht aus dem Zwischenspeicher kommen.
  - Format von `samples_input.txt`: `Nummer "Text";Sprecher`, geparst per `LINE_RE`
  - Ausgabe nach `Stories/<Name>/samples/sample_NNNNN.mp3`, Modell `gemini-2.5-flash-preview-tts`
- [export_pics.py](export_pics.py) + [pics_fields.py](pics_fields.py): Liest `image` und `stateImages` aus den Stories und schreibt `pictures_input.txt`, den Masterprompt jeweils als Zusatzinfo. Feste Nummern in `pictures_index.json`. Der Schlüssel eines Zustandsbilds ist `element:image@zustand=wert,...`, also an den Zustand gebunden und nicht an die Listenposition. Neue Nummern beginnen hinter allen schon vorhandenen Mediendateien der Geschichte (`story_files.assign_numbers`), damit nie eine fremde alte Datei erscheint. Ändert sich der Masterprompt, entstehen alle Bilder der Geschichte neu (er geht in den Manifest-Hash ein).
- **Bildformat immer 16:9**: `ASPECT_RATIO` in generate_pictures.py (an Gemini per `ImageConfig` übergeben, zusätzlich exakter Mittelzuschnitt per ffmpeg `CROP_16_9`; das Format geht in den Manifest-Hash ein). Das Spielfenster scrollt nie (`#window-stack .window { overflow: hidden }`): Text und Auswahl bekommen ihre natürliche Höhe, das Bild füllt den Rest vollständig (`object-fit: contain`). Im Grenzfall schrumpft das Bild bis `--image-min-height`, danach scrollen Text bzw. Auswahl in sich. Editor-Fenster scrollen weiterhin normal.
- [generate_pictures.py](generate_pictures.py): Gemini-Bildgenerierung, Ausgabe per `ffmpeg` als JPEG.
  - Format von `pictures_input.txt`: `Nummer "Prompt";"Zusatzinfo"`. Die Zusatzinfo wird als `system_instruction` übergeben.
  - Ausgabe nach `Stories/<Name>/pictures/pic_NNNNN.jpg`, Modell `gemini-2.5-flash-image`
- Beide Skripte führen ein Manifest (`samples/.manifest.json` bzw. `pictures/.manifest.json`, Hash pro Nummer) und überspringen unveränderte Einträge. `--force` erzeugt alles neu.

```
python export_vocs.py
python export_pics.py
python generate_samples.py             # fragt nach der Geschichte, exportiert selbst, fragt vor API-Aufrufen
python generate_samples.py [--story <id>|alle] [--yes] [--dry-run] [--force]
python generate_pictures.py            # fragt nach der Geschichte, exportiert selbst, fragt vor API-Aufrufen
python generate_pictures.py [--story <id>|alle] [--yes] [--dry-run] [--force]
python generate_pictures.py --input datei.txt   # klassischer Modus ohne Stories
```

## Wichtige Entscheidungen und Einschränkungen

- **Kein pydub und kein Pillow:** pydub ist unter Python 3.14 kaputt (das Modul `audioop` wurde entfernt). Alle Konvertierungen laufen über `ffmpeg`-Subprocess (`wav_to_mp3()`, `image_to_jpeg()`). `ffmpeg` muss im PATH liegen (hier installiert über `winget install Gyan.FFmpeg`).
- Der API-Key steht in `.env` (`GEMINI_API_KEY=...`) und wird per `python-dotenv` geladen. `.env` ist in `.gitignore`, `.env.example` enthält nur einen Platzhalter. **Nie einen echten Key committen.**
- **Erzeugte Medien kommen mit in Git** (Entscheidung des Autors): Alles einer Geschichte liegt in ihrem Ordner, auch auf GitHub.
- Für Code-Kommentare in den JS- und Python-Dateien werden Umlaute umschrieben (ae/oe/ue). Für Texte in der Oberfläche echte Umlaute und deutsche Anführungszeichen („…“) verwenden.
- Beim Bearbeiten von JS-Dateien per Shell-Heredoc/Python **keine `\n`-Escapes durchreichen**. Das hat schon zweimal echte Zeilenumbrüche in JS-Strings erzeugt und die Skripte lahmgelegt. Danach immer `node --check web/<datei>.js` ausführen.
