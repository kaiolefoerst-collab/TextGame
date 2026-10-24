"""Ordnerstruktur der Geschichten - die einzige Stelle, die sie kennt.

Jede Geschichte ist ein eigener Ordner unter Stories/, benannt wie ihre YAML-Datei.
Alles, was zu einer Geschichte gehoert, liegt darin:

    Stories/<Name>/
        <Name>.yaml            die Geschichte (header.id == <Name>)
        samples/               erzeugte Sprachdateien sample_NNNNN.mp3 (+ .manifest.json)
        pictures/              erzeugte Bilder pic_NNNNN.jpg (+ .manifest.json)
        samples_index.json     feste Nummer je Text   (Schluessel "element:feld")
        pictures_index.json    feste Nummer je Bild   (Schluessel "element:image[@zustand]")
        samples_input.txt      Exportliste fuer generate_samples.py
        pictures_input.txt     Exportliste fuer generate_pictures.py
        editor_layout.json     Positionen der Orte im Editor (nur Editor, vom Spiel ignoriert)
        Schiffe.md             optional: Prompt-Bausteine fuer wiederkehrende Motive
        vorlagen/              optional: Vorlagebilder (+ .manifest.json, vorlagen_prompts.txt)

Eine Geschichte existiert genau dann, wenn ihr Ordner mit der gleichnamigen YAML-Datei
existiert. Der Ordnername ist ihre Kennung; eine abweichende header.id wird mit Warnung
durch den Ordnernamen ersetzt.
"""

from __future__ import annotations

import json
import sys
from dataclasses import dataclass
from pathlib import Path

import yaml

ROOT_DIR = Path(__file__).resolve().parent
STORIES_DIR = ROOT_DIR / "Stories"


@dataclass(frozen=True)
class StoryFolder:
    dir: Path

    @property
    def name(self) -> str:
        return self.dir.name

    @property
    def yaml_path(self) -> Path:
        return self.dir / f"{self.name}.yaml"

    @property
    def samples_dir(self) -> Path:
        return self.dir / "samples"

    @property
    def pictures_dir(self) -> Path:
        return self.dir / "pictures"

    @property
    def samples_index(self) -> Path:
        return self.dir / "samples_index.json"

    @property
    def pictures_index(self) -> Path:
        return self.dir / "pictures_index.json"

    @property
    def samples_input(self) -> Path:
        return self.dir / "samples_input.txt"

    @property
    def pictures_input(self) -> Path:
        return self.dir / "pictures_input.txt"

    @property
    def editor_layout(self) -> Path:
        """Positionen der Ellipsen im Editor-Ortsgraph (elementId -> {x, y}); vom Spiel ignoriert."""
        return self.dir / "editor_layout.json"

    @property
    def ships_doc(self) -> Path:
        """Verbindliche Beschreibung wiederkehrender Motive (Prompt-Bausteine), z.B. die Raumschiffe."""
        return self.dir / "Schiffe.md"

    @property
    def references_dir(self) -> Path:
        """Vorlagebilder (Referenzen fuer einheitliches Aussehen) + Prompts, erzeugt von generate_picprompt.py."""
        return self.dir / "vorlagen"


def story_folders(stories_dir: Path = STORIES_DIR) -> list[StoryFolder]:
    folders = []
    if not stories_dir.is_dir():
        return folders
    for d in sorted(p for p in stories_dir.iterdir() if p.is_dir()):
        folder = StoryFolder(d)
        if not folder.yaml_path.is_file():
            print(f"Warnung: Ordner {d.name} enthaelt keine {d.name}.yaml und wird uebersprungen.", file=sys.stderr)
            continue
        folders.append(folder)
    return folders


def load_story(folder: StoryFolder) -> dict | None:
    with folder.yaml_path.open("r", encoding="utf-8") as f:
        data = yaml.safe_load(f)
    if not data or "header" not in data:
        print(f"Warnung: {folder.yaml_path.name} hat keinen 'header' und wird uebersprungen.", file=sys.stderr)
        return None
    if data["header"].get("id") != folder.name:
        print(f"Warnung: {folder.yaml_path.name} hat header.id '{data['header'].get('id')}' - "
              f"verwendet wird der Ordnername '{folder.name}'.", file=sys.stderr)
        data["header"]["id"] = folder.name
    return data


def load_index(path: Path) -> dict[str, int]:
    if not path.exists():
        return {}
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def save_index(path: Path, index: dict[str, int]) -> None:
    with path.open("w", encoding="utf-8") as f:
        json.dump(index, f, indent=2, sort_keys=True, ensure_ascii=False)
        f.write("\n")


def assign_numbers(keys: list[str], index: dict[str, int], media_dir: Path, pattern: str) -> dict[str, int]:
    """Feste Nummern: bekannte Schluessel behalten ihre Nummer, neue bekommen die naechste
    freie - hinter allen vergebenen UND allen schon vorhandenen Mediendateien (pattern z.B.
    'sample_*.mp3'), damit nie eine fremde alte Datei als neuer Text/neues Bild erscheint.
    Nummern verschwundener Schluessel werden nie wiederverwendet. Aendert `index` in-place."""
    existing = []
    if media_dir.is_dir():
        for p in media_dir.glob(pattern):
            digits = "".join(ch for ch in p.stem if ch.isdigit())
            if digits:
                existing.append(int(digits))
    next_number = max(max(index.values(), default=0), max(existing, default=0)) + 1
    assigned: dict[str, int] = {}
    for key in keys:
        if key not in index:
            index[key] = next_number
            next_number += 1
        assigned[key] = index[key]
    return assigned
