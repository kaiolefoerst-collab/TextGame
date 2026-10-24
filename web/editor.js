'use strict';

/* Story-Editor: zeigt physische Orte (Ellipsen) samt Verbindungen (Pfeile via
 * Tuer-Elementen) und erlaubt rekursives Aufklappen + Bearbeiten aller Texte,
 * analog zum Fenster-Stapel des Spiels, aber ohne Spiel-Logik (Trigger/State).
 * Nutzt escapeHtml() und showScreen() aus game.js (im selben Dokument geladen).
 */

// PLAYER_ID kommt aus game.js (gemeinsamer globaler Scope beider Scripts).

// Orte haben einen einzigen Typ "location" und liegen immer auf oberster Ebene - man erreicht
// sie nur ueber Wege. room/area/building sind die frueheren Typen (aeltere Dateien).
const LOCATION_TYPES = ['location', 'room', 'area', 'building'];

// Element-Typen, bei denen ein Wortlaut (wörtlicher Inhalt) Sinn ergibt.
const DOCUMENT_TYPES = ['document', 'document_entry', 'document_collection', 'inscription'];

// ---------------------------------------------------------------------
// Erklaerungen fuer Roll-Over-Tooltips. Die Texte beschreiben, was das Spiel
// (game.js: pickPresentationText, applyEffect, renderLog) tatsaechlich mit dem
// jeweiligen Feld macht - bei Aenderungen an der Spiellogik hier mitpflegen.
// Textmodell: siehe vocs_fields.py (feste Betrachtungen, Zustandstexte, Wortlaut,
// Meldungen, Logbuch).
// ---------------------------------------------------------------------

const FIELD_INFO = {
  firstView: {
    label: 'Erste Betrachtung',
    tip: 'Text, den der Spieler beim ERSTEN Öffnen bzw. Betreten dieses Elements liest.\n'
      + 'Das ist der wichtigste Text – fast jedes Element sollte ihn haben.',
    placeholder: 'z.B. Du betrittst eine staubige Kammer. Durch ein kleines Fenster fällt fahles Licht.',
  },
  repeatView: {
    label: 'Erneute Betrachtung',
    tip: 'Text ab dem ZWEITEN Öffnen – meist eine Kurzfassung der ersten Betrachtung.\n'
      + 'Leer lassen = die erste Betrachtung wird wiederholt.',
    placeholder: 'z.B. Die staubige Kammer. Nichts hat sich verändert.',
  },
  contentText: {
    label: 'Wortlaut',
    tip: 'Nur für Schriftstücke: der wörtliche INHALT eines Briefs, Eintrags, Buchs oder einer Inschrift – '
      + 'also genau das, was dort geschrieben steht.\n'
      + 'Die Betrachtung erzählt, was der Spieler tut („Du entfaltest den Brief …“), der Wortlaut ist der Brief selbst.\n'
      + 'Er wird bei JEDEM Öffnen unter den Text gehängt (auch unter Zustandstexte) und nur einmal gepflegt.\n'
      + 'Eigener Sprecher möglich – z.B. liest die Schreiberin ihren Brief mit ihrer Stimme.',
    placeholder: 'z.B. „Liebe Clara, ich kann nicht länger schweigen …“',
  },
  body: {
    label: 'Logbuch-Eintrag',
    tip: 'Text im Logbuch – gedacht für NICHT-physische Elemente wie Erkenntnisse, Gerüchte oder Widersprüche.\n'
      + 'Erscheint, sobald der Spieler dieses Wissen entdeckt hat. (Das Logbuch wird später neu gestaltet.)',
    placeholder: 'z.B. Clara war in der Unglücksnacht nicht im Dorf.',
  },
  openQuestion: {
    label: 'Offene Frage',
    tip: 'Nur für Widersprüche: Die Frage, die im Logbuch unter dem Logbuch-Eintrag steht.',
    placeholder: 'z.B. Wer hat dann das Wehr geöffnet?',
  },
  style: {
    label: 'Logbuch-Kategorie',
    tip: 'In welchem Logbuch-Abschnitt der Eintrag landet: Neue Erkenntnisse oder Widersprüche & offene Fragen.',
  },
  takeText: {
    label: 'Meldung beim Aufnehmen',
    tip: 'Kurze Meldung, wenn der Spieler diesen Gegenstand ins Inventar legt. Wird vorgelesen (nach dem Erzeugen der Sprachdateien).\n'
      + 'Leer lassen = „Du nimmst „Name“ an dich.“',
    placeholder: 'z.B. Du steckst den rostigen Schlüssel ein.',
  },
  dropText: {
    label: 'Meldung beim Ablegen',
    tip: 'Kurze Meldung, wenn der Spieler diesen Gegenstand wieder ablegt. Wird vorgelesen (nach dem Erzeugen der Sprachdateien).\n'
      + 'Leer lassen = „Du legst „Name“ hier ab.“',
    placeholder: 'z.B. Du legst den Schlüssel vorsichtig auf den Tisch.',
  },
};

const TEXT_PRIORITY_TIP = 'Welcher Text erscheint?\n'
  + '1. Passt ein Zustandstext (von oben nach unten geprüft), gilt dessen erste bzw. erneute Betrachtung.\n'
  + '2. Sonst die feste erste bzw. erneute Betrachtung.\n'
  + '„Erste“ heißt: das erste Mal, dass der Spieler das Element mit diesem Text sieht.\n'
  + 'Ein Wortlaut (bei Schriftstücken) wird immer angehängt.';

const TYPE_INFO = {
  location: 'Ort – ein Ort, den der Spieler betritt: Raum, Platz, Gebäude, Waldweg …\n'
    + 'Erscheint als Ellipse im Ortsgraph. Orte liegen nie ineinander – man erreicht sie nur über Wege (🔗 im Ortsgraph).',
  door: 'Weg/Tür – führt beim Benutzen an einen anderen Ort. Erscheint im Ortsgraph als Pfeil.',
  object: 'Objekt – ein Gegenstand, den man ansehen oder benutzen kann.',
  feature: 'Detail – etwas Festes am Ort, das man sich anschauen kann (Gemälde, Kamin, Schreibtisch, Brunnen, alter Baum).\n'
    + 'Kann nicht aufgenommen werden. Kann aber weitere Elemente enthalten (z.B. einen Brief im Schreibtisch).',
  container: 'Behälter – Kiste, Truhe, Schublade; enthält andere Objekte.',
  document: 'Dokument – Brief, Buch, Notiz. Den eigentlichen Inhalt in „Wortlaut“ schreiben.',
  inscription: 'Inschrift – Text auf Stein, Schild oder Wand. Inhalt in „Wortlaut“ schreiben.',
  mechanism: 'Mechanismus – Hebel, Schloss, Wehr; wird meist benutzt und löst etwas aus.',
  person: 'Person – jemand, mit dem der Spieler sprechen kann.',
};

const BASE_TIPS = {
  name: 'Name des Elements. So heißt der Knopf, mit dem der Spieler es im Spiel öffnet – kurz und eindeutig halten.',
  id: 'Interne Kennung. Wird automatisch vergeben und von Verbindungen/Auslösern referenziert – nicht änderbar.',
  type: 'Art des Elements. Bestimmt, wie der Editor es darstellt: Orte werden Ellipsen im Graph, Wege werden Pfeile.',
  locatedIn: 'Wo sich dieses Element befindet. Es erscheint im Spiel als Knopf im Fenster dieses Ortes/Objekts.\n'
    + 'Bei Gegenständen, die man aufnehmen kann, ist das die Position zu Spielbeginn.\n'
    + '„🎒 Inventar des Spielers“ = trägt der Spieler von Anfang an bei sich.\n'
    + 'Orte selbst liegen immer auf oberster Ebene und sind nur über Wege verbunden.',
  target: 'Zielort dieses Weges. Benutzt der Spieler den Weg, steht er danach an diesem Ort.',
  exitLabel: 'Beschriftung des Zurück-Knopfs, wenn dieses Element als Fenster offen ist (z.B. „Tisch verlassen“).\n'
    + 'Leer lassen = „Zurück“.',
  portable: 'Kann aufgenommen werden: Im Spiel erscheint im Fenster dieses Gegenstands ein Knopf „✋ Aufnehmen“.\n'
    + 'Danach liegt er im Inventar und kann dort mit „⬇ Ablegen“ wieder abgelegt werden – am aktuellen Ort '
    + 'oder in einem gerade offenen Behälter/Möbelstück.\n'
    + 'Unter „Befindet sich in“ stellst du nur ein, wo er zu Spielbeginn liegt.\n'
    + 'Auslöser können mit den Bedingungen inInventory / notInInventory prüfen, ob der Spieler ihn trägt.',
  start: 'Startort: Hier beginnt der Spieler die Geschichte. Es gibt genau einen Startort.',
};

function setTip(node, text) {
  if (text) node.dataset.tip = text;
  return node;
}

// Kleines ⓘ-Symbol mit Tooltip, damit auch ohne Hover ueber das Feld klar ist, dass es Hilfe gibt.
function infoIcon(text) {
  const span = document.createElement('span');
  span.className = 'info-icon';
  span.textContent = 'ⓘ';
  return setTip(span, text);
}

function fieldLabel(field) {
  return (FIELD_INFO[field] && FIELD_INFO[field].label) || field;
}

