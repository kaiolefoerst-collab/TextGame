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

Der Schluessel eines Zustandsbilds haengt am Zustand, nicht an der Listenposition: Umsortieren
behaelt die Nummern (und damit die schon erzeugten Bilder), eine geaenderte Zustandsbedingung
bekommt dagegen bewusst eine neue Nummer.
"""

from __future__ import annotations


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


def image_entries(element: dict) -> list[tuple[dict | None, str, dict]]:
    """Liefert (zustand_oder_None, prompt, ziel_dict) fuer alle Bilder eines Elements.
    ziel_dict ist das Dict, an das game.py die Bildnummer als `_image` haengt
    (das Element selbst fuer das Standardbild, sonst der stateImages-Eintrag)."""
    entries: list[tuple[dict | None, str, dict]] = []
    prompt = element.get("image")
    if isinstance(prompt, str) and prompt.strip():
        entries.append((None, prompt, element))
    for entry in element.get("stateImages") or []:
        if not isinstance(entry, dict):
            continue
        state = entry.get("state")
        prompt = entry.get("prompt")
        if isinstance(state, dict) and state and isinstance(prompt, str) and prompt.strip():
            entries.append((state, prompt, entry))
    return entries
