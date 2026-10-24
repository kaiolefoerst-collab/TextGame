"""Gemeinsame Logik fuer die Kopplung von Story-Bildern an generate_pictures.py.

Wird von export_pics.py (schreibt pictures_input.txt) und game.py (zeigt vorhandene Bilder
im Browser an) gleichermassen importiert, damit beide Seiten exakt dieselben Prompts
und denselben Schluesselaufbau verwenden.

Story-Felder:
  header.imageMasterPrompt  Stil-/Masterprompt fuer alle Bilder der Geschichte (optional),
                            wird als Zusatzinfo (system_instruction) mitgegeben.
  element.image             Standardbild des Elements (Prompt-Text, optional).
  element.stateImages       Liste [{state: {name: wert, ...}, prompt: "..."}] - Bild fuer einen
                            bestimmten Zustand des Elements. Das erste passende gewinnt, sonst
                            gilt das Standardbild.
  element.cutscene.image    Bild der Zwischensequenz eines Weges (Schluessel <id>:cutscene).

Vorlagebilder (Referenzen fuer einheitliches Aussehen), je Bild hoechstens MAX_REFS Dateinamen aus
Stories/<Name>/vorlagen/: element.imageRefs (zu image), stateImages[].refs (zu prompt),
cutscene.imageRefs (zu cutscene.image). generate_pictures.py schickt sie als "Vorlage 1..3" mit.

Der Schluessel eines Zustandsbilds haengt am Zustand, nicht an der Listenposition: Umsortieren
behaelt die Nummern (und damit die schon erzeugten Bilder), eine geaenderte Zustandsbedingung
bekommt dagegen bewusst eine neue Nummer.
"""

from __future__ import annotations

MAX_REFS = 3  # Gemini-Bildmodell: hoechstens 3 Bilder pro Anfrage


def ref_list(value) -> list[str]:
    """Dateinamen der Vorlagen eines Bilds (leere/ungueltige Eintraege fallen weg)."""
    if not isinstance(value, list):
        return []
    return [v.strip() for v in value if isinstance(v, str) and v.strip()]


def format_state_value(value) -> str:
    """Einheitliche Textform fuer Zustandswerte (Python schreibt sonst True statt true)."""
    if value is True:
        return "true"
    if value is False:
        return "false"
    return str(value)


def state_signature(state: dict) -> str:
    return ",".join(f"{key}={format_state_value(state[key])}" for key in sorted(state))


def image_key(element_id: str, state: dict | None = None) -> str:
    """Schluessel in Stories/<Name>/pictures_index.json (je Geschichte eine eigene Liste)."""
    base = f"{element_id}:image"
    return f"{base}@{state_signature(state)}" if state else base


def image_entries(element: dict) -> list[tuple[str, str, dict, list[str]]]:
    """Liefert (schluessel, prompt, ziel_dict, vorlagen) fuer alle Bilder eines Elements.
    ziel_dict ist das Dict, an das game.py die Bildnummer als `_image` haengt
    (das Element selbst fuer das Standardbild, sonst der stateImages- bzw. cutscene-Eintrag).
    vorlagen sind die Dateinamen der Vorlagebilder (ungekuerzt; MAX_REFS prueft der Export)."""
    entries: list[tuple[str, str, dict, list[str]]] = []
    element_id = element["id"]
    prompt = element.get("image")
    if isinstance(prompt, str) and prompt.strip():
        entries.append((image_key(element_id), prompt, element, ref_list(element.get("imageRefs"))))
    for entry in element.get("stateImages") or []:
        if not isinstance(entry, dict):
            continue
        state = entry.get("state")
        prompt = entry.get("prompt")
        if isinstance(state, dict) and state and isinstance(prompt, str) and prompt.strip():
            entries.append((image_key(element_id, state), prompt, entry, ref_list(entry.get("refs"))))
    cutscene = element.get("cutscene")
    if isinstance(cutscene, dict):
        prompt = cutscene.get("image")
        if isinstance(prompt, str) and prompt.strip():
            entries.append((f"{element_id}:cutscene", prompt, cutscene, ref_list(cutscene.get("imageRefs"))))
    return entries