// Ein einziges, per JS positioniertes Tooltip-Element statt CSS ::after, damit Tooltips nicht
// von overflow:auto-Containern (Canvas, Fenster) abgeschnitten werden.
const tooltip = { el: null, target: null, timer: null };

function initTooltips() {
  tooltip.el = document.createElement('div');
  tooltip.el.className = 'ed-tooltip';
  tooltip.el.hidden = true;
  document.body.appendChild(tooltip.el);

  document.addEventListener('mouseover', (e) => {
    const target = e.target.closest && e.target.closest('[data-tip]');
    if (target === tooltip.target) return;
    hideTooltip();
    if (!target) return;
    tooltip.target = target;
    tooltip.timer = setTimeout(() => showTooltip(target), 350);
  });
  document.addEventListener('mousedown', hideTooltip);
  document.addEventListener('scroll', hideTooltip, true);
}

function showTooltip(target) {
  if (!document.body.contains(target)) return;
  const t = tooltip.el;
  t.textContent = target.dataset.tip;
  t.hidden = false;
  const r = target.getBoundingClientRect();
  const tw = t.offsetWidth;
  const th = t.offsetHeight;
  let left = r.left + r.width / 2 - tw / 2;
  left = Math.max(8, Math.min(left, window.innerWidth - tw - 8));
  let top = r.bottom + 8;
  if (top + th > window.innerHeight - 8) top = r.top - th - 8;
  t.style.left = left + 'px';
  t.style.top = Math.max(8, top) + 'px';
}

function hideTooltip() {
  clearTimeout(tooltip.timer);
  tooltip.target = null;
  if (tooltip.el) tooltip.el.hidden = true;
}

const ed = {
  storyId: null,
  story: null,
  elementsById: {},
  dirty: false,
  stack: [],
  connectSource: null,
  positions: {},   // nur Zwischenergebnis von computeLayout (automatische Erstanordnung)
  layout: {},      // feste Positionen der Ellipsen: elementId -> {x, y} (editor_layout.json)
  graph: null,     // DOM-Ebenen des Ortsgraphs (canvas, svg, overlay)
  selection: new Set(), // ausgewaehlte Orte (gemeinsam verschiebbar)
  openContents: null,   // Ort, dessen Inhaltsliste an der Ellipse aufgeklappt ist
  references: [],       // Dateinamen der Vorlagebilder (Stories/<Name>/vorlagen/), vom Server
};

function isLocation(el) {
  return !!el.physical && LOCATION_TYPES.includes(el.type);
}

function isDoor(el) {
  return !!el.physical && el.type === 'door';
}

function slugify(name, existingIds) {
  const base = name.toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'element';
  let id = base;
  let n = 2;
  while (existingIds.has(id)) {
    id = `${base}_${n++}`;
  }
  return id;
}

function markDirty() {
  ed.dirty = true;
  updateSaveButtonState();
}

function updateSaveButtonState() {
  const btn = document.getElementById('btn-editor-save');
  if (btn) btn.disabled = !ed.dirty;
}

// ---------------------------------------------------------------------
// Laden
// ---------------------------------------------------------------------

async function openEditorStoryList() {
  const res = await fetch('/api/stories');
  const stories = await res.json();
  const list = document.getElementById('editor-story-list');
  list.innerHTML = '';
  if (stories.length === 0) {
    const note = document.createElement('p');
    note.className = 'empty-note';
    note.textContent = 'Keine Geschichten gefunden.';
    list.appendChild(note);
  } else {
    for (const s of stories) {
      const card = document.createElement('div');
      card.className = 'story-card';
      card.innerHTML = `<h2>${escapeHtml(s.title)}</h2><p>${escapeHtml(s.teaser || '')}</p>`;
      card.addEventListener('click', () => loadEditorStory(s.id));
      list.appendChild(card);
    }
  }
  showScreen('screen-editor-select');
}

async function loadEditorStory(storyId) {
  await loadVoices();
  const res = await fetch('/api/story/' + encodeURIComponent(storyId));
  const story = await res.json();
  ed.storyId = storyId;
  ed.story = story;
  ed.elementsById = {};
  for (const el of story.elements) {
    delete el._samples;
    hideImageNumbers(el);
    ed.elementsById[el.id] = el;
  }
  // Positionen kommen aus Stories/<Name>/editor_layout.json (separat von der YAML-Datei).
  ed.layout = story._editorLayout || {};
  delete story._editorLayout;
  // Vorlagebilder fuer die Bild-Prompts (nur zur Auswahl, nicht Teil der YAML).
  ed.references = Array.isArray(story._references) ? story._references : [];
  delete story._references;
  ensurePositions(true);
  ed.selection = new Set();
  ed.dirty = false;
  ed.stack = [];
  ed.connectSource = null;
  document.getElementById('editor-title').value = story.header.title || '';
  hideEditorBanner();
  let helpHidden = false;
  try {
    helpHidden = localStorage.getItem('editorHelpHidden') === '1';
  } catch (_) { /* ignorieren */ }
  document.getElementById('editor-help').hidden = helpHidden;
  showScreen('screen-editor-graph');
  renderGraph();
  renderEditorStack();
  updateSaveButtonState();
}

// ---------------------------------------------------------------------
// Layout (rein zur Anzeige berechnet, wird nicht gespeichert)
// ---------------------------------------------------------------------

const COL_W = 170;
const ROW_H = 130;
const MARGIN = 60;

function computeLayout() {
  const locs = Object.values(ed.elementsById).filter(isLocation);
  const locIds = new Set(locs.map((l) => l.id));
  const depth = {};
  const visiting = new Set();

  function depthOf(id) {
    if (depth[id] !== undefined) return depth[id];
    if (visiting.has(id)) return 0; // Zyklus-Schutz
    visiting.add(id);
    const el = ed.elementsById[id];
    const parent = el.locatedIn;
    const d = parent && locIds.has(parent) && parent !== id ? depthOf(parent) + 1 : 0;
    depth[id] = d;
    visiting.delete(id);
    return d;
  }

  const rows = {};
  for (const l of locs) {
    const d = depthOf(l.id);
    (rows[d] = rows[d] || []).push(l.id);
  }

  // Innerhalb einer Reihe verbundene Orte nebeneinander anordnen, damit Pfeile
  // moeglichst wenige andere Ellipsen kreuzen (Tuer-Verbindungen laufen meist
  // zwischen Geschwister-Orten derselben Reihe, nicht zwischen Reihen).
  const rowOf = {};
  for (const d of Object.keys(rows)) {
    for (const id of rows[d]) rowOf[id] = Number(d);
  }
  const outgoing = {};
  const incoming = {};
  for (const conn of getConnections()) {
    if (conn.from === conn.to) continue;
    if (rowOf[conn.from] === undefined || rowOf[conn.from] !== rowOf[conn.to]) continue;
    (outgoing[conn.from] = outgoing[conn.from] || new Set()).add(conn.to);
    (incoming[conn.to] = incoming[conn.to] || new Set()).add(conn.from);
  }
  for (const d of Object.keys(rows)) {
    rows[d] = orderRowLeftToRight(rows[d], outgoing, incoming);
  }

  ed.positions = {};
  const rowKeys = Object.keys(rows).map(Number).sort((a, b) => a - b);
  for (const d of rowKeys) {
    rows[d].forEach((id, i) => {
      ed.positions[id] = { x: MARGIN + i * COL_W, y: MARGIN + d * ROW_H };
    });
  }
  const maxCols = rowKeys.length ? Math.max(...rowKeys.map((d) => rows[d].length)) : 0;
  return {
    width: MARGIN * 2 + Math.max(1, maxCols) * COL_W,
    height: MARGIN * 2 + Math.max(1, rowKeys.length) * ROW_H,
  };
}

// Ordnet Orte einer Zeile per Breitensuche ueber ihre Verbindungen an, damit Wege
// moeglichst von links nach rechts laufen: Der Startort steht ganz links, danach folgen
// zuerst die Orte, zu denen ein Weg hinfuehrt, dann die, von denen einer herkommt.
// Weitere Gruppen beginnen bei einem Ort ohne eingehenden Weg. Die Grundreihenfolge ist
// die Reihenfolge in der Story-Datei, damit neu angelegte Orte rechts angehaengt werden.
function orderRowLeftToRight(ids, outgoing, incoming) {
  const startId = ed.story.header && ed.story.header.startElement;
  const inRow = new Set(ids);
  const rank = new Map(ids.map((id, i) => [id, i]));
  const byFileOrder = (list) => [...(list || [])].filter((n) => inRow.has(n)).sort((x, y) => rank.get(x) - rank.get(y));
  const hasIncoming = (id) => byFileOrder(incoming[id]).length > 0;

  const seeds = [
    ...(inRow.has(startId) ? [startId] : []),
    ...ids.filter((id) => !hasIncoming(id)),
    ...ids,
  ];
  const visited = new Set();
  const ordered = [];
  for (const seed of seeds) {
    if (visited.has(seed)) continue;
    const queue = [seed];
    visited.add(seed);
    while (queue.length) {
      const cur = queue.shift();
      ordered.push(cur);
      for (const n of [...byFileOrder(outgoing[cur]), ...byFileOrder(incoming[cur])]) {
        if (!visited.has(n)) {
          visited.add(n);
          queue.push(n);
        }
      }
    }
  }
  return ordered;
}

