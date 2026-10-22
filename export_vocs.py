"""Exportiert die zu sprechenden Texte einer Geschichte nach Stories/<Name>/samples_input.txt.

Welche Texte gesprochen werden, entscheidet vocs_fields.narrated_texts (keine Wege ausser
Zwischensequenzen, kein Logbuch, alle Meldungen). Jeder Text bekommt eine stabile, dauerhafte Nummer in
Stories/<Name>/samples_index.json: Bekannte Texte behalten ihre Nummer (damit erzeugte
samples/sample_NNNNN.mp3 weiter passen), neue bekommen die naechste freie. Verschwindet ein
Text, wird seine Nummer nie wiederverwendet.

generate_samples.py ruft den Export selbst auf; dieses Skript braucht man nur, um die
Exportliste ohne Vertonung anzusehen.

Aufruf:
    python export_vocs.py [--story <Name>]     (ohne --story: alle Geschichten)
"""

from __future__ import annotations

import argparse
import re
import sys

from story_files import StoryFolder, assign_numbers, load_index, load_story, save_index, story_folders
from vocs_fields import narrated_texts, sample_key


def collapse_for_tts(text: str) -> str:
    """Macht einen (ggf. mehrzeiligen) Erzaehltext TTS-tauglich als EINE Zeile: Zeilenumbrueche
    werden zu Leerzeichen, doppelte Anfuehrungszeichen zu einfachen, damit das Zeilenformat
    'Nummer "Text";Sprecher' eindeutig bleibt."""
    collapsed = re.sub(r"\s+", " ", text).strip()
    return collapsed.replace('"', "'")


def collect_entries(story: dict) -> list[tuple[str, str, str | None]]:
    """(schluessel, text, sprecher) in stabiler Reihenfolge. Sprecher: der des Textes
    (Element bzw. eigener Sprecher des Wortlauts), sonst die Erzaehlstimme der Geschichte,
    sonst leer (dann Standardstimme)."""
    narrator = story["header"].get("narratorVoice") or None
    return [
        (sample_key(el["id"], key), collapse_for_tts(text), voice or narrator)
        for el, key, text, voice in narrated_texts(story)
    ]


def export_story(folder: StoryFolder) -> list[tuple[int, str, str | None]]:
    """Exportiert eine Geschichte und liefert [(nummer, text, sprecher)]."""
    story = load_story(folder)
    if story is None:
        return []
    entries = collect_entries(story)
    index = load_index(folder.samples_index)
    assigned = assign_numbers([k for k, _, _ in entries], index, folder.samples_dir, "sample_*.mp3")
    save_index(folder.samples_index, index)
    lines = [
        "# Automatisch erzeugt von export_vocs.py aus " + folder.yaml_path.name + " - nicht von Hand bearbeiten.",
        "# Format pro Zeile: Nummer \"Text\";Sprecher (Sprecher optional)",
        "",
    ]
    lines += [f'{assigned[k]:05d} "{text}";{speaker or ""}' for k, text, speaker in entries]
    folder.samples_input.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return [(assigned[k], text, speaker) for k, text, speaker in entries]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--story", help="Name der Geschichte (Ordnername); ohne Angabe alle")
    args = parser.parse_args()

    folders = [f for f in story_folders() if not args.story or f.name == args.story]
    if not folders:
        sys.exit("Keine passende Geschichte unter Stories/ gefunden.")
    for folder in folders:
        entries = export_story(folder)
        print(f"{folder.name}: {len(entries)} Text(e) -> {folder.samples_input.name}")


if __name__ == "__main__":
    main()
