"""Erstellt Bild-Prompts fuer Vorlagebilder und erzeugt die Bilder via Gemini.

Vorlagebilder zeigen ein wiederkehrendes Motiv einmal vollstaendig und gut erkennbar. Sie sollen
spaeter als Referenz dienen, damit das Motiv auf allen Bildern einer Geschichte gleich aussieht.

Die Beschreibung der Motive kommt aus den Prompt-Bausteinen in Stories/<Name>/Schiffe.md
(Abschnitte **Prompt-Baustein „…“** mit einem Zitatblock darunter) - das Dokument bleibt die
einzige Quelle. Der Masterprompt der Geschichte (header.imageMasterPrompt) geht wie bei
generate_pictures.py als system_instruction mit.

Ausgabe: Stories/<Name>/vorlagen/<schluessel>.jpg, dazu vorlagen_prompts.txt (die fertigen
Prompts zum Nachlesen) und .manifest.json (unveraenderte Vorlagen werden uebersprungen).

Eine Vorlage kann selbst bis zu 3 Vorlagen bekommen ("refs", Dateinamen in vorlagen/), z.B. das
Cockpit die Aussenansicht der Glover (derzeit nicht genutzt). Sie werden in der Reihenfolge von
VORLAGEN erzeugt; eine Vorlage
darf nur auf eine vorher stehende oder schon vorhandene Datei verweisen (keine Zirkel). Der Inhalt
der Vorlagedateien geht in den Hash ein: Entsteht eine Vorlage neu, entstehen die abhaengigen mit.

Zuschnitt ("crop", Anteil 0 < x < 1): Nach dem Erzeugen bleibt nur der obere Teil des Bildes stehen
(Hoehe und Breite je x, waagerecht mittig, damit es 16:9 bleibt), danach wird es wieder auf die
urspruengliche Groesse gebracht. Fuer Motive, bei denen das Modell den Ausschnitt nicht zuverlaessig
einhaelt (Cockpit: unten immer ein Stueck Innenraum). Der Zuschnitt geht in den Hash ein.

Space Trace: Glover und Hoffnung von aussen, dazu der Blick aus der Glover-Kanzel.

    python generate_picprompt.py --dry-run          # nur Prompts anzeigen und schreiben
    python generate_picprompt.py                    # Rueckfrage, dann alle fehlenden/geaenderten erzeugen
    python generate_picprompt.py --only glover_cockpit --force
"""

import argparse
import os
import re
import subprocess
import sys

from dotenv import load_dotenv
from google import genai

import generate_pictures as gp
from export_pics import collapse_prompt
from story_files import load_story, story_folders

# Je Vorlage: Schluessel (= Dateiname), Name des Bausteins in Schiffe.md, Bildrahmen.
# {baustein} wird durch den Zitatblock des Bausteins ersetzt.
VORLAGEN = {
    "SpaceTrace": [
        {
            "key": "glover_aussen",
            "baustein": "Glover außen",
            "prompt": (
                "Vorlagebild eines Raumschiffs, das in vielen weiteren Bildern genau gleich aussehen soll. Weltraumszene: "
                "{baustein}. Das ganze Schiff ist vollständig, groß und scharf im Bild, in seitlicher Dreiviertelansicht "
                "schräg von vorne, sodass die spitz zulaufende Bugsektion mit der großen Panoramascheibe, der große "
                "Frachtteil, die Steuerdüsen, die Landestützen und der Schriftzug gut zu erkennen sind. Der Frachtteil ist "
                "deutlich größer als die Bugsektion. Dahinter tiefschwarzes Weltall mit Sternen, keine Planeten. Das Schiff "
                "treibt ruhig, alle Triebwerke und Düsen sind aus. Klares, kühles Licht von einer Seite, damit Form, Farben "
                "und Markierungen deutlich zu sehen sind."
            ),
        },
        {
            "key": "hoffnung_aussen",
            "baustein": "Hoffnung außen",
            "prompt": (
                "Vorlagebild eines Raumschiffs, das in vielen weiteren Bildern genau gleich aussehen soll. Weltraumszene: "
                "{baustein}. Das ganze Rad ist vollständig im Bild, fast frontal von vorne gesehen und nur leicht "
                "schräg, sodass man auf die flache Radfläche blickt: außen der große Ring, darin der kleinere Ring, in "
                "der Mitte die Nabe mit der Hangaröffnung, dazwischen Speichen und Streben. Nur ein einziges Rad, kein "
                "zweiter Ring quer dazu. Dahinter tiefschwarzes Weltall mit Sternen, keine Planeten. "
                "Schwaches, kühles Sternenlicht von einer Seite modelliert die Form, der Rest liegt im Schatten."
            ),
        },
        {
            "key": "glover_cockpit",
            "baustein": "Glover-Kanzel von innen",
            # Vom Autor gewaehltes Bild (frueheres Spielbild aus Git). Bewusst ohne refs und crop: Es soll sich
            # nur aendern, wenn sich der Prompt aendert - nicht, wenn eine neue Aussenansicht entsteht.
            "prompt": (
                "Vorlagebild für das Cockpit eines Raumschiffs, das in vielen weiteren Bildern genau gleich aussehen soll. "
                "{baustein}."
            ),
        },
    ],
}
MAX_REFS = 3