function getConnections() {
  const conns = [];
  for (const el of Object.values(ed.elementsById)) {
    if (!isDoor(el)) continue;
    for (const trig of el.onUse || []) {
      for (const effect of trig.effects || []) {
        if (effect.setCurrentElement && ed.elementsById[effect.setCurrentElement]) {
          conns.push({ doorId: el.id, from: el.locatedIn, to: effect.setCurrentElement });
        }
      }
    }
  }
  return conns;
}

// Rubrik "Wege" im Fenster eines Ortes: Beschriftungen aller Wege von hier weg und hierher
// direkt bearbeitbar. Die Beschriftung ist der Name des Weg-Elements - genau dieser Text steht
// im Spiel auf der Taste unter "Moeglichkeiten".
const WAYS_TIP = 'Wege: So heißen die Tasten unter „Möglichkeiten“, mit denen der Spieler zwischen den Orten wechselt.\n'
  + 'Die Vorgabe „Weg nach …“ kannst du frei ändern, z.B. in „Durch die Luke ins Cockpit“.\n'
  + 'Neue Wege legst du im Ortsgraph mit 🔗 an. Für Meldungen oder Bedingungen den Weg mit ✎ öffnen.';

function renderWaysSection(el) {
  const frag = document.createDocumentFragment();
  frag.appendChild(renderSection('Wege', WAYS_TIP));
  const conns = getConnections();
  const groups = [
    ['Von hier nach …', conns.filter((c) => c.from === el.id), (c) => ed.elementsById[c.to]],
    ['Von … hierher', conns.filter((c) => c.to === el.id && c.from !== el.id), (c) => ed.elementsById[c.from]],
  ];
  for (const [title, list, other] of groups) {
    const head = document.createElement('div');
    head.className = 'rule-block-title';
    head.textContent = title;
    frag.appendChild(head);
    if (list.length === 0) {
      const none = document.createElement('div');
      none.className = 'rule-always';
      none.textContent = 'keine – im Ortsgraph mit 🔗 anlegen';
      frag.appendChild(none);
      continue;
    }
    for (const conn of list) {
      const door = ed.elementsById[conn.doorId];
      const target = other(conn);
      const row = document.createElement('div');
      row.className = 'rule-row way-row';
      const place = document.createElement('span');
      place.className = 'way-place';
      place.textContent = (target ? target.name : '?');
      setTip(place, conn.from === el.id ? `Dieser Weg führt nach „${place.textContent}“.` : `Dieser Weg steht in „${place.textContent}“ und führt hierher.`);
      row.appendChild(place);
      const input = document.createElement('input');
      input.className = 'rule-input way-label';
      input.value = door.name || '';
      input.placeholder = `Weg nach ${ed.elementsById[conn.to].name}`;
      setTip(input, 'Beschriftung der Taste im Spiel (unter „Möglichkeiten“).\nLeer lassen = „Weg nach …“.');
      input.addEventListener('input', () => {
        door.name = input.value.trim() ? input.value : input.placeholder;
        markDirty();
        renderGraph();
      });
      row.appendChild(input);
      const open = document.createElement('button');
      open.className = 'field-del-btn';
      open.textContent = '✎';
      setTip(open, 'Weg öffnen – für Meldungen (z.B. „Weg versperrt“) und Bedingungen (z.B. nur mit Schlüssel).');
      open.addEventListener('click', () => openElementWindow(door.id));
      row.appendChild(open);
      frag.appendChild(row);
    }
  }
  return frag;
}

// ---------------------------------------------------------------------
// Grafische Ebene: Ellipsen + Pfeile
// ---------------------------------------------------------------------

// ---------------------------------------------------------------------
// Positionen der Ellipsen: frei per Maus verschiebbar, gespeichert in
// Stories/<Name>/editor_layout.json (ed.layout: elementId -> {x, y}).
// ---------------------------------------------------------------------

const NODE_W = 140;
const NODE_H = 80;
const DRAG_THRESHOLD = 4; // so viele Pixel Bewegung, bevor aus einem Klick ein Verschieben wird

function locationsList() {
  return Object.values(ed.elementsById).filter(isLocation);
}

// Mitte des gerade sichtbaren Bereichs - dort erscheinen neue Orte (leicht versetzt,
// falls mehrere auf einmal ohne Position sind).
function viewCenterPosition(i = 0) {
  const wrap = document.querySelector('.editor-canvas-wrap');
  const w = wrap ? wrap.clientWidth : 800;
  const h = wrap ? wrap.clientHeight : 600;
  return {
    x: Math.max(10, Math.round((wrap ? wrap.scrollLeft : 0) + w / 2 - NODE_W / 2 + i * 24)),
    y: Math.max(10, Math.round((wrap ? wrap.scrollTop : 0) + h / 2 - NODE_H / 2 + i * 24)),
  };
}

// Fehlende Positionen auffuellen. Beim Laden (useAutoLayout) einmalig mit der automatischen
// Anordnung - danach sind alle Positionen fest und springen nicht mehr von selbst.
function ensurePositions(useAutoLayout) {
  const missing = locationsList().filter((l) => !ed.layout[l.id]);
  if (missing.length === 0) return;
  if (useAutoLayout) {
    computeLayout();
    for (const l of missing) ed.layout[l.id] = { ...ed.positions[l.id] };
  } else {
    missing.forEach((l, i) => { ed.layout[l.id] = viewCenterPosition(i); });
  }
}

function canvasSize() {
  const wrap = document.querySelector('.editor-canvas-wrap');
  // Etwas kleiner als der sichtbare Bereich, damit ohne Bedarf keine Scrollbalken erscheinen.
  let w = wrap ? wrap.clientWidth - 4 : 800;
  let h = wrap ? wrap.clientHeight - 4 : 600;
  for (const l of locationsList()) {
    const p = ed.layout[l.id];
    if (!p) continue;
    w = Math.max(w, p.x + NODE_W + MARGIN);
    h = Math.max(h, p.y + NODE_H + MARGIN);
  }
  return { width: w, height: h };
}

function updateCanvasSize() {
  const g = ed.graph;
  if (!g) return;
  const size = canvasSize();
  g.canvas.style.width = size.width + 'px';
  g.canvas.style.height = size.height + 'px';
  g.svg.setAttribute('width', size.width);
  g.svg.setAttribute('height', size.height);
}

// Punkt auf dem Rand der Ellipse (Mittelpunkt c, Halbachsen rx/ry) in Richtung (ux, uy).
function ellipseEdge(cx, cy, ux, uy) {
  const rx = NODE_W / 2 - 2;
  const ry = NODE_H / 2 - 2;
  const t = 1 / Math.sqrt((ux * ux) / (rx * rx) + (uy * uy) / (ry * ry));
  return { x: cx + ux * t, y: cy + uy * t };
}

// Zeichnet alle Wege-Pfeile neu. Wird beim Verschieben
// laufend aufgerufen, damit die Linien live mitwandern.
function drawLinks() {
  const g = ed.graph;
  if (!g) return;
  const svgNs = 'http://www.w3.org/2000/svg';
  while (g.svg.lastChild && g.svg.lastChild !== g.defs) g.svg.removeChild(g.svg.lastChild);
  g.overlay.innerHTML = '';
  const center = (id) => {
    const p = ed.layout[id];
    return p ? { x: p.x + NODE_W / 2, y: p.y + NODE_H / 2 } : null;
  };

  const conns = getConnections();
  const pairs = new Set(conns.map((c) => c.from + '>' + c.to));
  for (const conn of conns) {
    const a = center(conn.from);
    const b = center(conn.to);
    if (!a || !b || conn.from === conn.to) continue;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dist = Math.hypot(dx, dy) || 1;
    const ux = dx / dist;
    const uy = dy / dist;
    // Hin- und Rueckweg leicht gegeneinander versetzen, sonst liegen sie genau uebereinander.
    const off = pairs.has(conn.to + '>' + conn.from) ? 7 : 0;
    const ox = -uy * off;
    const oy = ux * off;
    const p1 = ellipseEdge(a.x, a.y, ux, uy);
    const p2 = ellipseEdge(b.x, b.y, -ux, -uy);
    const x1 = p1.x + ox;
    const y1 = p1.y + oy;
    const x2 = p2.x + ox;
    const y2 = p2.y + oy;

    for (const cls of ['conn-line', 'conn-hit']) {
      const line = document.createElementNS(svgNs, 'line');
      line.setAttribute('x1', x1);
      line.setAttribute('y1', y1);
      line.setAttribute('x2', x2);
      line.setAttribute('y2', y2);
      line.setAttribute('class', cls);
      if (cls === 'conn-line') line.setAttribute('marker-end', 'url(#arrowhead)');
      g.svg.appendChild(line);
      if (cls === 'conn-hit') {
        const door = ed.elementsById[conn.doorId];
        setTip(line, `Weg „${door.name}“: von ${ed.elementsById[conn.from].name} nach ${ed.elementsById[conn.to].name}.\n`
          + 'Klicken, um Name und Texte des Weges zu bearbeiten.');
        line.addEventListener('click', () => openElementWindow(conn.doorId));
      }
    }

    const delBtn = document.createElement('button');
    delBtn.className = 'conn-delete-btn';
    delBtn.textContent = '✕';
    setTip(delBtn, `Weg von ${ed.elementsById[conn.from].name} nach ${ed.elementsById[conn.to].name} löschen.\n`
      + 'Ein eventueller Rückweg bleibt erhalten.');
    delBtn.style.left = (x1 + x2) / 2 + 'px';
    delBtn.style.top = (y1 + y2) / 2 + 'px';
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteConnection(conn.doorId);
    });
    g.overlay.appendChild(delBtn);
  }
}

