"""Exportiert die Bild-Prompts einer Geschichte nach Stories/<Name>/pictures_input.txt.

Gegenstueck zu export_vocs.py: Jedes Bild (Standardbild `image` und Zustandsbilder
`stateImages`, siehe pics_fields.py) bekommt eine stabile Nummer in
Stories/<Name>/pictures_index.json. Der Masterprompt der Geschichte
(header.imageMasterPrompt) wird als Zusatzinfo an jede Zeile gehaengt.

generate_pictures.py ruft den Export selbst auf; dieses Skript braucht man nur, um die
Exportliste ohne Bilderzeugung anzusehen.

Aufruf:
    python export_pics.py [--story <Name>]     (ohne --story: alle Geschichten)
"""

from __future__ import annotations

import argparse
import re
import sys

from pics_fields import image_entries
from story_files import StoryFolder, assign_numbers, load_index, load_story, save_index, story_folders


def collapse_prompt(text: str) -> str:
    """Eine Zeile pro Bild: Zeilenumbrueche zu Leerzeichen, doppelte Anfuehrungszeichen zu
    einfachen, damit das Format 'Nummer "Prompt";"Zusatzinfo"' eindeutig parsebar bleibt."""
    return re.sub(r"\s+", " ", text).strip().replace('"', "'")


def collect_entries(story: dict) -> list[tuple[str, str, str]]:
    """(schluessel, prompt, masterprompt) in stabiler Reihenfolge."""
    master = story["header"].get("imageMasterPrompt") or ""
    master = collapse_prompt(master) if isinstance(master, str) else ""
    return [
        (key, collapse_prompt(prompt), master)
        for el in story.get("elements", [])
        for key, prompt, _target in image_entries(el)
    ]


def export_story(folder: StoryFolder) -> list[tuple[int, str, str]]:
    """Exportiert eine Geschichte und liefert [(nummer, prompt, masterprompt)]."""
    story = load_story(folder)
    if story is None:
        return []
    entries = collect_entries(story)
    index = load_index(folder.pictures_index)
    assigned = assign_numbers([k for k, _, _ in entries], index, folder.pictures_dir, "pic_*.jpg")
    save_index(folder.pictures_index, index)
    lines = [
        "# Automatisch erzeugt von export_pics.py aus " + folder.yaml_path.name + " - nicht von Hand bearbeiten.",
        '# Format pro Zeile: Nummer "Prompt";"Masterprompt der Geschichte" (Masterprompt optional)',
        "",
    ]
    lines += [f'{assigned[k]:05d} "{prompt}";' + (f'"{master}"' if master else "") for k, prompt, master in entries]
    folder.pictures_input.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return [(assigned[k], prompt, master) for k, prompt, master in entries]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--story", help="Name der Geschichte (Ordnername); ohne Angabe alle")
    args = parser.parse_args()

    folders = [f for f in story_folders() if not args.story or f.name == args.story]
    if not folders:
        sys.exit("Keine passende Geschichte unter Stories/ gefunden.")
    for folder in folders:
        entries = export_story(folder)
        print(f"{folder.name}: {len(entries)} Bild-Prompt(s) -> {folder.pictures_input.name}")


if __name__ == "__main__":
    main()
