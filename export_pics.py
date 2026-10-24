"""Exportiert die Bild-Prompts einer Geschichte nach Stories/<Name>/pictures_input.txt.

Gegenstueck zu export_vocs.py: Jedes Bild (Standardbild `image` und Zustandsbilder
`stateImages`, siehe pics_fields.py) bekommt eine stabile Nummer in
Stories/<Name>/pictures_index.json. Der Masterprompt der Geschichte
(header.imageMasterPrompt) wird als Zusatzinfo an jede Zeile gehaengt, die Vorlagebilder eines
Bilds (hoechstens 3, aus Stories/<Name>/vorlagen/) als dritte Angabe.

generate_pictures.py ruft den Export selbst auf; dieses Skript braucht man nur, um die
Exportliste ohne Bilderzeugung anzusehen.

Aufruf:
    python export_pics.py [--story <Name>]     (ohne --story: alle Geschichten)
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

from pics_fields import MAX_REFS, image_entries
from story_files import StoryFolder, assign_numbers, load_index, load_story, save_index, story_folders


def collapse_prompt(text: str) -> str:
    """Eine Zeile pro Bild: Zeilenumbrueche zu Leerzeichen, doppelte Anfuehrungszeichen zu
    einfachen, damit das Format 'Nummer "Prompt";"Zusatzinfo"' eindeutig parsebar bleibt."""
    return re.sub(r"\s+", " ", text).strip().replace('"', "'")


def collect_entries(story: dict) -> list[tuple[str, str, str, list[str]]]:
    """(schluessel, prompt, masterprompt, vorlagen) in stabiler Reihenfolge."""
    master = story["header"].get("imageMasterPrompt") or ""
    master = collapse_prompt(master) if isinstance(master, str) else ""
    return [
        (key, collapse_prompt(prompt), master, refs)
        for el in story.get("elements", [])
        for key, prompt, _target, refs in image_entries(el)
    ]


def check_refs(folder: StoryFolder, key: str, refs: list[str]) -> list[Path]:
    """Vorlagen eines Bilds als Pfade; warnt bei mehr als MAX_REFS und bei fehlenden Dateien.
    Fehlende Dateien bleiben in der Liste - generate_pictures.py meldet das Bild dann als Fehler."""
    if len(refs) > MAX_REFS:
        print(f"Warnung: {folder.name} {key}: {len(refs)} Vorlagen, nur die ersten {MAX_REFS} werden verwendet.",
              file=sys.stderr)
        refs = refs[:MAX_REFS]
    paths = [folder.references_dir / name for name in refs]
    for path in paths:
        if not path.is_file():
            print(f"Warnung: {folder.name} {key}: Vorlage fehlt: {path}", file=sys.stderr)
    return paths


def export_story(folder: StoryFolder) -> list[tuple[int, str, str, list[Path]]]:
    """Exportiert eine Geschichte und liefert [(nummer, prompt, masterprompt, vorlagen-pfade)]."""
    story = load_story(folder)
    if story is None:
        return []
    entries = collect_entries(story)
    index = load_index(folder.pictures_index)
    assigned = assign_numbers([k for k, _, _, _ in entries], index, folder.pictures_dir, "pic_*.jpg")
    save_index(folder.pictures_index, index)
    result = [(assigned[k], prompt, master, check_refs(folder, k, refs)) for k, prompt, master, refs in entries]
    lines = [
        "# Automatisch erzeugt von export_pics.py aus " + folder.yaml_path.name + " - nicht von Hand bearbeiten.",
        '# Format pro Zeile: Nummer "Prompt";"Masterprompt der Geschichte";"Vorlage1|Vorlage2" '
        "(Masterprompt und Vorlagen optional, Vorlagen relativ zu dieser Datei)",
        "",
    ]
    for number, prompt, master, refs in result:
        line = f'{number:05d} "{prompt}";' + (f'"{master}"' if master else "")
        if refs:
            line += ';"' + "|".join(p.relative_to(folder.dir).as_posix() for p in refs) + '"'
        lines.append(line)
    folder.pictures_input.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return result


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