function renderGraph() {
  ensurePositions(false);
  ed.selection = new Set([...ed.selection].filter((id) => ed.elementsById[id] && isLocation(ed.elementsById[id])));
  const canvas = document.getElementById('editor-canvas');
  canvas.innerHTML = '';

  // Reihenfolge = Ebenen: Linien (SVG) ganz unten, darueber die Loesch-Knoepfe der Wege,
  // ganz oben die Ellipsen - Linien liegen also immer HINTER den Ellipsen.
  const svgNs = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNs, 'svg');
  svg.setAttribute('class', 'editor-arrows');
  const defs = document.createElementNS(svgNs, 'defs');
  defs.innerHTML = '<marker id="arrowhead" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto">'
    + '<polygon points="0 0, 10 4, 0 8" fill="#c9a24b"></polygon></marker>';
  svg.appendChild(defs);
  const overlay = document.createElement('div');
  overlay.className = 'editor-conn-overlay';
  canvas.appendChild(svg);
  canvas.appendChild(overlay);
  ed.graph = { canvas, svg, defs, overlay };
  updateCanvasSize();
  drawLinks();

  const locations = locationsList();
  if (locations.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'editor-empty-note';
    empty.textContent = 'Noch keine Orte vorhanden. Lege oben mit „+ Neuer Ort“ den ersten Ort an.';
    canvas.appendChild(empty);
  }

  const startId = ed.story.header && ed.story.header.startElement;
  for (const el of locations) {
    const pos = ed.layout[el.id];
    const isStart = el.id === startId;
    const node = document.createElement('div');
    node.className = 'loc-node'
      + (ed.connectSource === el.id ? ' connect-source' : '')
      + (ed.selection.has(el.id) ? ' selected' : '')
      + (isStart ? ' is-start' : '');
    node.style.left = pos.x + 'px';
    node.style.top = pos.y + 'px';
    node.innerHTML = `
      ${isStart ? '<span class="loc-start-badge">★ Start</span>' : ''}
      <button class="loc-del-btn">✕</button>
      <span class="loc-name">${escapeHtml(el.name)}</span>
      <button class="loc-connect-btn">🔗</button>
    `;
    const contained = childrenOfEditor(el.id).filter((c) => !isDoor(ed.elementsById[c])).length;
    appendContentsButton(node, el);
    setTip(node, ed.connectSource
      ? `Hier klicken, um den Weg nach „${el.name}“ anzulegen.`
      : `${TYPE_INFO[el.type] || el.type}\n${contained} Element(e) darin.${isStart ? '\n★ Hier beginnt die Geschichte.' : ''}\n`
        + 'Klicken, um Texte und Inhalt dieses Ortes zu bearbeiten.\nMit gedrückter Maustaste ziehen, um den Ort zu verschieben.');
    setTip(node.querySelector('.loc-del-btn'), `Ort „${el.name}“ löschen (samt seiner Wege).\nGeht nur, wenn er leer ist.`);
    setTip(node.querySelector('.loc-connect-btn'),
      `Weg anlegen: Danach den Zielort anklicken.\nDer Spieler kann dann von „${el.name}“ dorthin gehen.`);
    if (isStart) setTip(node.querySelector('.loc-start-badge'), BASE_TIPS.start);
    node.querySelector('.loc-del-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      deleteLocation(el.id);
    });
    node.querySelector('.loc-connect-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      startConnect(el.id);
    });
    enableDrag(node, el.id);
    node.addEventListener('click', () => {
      if (node.dataset.dragged) {
        delete node.dataset.dragged; // Ende eines Verschiebens ist kein Klick
        return;
      }
      onLocationClick(el.id);
    });
    canvas.appendChild(node);
  }
  updateSelectionBanner();
}

// ---------------------------------------------------------------------
// Inhalt eines Ortes direkt an der Ellipse: Knopf "▾ Anzahl" klappt eine Liste aller
// Elemente auf, die (auch verschachtelt) im Ort liegen. Ein Klick oeffnet das Element samt
// Fensterpfad (Ort -> Behaelter -> Element), damit "Zurueck" wie gewohnt funktioniert.
// Wege direkt am Ort fehlen in der Liste - die stehen schon als Pfeile im Graph.
// ---------------------------------------------------------------------

// [{ id, depth, path }] in Baumreihenfolge, je Ebene nach Namen sortiert.
function containedTree(locId) {
  const result = [];
  const seen = new Set();
  const byName = (a, b) => (ed.elementsById[a].name || a).localeCompare(ed.elementsById[b].name || b, 'de');
  const walk = (parentId, depth, path) => {
    for (const cid of childrenOfEditor(parentId).sort(byName)) {
      const c = ed.elementsById[cid];
      if (seen.has(cid) || isLocation(c) || (depth === 0 && isDoor(c))) continue;
      seen.add(cid);
      const itemPath = [...path, cid];
      result.push({ id: cid, depth, path: itemPath });
      walk(cid, depth + 1, itemPath);
    }
  };
  walk(locId, 0, [locId]);
  return result;
}

function appendContentsButton(node, loc) {
  const items = containedTree(loc.id);
  if (items.length === 0) return;
  const btn = document.createElement('button');
  btn.className = 'loc-contents-btn';
  btn.textContent = `▾ ${items.length}`;
  setTip(btn, `Inhalt von „${loc.name}“ anzeigen: ${items.length} Element(e), auch verschachtelte.\n`
    + 'Ein Eintrag lässt sich direkt anklicken und bearbeiten.');
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (ed.openContents === loc.id) closeContentsList();
    else {
      ed.openContents = loc.id;
      renderGraph();
    }
  });
  node.appendChild(btn);
  if (ed.openContents !== loc.id) return;

  node.classList.add('contents-open');
  const list = document.createElement('div');
  list.className = 'loc-contents';
  for (const item of items) {
    const c = ed.elementsById[item.id];
    const category = menuCategoryOf(c);
    const hidden = !!(c.initialState && c.initialState.visible === false);
    const entry = document.createElement('button');
    entry.className = 'loc-contents-item' + (hidden ? ' is-hidden' : '');
    entry.style.paddingLeft = (0.5 + item.depth * 1) + 'rem';
    entry.textContent = `${category.icon} ${c.name || c.id}`;
    const inside = item.path.slice(1, -1).map((id) => ed.elementsById[id].name).join(' › ');
    setTip(entry, `${category.label}${inside ? ` – in „${inside}“` : ''}${hidden ? '\nZu Beginn verborgen.' : ''}\n`
      + 'Klicken, um es zu bearbeiten.');
    entry.addEventListener('click', () => {
      closeContentsList();
      ed.stack = item.path.slice();
      renderEditorStack();
    });
    list.appendChild(entry);
  }
  // Klicks und Ziehen in der Liste gehoeren nicht zur Ellipse (oeffnen/verschieben).
  list.addEventListener('click', (e) => e.stopPropagation());
  list.addEventListener('pointerdown', (e) => e.stopPropagation());
  node.appendChild(list);
}

// Schliesst die Liste ohne den Graph neu zu zeichnen - sonst ginge ein gerade begonnenes
// Ziehen an einer anderen Ellipse verloren.
function closeContentsList() {
  ed.openContents = null;
  document.querySelectorAll('#editor-canvas .loc-contents').forEach((n) => n.remove());
  document.querySelectorAll('#editor-canvas .contents-open').forEach((n) => n.classList.remove('contents-open'));
}

// ---------------------------------------------------------------------
// Mehrfachauswahl: Strg/Umschalt-Klick oder Rahmen ziehen; ausgewaehlte Orte werden
// gemeinsam verschoben. Klick auf freie Flaeche oder Esc hebt die Auswahl auf.
// ---------------------------------------------------------------------

function isMultiKey(e) {
  return e.ctrlKey || e.shiftKey || e.metaKey;
}

function setSelection(ids) {
  ed.selection = new Set([...ids].filter((id) => ed.elementsById[id] && isLocation(ed.elementsById[id])));
  for (const node of document.querySelectorAll('#editor-canvas .loc-node')) {
    node.classList.toggle('selected', ed.selection.has(node.dataset.id));
  }
  updateSelectionBanner();
}

function updateSelectionBanner() {
  if (ed.connectSource) return; // Verbindungs-Modus hat Vorrang
  if (ed.selection.size > 1) {
    showEditorBanner(`${ed.selection.size} Orte ausgewählt – eine davon ziehen, um alle gemeinsam zu verschieben. `
      + 'Strg/Umschalt-Klick ändert die Auswahl, Esc hebt sie auf.', false);
  } else {
    hideEditorBanner();
  }
  updateCanvasSize(); // der Hinweis aendert die Hoehe des sichtbaren Bereichs
}

