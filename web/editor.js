'use strict';

/* Story-Editor: zeigt physische Orte (Ellipsen) samt Verbindungen (Pfeile via
 * Tuer-Elementen) und erlaubt rekursives Aufklappen + Bearbeiten aller Texte,
 * analog zum Fenster-Stapel des Spiels, aber ohne Spiel-Logik (Trigger/State).
 * Nutzt escapeHtml() und showScreen() aus game.js (im selben Dokument geladen).
 */

const NARRATED_FIELDS = [
  'firstView', 'repeatView',
  'firstUse', 'repeatUse', 'blockedUse',
  'openLeadView', 'openLeadUse',
  'completeView', 'completeUse',
  'contentText', 'blockedText', 'exitText',
  'heading', 'body', 'openQuestion', 'releaseText',
];

// Nicht vorgelesene Zusatztexte (erscheinen im Spiel nur als kurze Meldung), daher nicht
// in NARRATED_FIELDS / vocs_fields.py.
const EDITOR_TEXT_FIELDS = [...NARRATED_FIELDS, 'takeText', 'dropText'];

// PLAYER_ID kommt aus game.js (gemeinsamer globaler Scope beider Scripts).

const LOCATION_TYPES = ['room', 'area', 'building'];

// ---------------------------------------------------------------------
// Erklaerungen fuer Roll-Over-Tooltips. Die Texte beschreiben, was das Spiel
// (game.js: pickPresentationText, applyEffect, renderLog) tatsaechlich mit dem
// jeweiligen Feld macht - bei Aenderungen an der Spiellogik hier mitpflegen.
// ---------------------------------------------------------------------