def crop_top(path, share):
    """Behaelt den oberen Anteil `share` des Bildes (Hoehe und Breite, waagerecht mittig, bleibt 16:9)
    und skaliert wieder auf die urspruengliche Groesse."""
    tmp = path.with_suffix(".crop.jpg")
    vf = (f"crop=trunc(iw*{share}/2)*2:trunc(ih*{share}/2)*2:(iw-trunc(iw*{share}/2)*2)/2:0,"
          f"scale=trunc(iw/{share}/2)*2:trunc(ih/{share}/2)*2:flags=lanczos")
    result = subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(path), "-vf", vf, "-q:v", "3", str(tmp)],
                            stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg-Zuschnitt fehlgeschlagen: {result.stderr.decode(errors='replace')}")
    tmp.replace(path)


def hash_prompt(prompt, crop):
    """Prompt fuer den Aenderungs-Hash; ohne Zuschnitt unveraendert (bestehende Vorlagen bleiben aktuell)."""
    return prompt if not crop else f"{prompt}\x1fcrop:{crop}"


BAUSTEIN_RE = re.compile(r"\*\*Prompt-Baustein „(?P<name>[^“]+)“\*\*[^\n]*\n\s*\n(?P<quote>(?:>[^\n]*\n?)+)")


def read_bausteine(path):
    """{Name: Text} aller Prompt-Bausteine im Dokument (Zitatblock, Zeilen zusammengefuegt)."""
    text = path.read_text(encoding="utf-8")
    bausteine = {}
    for match in BAUSTEIN_RE.finditer(text):
        lines = [line.lstrip(">").strip() for line in match.group("quote").splitlines()]
        bausteine[match.group("name")] = " ".join(line for line in lines if line)
    return bausteine


def build_entries(folder, only):
    """[(schluessel, prompt, vorlagen-pfade, zuschnitt)] der gewaehlten Vorlagen einer Geschichte, in
    Erzeugungsreihenfolge. Prueft, dass jede Vorlage nur auf Vorhergehendes oder Vorhandenes verweist."""
    if not folder.ships_doc.exists():
        sys.exit(f"Fehler: {folder.ships_doc} fehlt - dort stehen die Prompt-Bausteine.")
    bausteine = read_bausteine(folder.ships_doc)
    entries = []
    earlier = set()
    for vorlage in VORLAGEN[folder.name]:
        key = vorlage["key"]
        refs = vorlage.get("refs", [])
        if len(refs) > MAX_REFS:
            sys.exit(f"Fehler: {key} hat {len(refs)} Vorlagen, erlaubt sind {MAX_REFS}.")
        for ref in refs:
            if ref not in earlier and not (folder.references_dir / ref).is_file():
                sys.exit(f"Fehler: {key} verweist auf {ref}, das weder vorher erzeugt wird noch in "
                         f"{folder.references_dir} liegt.")
        earlier.add(f"{key}.jpg")
        if only and key not in only:
            continue
        if vorlage["baustein"] not in bausteine:
            sys.exit(f"Fehler: Baustein „{vorlage['baustein']}“ nicht in {folder.ships_doc.name} gefunden "
                     f"(gefunden: {', '.join(bausteine) or 'keine'}).")
        prompt = vorlage["prompt"].format(baustein=bausteine[vorlage["baustein"]])
        crop = vorlage.get("crop")
        if crop is not None and not 0 < crop < 1:
            sys.exit(f"Fehler: {key}: crop muss zwischen 0 und 1 liegen, ist {crop}.")
        entries.append((key, collapse_prompt(prompt), [folder.references_dir / ref for ref in refs], crop))
    return entries


def write_prompts(out_dir, entries, master):
    lines = ["# Automatisch erzeugt von generate_picprompt.py - nicht von Hand bearbeiten.",
             "# Quelle: Prompt-Bausteine in Schiffe.md; Masterprompt als system_instruction.", ""]
    for key, prompt, refs, crop in entries:
        lines += [f"[{key}]"] + [f"Vorlage {i}: {ref.name}" for i, ref in enumerate(refs, start=1)]
        lines += ([f"Zuschnitt: obere {crop:.0%}"] if crop else []) + [prompt, ""]
    lines += ["[Masterprompt]", master.strip(), ""]
    (out_dir / "vorlagen_prompts.txt").write_text("\n".join(lines), encoding="utf-8")