function enableDrag(node, id) {
  node.dataset.id = id;
  node.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || e.target.closest('button, .loc-contents')) return;
    if (isMultiKey(e)) {
      // Auswahl umschalten statt verschieben; der folgende Klick oeffnet kein Fenster.
      const next = new Set(ed.selection);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      setSelection(next);
      node.dataset.dragged = '1';
      return;
    }
    // Ausgewaehlten Ort ziehen = ganze Auswahl verschieben; sonst nur diesen einen.
    const group = ed.selection.has(id) ? [...ed.selection] : [id];
    const starts = Object.fromEntries(group.map((gid) => [gid, { ...ed.layout[gid] }]));
    const minX = Math.min(...group.map((gid) => starts[gid].x));
    const minY = Math.min(...group.map((gid) => starts[gid].y));
    const nodes = group.map((gid) => document.querySelector(`#editor-canvas .loc-node[data-id="${CSS.escape(gid)}"]`));
    const mx = e.clientX;
    const my = e.clientY;
    let dragging = false;
    const onMove = (ev) => {
      let dx = ev.clientX - mx;
      let dy = ev.clientY - my;
      if (!dragging && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      if (!dragging) {
        dragging = true;
        nodes.forEach((n) => n && n.classList.add('dragging'));
        hideTooltip();
      }
      // Die Gruppe bleibt als Ganzes zusammen: niemand rutscht ueber den linken/oberen Rand.
      dx = Math.max(dx, -minX);
      dy = Math.max(dy, -minY);
      group.forEach((gid, i) => {
        const pos = { x: Math.round(starts[gid].x + dx), y: Math.round(starts[gid].y + dy) };
        ed.layout[gid] = pos;
        if (nodes[i]) {
          nodes[i].style.left = pos.x + 'px';
          nodes[i].style.top = pos.y + 'px';
        }
      });
      updateCanvasSize();
      drawLinks();
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      if (dragging) {
        nodes.forEach((n) => n && n.classList.remove('dragging'));
        node.dataset.dragged = '1';
        markDirty();
      }
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  });
}

// Auswahlrahmen: auf freier Flaeche des Graphen ziehen. Ein Klick ohne Ziehen hebt die
// Auswahl auf. Mit Strg/Umschalt wird zur bestehenden Auswahl hinzugefuegt.
function initSelectionRectangle() {
  const wrap = document.querySelector('.editor-canvas-wrap');
  wrap.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    if (e.target.closest('.loc-node, button, .conn-hit')) return;
    e.preventDefault(); // sonst markiert der Browser beim Rahmenziehen nebenbei Text
    const canvas = document.getElementById('editor-canvas');
    const origin = canvas.getBoundingClientRect();
    const sx = e.clientX - origin.left;
    const sy = e.clientY - origin.top;
    const additive = isMultiKey(e);
    const base = additive ? new Set(ed.selection) : new Set();
    let rect = null;
    const onMove = (ev) => {
      const o = canvas.getBoundingClientRect();
      const cx = ev.clientX - o.left;
      const cy = ev.clientY - o.top;
      if (!rect && Math.hypot(cx - sx, cy - sy) < DRAG_THRESHOLD) return;
      if (!rect) {
        rect = document.createElement('div');
        rect.className = 'select-rect';
        canvas.appendChild(rect);
        hideTooltip();
      }
      const x1 = Math.min(sx, cx);
      const y1 = Math.min(sy, cy);
      const x2 = Math.max(sx, cx);
      const y2 = Math.max(sy, cy);
      Object.assign(rect.style, { left: x1 + 'px', top: y1 + 'px', width: x2 - x1 + 'px', height: y2 - y1 + 'px' });
      const inside = locationsList()
        .filter((l) => {
          const p = ed.layout[l.id];
          return p && p.x < x2 && p.x + NODE_W > x1 && p.y < y2 && p.y + NODE_H > y1;
        })
        .map((l) => l.id);
      setSelection(new Set([...base, ...inside]));
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      if (rect) rect.remove();
      else if (!additive) setSelection(new Set()); // einfacher Klick auf freie Flaeche
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  });
}

function onLocationClick(id) {
  if (ed.connectSource) {
    finishConnect(id);
    return;
  }
  openElementWindow(id);
}

function startConnect(id) {
  ed.connectSource = id;
  showEditorBanner(`Weg von „${ed.elementsById[id].name}“: Jetzt den Zielort anklicken (Esc = abbrechen).`, true);
  renderGraph();
}

function cancelConnect() {
  ed.connectSource = null;
  hideEditorBanner();
  renderGraph();
}

function finishConnect(targetId) {
  const sourceId = ed.connectSource;
  ed.connectSource = null;
  hideEditorBanner();
  if (targetId === sourceId) {
    renderGraph();
    return;
  }
  const label = prompt(
    'Wie soll der Knopf für diesen Weg im Spiel heißen? (optional)\n'
    + `Leer lassen = „Weg nach ${ed.elementsById[targetId].name}“`,
    ''
  ) || '';
  const both = confirm(
    `Auch einen Rückweg von "${ed.elementsById[targetId].name}" zu "${ed.elementsById[sourceId].name}" anlegen?`
  );
  createDoor(sourceId, targetId, label);
  if (both) createDoor(targetId, sourceId, '');
  markDirty();
  renderGraph();
}

function createDoor(fromId, toId, label) {
  const existingIds = new Set(Object.keys(ed.elementsById));
  const id = slugify(`weg_${fromId}_${toId}`, existingIds);
  const fromEl = ed.elementsById[fromId];
  const door = {
    id,
    name: label || `Weg nach ${ed.elementsById[toId].name}`,
    type: 'door',
    physical: true,
    layers: fromEl.layers ? [...fromEl.layers] : [],
    locatedIn: fromId,
    initialState: { visible: true },
    initialPartOf: [],
    onUse: [
      { id: `go_${id}`, enabled: true, effects: [{ setCurrentElement: toId }] },
    ],
  };
  ed.elementsById[id] = door;
  ed.story.elements.push(door);
}

function deleteConnection(doorId) {
  if (!confirm('Diese Verbindung wirklich löschen?')) return;
  removeElement(doorId);
  markDirty();
  renderGraph();
}

function deleteLocation(id) {
  const hasChildren = Object.values(ed.elementsById).some((c) => c.locatedIn === id);
  if (hasChildren) {
    alert('Dieser Ort enthält noch Objekte/Unterorte. Bitte zuerst entfernen oder verschieben.');
    return;
  }
  if (!confirm(`Ort "${ed.elementsById[id].name}" wirklich löschen?`)) return;
  for (const conn of getConnections()) {
    if (conn.from === id || conn.to === id) removeElement(conn.doorId);
  }
  removeElement(id);
  delete ed.layout[id];
  ed.stack = ed.stack.filter((sid) => sid !== id);
  markDirty();
  renderGraph();
  renderEditorStack();
}

function removeElement(id) {
  delete ed.elementsById[id];
  ed.story.elements = ed.story.elements.filter((e) => e.id !== id);
}

function isReferencedElsewhere(id) {
  const others = ed.story.elements.filter((e) => e.id !== id);
  return JSON.stringify(others).includes(`"${id}"`);
}

function addLocation() {
  const name = prompt('Name des neuen Ortes:');
  if (!name) return;
  const existingIds = new Set(Object.keys(ed.elementsById));
  const id = slugify(name, existingIds);
  const el = {
    id,
    name,
    type: 'location',
    physical: true,
    layers: ed.story.layers && ed.story.layers[0] ? [ed.story.layers[0].id] : [],
    locatedIn: null,
    initialState: { visible: true },
    initialPartOf: [],
    presentation: {},
  };
  ed.elementsById[id] = el;
  ed.story.elements.push(el);
  ed.layout[id] = viewCenterPosition(); // neuer Ort erscheint mitten im sichtbaren Bereich
  markDirty();
  renderGraph();
}

// ---------------------------------------------------------------------
// Detail-Fenster (rekursiv wie im Spiel, aber editierbar, ohne Spiel-Logik)
// ---------------------------------------------------------------------

function openElementWindow(id) {
  const top = ed.stack[ed.stack.length - 1];
  if (top === id) return;
  ed.stack.push(id);
  renderEditorStack();
}

function closeAllEditorWindows() {
  ed.stack = [];
  renderEditorStack();
  renderGraph();
}

function closeEditorTopWindow() {
  ed.stack.pop();
  renderEditorStack();
  if (ed.stack.length === 0) renderGraph();
}

function childrenOfEditor(id) {
  return Object.values(ed.elementsById)
    .filter((c) => c.locatedIn === id)
    .map((c) => c.id)
    .sort();
}

function renderEditorStack() {
  const container = document.getElementById('editor-window-stack');
  // Scrollposition des obersten Fensters merken: Viele Aenderungen (Reaktion hinzufuegen,
  // Typ wechseln ...) zeichnen das Fenster neu, und es soll dabei nicht nach oben springen.
  const prevTop = container.querySelector('.window:last-child');
  const prevId = prevTop ? prevTop.dataset.elementId : null;
  const prevScroll = prevTop ? prevTop.scrollTop : 0;
  container.innerHTML = '';
  container.hidden = ed.stack.length === 0;
  ed.stack.forEach((id, index) => {
    const isTop = index === ed.stack.length - 1;
    const win = renderEditorWindow(id, isTop, index === 0);
    win.dataset.elementId = id;
    container.appendChild(win);
    if (isTop && id === prevId) win.scrollTop = prevScroll;
  });
}

