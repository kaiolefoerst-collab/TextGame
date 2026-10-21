"""Exportiert die Bild-Prompts aus allen Stories/*.yaml nach input_pics.txt.

Gegenstueck zu export_vocs.py: Jedes Bild (Standardbild `image` und Zustandsbilder
`stateImages` eines Elements, siehe pics_fields.py) bekommt eine stabile, dauerhafte
Nummer, gespeichert in .pics_index.json. Bekannte Bilder behalten ihre Nummer (damit
bereits erzeugte output_pics/pic_*.jpg weiter passen), neue bekommen die naechste freie.
Verschwindet ein Bild aus einer Story, wird seine Nummer nicht wiederverwendet.

Der Masterprompt der Geschichte (header.imageMasterPrompt) wird als Zusatzinfo an jede
Zeile gehaengt. generate_pictures.py rechnet ihn in seinen Aenderungs-Hash ein - wer den
Masterprompt aendert, bekommt beim naechsten Lauf also alle Bilder der Geschichte neu.

Die eigentliche Bilderzeugung geschieht weiterhin unveraendert per
    python generate_pictures.py

Aufruf:
    python export_pics.py [--stories-dir Stories] [--output input_pics.txt] [--index .pics_index.json]
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

from export_vocs import load_index, load_stories, save_index
from pics_fields import image_entries, image_key

ROOT_DIR = Path(__file__).resolve().parent
OUTPUT_PICS_DIR = ROOT_DIR / "output_pics"
PIC_FILE_RE = re.compile(r"^pic_(\d+)\.jpg$")


def collapse_prompt(text: str) -> str:
    """Eine Zeile pro Bild: Zeilenumbrueche zu Leerzeichen, doppelte Anfuehrungszeichen zu
    einfachen, damit das Format 'Nummer "Prompt";"Zusatzinfo"' eindeutig parsebar bleibt."""
    return re.sub(r"\s+", " ", text).strip().replace('"', "'")


def collect_entries(stories: list[dict]) -> list[tuple[str, str, str]]:
    """Liefert (key, prompt, masterprompt) in stabiler Reihenfolge."""
    entries: list[tuple[str, str, str]] = []
    for story in stories:
        story_id = story["header"]["id"]
        master = story["header"].get("imageMasterPrompt") or ""
        master = collapse_prompt(master) if isinstance(master, str) else ""
        for el in story.get("elements", []):
            for state, prompt, _target in image_entries(el):
                entries.append((image_key(story_id, el["id"], state), collapse_prompt(prompt), master))
    return entries


def highest_existing_picture() -> int:
    """Hoechste Nummer einer schon vorhandenen output_pics/pic_NNNNN.jpg (z.B. alte Demobilder)."""
    if not OUTPUT_PICS_DIR.is_dir():
        return 0
    numbers = [int(m.group(1)) for p in OUTPUT_PICS_DIR.iterdir() if (m := PIC_FILE_RE.match(p.name))]
    return max(numbers, default=0)


def assign_numbers(entries: list[tuple[str, str, str]], index: dict[str, int]) -> dict[str, int]:
    used = set(index.values())
    # Neue Nummern beginnen hinter allen vergebenen UND allen schon vorhandenen Bilddateien:
    # sonst wuerde ein altes Demobild (pic_00001.jpg) im Spiel als Bild eines Elements
    # erscheinen, bis generate_pictures.py es ersetzt.
    next_number = max(max(used, default=0), highest_existing_picture()) + 1
    assigned: dict[str, int] = {}
    for key, _prompt, _master in entries:
        if key in index:
            assigned[key] = index[key]
        else:
            index[key] = next_number
            assigned[key] = next_number
            next_number += 1
    return assigned


def write_input_pics(output_path: Path, entries: list[tuple[str, str, str]], assigned: dict[str, int]) -> None:
    lines = [
        "# Automatisch erzeugt von export_pics.py aus Stories/*.yaml - nicht von Hand bearbeiten,",
        "# Aenderungen werden beim naechsten Export ueberschrieben.",
        '# Format pro Zeile: Nummer "Prompt";"Masterprompt der Geschichte" (Masterprompt optional)',
        "",
    ]
    for key, prompt, master in entries:
        extra = f'"{master}"' if master else ""
        lines.append(f'{assigned[key]:05d} "{prompt}";{extra}')
    output_path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--stories-dir", default=str(ROOT_DIR / "Stories"))
    parser.add_argument("--output", default=str(ROOT_DIR / "input_pics.txt"))
    parser.add_argument("--index", default=str(ROOT_DIR / ".pics_index.json"))
    args = parser.parse_args()

    stories_dir = Path(args.stories_dir)
    stories = load_stories(stories_dir)
    if not stories:
        sys.exit(f"Keine Story-Dateien in {stories_dir} gefunden.")

    entries = collect_entries(stories)
    if not entries:
        sys.exit("Keine Bild-Prompts gefunden (Felder 'image' / 'stateImages').")

    index_path = Path(args.index)
    index = load_index(index_path)
    assigned = assign_numbers(entries, index)
    save_index(index_path, index)
    write_input_pics(Path(args.output), entries, assigned)

    print(f"{len(entries)} Bild-Prompt(s) exportiert nach {args.output}.")
    print(f"{len(index)} Nummer(n) insgesamt in {index_path.name} vergeben.")
    print("Bilder erzeugen mit: python generate_pictures.py")


if __name__ == "__main__":
    main()
