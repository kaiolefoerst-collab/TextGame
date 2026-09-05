"""Exportiert vorlesbare Texte aus allen Stories/*.yaml nach input_vocs.txt.

Jedes erfasste Textfeld (siehe vocs_fields.NARRATED_FIELDS) bekommt eine stabile,
dauerhafte Nummer, gespeichert in .vocs_index.json. Bei erneutem Export behalten
bereits bekannte Texte ihre Nummer (damit bereits erzeugte output_vocs/sample_*.mp3
weiter passen); neue Texte bekommen die naechste freie Nummer. Verschwindet ein Text
aus einer Story, verschwindet seine Zeile aus input_vocs.txt, seine Nummer wird aber
nicht wiederverwendet.

Die eigentliche Sample-Erzeugung geschieht weiterhin unveraendert per
    python generate_samples.py

Aufruf:
    python export_vocs.py [--stories-dir Stories] [--output input_vocs.txt] [--index .vocs_index.json]
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

import yaml

from vocs_fields import NARRATED_FIELDS, sample_key

ROOT_DIR = Path(__file__).resolve().parent


def load_stories(stories_dir: Path) -> list[dict]:
    stories = []
    for path in sorted(stories_dir.glob("*.yaml")):
        with path.open("r", encoding="utf-8") as f:
            data = yaml.safe_load(f)
        if not data or "header" not in data or "id" not in data["header"]:
            print(f"Warnung: {path.name} hat keinen header.id und wird uebersprungen.", file=sys.stderr)
            continue
        stories.append(data)
    return stories


def collapse_for_tts(text: str) -> str:
    """Macht einen (ggf. mehrzeiligen) Erzaehltext TTS-tauglich als EINE Zeile.

    generate_samples.py liest input_vocs.txt zeilenweise (ein Eintrag = eine Zeile),
    daher werden Zeilenumbrueche zu Leerzeichen; eingebettete doppelte Anfuehrungszeichen
    werden zu einfachen, damit das Zeilenformat 'Nummer "Text";Sprecher' eindeutig bleibt.
    """
    collapsed = re.sub(r"\s+", " ", text).strip()
    return collapsed.replace('"', "'")


def collect_entries(stories: list[dict]) -> list[tuple[str, str, str | None]]:
    """Liefert (key, text, sprecher) in stabiler Reihenfolge: Story-, Element-, Feldreihenfolge."""
    entries: list[tuple[str, str, str | None]] = []
    for story in stories:
        story_id = story["header"]["id"]
        for el in story.get("elements", []):
            presentation = el.get("presentation") or {}
            speaker = el.get("voice")
            for field in NARRATED_FIELDS:
                value = presentation.get(field)
                if not isinstance(value, str) or not value.strip():
                    continue
                key = sample_key(story_id, el["id"], field)
                entries.append((key, collapse_for_tts(value), speaker))
    return entries


def load_index(index_path: Path) -> dict[str, int]:
    if not index_path.exists():
        return {}
    with index_path.open("r", encoding="utf-8") as f:
        return json.load(f)


def save_index(index_path: Path, index: dict[str, int]) -> None:
    with index_path.open("w", encoding="utf-8") as f:
        json.dump(index, f, indent=2, sort_keys=True, ensure_ascii=False)
        f.write("\n")


def assign_numbers(entries: list[tuple[str, str, str | None]], index: dict[str, int]) -> dict[str, int]:
    used = set(index.values())
    next_number = (max(used) + 1) if used else 1
    assigned: dict[str, int] = {}
    for key, _text, _speaker in entries:
        if key in index:
            assigned[key] = index[key]
        else:
            index[key] = next_number
            assigned[key] = next_number
            next_number += 1
    return assigned


def write_input_vocs(output_path: Path, entries: list[tuple[str, str, str | None]], assigned: dict[str, int]) -> None:
    lines = [
        "# Automatisch erzeugt von export_vocs.py aus Stories/*.yaml - nicht von Hand bearbeiten,",
        "# Aenderungen werden beim naechsten Export ueberschrieben.",
        "# Format pro Zeile: Nummer \"Text\";Sprecher (Sprecher optional)",
        "",
    ]
    for key, text, speaker in entries:
        number = assigned[key]
        speaker_part = speaker if speaker else ""
        lines.append(f'{number:05d} "{text}";{speaker_part}')
    output_path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--stories-dir", default=str(ROOT_DIR / "Stories"))
    parser.add_argument("--output", default=str(ROOT_DIR / "input_vocs.txt"))
    parser.add_argument("--index", default=str(ROOT_DIR / ".vocs_index.json"))
    args = parser.parse_args()

    stories_dir = Path(args.stories_dir)
    stories = load_stories(stories_dir)
    if not stories:
        sys.exit(f"Keine Story-Dateien in {stories_dir} gefunden.")

    entries = collect_entries(stories)
    if not entries:
        sys.exit("Keine vorlesbaren Texte gefunden.")

    index_path = Path(args.index)
    index = load_index(index_path)
    assigned = assign_numbers(entries, index)
    save_index(index_path, index)
    write_input_vocs(Path(args.output), entries, assigned)

    print(f"{len(entries)} Text(e) exportiert nach {args.output}.")
    print(f"{len(index)} Nummer(n) insgesamt in {index_path.name} vergeben.")
    print("Samples erzeugen mit: python generate_samples.py")


if __name__ == "__main__":
    main()