function renderEditorWindow(id, isTop, isFirstInStack) {
  const el = ed.elementsById[id];
  const div = document.createElement('div');
  div.className = 'window' + (isTop ? '' : ' dimmed');

  const header = document.createElement('div');
  header.className = 'window-header';
  // Ganz links immer der Weg zum Ortsgraph, daneben "↑ <Name>" um eine Ebene nach oben
  // (nur, wenn es eine Ebene darueber gibt).
  const graphBtn = document.createElement('button');
  graphBtn.className = 'close-btn';
  graphBtn.textContent = '⌂ Zum Ortsgraph';
  setTip(graphBtn, 'Alle Fenster schließen und zur Übersicht aller Orte zurückkehren. Änderungen bleiben erhalten (aber noch nicht gespeichert).');
  graphBtn.addEventListener('click', closeAllEditorWindows);
  header.appendChild(graphBtn);
  if (!isFirstInStack) {
    const backBtn = document.createElement('button');
    backBtn.className = 'close-btn';
    // Beschriftet mit dem Ziel (Ebene darueber), lange Namen gekuerzt - voller Name im Tooltip.
    const parentName = ed.elementsById[ed.stack[ed.stack.length - 2]].name || '';
    const shortName = parentName.length > 24 ? parentName.slice(0, 23) + '…' : parentName;
    backBtn.textContent = `↑ ${shortName}`;
    setTip(backBtn, `Eine Ebene höher: dieses Fenster schließen und zu „${parentName}“ wechseln.`);
    backBtn.addEventListener('click', closeEditorTopWindow);
    header.appendChild(backBtn);
  }
  const nameInput = document.createElement('input');
  nameInput.className = 'window-name-input';
  nameInput.value = el.name || '';
  nameInput.placeholder = 'Name';
  setTip(nameInput, BASE_TIPS.name);
  nameInput.addEventListener('input', () => {
    el.name = nameInput.value;
    markDirty();
    renderGraph();
  });
  header.appendChild(nameInput);

  const idLabel = document.createElement('span');
  idLabel.className = 'window-id-label';
  idLabel.textContent = el.id;
  setTip(idLabel, BASE_TIPS.id);
  header.appendChild(idLabel);

  const delBtn = document.createElement('button');
  delBtn.className = 'close-btn';
  delBtn.textContent = '🗑';
  setTip(delBtn, `„${el.name}“ löschen.\nGeht nur, wenn nichts mehr darin enthalten ist.`);
  delBtn.addEventListener('click', () => deleteGenericElement(id));
  header.appendChild(delBtn);

  div.appendChild(header);

  const body = document.createElement('div');
  body.className = 'window-text editor-fields';

  body.appendChild(renderSection('Grundeinstellungen',
    'Was für ein Element das ist und wo es sich befindet.'));
  const basics = document.createElement('div');
  basics.className = 'field-grid';
  basics.appendChild(renderTypeRow(el));
  basics.appendChild(renderLocatedInRow(el));
  if (isDoor(el)) basics.appendChild(renderTargetRow(el));
  if (isLocation(el)) basics.appendChild(renderStartRow(el));
  if (canBePortable(el)) basics.appendChild(renderPortableRow(el));
  if (!isDoor(el)) basics.appendChild(renderVoiceRow(el));
  // Wege und Orte der obersten Ebene bekommen im Spiel nie einen Zurueck-Knopf - Feld nur zeigen, wo es wirkt
  // (oder wenn schon ein Wert drinsteht, damit nichts unsichtbar bleibt).
  const hasBackButton = !isDoor(el) && !(isLocation(el) && !el.locatedIn);
  if (hasBackButton) basics.appendChild(renderExitLabelRow(el));
  else if (el.exitLabel) basics.appendChild(renderExitLabelRow(el, true));
  body.appendChild(basics);

  if (isLocation(el)) body.appendChild(renderWaysSection(el));
  body.appendChild(renderInitialStateSection(el));

  el.presentation = el.presentation || {};

  // Ein Weg navigiert sofort zum Ziel (setCurrentElement) - sein eigenes Fenster und
  // damit seine Betrachtungstexte sieht der Spieler nie. Meldungen (z.B. "Weg versperrt")
  // und Reaktionen (z.B. "nur mit Schluessel") bekommt ein Weg trotzdem.
  if (isDoor(el)) {
    const note = document.createElement('p');
    note.className = 'door-note';
    note.textContent = 'Ein Weg braucht keine Betrachtungstexte: Der Name ist die Beschriftung des Knopfs, '
      + 'und beim Klicken landet der Spieler direkt am Zielort und liest dort dessen Text. '
      + 'Soll vorher ein Handlungsabschnitt enden, lege unten eine Zwischensequenz an. '
      + 'Soll der Weg versperrt sein, lege unten eine Meldung und eine Reaktion mit Bedingung an.';
    body.appendChild(note);
    body.appendChild(renderCutsceneSection(el));
    body.appendChild(renderMessagesSection(el));
    body.appendChild(renderReactionsSection(el));
    div.appendChild(body);
    return div;
  }

  renderTextsSection(el, body);
  body.appendChild(renderImagesSection(el));
  body.appendChild(renderReactionsSection(el));
  div.appendChild(body);
  appendContainsMenu(div, el);
  return div;
}

function appendContainsMenu(div, el) {
  const id = el.id;
  const menu = document.createElement('div');
  menu.className = 'window-menu';
  const menuTitle = document.createElement('div');
  menuTitle.className = 'window-menu-title';
  menuTitle.textContent = 'Enthält';
  menuTitle.appendChild(infoIcon('Diese Elemente befinden sich hier. Im Spiel erscheinen sie als Knöpfe in diesem Fenster.\n'
    + 'Klicken öffnet sie zum Bearbeiten.'));
  menu.appendChild(menuTitle);
  for (const childId of childrenOfEditor(id)) {
    const child = ed.elementsById[childId];
    const btn = document.createElement('button');
    btn.className = 'menu-btn';
    const hidden = child.initialState && child.initialState.visible === false;
    btn.className = 'menu-btn' + (hidden ? ' is-hidden-start' : '');
    btn.textContent = (hidden ? '🙈 ' : '') + child.name
      + (isLocation(child) ? ' 🗺' : isDoor(child) ? ' ➜' : child.portable ? ' ✋' : '');
    let tip = (TYPE_INFO[child.type] || `Typ: ${child.type}`)
      + (child.portable ? '\n✋ Kann vom Spieler aufgenommen werden.' : '')
      + (hidden ? '\n🙈 Zu Beginn verborgen – erscheint erst, wenn eine Reaktion es sichtbar macht.' : '')
      + '\nKlicken, um es zu bearbeiten.';
    if (isDoor(child)) {
      const target = doorTarget(child);
      const targetName = target && ed.elementsById[target] ? ed.elementsById[target].name : '(noch kein Ziel)';
      tip = `Weg nach ${targetName}.\nKlicken, um ihn zu bearbeiten.`;
    }
    setTip(btn, tip);
    btn.addEventListener('click', () => openElementWindow(childId));
    menu.appendChild(btn);
  }
  const addChildBtn = document.createElement('button');
  addChildBtn.className = 'menu-btn add-child-btn';
  addChildBtn.textContent = '+ Objekt hinzufügen';
  setTip(addChildBtn, `Neues Element in „${el.name}“ anlegen (z.B. ein Tisch, ein Brief, eine Person).\n`
    + 'Den Typ kannst du danach im neuen Fenster ändern.\nWege zu anderen Orten legst du besser im Ortsgraph mit 🔗 an.');
  addChildBtn.addEventListener('click', () => addChildElement(id));
  menu.appendChild(addChildBtn);
  div.appendChild(menu);

  return div;
}

function renderSection(title, tip) {
  const h = document.createElement('div');
  h.className = 'field-section';
  h.textContent = title;
  h.appendChild(infoIcon(tip));
  return h;
}

function makeRow(labelText, tip) {
  const row = document.createElement('label');
  row.className = 'field-row';
  const head = document.createElement('span');
  head.className = 'field-label';
  head.textContent = labelText;
  head.appendChild(infoIcon(tip));
  row.appendChild(head);
  return row;
}

function renderTypeRow(el) {
  const row = makeRow('Typ', BASE_TIPS.type);
  const select = document.createElement('select');
  const types = Object.keys(TYPE_INFO);
  if (el.type && !types.includes(el.type)) types.push(el.type);
  for (const t of types) {
    const opt = document.createElement('option');
    opt.value = t;
    opt.textContent = TYPE_INFO[t] ? `${TYPE_INFO[t].split(' – ')[0]} (${t})` : t;
    select.appendChild(opt);
  }
  select.value = el.type;
  setTip(select, TYPE_INFO[el.type] || BASE_TIPS.type);
  select.addEventListener('change', () => {
    const becomesLocation = LOCATION_TYPES.includes(select.value) && !isLocation(el);
    el.type = select.value;
    if (becomesLocation && el.locatedIn) {
      // Orte liegen nie in etwas anderem - sonst entstuende ein doppelter Zugang (Fenster + Weg).
      const parent = ed.elementsById[el.locatedIn];
      el.locatedIn = null;
      alert(`„${el.name}“ ist jetzt ein Ort und liegt nicht mehr in „${parent ? parent.name : '?'}“.\n`
        + 'Orte erreicht man nur über Wege: Lege im Ortsgraph mit 🔗 einen Weg dorthin an.');
    }
    markDirty();
    renderGraph();
    renderEditorStack();
  });
  row.appendChild(select);
  return row;
}

