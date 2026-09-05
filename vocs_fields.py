"""Gemeinsame Konstanten fuer die Kopplung von Story-Texten an generate_samples.py.

Wird von export_vocs.py (schreibt input_vocs.txt) und game.py (spielt vorhandene
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


def sample_key(story_id: str, element_id: str, field: str) -> str:
    return f"{story_id}:{element_id}:{field}"
