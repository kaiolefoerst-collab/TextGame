"""Startpunkt fuer den Prototyp der elementbasierten Erzaehl-Engine (Version 0.0).

Startet einen lokalen HTTP-Server, der das Web-Frontend aus web/ ausliefert und
Story-Dateien aus Stories/*.yaml als JSON bereitstellt. Die eigentliche Spiellogik
(Trigger, Bedingungen, Effekte, Fenster-Navigation) laeuft im Browser (web/game.js).

Aufruf:
    python game.py [--port 8000] [--no-browser]
"""

from __future__ import annotations

import argparse
import copy
import json
import mimetypes
import threading
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

import yaml

from pics_fields import image_entries, image_key
from vocs_fields import DEFAULT_SPEAKER, SPEAKERS, narrated_texts, sample_key

ROOT_DIR = Path(__file__).resolve().parent
STORIES_DIR = ROOT_DIR / "Stories"
WEB_DIR = ROOT_DIR / "web"
OUTPUT_VOCS_DIR = ROOT_DIR / "output_vocs"
VOCS_INDEX_PATH = ROOT_DIR / ".vocs_index.json"
OUTPUT_PICS_DIR = ROOT_DIR / "output_pics"
PICS_INDEX_PATH = ROOT_DIR / ".pics_index.json"

# Schuetzt Lese-Aendern-Schreiben-Zyklen auf self.stories/Story-Dateien, da
# ThreadingHTTPServer jede Anfrage in einem eigenen Thread bearbeitet.
STORIES_LOCK = threading.Lock()


def _represent_multiline_str(dumper: yaml.Dumper, data: str) -> yaml.ScalarNode:
    style = "|" if "\n" in data else None
    return dumper.represent_scalar("tag:yaml.org,2002:str", data, style=style)


yaml.SafeDumper.add_representer(str, _represent_multiline_str)


def load_story_files() -> tuple[dict[str, dict], dict[str, Path]]:
    """Laedt alle Story-YAML-Dateien aus STORIES_DIR, indiziert nach header.id.
    Liefert zusaetzlich eine story_id -> Dateipfad Zuordnung fuer den Editor-Speicherpfad."""
    stories: dict[str, dict] = {}
    paths: dict[str, Path] = {}
    if not STORIES_DIR.exists():
        return stories, paths
    for path in sorted(STORIES_DIR.glob("*.yaml")):
        with path.open("r", encoding="utf-8") as f:
            data = yaml.safe_load(f)
        if not data or "header" not in data:
            print(f"Warnung: {path.name} hat keinen 'header' und wird uebersprungen.")
            continue
        story_id = data["header"].get("id")
        if not story_id:
            print(f"Warnung: {path.name} hat keine header.id und wird uebersprungen.")
            continue
        if story_id in stories:
            print(f"Warnung: doppelte Story-ID '{story_id}' in {path.name}, vorherige wird ueberschrieben.")
        stories[story_id] = data
        paths[story_id] = path
    return stories, paths


def extract_leading_comment(path: Path) -> str:
    """Liest den Kommentar-/Leerzeilen-Block am Dateianfang (vor der ersten
    Nicht-Kommentarzeile). yaml.safe_dump kennt keine Kommentare, darum wird dieser
    Block beim Zurueckschreiben aus dem Editor manuell erhalten."""
    lines = []
    with path.open("r", encoding="utf-8") as f:
        for line in f:
            if line.strip() == "" or line.lstrip().startswith("#"):
                lines.append(line)
            else:
                break
    return "".join(lines)


def save_story_file(story_id: str, data: dict, paths: dict[str, Path]) -> None:
    path = paths.get(story_id)
    if path is None:
        raise ValueError(f"Unbekannte Story-ID '{story_id}'")
    leading_comment = extract_leading_comment(path)
    body = yaml.safe_dump(data, allow_unicode=True, sort_keys=False, default_flow_style=False, width=100)
    path.write_text(leading_comment + body, encoding="utf-8")


def load_vocs_index() -> dict[str, int]:
    """Liest .vocs_index.json (von export_vocs.py geschrieben) bei jeder Anfrage frisch ein,
    damit neu erzeugte Samples ohne Server-Neustart sichtbar werden."""
    if not VOCS_INDEX_PATH.exists():
        return {}
    with VOCS_INDEX_PATH.open("r", encoding="utf-8") as f:
        return json.load(f)


def enrich_with_samples(story: dict) -> dict:
    """Ergaenzt jedes Element um `_samples` (Feldname -> Sample-Nummer), aber nur fuer
    Textfelder, zu denen tatsaechlich schon eine output_vocs/sample_NNNNN.mp3 existiert.
    Der Browser muss so nicht wissen, wie Nummern vergeben werden - er bekommt fertige,
    abspielbare Zuordnungen."""
    story = copy.deepcopy(story)
    index = load_vocs_index()
    story_id = story["header"]["id"]
    # Nur Texte, die laut vocs_fields.narrated_texts gesprochen werden - ein altes mp3 zu
    # einem inzwischen ausgeschlossenen Text (z.B. Logbuch) wird so nie abgespielt.
    for el, field, _text in narrated_texts(story):
        number = index.get(sample_key(story_id, el["id"], field))
        if number is not None and (OUTPUT_VOCS_DIR / f"sample_{number:05d}.mp3").is_file():
            el.setdefault("_samples", {})[field] = number
    return story


def load_pics_index() -> dict[str, int]:
    """Wie load_vocs_index: bei jeder Anfrage frisch, damit neue Bilder ohne Neustart erscheinen."""
    if not PICS_INDEX_PATH.exists():
        return {}
    with PICS_INDEX_PATH.open("r", encoding="utf-8") as f:
        return json.load(f)