def main():
    parser = argparse.ArgumentParser(description="Erstellt Prompts fuer Vorlagebilder aus Schiffe.md und erzeugt die Bilder.")
    parser.add_argument("--story", default="SpaceTrace", help="Geschichte (Ordnername unter Stories/), Standard: SpaceTrace")
    parser.add_argument("--only", nargs="+", help="Nur diese Vorlagen, z.B. glover_aussen hoffnung_aussen")
    parser.add_argument("--model", default=gp.DEFAULT_MODEL, help=f"Gemini Bildmodell (default: {gp.DEFAULT_MODEL})")
    parser.add_argument("--force", action="store_true", help="Auch unveraenderte Vorlagen neu erzeugen")
    parser.add_argument("--yes", "-y", action="store_true", help="Keine Rueckfrage vor dem Erzeugen")
    parser.add_argument("--dry-run", action="store_true", help="Nur Prompts anzeigen und schreiben - keine API-Aufrufe")
    args = parser.parse_args()

    folder = next((f for f in story_folders() if f.name == args.story), None)
    if folder is None or args.story not in VORLAGEN:
        sys.exit(f"Fuer '{args.story}' sind keine Vorlagen definiert. Moeglich: {', '.join(VORLAGEN)}")
    story = load_story(folder)
    master = story["header"].get("imageMasterPrompt") or ""
    entries = build_entries(folder, args.only)
    if not entries:
        sys.exit("Keine passende Vorlage gewaehlt.")

    out_dir = folder.references_dir
    out_dir.mkdir(exist_ok=True)
    write_prompts(out_dir, entries, master)
    extra = collapse_prompt(master)  # genau wie bei den Spielbildern (export_pics.py)

    # Immer laden: --force entscheidet nur, was neu entsteht, und darf die Eintraege der nicht
    # gewaehlten Vorlagen (--only) nicht verwerfen.
    manifest = gp.load_manifest(str(out_dir))

    def is_current(key, prompt, refs, crop):
        return (manifest.get(key) == gp.content_hash(hash_prompt(prompt, crop), extra, args.model, refs)
                and (out_dir / f"{key}.jpg").exists())

    # Eine Vorlage entsteht neu, wenn sie selbst veraltet ist oder eine ihrer Vorlagen in diesem
    # Lauf neu entsteht (entries steht in Erzeugungsreihenfolge, Abhaengigkeiten also davor).
    todo = []
    reasons = {}
    for key, prompt, refs, crop in entries:
        changed_deps = [ref.stem for ref in refs if ref.stem in todo]
        if args.force or not is_current(key, prompt, refs, crop) or changed_deps:
            todo.append(key)
            if changed_deps and not args.force and is_current(key, prompt, refs, crop):
                reasons[key] = f"weil {', '.join(changed_deps)} neu entsteht"

    for key, prompt, refs, crop in entries:
        status = ("zu erzeugen" + (f", {reasons[key]}" if key in reasons else "")) if key in todo else "aktuell"
        vorlagen = "".join(f"\n  Vorlage {i}: {ref.name}" for i, ref in enumerate(refs, start=1))
        vorlagen += f"\n  Zuschnitt: obere {crop:.0%}" if crop else ""
        print(f"[{key}] ({status}){vorlagen}\n  {prompt}\n")
    print(f"Prompts geschrieben: {out_dir / 'vorlagen_prompts.txt'}")
    if not todo:
        print("Alle Vorlagen sind aktuell - nichts zu tun.")
        return
    if args.dry_run:
        print(f"Probelauf - {len(todo)} Vorlage(n) wuerden erzeugt, es wurde nichts erzeugt.")
        return

    load_dotenv(gp.ROOT_DIR / ".env")
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        sys.exit("Fehler: GEMINI_API_KEY ist nicht gesetzt. Lege eine .env an.")
    if not args.yes:
        answer = gp.ask(f"{len(todo)} Vorlagebild(er) jetzt erzeugen ({', '.join(todo)})? Das kostet API-Aufrufe. [j/N] ").lower()
        if answer not in ("j", "ja", "y", "yes"):
            print("Abgebrochen.")
            return

    client = genai.Client(api_key=api_key)
    made = 0
    failed = []
    for key, prompt, refs, crop in entries:
        if key not in todo:
            continue
        broken = [ref.stem for ref in refs if ref.stem in failed]
        if broken:
            print(f"[{key}] übersprungen: Vorlage {', '.join(broken)} ist fehlgeschlagen.", file=sys.stderr)
            failed.append(key)
            continue
        out_path = out_dir / f"{key}.jpg"
        print(f"[{key}] erzeuge ..." + (f" (Vorlagen: {', '.join(r.name for r in refs)})" if refs else ""))
        try:
            gp.image_to_jpeg(gp.synthesize(client, args.model, prompt, extra, refs), str(out_path))
            if crop:
                crop_top(out_path, crop)
            # Hash erst jetzt: die Vorlagedateien koennen in diesem Lauf neu entstanden sein.
            manifest[key] = gp.content_hash(hash_prompt(prompt, crop), extra, args.model, refs)
            gp.save_manifest(str(out_dir), manifest)
            made += 1
            print(f"  gespeichert: {out_path}")
        except Exception as exc:
            print(f"  Fehler bei {key}: {exc}", file=sys.stderr)
            failed.append(key)
    print(f"Fertig: {made} erzeugt, {len(failed)} fehlgeschlagen.")


if __name__ == "__main__":
    main()
