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
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

import yaml

from vocs_fields import NARRATED_FIELDS, sample_key

ROOT_DIR = Path(__file__).resolve().parent
STORIES_DIR = ROOT_DIR / "Stories"
WEB_DIR = ROOT_DIR / "web"
OUTPUT_VOCS_DIR = ROOT_DIR / "output_vocs"
VOCS_INDEX_PATH = ROOT_DIR / ".vocs_index.json"


def load_story_files() -> dict[str, dict]:
    """Laedt alle Story-YAML-Dateien aus STORIES_DIR, indiziert nach header.id."""
    stories: dict[str, dict] = {}
    if not STORIES_DIR.exists():
        return stories
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
    return stories


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
    for el in story.get("elements", []):
        presentation = el.get("presentation") or {}
        samples: dict[str, int] = {}
        for field in NARRATED_FIELDS:
            value = presentation.get(field)
            if not isinstance(value, str) or not value.strip():
                continue
            number = index.get(sample_key(story_id, el["id"], field))
            if number is None:
                continue
            if (OUTPUT_VOCS_DIR / f"sample_{number:05d}.mp3").is_file():
                samples[field] = number
        if samples:
            el["_samples"] = samples
    return story


class GameRequestHandler(BaseHTTPRequestHandler):
    stories: dict[str, dict] = {}

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

        if path.startswith("/api/story/"):
            story_id = path[len("/api/story/"):]
            story = self.stories.get(story_id)
            if story is None:
                self._send_json({"error": f"Unbekannte Story-ID '{story_id}'"}, status=404)
                return
            self._send_json(enrich_with_samples(story))
            return

        if path.startswith("/output_vocs/"):
            self._send_from_dir(OUTPUT_VOCS_DIR, path[len("/output_vocs/"):])
            return

        self._send_from_dir(WEB_DIR, path)


def make_handler(stories: dict[str, dict]):
    class Handler(GameRequestHandler):
        pass

    Handler.stories = stories
    return Handler


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8000, help="Port fuer den lokalen Server (Default 8000)")
    parser.add_argument("--no-browser", action="store_true", help="Browser nicht automatisch oeffnen")
    args = parser.parse_args()

    stories = load_story_files()
    if not stories:
        print(f"Keine Stories in {STORIES_DIR} gefunden. Server startet trotzdem.")
    else:
        print(f"{len(stories)} Story(s) geladen: {', '.join(stories)}")

    handler_cls = make_handler(stories)
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
