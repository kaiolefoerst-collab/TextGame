"""Startpunkt fuer den Prototyp der elementbasierten Erzaehl-Engine (Version 0.0).

Startet einen lokalen HTTP-Server, der das Web-Frontend aus web/ ausliefert und die
Geschichten aus Stories/<Name>/<Name>.yaml als JSON bereitstellt (Ordnerstruktur siehe
story_files.py), samt ihren Sprachdateien und Bildern. Die eigentliche Spiellogik
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
from urllib.parse import unquote, urlparse

import yaml

from pics_fields import image_entries
from story_files import STORIES_DIR, StoryFolder, load_index, load_story, save_index, story_folders
from vocs_fields import DEFAULT_SPEAKER, SPEAKERS, narrated_texts, sample_key

ROOT_DIR = Path(__file__).resolve().parent
WEB_DIR = ROOT_DIR / "web"

# Schuetzt Lese-Aendern-Schreiben-Zyklen auf self.stories/Story-Dateien, da
# ThreadingHTTPServer jede Anfrage in einem eigenen Thread bearbeitet.
STORIES_LOCK = threading.Lock()


def _represent_multiline_str(dumper: yaml.Dumper, data: str) -> yaml.ScalarNode:
    style = "|" if "\n" in data else None
    return dumper.represent_scalar("tag:yaml.org,2002:str", data, style=style)


yaml.SafeDumper.add_representer(str, _represent_multiline_str)


def load_story_files() -> tuple[dict[str, dict], dict[str, StoryFolder]]:
    """Laedt alle Geschichten (je ein Ordner unter Stories/), indiziert nach Ordnername
    (= header.id). Liefert zusaetzlich Name -> StoryFolder fuer Speichern und Medien."""
    stories: dict[str, dict] = {}
    folders: dict[str, StoryFolder] = {}
    for folder in story_folders():
        data = load_story(folder)
        if data is not None:
            stories[folder.name] = data
            folders[folder.name] = folder
    return stories, folders


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


def save_story_file(story_id: str, data: dict, folders: dict[str, StoryFolder]) -> None:
    folder = folders.get(story_id)
    if folder is None:
        raise ValueError(f"Unbekannte Story-ID '{story_id}'")
    path = folder.yaml_path
    leading_comment = extract_leading_comment(path)
    body = yaml.safe_dump(data, allow_unicode=True, sort_keys=False, default_flow_style=False, width=100)
    path.write_text(leading_comment + body, encoding="utf-8")


def enrich_with_samples(story: dict, folder: StoryFolder) -> dict:
    """Ergaenzt jedes Element um `_samples` (Feldname -> Sample-Nummer), aber nur fuer
    Textfelder, zu denen tatsaechlich schon eine samples/sample_NNNNN.mp3 existiert.
    Der Index wird bei jeder Anfrage frisch gelesen, damit neu erzeugte Samples ohne
    Server-Neustart erscheinen."""
    story = copy.deepcopy(story)
    index = load_index(folder.samples_index)
    # Nur Texte, die laut vocs_fields.narrated_texts gesprochen werden - ein altes mp3 zu
    # einem inzwischen ausgeschlossenen Text (z.B. Logbuch) wird so nie abgespielt.
    for el, field, _text, _voice in narrated_texts(story):
        number = index.get(sample_key(el["id"], field))
        if number is not None and (folder.samples_dir / f"sample_{number:05d}.mp3").is_file():
            el.setdefault("_samples", {})[field] = number
    return story


REFERENCE_SUFFIXES = (".jpg", ".jpeg", ".png", ".webp")


def reference_files(folder: StoryFolder) -> list[str]:
    """Dateinamen der Vorlagebilder einer Geschichte, alphabetisch."""
    if not folder.references_dir.is_dir():
        return []
    return sorted(p.name for p in folder.references_dir.iterdir()
                  if p.is_file() and p.suffix.lower() in REFERENCE_SUFFIXES)


def enrich_with_images(story: dict, folder: StoryFolder) -> dict:
    """Haengt `_image` (Bildnummer) an das Element (Standardbild) bzw. an den passenden
    stateImages- oder cutscene-Eintrag - nur, wenn pictures/pic_NNNNN.jpg tatsaechlich existiert.
    Welches Bild gerade gilt (Zustand), entscheidet der Browser zur Laufzeit.
    Erwartet eine bereits kopierte Story (wird in-place ergaenzt)."""
    index = load_index(folder.pictures_index)
    for el in story.get("elements", []):
        for key, _prompt, target, _refs in image_entries(el):
            number = index.get(key)
            if number is not None and (folder.pictures_dir / f"pic_{number:05d}.jpg").is_file():
                target["_image"] = number
    return story


class GameRequestHandler(BaseHTTPRequestHandler):
    stories: dict[str, dict] = {}
    story_folders: dict[str, StoryFolder] = {}

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
            folder = self.story_folders[story_id]
            payload = enrich_with_images(enrich_with_samples(story, folder), folder)
            # Positionen der Orte fuer den Editor (eigene Datei, nicht Teil der YAML).
            payload["_editorLayout"] = load_index(folder.editor_layout)
            # Verfuegbare Vorlagebilder (Stories/<Name>/vorlagen/) fuer die Auswahl im Editor.
            payload["_references"] = reference_files(folder)
            self._send_json(payload)
            return

        # Medien einer Geschichte: /stories/<Name>/samples|pictures|vorlagen/<datei>
        # (nur diese Unterordner - die YAML-Datei und Listen werden nicht ausgeliefert).
        if path.startswith("/stories/"):
            parts = unquote(path[len("/stories/"):]).split("/", 2)
            folder = self.story_folders.get(parts[0]) if parts else None
            media_dirs = {"samples": folder.samples_dir, "pictures": folder.pictures_dir,
                          "vorlagen": folder.references_dir} if folder else {}
            if len(parts) != 3 or parts[1] not in media_dirs:
                self.send_error(404, "Nicht gefunden")
                return
            media_dir = media_dirs[parts[1]]
            self._send_from_dir(media_dir.resolve(), parts[2])
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
            # Editor-Positionen getrennt von der Geschichte speichern (Stories/<Name>/editor_layout.json).
            editor_layout = data.pop("editorLayout", None) if isinstance(data, dict) else None
            if not isinstance(data, dict) or "header" not in data or "elements" not in data:
                self._send_json({"error": "Story-Objekt muss 'header' und 'elements' enthalten"}, status=400)
                return
            if data["header"].get("id") != story_id:
                self._send_json({"error": "header.id passt nicht zur URL"}, status=400)
                return
            with STORIES_LOCK:
                try:
                    save_story_file(story_id, data, self.story_folders)
                    if isinstance(editor_layout, dict):
                        save_index(self.story_folders[story_id].editor_layout, editor_layout)
                except Exception as exc:
                    self._send_json({"error": str(exc)}, status=500)
                    return
                self.stories[story_id] = data
            self._send_json({"ok": True})
            return

        self.send_error(404, "Nicht gefunden")


class ExclusiveHTTPServer(ThreadingHTTPServer):
    """Unter Windows darf sich mit SO_REUSEADDR ein zweiter Server unbemerkt auf denselben
    Port setzen - dann antwortet weiter der alte Prozess (mit veralteten Geschichten).
    Ohne Wiederverwendung bricht ein zweiter Start sofort mit einer klaren Meldung ab."""
    allow_reuse_address = False


def make_handler(stories: dict[str, dict], folders: dict[str, StoryFolder]):
    class Handler(GameRequestHandler):
        pass

    Handler.stories = stories
    Handler.story_folders = folders
    return Handler


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8000, help="Port fuer den lokalen Server (Default 8000)")
    parser.add_argument("--no-browser", action="store_true", help="Browser nicht automatisch oeffnen")
    args = parser.parse_args()

    stories, folders = load_story_files()
    if not stories:
        print(f"Keine Stories in {STORIES_DIR} gefunden. Server startet trotzdem.")
    else:
        print(f"{len(stories)} Story(s) geladen: {', '.join(stories)}")

    handler_cls = make_handler(stories, folders)
    try:
        server = ExclusiveHTTPServer(("127.0.0.1", args.port), handler_cls)
    except OSError:
        raise SystemExit(f"Port {args.port} ist schon belegt - läuft das Spiel bereits? "
                         f"Altes Fenster schließen oder einen anderen Port wählen: python game.py --port 8001")
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