function isInsideOf(id, ancestorId) {
  const seen = new Set();
  let cur = ed.elementsById[id];
  while (cur && cur.locatedIn && !seen.has(cur.id)) {
    if (cur.locatedIn === ancestorId) return true;
    seen.add(cur.id);
    cur = ed.elementsById[cur.locatedIn];
  }
  return false;
}

function renderLocatedInRow(el) {
  if (isLocation(el)) {
    const row = makeRow('Befindet sich in', BASE_TIPS.locatedIn);
    const note = document.createElement('div');
    note.className = 'fixed-value';
    note.textContent = 'Orte liegen auf oberster Ebene – Zugang nur über Wege';
    setTip(note, TYPE_INFO.location);
    row.appendChild(note);
    return row;
  }
  const row = makeRow('Befindet sich in', BASE_TIPS.locatedIn);
  const select = document.createElement('select');
  const none = document.createElement('option');
  none.value = '';
  none.textContent = '(oberste Ebene)';
  select.appendChild(none);
  if (el.id !== PLAYER_ID && !ed.elementsById[PLAYER_ID]) {
    // Das Spiel legt ein player-Element automatisch an, wenn die Story keines hat.
    const inv = document.createElement('option');
    inv.value = PLAYER_ID;
    inv.textContent = '🎒 Inventar des Spielers';
    select.appendChild(inv);
  }
  const candidates = Object.values(ed.elementsById)
    .filter((c) => c.id !== el.id && !isDoor(c) && !isInsideOf(c.id, el.id))
    .sort((a, b) => (isLocation(b) - isLocation(a)) || (a.name || '').localeCompare(b.name || ''));
  for (const c of candidates) {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.id === PLAYER_ID ? '🎒 Inventar des Spielers' : (isLocation(c) ? '🗺 ' : '') + c.name;
    select.appendChild(opt);
  }
  select.value = el.locatedIn || '';
  setTip(select, BASE_TIPS.locatedIn);
  select.addEventListener('change', () => {
    if (select.value === PLAYER_ID) ensurePlayerElement();
    el.locatedIn = select.value || null;
    markDirty();
    renderGraph();
    renderEditorStack();
  });
  row.appendChild(select);
  return row;
}

function doorTarget(el) {
  for (const trig of el.onUse || []) {
    for (const effect of trig.effects || []) {
      if (effect.setCurrentElement) return effect.setCurrentElement;
    }
  }
  return null;
}

function setDoorTarget(el, targetId) {
  for (const trig of el.onUse || []) {
    for (const effect of trig.effects || []) {
      if (effect.setCurrentElement) {
        effect.setCurrentElement = targetId;
        return;
      }
    }
  }
  el.onUse = el.onUse || [];
  el.onUse.push({ id: `go_${el.id}`, enabled: true, effects: [{ setCurrentElement: targetId }] });
}

function renderTargetRow(el) {
  const row = makeRow('Führt zu', BASE_TIPS.target);
  const select = document.createElement('select');
  const current = doorTarget(el);
  if (!current) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = '– Ziel wählen –';
    select.appendChild(opt);
  }
  for (const loc of Object.values(ed.elementsById).filter(isLocation)) {
    // Der eigene Ort ist als Ziel sinnlos - ausser er ist es schon (z.B. "Weg im Nebel fuehrt zurueck").
    if (loc.id === el.locatedIn && loc.id !== current) continue;
    const opt = document.createElement('option');
    opt.value = loc.id;
    opt.textContent = loc.name;
    select.appendChild(opt);
  }
  select.value = current || '';
  setTip(select, BASE_TIPS.target);
  select.addEventListener('change', () => {
    if (!select.value) return;
    setDoorTarget(el, select.value);
    markDirty();
    renderGraph();
    renderEditorStack();
  });
  row.appendChild(select);
  return row;
}

// Gleiches Ersatz-Element, das game.js anlegt, wenn eine Story kein player-Element hat.
function ensurePlayerElement() {
  if (ed.elementsById[PLAYER_ID]) return;
  const player = {
    id: PLAYER_ID,
    name: 'Inventar',
    type: 'player',
    physical: true,
    layers: ed.story.layers && ed.story.layers[0] ? [ed.story.layers[0].id] : [],
    locatedIn: null,
    initialState: {},
    initialPartOf: [],
    presentation: { firstView: 'Du schaust in deine Taschen.' },
  };
  ed.elementsById[PLAYER_ID] = player;
  ed.story.elements.push(player);
  markDirty();
}

function openStartInventory() {
  ensurePlayerElement();
  ed.stack = [];
  openElementWindow(PLAYER_ID);
}

function canBePortable(el) {
  return !isLocation(el) && !isDoor(el) && !['person', 'player', 'inscription', 'feature', 'furniture'].includes(el.type)
    && el.physical !== false;
}

function renderPortableRow(el) {
  const row = document.createElement('label');
  row.className = 'field-row field-row-inline';
  const cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.checked = !!el.portable;
  cb.addEventListener('change', () => {
    if (cb.checked) el.portable = true;
    else delete el.portable;
    markDirty();
    renderEditorStack();
  });
  row.appendChild(cb);
  const span = document.createElement('span');
  span.className = 'field-label';
  span.textContent = '✋ Kann aufgenommen werden';
  span.appendChild(infoIcon(BASE_TIPS.portable));
  row.appendChild(span);
  setTip(row, BASE_TIPS.portable);
  return row;
}

function renderStartRow(el) {
  const row = document.createElement('label');
  row.className = 'field-row field-row-inline';
  const cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.checked = ed.story.header.startElement === el.id;
  cb.disabled = cb.checked;
  cb.addEventListener('change', () => {
    ed.story.header.startElement = el.id;
    markDirty();
    renderGraph();
    renderEditorStack();
  });
  row.appendChild(cb);
  const span = document.createElement('span');
  span.className = 'field-label';
  span.textContent = cb.checked ? '★ Startort der Geschichte' : 'Als Startort festlegen';
  span.appendChild(infoIcon(BASE_TIPS.start));
  row.appendChild(span);
  setTip(row, BASE_TIPS.start);
  return row;
}

function renderExitLabelRow(el, ineffective) {
  const tip = ineffective
    ? BASE_TIPS.exitLabel + '\n\nAchtung: Bei Wegen und Orten der obersten Ebene zeigt das Spiel keinen Zurück-Knopf – dieser Wert hat hier keine Wirkung.'
    : BASE_TIPS.exitLabel;
  const row = makeRow('Zurück-Knopf' + (ineffective ? ' (ohne Wirkung)' : ''), tip);
  const input = document.createElement('input');
  input.value = el.exitLabel || '';
  input.placeholder = 'Zurück';
  setTip(input, tip);
  input.addEventListener('input', () => {
    el.exitLabel = input.value;
    markDirty();
  });
  row.appendChild(input);
  return row;
}

function addChildElement(parentId) {
  const name = prompt('Name des neuen Objekts:');
  if (!name) return;
  const existingIds = new Set(Object.keys(ed.elementsById));
  const id = slugify(name, existingIds);
  const parent = ed.elementsById[parentId];
  const el = {
    id,
    name,
    type: 'object',
    physical: true,
    layers: parent.layers ? [...parent.layers] : [],
    locatedIn: parentId,
    initialState: { visible: true },
    initialPartOf: [],
    presentation: {},
  };
  ed.elementsById[id] = el;
  ed.story.elements.push(el);
  markDirty();
  renderEditorStack();
}

function deleteGenericElement(id) {
  const hasChildren = Object.values(ed.elementsById).some((c) => c.locatedIn === id);
  if (hasChildren) {
    alert('Dieses Element enthält noch andere Elemente. Bitte zuerst entfernen oder verschieben.');
    return;
  }
  if (isReferencedElsewhere(id)) {
    if (!confirm('Dieses Element wird an anderer Stelle referenziert (z.B. Verbindung, Bedingung, partOf). Trotzdem löschen?')) {
      return;
    }
  } else if (!confirm(`"${ed.elementsById[id].name}" wirklich löschen?`)) {
    return;
  }
  removeElement(id);
  ed.stack = ed.stack.filter((sid) => sid !== id);
  markDirty();
  renderGraph();
  renderEditorStack();
}

// ---------------------------------------------------------------------
// Speichern / Verlassen
// ---------------------------------------------------------------------