const FIELD_INFO = {
  firstView: {
    label: 'Erster Besuch',
    tip: 'Text, den der Spieler beim ERSTEN Öffnen bzw. Betreten dieses Elements liest.\n'
      + 'Das ist der wichtigste Text – fast jedes Element sollte ihn haben.',
    placeholder: 'z.B. Du betrittst eine staubige Kammer. Durch ein kleines Fenster fällt fahles Licht.',
  },
  repeatView: {
    label: 'Wiederkehr',
    tip: 'Text ab dem ZWEITEN Öffnen/Betreten.\n'
      + 'Meist kürzer als der erste Text. Fehlt er, wird einfach der Text vom ersten Besuch wiederholt.',
    placeholder: 'z.B. Die staubige Kammer. Nichts hat sich verändert.',
  },
  firstUse: {
    label: 'Erstes Benutzen',
    tip: 'Alternative zu „Erster Besuch“ für Dinge, die man eher benutzt als ansieht (Hebel, Schalter, Tür).\n'
      + 'Wird nur angezeigt, wenn KEIN „Erster Besuch“-Text existiert.\n'
      + 'Hinweis: Hier gehört Erzähltext hinein – kein Ziel einer Tür. Wege legst du im Ortsgraph mit 🔗 an.',
    placeholder: 'z.B. Du ziehst kräftig am Hebel. Irgendwo knarrt Holz.',
  },
  repeatUse: {
    label: 'Erneutes Benutzen',
    tip: 'Alternative zu „Wiederkehr“ für Dinge, die man benutzt.\n'
      + 'Wird ab dem zweiten Mal gezeigt, wenn KEIN „Wiederkehr“-Text existiert.',
    placeholder: 'z.B. Der Hebel bewegt sich nicht mehr.',
  },
  blockedUse: {
    label: 'Nichts Neues mehr',
    tip: 'Text ab dem zweiten Benutzen, wenn hier nichts mehr zu holen ist.\n'
      + 'Hat Vorrang vor „Wiederkehr“ und „Erneutes Benutzen“.',
    placeholder: 'z.B. Die Schublade ist leer.',
  },
  openLeadView: {
    label: 'Neue Spur',
    tip: 'Wird gezeigt, solange in diesem Element etwas NEU aufgetaucht ist, das der Spieler noch nicht angesehen hat '
      + '(z.B. ein Fach hat sich geöffnet).\n'
      + 'Lenkt die Aufmerksamkeit auf das Neue. Hat Vorrang vor Erster Besuch / Wiederkehr.',
    placeholder: 'z.B. Im Schreibtisch ist jetzt ein Geheimfach zu sehen.',
  },
  openLeadUse: {
    label: 'Neue Spur (Benutzen)',
    tip: 'Wie „Neue Spur“, aber für Dinge, die man benutzt. Wird nur genutzt, wenn „Neue Spur“ leer ist.',
  },
  completeView: {
    label: 'Abgeschlossen',
    tip: 'Wird gezeigt, sobald dieses Element als „vollständig untersucht“ gilt '
      + '(ein Auslöser setzt investigation = complete).\n'
      + 'Höchste Priorität – ersetzt dann alle anderen Texte.',
    placeholder: 'z.B. Hier hast du alles herausgefunden, was es zu wissen gibt.',
  },
  completeUse: {
    label: 'Abgeschlossen (Benutzen)',
    tip: 'Wie „Abgeschlossen“, aber für Dinge, die man benutzt. Wird nur genutzt, wenn „Abgeschlossen“ leer ist.',
  },
  contentText: {
    label: 'Wortlaut',
    tip: 'Der wörtliche Inhalt eines Dokuments, Briefs oder einer Inschrift.\n'
      + 'Wird bei JEDEM Öffnen unter den eigentlichen Text gehängt – egal ob erster Besuch oder Wiederkehr.\n'
      + 'So bleibt die Rahmenerzählung („Du entfaltest den Brief…“) vom Briefinhalt getrennt.',
    placeholder: 'z.B. „Liebe Clara, ich kann nicht länger schweigen …“',
  },
  blockedText: {
    label: 'Weg versperrt',
    tip: 'Sondertext, der NICHT automatisch erscheint.\n'
      + 'Er wird nur angezeigt, wenn ein Auslöser ihn per „showTextFrom“ aufruft – typischerweise wenn ein Weg noch versperrt ist.',
    placeholder: 'z.B. Der Weg verschwindet im Nebel. Du kehrst um.',
  },
  exitText: {
    label: 'Abschiedstext',
    tip: 'Sondertext, der NICHT automatisch erscheint.\n'
      + 'Wird über einen Auslöser („showTextFrom“) gezeigt, z.B. wenn der Spieler die Geschichte über diesen Weg verlässt.',
    placeholder: 'z.B. Du folgst dem Weg aus dem Dorf. Die Geschichte ist abgeschlossen.',
  },
  heading: {
    label: 'Überschrift',
    tip: 'Kurze Überschrift für dieses Element (wird mitvorgelesen).\n'
      + 'Im Spiel derzeit nur sichtbar, wenn ein Auslöser sie per „showTextFrom“ aufruft.',
  },
  body: {
    label: 'Logbuch-Eintrag',
    tip: 'Text im Logbuch – gedacht für NICHT-physische Elemente wie Erkenntnisse, Gerüchte oder Widersprüche.\n'
      + 'Erscheint, sobald der Spieler dieses Wissen entdeckt hat.',
    placeholder: 'z.B. Clara war in der Unglücksnacht nicht im Dorf.',
  },
  openQuestion: {
    label: 'Offene Frage',
    tip: 'Nur für Widersprüche: Die Frage, die im Logbuch unter dem Logbuch-Eintrag steht und den Spieler zum Weiterforschen anregt.',
    placeholder: 'z.B. Wer hat dann das Wehr geöffnet?',
  },
  releaseText: {
    label: 'Auflösungstext',
    tip: 'Text für die Auflösung der Geschichte.\n'
      + 'Wird über einen Auslöser („showTextFrom“) gezeigt, meist wenn die Lösungsbedingung erfüllt ist.',
  },
  takeText: {
    label: 'Meldung beim Aufnehmen',
    tip: 'Kurze Meldung, wenn der Spieler diesen Gegenstand ins Inventar legt.\n'
      + 'Leer lassen = „Du nimmst „Name“ an dich.“\nNur sinnvoll, wenn „Kann aufgenommen werden“ angehakt ist.',
    placeholder: 'z.B. Du steckst den rostigen Schlüssel ein.',
  },
  dropText: {
    label: 'Meldung beim Ablegen',
    tip: 'Kurze Meldung, wenn der Spieler diesen Gegenstand aus dem Inventar wieder ablegt.\n'
      + 'Leer lassen = „Du legst „Name“ hier ab.“',
    placeholder: 'z.B. Du legst den Schlüssel vorsichtig auf den Tisch.',
  },
  style: {
    label: 'Logbuch-Kategorie',
    tip: 'Legt fest, in welchem Logbuch-Abschnitt der Logbuch-Eintrag landet:\n'
      + '„discovery“ = Neue Erkenntnisse, „contradiction“ = Widersprüche & offene Fragen.',
  },
};

