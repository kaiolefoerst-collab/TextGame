"""Gemeinsame Regeln fuer die Kopplung von Story-Texten an generate_samples.py.

Wird von export_vocs.py (schreibt samples_input.txt) und game.py (spielt vorhandene
Samples im Browser ab) gleichermassen importiert, damit beide Seiten exakt dieselben
Texte und denselben Schluesselaufbau verwenden.

Textmodell (Aenderung 2, 2026-10-21) je Element:
  presentation.firstView / repeatView   Erste / Erneute Betrachtung (feste Texte)
  stateTexts: [{id, conditions, firstView, repeatView}]
                                        Texte fuer einen Zustand; der oberste passende
                                        ersetzt die festen Texte (Bedingungen wie bei Reaktionen)
  presentation.contentText              Wortlaut (Brief, Inschrift ...), wird angehaengt;
                                        eigener Sprecher ueber element.contentVoice
  messages: {Name: Text}                frei benannte Meldungen, eingeblendet per Reaktion
                                        ("showTextFrom": "<elementId>.messages.<Name>")
  presentation.body / openQuestion / style   Logbuch (wird nicht gesprochen)
  cutscene.text                         Text der Zwischensequenz eines Weges (Schluessel "cutscene")
"""

# Sprecher, die Autoren im Editor waehlen koennen: (Kuerzel, Anzeigename, Gemini-Stimme).
# Einzige Quelle fuer generate_samples.py (SPEAKER_VOICES) und den Editor (ueber
# GET /api/voices in game.py). Kuerzel stehen in der Story-Datei (`voice:` / `contentVoice:`
# am Element, `header.narratorVoice`) und in samples_input.txt - bestehende Kuerzel nie umbenennen.
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

VIEW_FIELDS = ["firstView", "repeatView"]


def sample_key(element_id: str, field: str) -> str:
    """Schluessel in Stories/<Name>/samples_index.json (je Geschichte eine eigene Liste).
    `field` ist z.B. "firstView", "contentText", "stateText:zt_1:repeatView" oder
    "message:Weg versperrt" - dieselben Namen nutzt game.js fuer el._samples."""
    return f"{element_id}:{field}"


# ---------------------------------------------------------------------------
# Welche Texte werden tatsaechlich gesprochen? (mit dem Autor abgestimmt)
# ---------------------------------------------------------------------------
# 1. Fenstertexte: erste/erneute Betrachtung, alle Zustandstexte und der Wortlaut.
#    Nicht fuer Wege (type door) und nicht fuer Elemente, die beim Klick sofort woanders
#    hinfuehren - deren Fenster sieht der Spieler nie. Nicht fuer nicht-physische Elemente
#    (Wissen/Logbuch - das Logbuch wird nicht gesprochen).
# 2. Zwischensequenzen von Wegen (cutscene.text) - die einzigen gesprochenen Texte eines Weges.
# 3. Erzaehlende Meldungen: Meldungsfelder, die eine Reaktion oder die Loesung per
#    showTextFrom einblendet - egal an welchem Element sie stehen. NICHT: frei geschriebene
#    "Zeige Kurztext"-Texte (showText) und Aufnehmen/Ablegen-Meldungen (takeText/dropText).


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


def message_refs(story: dict) -> list[tuple[str, str, str]]:
    """(element_id, bereich, name) aller per showTextFrom eingeblendeten Texte, in der
    Reihenfolge ihres Auftretens. bereich ist "messages" (neu) oder "presentation" (alt)."""
    found: list[tuple[str, str, str]] = []
    effect_lists = [(story.get("resolution") or {}).get("effects") or []]
    for el in story.get("elements", []):
        for trigger in el.get("onUse") or []:
            effect_lists.append(trigger.get("effects") or [])
    for effects in effect_lists:
        for effect in effects:
            path = effect.get("showTextFrom") if isinstance(effect, dict) else None
            if isinstance(path, str):
                ref = tuple(path.split(".", 2))
                if len(ref) == 3 and ref[1] in ("messages", "presentation") and ref not in found:
                    found.append(ref)
    return found


def narrated_texts(story: dict) -> list[tuple[dict, str, str, str | None]]:
    """Alle zu sprechenden Texte einer Geschichte als (element, schluessel, text, sprecher),
    in stabiler Reihenfolge. sprecher ist None, wenn die Erzaehlstimme gelten soll."""
    refs = message_refs(story)
    result: list[tuple[dict, str, str, str | None]] = []

    def add(el, key, text, voice):
        if isinstance(text, str) and text.strip():
            result.append((el, key, text, voice))

    for el in story.get("elements", []):
        presentation = el.get("presentation") or {}
        voice = el.get("voice") or None
        if el.get("physical", True) is not False and not leads_elsewhere(el):
            for field in VIEW_FIELDS:
                add(el, field, presentation.get(field), voice)
            for st in el.get("stateTexts") or []:
                if isinstance(st, dict) and st.get("id"):
                    for field in VIEW_FIELDS:
                        add(el, f"stateText:{st['id']}:{field}", st.get(field), voice)
            add(el, "contentText", presentation.get("contentText"), el.get("contentVoice") or voice)
        cutscene = el.get("cutscene")
        if el.get("type") == "door" and isinstance(cutscene, dict):
            add(el, "cutscene", cutscene.get("text"), voice)
        for eid, area, name in refs:
            if eid != el.get("id"):
                continue
            if area == "messages":
                add(el, f"message:{name}", (el.get("messages") or {}).get(name), voice)
            elif name not in VIEW_FIELDS and name != "contentText":  # alte Stories
                add(el, name, presentation.get(name), voice)
    return result