async function saveEditorStory() {
  const payload = {
    header: ed.story.header,
    layers: ed.story.layers,
    resolution: ed.story.resolution,
    elements: Object.values(ed.elementsById),
    // Nur fuer den Editor; der Server schreibt das in editor_layout.json, nicht in die YAML.
    editorLayout: Object.fromEntries(locationsList().filter((l) => ed.layout[l.id]).map((l) => [l.id, ed.layout[l.id]])),
  };
  const btn = document.getElementById('btn-editor-save');
  btn.disabled = true;
  btn.textContent = 'Speichere…';
  try {
    const res = await fetch('/api/story/' + encodeURIComponent(ed.storyId), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const result = await res.json();
    if (!res.ok || result.error) throw new Error(result.error || 'Unbekannter Fehler');
    ed.dirty = false;
    showEditorToast('Gespeichert.');
    return true;
  } catch (err) {
    showEditorToast('Fehler beim Speichern: ' + err.message);
    return false;
  } finally {
    btn.textContent = 'Speichern';
    updateSaveButtonState();
  }
}

function exitEditor() {
  if (ed.dirty) {
    showLeaveDialog();
    return;
  }
  leaveEditorNow();
}

// Sicherheitsabfrage bei ungespeicherten Aenderungen: Speichern und verlassen /
// Verwerfen und verlassen / Im Editor bleiben (auch per Esc oder Klick daneben).
function showLeaveDialog() {
  document.getElementById('leave-dialog').hidden = false;
  document.getElementById('btn-leave-save').focus();
}

function hideLeaveDialog() {
  document.getElementById('leave-dialog').hidden = true;
}

async function saveAndLeave() {
  const btn = document.getElementById('btn-leave-save');
  btn.disabled = true;
  const ok = await saveEditorStory();
  btn.disabled = false;
  hideLeaveDialog();
  // Bei Fehler im Editor bleiben, damit nichts verloren geht (Fehlermeldung kommt als Toast).
  if (ok) leaveEditorNow();
}

function discardAndLeave() {
  hideLeaveDialog();
  ed.dirty = false;
  leaveEditorNow();
}

// ---------------------------------------------------------------------
// Angaben zur Geschichte (header: title, author, teaser, version)
// ---------------------------------------------------------------------

function openMetaDialog() {
  const header = ed.story.header;
  fillSpeakerSelect(document.getElementById('meta-narrator'), header.narratorVoice,
    `(keine Angabe – ${speakerLabel(ed.voices.default)})`);
  for (const input of document.querySelectorAll('#meta-dialog [data-meta]')) {
    if (input.id === 'meta-narrator') continue;
    const value = header[input.dataset.meta];
    input.value = value == null ? '' : value;
  }
  document.getElementById('meta-dialog').hidden = false;
  document.getElementById('meta-title').focus();
}

function hideMetaDialog() {
  document.getElementById('meta-dialog').hidden = true;
}

function onMetaInput(input) {
  const key = input.dataset.meta;
  if (key === 'version') {
    const n = parseInt(input.value, 10);
    ed.story.header.version = Number.isNaN(n) ? 1 : n;
  } else if (key === 'narratorVoice' && !input.value) {
    delete ed.story.header.narratorVoice;
  } else {
    ed.story.header[key] = input.value;
  }
  // Titel steht auch oben in der Leiste - beide Eingaben synchron halten.
  if (key === 'title') document.getElementById('editor-title').value = input.value;
  markDirty();
}

// ---------------------------------------------------------------------
// Sprecher (Stimmen fuer die Sprachsamples)
// ---------------------------------------------------------------------

// Liste kommt vom Server (vocs_fields.SPEAKERS) - dieselbe Quelle wie generate_samples.py.
async function loadVoices() {
  if (ed.voices) return;
  try {
    const res = await fetch('/api/voices');
    ed.voices = await res.json();
  } catch (_) {
    ed.voices = { default: 'standard', speakers: [] };
  }
}

function speakerLabel(id) {
  const s = ((ed.voices && ed.voices.speakers) || []).find((v) => v.id === String(id || '').toLowerCase());
  return s ? s.label : (id || 'Standard');
}

// Fuellt eine Sprecher-Auswahl. Werte werden ohne Gross-/Kleinschreibung verglichen
// (Story-Dateien enthalten z.B. "Standard"); Unbekanntes bleibt als Warn-Eintrag erhalten.
function fillSpeakerSelect(select, value, emptyLabel) {
  select.innerHTML = '';
  const empty = document.createElement('option');
  empty.value = '';
  empty.textContent = emptyLabel;
  select.appendChild(empty);
  for (const s of ed.voices.speakers) {
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = s.label;
    select.appendChild(opt);
  }
  const lower = String(value || '').toLowerCase();
  if (value && !ed.voices.speakers.some((s) => s.id === lower)) {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = `⚠ unbekannt: ${value}`;
    select.appendChild(opt);
    select.value = value;
  } else {
    select.value = value ? lower : '';
  }
}

const VOICE_TIP = 'Sprecher: Mit welcher Stimme die Texte dieses Elements vorgelesen werden – z.B. eine eigene Stimme für eine Person, '
  + 'damit ihre Worte sich vom Erzähler abheben.\n'
  + 'Leer = die Erzählstimme der Geschichte (einstellbar unter „📝 Geschichte“).\n'
  + 'Wirkt erst, nachdem die Sprachdateien neu erzeugt wurden: python generate_samples.py';

function renderVoiceRow(el) {
  const row = makeRow('Sprecher', VOICE_TIP);
  const select = document.createElement('select');
  const narrator = ed.story.header.narratorVoice || ed.voices.default;
  fillSpeakerSelect(select, el.voice, `(Erzählstimme: ${speakerLabel(narrator)})`);
  setTip(select, VOICE_TIP);
  select.addEventListener('change', () => {
    if (select.value) el.voice = select.value;
    else delete el.voice;
    markDirty();
  });
  row.appendChild(select);
  return row;
}

function leaveEditorNow() {
  cancelConnect();
  ed.stack = [];
  renderEditorStack();
  showScreen('screen-select');
  if (typeof loadStoryList === 'function') loadStoryList();
}

// ---------------------------------------------------------------------
// Kleine UI-Helfer
// ---------------------------------------------------------------------

function showEditorBanner(text, showCancel) {
  const banner = document.getElementById('editor-banner');
  document.getElementById('editor-banner-text').textContent = text;
  banner.hidden = false;
  document.getElementById('btn-editor-cancel-connect').hidden = !showCancel;
}

function hideEditorBanner() {
  document.getElementById('editor-banner').hidden = true;
  document.getElementById('btn-editor-cancel-connect').hidden = true;
}

let editorToastTimer = null;
function showEditorToast(text) {
  const toast = document.getElementById('toast');
  toast.textContent = text;
  toast.hidden = false;
  clearTimeout(editorToastTimer);
  editorToastTimer = setTimeout(() => {
    toast.hidden = true;
  }, 4000);
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btn-open-editor').addEventListener('click', openEditorStoryList);
  document.getElementById('btn-editor-select-back').addEventListener('click', () => showScreen('screen-select'));
  document.getElementById('btn-editor-leave').addEventListener('click', exitEditor);
  document.getElementById('btn-editor-save').addEventListener('click', saveEditorStory);
  document.getElementById('btn-editor-add-location').addEventListener('click', addLocation);
  document.getElementById('btn-editor-cancel-connect').addEventListener('click', cancelConnect);
  document.getElementById('editor-title').addEventListener('input', (e) => {
    ed.story.header.title = e.target.value;
    markDirty();
  });
  document.getElementById('btn-editor-help').addEventListener('click', toggleEditorHelp);
  document.getElementById('btn-editor-inventory').addEventListener('click', openStartInventory);
  document.getElementById('btn-editor-meta').addEventListener('click', openMetaDialog);
  document.getElementById('btn-meta-close').addEventListener('click', hideMetaDialog);
  document.getElementById('meta-dialog').addEventListener('click', (e) => {
    if (e.target.id === 'meta-dialog') hideMetaDialog();
  });
  for (const input of document.querySelectorAll('#meta-dialog [data-meta]')) {
    input.addEventListener('input', () => onMetaInput(input));
  }
  document.getElementById('btn-leave-save').addEventListener('click', saveAndLeave);
  document.getElementById('btn-leave-discard').addEventListener('click', discardAndLeave);
  document.getElementById('btn-leave-cancel').addEventListener('click', hideLeaveDialog);
  document.getElementById('leave-dialog').addEventListener('click', (e) => {
    if (e.target.id === 'leave-dialog') hideLeaveDialog();
  });
  document.getElementById('btn-editor-help-close').addEventListener('click', toggleEditorHelp);
  initTooltips();
  initSelectionRectangle();

  document.addEventListener('pointerdown', (e) => {
    if (!ed.openContents) return;
    if (e.target.closest && e.target.closest('.loc-contents, .loc-contents-btn')) return;
    closeContentsList();
  });
  document.addEventListener('keydown', (e) => {
    if (document.getElementById('screen-editor-graph').hidden) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      if (ed.dirty) saveEditorStory();
    } else if (e.key === 'Escape') {
      if (!document.getElementById('leave-dialog').hidden) hideLeaveDialog();
      else if (!document.getElementById('meta-dialog').hidden) hideMetaDialog();
      else if (ed.connectSource) cancelConnect();
      else if (ed.openContents) closeContentsList();
      else if (ed.stack.length > 0) closeEditorTopWindow();
      else if (ed.selection.size > 0) setSelection(new Set());
    }
  });

  window.addEventListener('beforeunload', (e) => {
    if (ed.dirty) {
      e.preventDefault();
      e.returnValue = '';
    }
  });
});

function toggleEditorHelp() {
  const help = document.getElementById('editor-help');
  help.hidden = !help.hidden;
  try {
    localStorage.setItem('editorHelpHidden', help.hidden ? '1' : '0');
  } catch (_) { /* Speicher nicht verfuegbar - Hilfe-Zustand dann nicht merken */ }
}