def enrich_with_images(story: dict) -> dict:
    """Haengt `_image` (Bildnummer) an das Element (Standardbild) bzw. an den passenden
    stateImages-Eintrag - nur, wenn output_pics/pic_NNNNN.jpg tatsaechlich existiert.
    Welches Bild gerade gilt (Zustand), entscheidet der Browser zur Laufzeit.
    Erwartet eine bereits kopierte Story (wird in-place ergaenzt)."""
    index = load_pics_index()
    story_id = story["header"]["id"]
    for el in story.get("elements", []):
        for state, _prompt, target in image_entries(el):
            number = index.get(image_key(story_id, el["id"], state))
            if number is not None and (OUTPUT_PICS_DIR / f"pic_{number:05d}.jpg").is_file():
                target["_image"] = number
    return story


class GameRequestHandler(BaseHTTPRequestHandler):
    stories: dict[str, dict] = {}
    story_paths: dict[str, Path] = {}

    def log_message(self, format, *args):  # noqa: A002 - stdlib signature
        print(f"[{self.address_string()}] {format % args}")

    def _send_json(self, payload, status: int = 200) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _send_from_dir(self, root_dir: Path, rel_path: str) -> None:
        if rel_path == "" or rel_path == "/":
            rel_path = "index.html"
        rel_path = rel_path.lstrip("/")
        candidate = (root_dir / rel_path).resolve()
        if root_dir not in candidate.parents and candidate != root_dir:
            self.send_error(403, "Verboten")
            return
        if not candidate.is_file():
            self.send_error(404, "Nicht gefunden")
            return
        content_type, _ = mimetypes.guess_type(str(candidate))
        body = candidate.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", content_type or "application/octet-stream")
        self.send_header("Content-Length", str(len(body)))
        # Neu erzeugte Sprach-/Bilddateien behalten ihren Namen (sample_00066.mp3) - ohne
        # diesen Header spielt der Browser sonst die alte Fassung aus seinem Zwischenspeicher.
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:  # noqa: N802 - stdlib method name
        parsed = urlparse(self.path)
        path = parsed.path

        if path == "/api/stories":
            index = [
                {
                    "id": story["header"]["id"],
                    "title": story["header"].get("title", story["header"]["id"]),
                    "author": story["header"].get("author", ""),
                    "teaser": story["header"].get("teaser", ""),
                    "partOf": story["header"].get("partOf"),
                    "chapterIndex": story["header"].get("chapterIndex"),
                }
                for story in self.stories.values()
            ]
            self._send_json(index)
            return

        if path == "/api/voices":
            # Sprecherliste fuer den Editor - dieselbe Quelle wie generate_samples.py.
            self._send_json({
                "default": DEFAULT_SPEAKER,
                "speakers": [{"id": key, "label": label, "voice": voice} for key, label, voice in SPEAKERS],
            })
            return

        if path.startswith("/api/story/"):
            story_id = path[len("/api/story/"):]
            story = self.stories.get(story_id)
            if story is None:
                self._send_json({"error": f"Unbekannte Story-ID '{story_id}'"}, status=404)
                return
            self._send_json(enrich_with_images(enrich_with_samples(story)))
            return

        if path.startswith("/output_vocs/"):
            self._send_from_dir(OUTPUT_VOCS_DIR, path[len("/output_vocs/"):])
            return

        if path.startswith("/output_pics/"):
            self._send_from_dir(OUTPUT_PICS_DIR, path[len("/output_pics/"):])
            return

        self._send_from_dir(WEB_DIR, path)

    def do_POST(self) -> None:  # noqa: N802 - stdlib method name
        parsed = urlparse(self.path)
        path = parsed.path

        if path.startswith("/api/story/"):
            story_id = path[len("/api/story/"):]
            if story_id not in self.stories:
                self._send_json({"error": f"Unbekannte Story-ID '{story_id}'"}, status=404)
                return
            length = int(self.headers.get("Content-Length", 0))
            raw = self.rfile.read(length) if length else b""
            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                self._send_json({"error": "Ungueltiges JSON im Request-Body"}, status=400)
                return
            if not isinstance(data, dict) or "header" not in data or "elements" not in data:
                self._send_json({"error": "Story-Objekt muss 'header' und 'elements' enthalten"}, status=400)
                return
            if data["header"].get("id") != story_id:
                self._send_json({"error": "header.id passt nicht zur URL"}, status=400)
                return
            with STORIES_LOCK:
                try:
                    save_story_file(story_id, data, self.story_paths)
                except Exception as exc:
                    self._send_json({"error": str(exc)}, status=500)
                    return
                self.stories[story_id] = data
            self._send_json({"ok": True})
            return

        self.send_error(404, "Nicht gefunden")


def make_handler(stories: dict[str, dict], story_paths: dict[str, Path]):
    class Handler(GameRequestHandler):
        pass

    Handler.stories = stories
    Handler.story_paths = story_paths
    return Handler


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8000, help="Port fuer den lokalen Server (Default 8000)")
    parser.add_argument("--no-browser", action="store_true", help="Browser nicht automatisch oeffnen")
    args = parser.parse_args()

    stories, story_paths = load_story_files()
    if not stories:
        print(f"Keine Stories in {STORIES_DIR} gefunden. Server startet trotzdem.")
    else:
        print(f"{len(stories)} Story(s) geladen: {', '.join(stories)}")

    handler_cls = make_handler(stories, story_paths)
    server = ThreadingHTTPServer(("127.0.0.1", args.port), handler_cls)
    url = f"http://127.0.0.1:{args.port}/"
    print(f"Server laeuft auf {url} (Strg+C zum Beenden)")

    if not args.no_browser:
        webbrowser.open(url)

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer wird beendet.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
