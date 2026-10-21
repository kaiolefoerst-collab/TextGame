"""Gemeinsame Konstanten fuer die Kopplung von Story-Texten an generate_samples.py.

Wird von export_vocs.py (schreibt samples_input.txt) und game.py (spielt vorhandene
Samples im Browser ab) gleichermassen importiert, damit beide Seiten exakt dieselben
Textfelder und denselben Schluesselaufbau verwenden. Nur Felder aus `presentation`,
die echte Erzaehltexte sind, werden vorgelesen - UI-/Meta-Text wie `exitLabel` (ein
Element-Top-Level-Feld) oder `currentHint` (ein reiner Laufzeit-State-Wert) taucht in
`presentation` ohnehin nie auf und wird darum nie erfasst.
"""

NARRATED_FIELDS = [
    "firstView", "repeatView",
    "firstUse", "repeatUse", "blockedUse",
    "openLeadView", "openLeadUse",
    "completeView", "completeUse",
    "contentText", "blockedText", "exitText",
    "heading", "body", "openQuestion", "releaseText",
]


# Sprecher, die Autoren im Editor waehlen koennen: (Kuerzel, Anzeigename, Gemini-Stimme).
# Einzige Quelle fuer generate_samples.py (SPEAKER_VOICES) und den Editor (ueber
# GET /api/voices in game.py). Kuerzel stehen in der Story-Datei (`voice:` am Element,
# `header.narratorVoice`) und in samples_input.txt - bestehende Kuerzel nie umbenennen.
SPEAKERS = [
    ("standard", "Standard (wie Männlich 1)", "Puck"),
    ("male1", "Männlich 1 – lebhaft, freundlich", "Puck"),
    ("male2", "Männlich 2 – energisch, aufgeregt", "Fenrir"),
    ("male3", "Männlich 3 – ruhig, sachlich", "Charon"),
    ("female1", "Weiblich 1 – klar, bestimmt", "Kore"),
    ("female2", "Weiblich 2 – jugendlich", "Leda"),
    ("female3", "Weiblich 3 – leicht, warm", "Aoede"),
]
DEFAULT_SPEAKER = "standard"


def sample_key(element_id: str, field: str) -> str:
    """Schluessel in Stories/<Name>/samples_index.json (je Geschichte eine eigene Liste)."""
    return f"{element_id}:{field}"


# ---------------------------------------------------------------------------
# Welche Texte werden tatsaechlich gesprochen? (mit dem Autor abgestimmt, 2026-10-21)
# ---------------------------------------------------------------------------
# 1. Fenstertexte: Was game.js (pickPresentationText) als Haupttext eines Fensters zeigt,
#    plus der Wortlaut (contentText, z.B. Inschrift, Brief, Logbuch in der Geschichte).
#    Nicht fuer Wege (type door) und nicht fuer Elemente, die beim Klick sofort woanders
#    hinfuehren - deren Fenster sieht der Spieler nie. Nicht fuer nicht-physische Elemente
#    (Wissen/Logbuch-Menue - das Logbuch wird nicht gesprochen).
# 2. Erzaehlende Meldungen: Textfelder, die eine Reaktion oder die Loesung per
#    showTextFrom einblendet (Weg versperrt, Abschiedstext, Aufloesung) - egal an welchem
#    Element sie stehen. NICHT: frei geschriebene "Zeige Meldung"-Texte (showText) und
#    Aufnehmen/Ablegen-Meldungen (takeText/dropText).

WINDOW_FIELDS = [
    "firstView", "repeatView",
    "firstUse", "repeatUse", "blockedUse",
    "openLeadView", "openLeadUse",
    "completeView", "completeUse",
    "contentText",
]

# Das Use-Feld wird nur gewaehlt, wenn das View-Feld fehlt (siehe pickPresentationText).
SHADOWED_BY = {
    "firstUse": "firstView",
    "repeatUse": "repeatView",
    "openLeadUse": "openLeadView",
    "completeUse": "completeView",
}


def leads_elsewhere(element: dict) -> bool:
    """True, wenn ein Klick ohne Bedingung zu einem anderen Element fuehrt (wie ein Weg)."""
    if element.get("type") == "door":
        return True
    for trigger in element.get("onUse") or []:
        if trigger.get("conditions"):
            continue
        for effect in trigger.get("effects") or []:
            target = effect.get("setCurrentElement") if isinstance(effect, dict) else None
            if target and target != element.get("id"):
                return True
    return False


def message_fields(story: dict) -> set[tuple[str, str]]:
    """(element_id, feld) aller Textfelder, die per showTextFrom eingeblendet werden."""
    found: set[tuple[str, str]] = set()
    effect_lists = [(story.get("resolution") or {}).get("effects") or []]
    for el in story.get("elements", []):
        for trigger in el.get("onUse") or []:
            effect_lists.append(trigger.get("effects") or [])
    for effects in effect_lists:
        for effect in effects:
            path = effect.get("showTextFrom") if isinstance(effect, dict) else None
            if isinstance(path, str):
                parts = path.split(".")
                if len(parts) == 3 and parts[1] == "presentation":
                    found.add((parts[0], parts[2]))
    return found


def narrated_texts(story: dict) -> list[tuple[dict, str, str]]:
    """Alle zu sprechenden Texte einer Geschichte als (element, feld, text), in stabiler
    Reihenfolge (Elemente wie in der Datei, Felder wie in NARRATED_FIELDS)."""
    messages = message_fields(story)
    result: list[tuple[dict, str, str]] = []
    for el in story.get("elements", []):
        presentation = el.get("presentation") or {}
        window_shown = el.get("physical", True) is not False and not leads_elsewhere(el)
        extra = [f for (eid, f) in sorted(messages) if eid == el.get("id") and f not in NARRATED_FIELDS]
        for field in NARRATED_FIELDS + extra:
            text = presentation.get(field)
            if not isinstance(text, str) or not text.strip():
                continue
            is_window_text = (
                window_shown
                and field in WINDOW_FIELDS
                and not (field in SHADOWED_BY and presentation.get(SHADOWED_BY[field]))
            )
            if is_window_text or (el.get("id"), field) in messages:
                result.append((el, field, text))
    return result