const TEXT_PRIORITY_TIP = 'Welcher Text erscheint? Das Spiel nimmt den ersten passenden:\n'
  + '1. Abgeschlossen  2. Neue Spur  3. Erster Besuch (beim 1. Mal)  4. Nichts Neues mehr  5. Wiederkehr\n'
  + 'Ein „Wortlaut“ wird immer zusätzlich angehängt.';

const TYPE_INFO = {
  room: 'Raum – ein begehbarer Ort (Zimmer, Kammer, Keller). Erscheint als Ellipse im Ortsgraph.',
  area: 'Bereich – ein Ort im Freien (Dorfplatz, Waldweg, Ufer). Erscheint als Ellipse im Ortsgraph.',
  building: 'Gebäude – ein Ort, der weitere Räume enthält. Erscheint als Ellipse im Ortsgraph.',
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
    + '„(oberste Ebene)“ = ein eigenständiger Ort, der nirgends enthalten ist.',
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
  positions: {},
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

// ---------------------------------------------------------------------
// Grafische Ebene: Ellipsen + Pfeile
// ---------------------------------------------------------------------

function renderGraph() {
  const size = computeLayout();
  const canvas = document.getElementById('editor-canvas');
  canvas.innerHTML = '';
  canvas.style.width = size.width + 'px';
  canvas.style.height = size.height + 'px';

  const svgNs = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNs, 'svg');
  svg.setAttribute('class', 'editor-arrows');
  svg.setAttribute('width', size.width);
  svg.setAttribute('height', size.height);
  const defs = document.createElementNS(svgNs, 'defs');
  defs.innerHTML = '<marker id="arrowhead" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto">'
    + '<polygon points="0 0, 10 4, 0 8" fill="#c9a24b"></polygon></marker>';
  svg.appendChild(defs);

  const overlay = document.createElement('div');
  overlay.className = 'editor-conn-overlay';

  for (const conn of getConnections()) {
    const a = ed.positions[conn.from];
    const b = ed.positions[conn.to];
    if (!a || !b) continue;
    const ax = a.x + 70;
    const ay = a.y + 40;
    const bx = b.x + 70;
    const by = b.y + 40;
    const dx = bx - ax;
    const dy = by - ay;
    const dist = Math.hypot(dx, dy) || 1;
    const ux = dx / dist;
    const uy = dy / dist;
    const rx = 68;
    const ry = 38;
    const x1 = ax + ux * rx;
    const y1 = ay + uy * ry;
    const x2 = bx - ux * rx;
    const y2 = by - uy * ry;

    const line = document.createElementNS(svgNs, 'line');
    line.setAttribute('x1', x1);
    line.setAttribute('y1', y1);
    line.setAttribute('x2', x2);
    line.setAttribute('y2', y2);
    line.setAttribute('class', 'conn-line');
    line.setAttribute('marker-end', 'url(#arrowhead)');
    svg.appendChild(line);

    const hit = document.createElementNS(svgNs, 'line');
    hit.setAttribute('x1', x1);
    hit.setAttribute('y1', y1);
    hit.setAttribute('x2', x2);
    hit.setAttribute('y2', y2);
    hit.setAttribute('class', 'conn-hit');
    hit.addEventListener('click', () => openElementWindow(conn.doorId));
    svg.appendChild(hit);

    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;
    const door = ed.elementsById[conn.doorId];
    const fromName = ed.elementsById[conn.from].name;
    const toName = ed.elementsById[conn.to].name;
    setTip(hit, `Weg „${door.name}“: von ${fromName} nach ${toName}.\nKlicken, um Name und Texte des Weges zu bearbeiten.`);

    const delBtn = document.createElement('button');
    delBtn.className = 'conn-delete-btn';
    delBtn.textContent = '✕';
    setTip(delBtn, `Weg von ${fromName} nach ${toName} löschen.\nEin eventueller Rückweg bleibt erhalten.`);
    delBtn.style.left = midX + 'px';
    delBtn.style.top = midY + 'px';
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteConnection(conn.doorId);
    });
    overlay.appendChild(delBtn);
  }

  canvas.appendChild(svg);
  canvas.appendChild(overlay);

  const locations = Object.values(ed.elementsById).filter(isLocation);
  if (locations.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'editor-empty-note';
    empty.textContent = 'Noch keine Orte vorhanden. Lege oben mit „+ Neuer Ort“ den ersten Ort an.';
    canvas.appendChild(empty);
  }

  const startId = ed.story.header && ed.story.header.startElement;
  for (const el of locations) {
    const pos = ed.positions[el.id];
    if (!pos) continue;
    const isStart = el.id === startId;
    const node = document.createElement('div');
    node.className = 'loc-node'
      + (ed.connectSource === el.id ? ' connect-source' : '')
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
    setTip(node, ed.connectSource
      ? `Hier klicken, um den Weg nach „${el.name}“ anzulegen.`
      : `${TYPE_INFO[el.type] || el.type}\n${contained} Element(e) darin.${isStart ? '\n★ Hier beginnt die Geschichte.' : ''}\n`
        + 'Klicken, um Texte und Inhalt dieses Ortes zu bearbeiten.');
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
    node.addEventListener('click', () => onLocationClick(el.id));
    canvas.appendChild(node);
  }
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
    type: 'room',
    physical: true,
    layers: ed.story.layers && ed.story.layers[0] ? [ed.story.layers[0].id] : [],
    locatedIn: null,
    initialState: { visible: true },
    initialPartOf: [],
    presentation: {},
  };
  ed.elementsById[id] = el;
  ed.story.elements.push(el);
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
  const closeBtn = document.createElement('button');
  closeBtn.className = 'close-btn';
  closeBtn.textContent = isFirstInStack ? '← Zum Ortsgraph' : '← Zurück';
  setTip(closeBtn, isFirstInStack
    ? 'Fenster schließen und zur Übersicht aller Orte zurückkehren. Änderungen bleiben erhalten (aber noch nicht gespeichert).'
    : 'Dieses Fenster schließen und zum darunterliegenden Element zurückkehren.');
  closeBtn.addEventListener('click', closeEditorTopWindow);
  header.appendChild(closeBtn);
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

  body.appendChild(renderInitialStateSection(el));

  el.presentation = el.presentation || {};
  const usedFields = Object.keys(el.presentation);

  // Ein Weg navigiert sofort zum Ziel (setCurrentElement) - sein eigenes Fenster und
  // damit seine Texte/Inhalte sieht der Spieler nie. Nur Hinweis statt leerer Felder.
  // Reaktionen (z.B. "nur mit Schluessel") bekommt ein Weg trotzdem.
  if (isDoor(el) && usedFields.length === 0) {
    const note = document.createElement('p');
    note.className = 'door-note';
    note.textContent = 'Ein Weg braucht keine eigenen Texte: Der Name ist die Beschriftung des Knopfs, '
      + 'und beim Klicken landet der Spieler direkt am Zielort und liest dort dessen Text. '
      + 'Soll der Weg versperrt sein, lege unten eine Reaktion mit Bedingung an.';
    body.appendChild(note);
    body.appendChild(renderReactionsSection(el));
    div.appendChild(body);
    return div;
  }

  renderTextsSection(el, body, usedFields);
  body.appendChild(renderImagesSection(el));
  body.appendChild(renderReactionsSection(el));
  div.appendChild(body);
  appendContainsMenu(div, el);
  return div;
}

function renderTextsSection(el, body, usedFields) {
  body.appendChild(renderSection('Texte', TEXT_PRIORITY_TIP));
  const ordered = [
    ...EDITOR_TEXT_FIELDS.filter((f) => usedFields.includes(f)),
    ...usedFields.filter((f) => !EDITOR_TEXT_FIELDS.includes(f)),
  ];
  if (ordered.length === 0) {
    const note = document.createElement('p');
    note.className = 'field-empty-note';
    note.textContent = 'Noch keine Texte. Tipp: Beginne mit „Erster Besuch“.';
    body.appendChild(note);
  }
  for (const field of ordered) {
    body.appendChild(renderTextField(el, field));
  }

  const remainingFields = EDITOR_TEXT_FIELDS
    .filter((f) => !usedFields.includes(f))
    .filter((f) => el.portable || (f !== 'takeText' && f !== 'dropText'));
  if (remainingFields.length > 0) {
    const addFieldRow = document.createElement('div');
    addFieldRow.className = 'add-field-row';
    const select = document.createElement('select');
    for (const f of remainingFields) {
      const opt = document.createElement('option');
      opt.value = f;
      opt.textContent = fieldLabel(f);
      select.appendChild(opt);
    }
    const desc = document.createElement('p');
    desc.className = 'add-field-desc';
    const updateDesc = () => {
      const info = FIELD_INFO[select.value];
      desc.textContent = info ? info.tip : '';
      setTip(select, 'Welches Textfeld soll hinzugefügt werden?\n\n' + (info ? info.tip : ''));
    };
    select.addEventListener('change', updateDesc);
    updateDesc();
    const addBtn = document.createElement('button');
    addBtn.textContent = '+ Textfeld hinzufügen';
    addBtn.className = 'menu-btn';
    setTip(addBtn, 'Fügt das links gewählte Textfeld zu diesem Element hinzu.');
    addBtn.addEventListener('click', () => {
      const field = select.value;
      el.presentation[field] = '';
      markDirty();
      renderEditorStack();
      const ta = document.querySelector(`#editor-window-stack .window:last-child textarea[data-field="${field}"]`);
      if (ta) ta.focus();
    });
    addFieldRow.appendChild(select);
    addFieldRow.appendChild(addBtn);
    body.appendChild(addFieldRow);
    body.appendChild(desc);
  }
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
    el.type = select.value;
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

function renderTextField(el, field) {
  const info = FIELD_INFO[field] || {};
  const row = document.createElement('div');
  row.className = 'field-row';
  const head = document.createElement('div');
  head.className = 'field-head';
  const label = document.createElement('span');
  label.className = 'field-label';
  label.textContent = fieldLabel(field);
  if (info.label) {
    const key = document.createElement('span');
    key.className = 'field-key';
    key.textContent = field;
    label.appendChild(key);
  }
  label.appendChild(infoIcon(info.tip || 'Freies Textfeld ohne besondere Bedeutung im Spiel.'));
  head.appendChild(label);
  const del = document.createElement('button');
  del.className = 'field-del-btn';
  del.textContent = '✕';
  setTip(del, `Textfeld „${fieldLabel(field)}“ entfernen.`);
  del.addEventListener('click', () => {
    if (el.presentation[field] && !confirm(`Textfeld „${fieldLabel(field)}“ samt Inhalt entfernen?`)) return;
    delete el.presentation[field];
    markDirty();
    renderEditorStack();
  });
  head.appendChild(del);
  row.appendChild(head);

  const textarea = document.createElement('textarea');
  textarea.dataset.field = field;
  textarea.rows = field === 'contentText' ? 5 : 3;
  textarea.value = el.presentation[field] || '';
  textarea.placeholder = info.placeholder || '';
  setTip(textarea, info.tip);
  textarea.addEventListener('input', () => {
    el.presentation[field] = textarea.value;
    markDirty();
  });
  row.appendChild(textarea);
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

  document.addEventListener('keydown', (e) => {
    if (document.getElementById('screen-editor-graph').hidden) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      if (ed.dirty) saveEditorStory();
    } else if (e.key === 'Escape') {
      if (!document.getElementById('leave-dialog').hidden) hideLeaveDialog();
      else if (!document.getElementById('meta-dialog').hidden) hideMetaDialog();
      else if (ed.connectSource) cancelConnect();
      else if (ed.stack.length > 0) closeEditorTopWindow();
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
