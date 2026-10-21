'use strict';

/* Elementbasierte Erzaehl-Engine - Prototyp v0.0
 * Laedt eine Story (JSON, vom Python-Server aus YAML konvertiert) und fuehrt
 * die komplette Spiellogik (Zustand, Trigger, Bedingungen, Effekte, Navigation)
 * client-seitig im Browser aus. Die Engine kennt keine story-spezifischen IDs -
 * alles Verhalten ergibt sich aus den generischen Regeln unten plus den Daten
 * der geladenen Story-Datei.
 */

const PLAYER_ID = 'player';

// Element-Typen, in die ein Gegenstand beim Ablegen aus dem Inventar gelegt werden kann
// (neben Orten). Bei allen anderen (z.B. Brief, Person) landet er am aktuellen Ort.
const DROP_TARGET_TYPES = ['room', 'area', 'building', 'place', 'container', 'feature', 'furniture', 'object_collection'];

// Gruppierung der Auswahlmoeglichkeiten unten im Fenster, in Anzeigereihenfolge.
// Zuordnung ueber den Element-Typ; alles Unbekannte landet unter "Sonstiges".
const MENU_CATEGORIES = [
  { key: 'person', label: 'Personen', icon: '👤', hint: 'Ansprechen',
    types: ['person', 'group'] },
  // Details: Festes am Ort zum Anschauen (Gemaelde, Kamin, Brunnen). "furniture" ist der
  // fruehere Name dieses Typs und bleibt fuer aeltere Story-Dateien als Alias gueltig.
  { key: 'feature', label: 'Details', icon: '◇', hint: 'Betrachten',
    types: ['feature', 'furniture'] },
  { key: 'item', label: 'Gegenstände', icon: '◆', hint: 'Untersuchen',
    types: ['object', 'object_collection', 'container', 'mechanism'] },
  { key: 'document', label: 'Schriftstücke', icon: '✎', hint: 'Lesen',
    types: ['document', 'document_collection', 'document_entry', 'inscription'] },
  { key: 'place', label: 'Bereiche', icon: '⌂', hint: 'Betreten',
    types: ['room', 'area', 'building', 'place'] },
  { key: 'way', label: 'Wege', icon: '➜', hint: 'Gehen',
    types: ['door'] },
  { key: 'other', label: 'Sonstiges', icon: '•', hint: '', types: [] },
];

function menuCategoryOf(el) {
  return MENU_CATEGORIES.find((c) => c.types.includes(el.type)) || MENU_CATEGORIES[MENU_CATEGORIES.length - 1];
}

const engine = {
  story: null,
  elementsById: {},
  fragmentsById: {},   // fragmentId -> { fact, assumption, ownerId, ownerName }
  runtime: {},          // elementId -> { visible, locatedIn, partOf, triggers, usedBefore, revealedDuringPlay, ...customState }
  discoveredOrder: [],  // fragment ids in discovery order
  discoveredSet: new Set(),
  stack: [],             // Fenster-Stapel; stack[0] = Weltebene
  resolutionApplied: false,
  gameFinished: false,
  pendingMessages: [],
  pendingSamples: [],
  actionCount: 0,       // Spieleraktionen seit Start - fuer die Verlassen-Rueckfrage   // Sample-Nummern erzaehlender Meldungen (showTextFrom), nach dem Fenstertext vorzulesen
};

// ---------------------------------------------------------------------
// Laden
// ---------------------------------------------------------------------

async function loadStoryList() {
  const res = await fetch('/api/stories');
  const stories = await res.json();
  const list = document.getElementById('story-list');
  list.innerHTML = '';
  if (stories.length === 0) {
    const note = document.createElement('p');
    note.className = 'empty-note';
    note.textContent = 'Keine Geschichten gefunden. Lege YAML-Dateien unter Stories/ ab.';
    list.appendChild(note);
    return;
  }
  for (const s of stories) {
    const card = document.createElement('div');
    card.className = 'story-card';
    card.innerHTML = `
      <h2>${escapeHtml(s.title)}</h2>
      <p>${escapeHtml(s.teaser || '')}</p>
      <div class="meta">${escapeHtml(s.author || '')}</div>
    `;
    card.addEventListener('click', () => startStory(s.id));
    list.appendChild(card);
  }
}

async function startStory(storyId) {
  const res = await fetch('/api/story/' + encodeURIComponent(storyId));
  const story = await res.json();
  initEngine(story);
  showScreen('screen-game');
  document.getElementById('game-title').textContent = story.header.title || story.header.id;
  setNarrationEnabled(false);
  render();
}

function initEngine(story) {
  engine.story = story;
  engine.elementsById = {};
  engine.fragmentsById = {};
  engine.runtime = {};
  engine.discoveredOrder = [];
  engine.discoveredSet = new Set();
  engine.resolutionApplied = false;
  engine.gameFinished = false;
  engine.pendingMessages = [];
  engine.pendingSamples = [];
  engine.actionCount = 0;

  // Inventar = Inhalt des Elements "player". Geschichten ohne eigenes player-Element
  // (z.B. neu im Editor angelegte) bekommen eines, damit Aufnehmen/Inventar immer funktioniert.
  if (!story.elements.some((el) => el.id === PLAYER_ID)) {
    story.elements.push({
      id: PLAYER_ID,
      name: 'Inventar',
      type: 'player',
      physical: true,
      locatedIn: null,
      initialState: {},
      initialPartOf: [],
      presentation: { firstView: 'Du schaust in deine Taschen.' },
    });
  }

  for (const el of story.elements) {
    engine.elementsById[el.id] = el;
    const rt = { locatedIn: el.locatedIn, usedBefore: false, revealedDuringPlay: false };
    Object.assign(rt, el.initialState || {});
    rt.partOf = Array.isArray(el.initialPartOf) ? [...el.initialPartOf] : [];
    rt.triggers = {};
    for (const trig of el.onUse || []) {
      rt.triggers[trig.id] = trig.enabled !== false;
    }
    engine.runtime[el.id] = rt;

    for (const frag of el.fragments || []) {
      engine.fragmentsById[frag.id] = {
        fact: frag.fact,
        assumption: frag.assumption,
        ownerId: el.id,
        ownerName: el.name,
      };
    }
  }

  engine.stack = [story.header.startElement];
}

// ---------------------------------------------------------------------
// Zustandszugriff
// ---------------------------------------------------------------------

function isVisible(id) {
  const rt = engine.runtime[id];
  return !!rt && rt.visible !== false;
}

function childrenOf(id) {
  // Der Spieler selbst wird nie als normales benutzbares Element gelistet - dafuer gibt
  // es den eigenen Inventar-Knopf (openInventory), auch wenn er rein raeumlich (locatedIn)
  // wie jedes andere Element irgendwo steht.
  return Object.keys(engine.runtime).filter(
    (cid) => engine.runtime[cid].locatedIn === id && engine.elementsById[cid].type !== 'player'
  );
}

function getStateValue(id, prop) {
  const rt = engine.runtime[id];
  if (!rt) return undefined;
  return rt[prop];
}

function setStateValue(id, prop, value) {
  const rt = engine.runtime[id];
  if (!rt) return;
  if (prop === 'visible') {
    if (value === true && rt.visible !== true) rt.revealedDuringPlay = true;
    if (value === false) rt.revealedDuringPlay = false;
  }
  rt[prop] = value;
}

function addPartOf(id, target) {
  const rt = engine.runtime[id];
  if (!rt) return;
  if (!rt.partOf.includes(target)) rt.partOf.push(target);
}

function removePartOf(id, target) {
  const rt = engine.runtime[id];
  if (!rt) return;
  rt.partOf = rt.partOf.filter((t) => t !== target);
}

function resolveTextPath(path) {
  const parts = path.split('.');
  let node = engine.elementsById[parts[0]];
  for (let i = 1; i < parts.length && node != null; i++) {
    node = node[parts[i]];
  }
  return typeof node === 'string' ? node : '';
}

// ---------------------------------------------------------------------
// Bedingungen
// ---------------------------------------------------------------------

function evalCondition(cond) {
  const key = Object.keys(cond)[0];
  const args = cond[key];
  switch (key) {
    case 'stateEquals': {
      const [id, prop, value] = args;
      return getStateValue(id, prop) === value;
    }
    case 'partOfExists': {
      const [id, target] = args;
      return (engine.runtime[id]?.partOf || []).includes(target);
    }
    case 'partOfMissing': {
      const [id, target] = args;
      return !(engine.runtime[id]?.partOf || []).includes(target);
    }
    case 'inInventory':
      return isCarried(args);
    case 'notInInventory':
      return !isCarried(args);
    default:
      console.warn('Unbekannter Bedingungstyp:', key);
      return false;
  }
}

function conditionsPass(conditions) {
  return (conditions || []).every(evalCondition);
}

// ---------------------------------------------------------------------
// Effekte
// ---------------------------------------------------------------------

let navigationTarget = null;

function applyEffect(effect, ctxElementId) {
  const key = Object.keys(effect)[0];
  const val = effect[key];
  switch (key) {
    case 'discoverFragment':
      if (!engine.discoveredSet.has(val)) {
        engine.discoveredSet.add(val);
        engine.discoveredOrder.push(val);
      }
      break;
    case 'revealElement':
      setStateValue(val, 'visible', true);
      break;
    case 'hideElement':
      setStateValue(val, 'visible', false);
      break;
    case 'addPartOf':
      addPartOf(val[0], val[1]);
      break;
    case 'removePartOf':
      removePartOf(val[0], val[1]);
      break;
    case 'replacePartOf':
      removePartOf(val.elementId, val.remove);
      addPartOf(val.elementId, val.add);
      break;
    case 'setElementState':
      setStateValue(val[0], val[1], val[2]);
      break;
    case 'setLocatedIn':
      if (engine.runtime[val[0]]) engine.runtime[val[0]].locatedIn = val[1];
      break;
    case 'setCurrentElement':
      navigationTarget = val;
      break;
    case 'showText':
      engine.pendingMessages.push(val);
      break;
    case 'showTextFrom': {
      const text = resolveTextPath(val);
      if (text) engine.pendingMessages.push(text);
      // Erzaehlende Meldung: wird vorgelesen, falls ein Sample existiert. Frei geschriebene
      // showText-Meldungen und Aufnehmen/Ablegen werden bewusst NICHT vorgelesen.
      const [msgElId, , msgField] = String(val).split('.');
      const msgEl = engine.elementsById[msgElId];
      const msgSample = msgEl && msgEl._samples ? msgEl._samples[msgField] : null;
      if (msgSample != null) engine.pendingSamples.push(msgSample);
      break;
    }
    case 'disableSelfTrigger':
      if (engine.runtime[ctxElementId]) engine.runtime[ctxElementId].triggers[val] = false;
      break;
    case 'disableTrigger':
      if (engine.runtime[val[0]]) engine.runtime[val[0]].triggers[val[1]] = false;
      break;
    case 'enableTrigger':
      if (engine.runtime[val[0]]) engine.runtime[val[0]].triggers[val[1]] = true;
      break;
    case 'finishGame':
      engine.gameFinished = true;
      break;
    default:
      console.warn('Unbekannter Effekttyp:', key);
  }
}

// ---------------------------------------------------------------------
// use() - die einzige bewusste Spieleraktion
// ---------------------------------------------------------------------

function use(elementId) {
  const el = engine.elementsById[elementId];
  if (!el) return;

  navigationTarget = elementId; // Default: das benutzte Element wird selbst fokussiert
  engine.actionCount++;
  engine.pendingMessages = [];
  engine.pendingSamples = [];

  const rt = engine.runtime[elementId];
  for (const trig of el.onUse || []) {
    if (!rt.triggers[trig.id]) continue;
    if (!conditionsPass(trig.conditions)) continue;
    for (const effect of trig.effects || []) {
      applyEffect(effect, elementId);
    }
  }

  focusElement(navigationTarget);
  checkResolution();

  if (engine.gameFinished) {
    showEndScreen();
    return;
  }

  render();
  if (engine.pendingMessages.length > 0) {
    showToast(engine.pendingMessages.join('\n\n'));
  }
}

function checkResolution() {
  const resolution = engine.story.resolution;
  if (!resolution || engine.resolutionApplied) return;
  if (!conditionsPass(resolution.conditions)) return;
  engine.resolutionApplied = true;
  for (const effect of resolution.effects || []) {
    applyEffect(effect, null);
  }
}

// ---------------------------------------------------------------------
// Navigation (Fenster-Stapel)
// ---------------------------------------------------------------------

function focusElement(elementId) {
  const top = engine.stack[engine.stack.length - 1];
  const targetLocatedIn = engine.runtime[elementId] ? engine.runtime[elementId].locatedIn : null;
  if (top !== undefined && targetLocatedIn === top) {
    engine.stack.push(elementId);
  } else {
    engine.stack = [elementId];
  }
}

function closeTopWindow() {
  if (engine.stack.length > 1) {
    engine.stack.pop();
    render();
  }
}

function openInventory() {
  if (engine.stack.includes(PLAYER_ID)) return;
  engine.stack.push(PLAYER_ID);
  render();
}

// ---------------------------------------------------------------------
// Inventar: Aufnehmen / Ablegen von Gegenstaenden mit portable: true
// ---------------------------------------------------------------------

// Traegt der Spieler das Element - direkt oder in etwas Getragenem (z.B. Brief in der Tasche)?
function isCarried(id) {
  const seen = new Set();
  let cur = engine.runtime[id] ? engine.runtime[id].locatedIn : null;
  while (cur && !seen.has(cur)) {
    if (cur === PLAYER_ID) return true;
    seen.add(cur);
    cur = engine.runtime[cur] ? engine.runtime[cur].locatedIn : null;
  }
  return false;
}

// Wohin wird abgelegt? Das oberste offene Fenster unterhalb des Inventars, in das man
// sinnvoll etwas legen kann (Ort, Truhe, Tisch ...); sonst der aktuelle Ort (stack[0]).
function dropTargetFor(itemId) {
  for (let i = engine.stack.length - 1; i >= 0; i--) {
    const id = engine.stack[i];
    if (id === itemId || id === PLAYER_ID || isCarried(id)) continue;
    if (DROP_TARGET_TYPES.includes(engine.elementsById[id].type)) return id;
  }
  return engine.stack[0];
}

function takeItem(itemId) {
  const el = engine.elementsById[itemId];
  engine.runtime[itemId].locatedIn = PLAYER_ID;
  closeWindowsFrom(itemId);
  finishInventoryAction((el.presentation && el.presentation.takeText) || `Du nimmst „${el.name}“ an dich.`);
}

function dropItem(itemId) {
  const el = engine.elementsById[itemId];
  const targetId = dropTargetFor(itemId);
  engine.runtime[itemId].locatedIn = targetId;
  closeWindowsFrom(itemId);
  const targetName = engine.elementsById[targetId].name;
  finishInventoryAction((el.presentation && el.presentation.dropText) || `Du legst „${el.name}“ hier ab (${targetName}).`);
}

// Das Fenster des Gegenstands (und alles darueber) schliessen - er liegt jetzt woanders.
function closeWindowsFrom(itemId) {
  const index = engine.stack.indexOf(itemId);
  if (index > 0) engine.stack = engine.stack.slice(0, index);
}

function finishInventoryAction(message) {
  engine.actionCount++;
  // Aufnehmen/Ablegen kann eine Loesungsbedingung erfuellen (z.B. inInventory: schluessel).
  engine.pendingMessages = [];
  engine.pendingSamples = [];
  checkResolution();
  if (engine.gameFinished) {
    showEndScreen();
    return;
  }
  render();
  showToast([message, ...engine.pendingMessages].join('\n\n'));
}

// ---------------------------------------------------------------------
// Textauswahl
// ---------------------------------------------------------------------

// Liefert { text, fields } - fields nennt, aus welchen presentation-Schluesseln der
// Text zusammengesetzt wurde (in Anzeigereihenfolge). Der Aufrufer kann darueber die
// passenden Sample-Nummern (el._samples[field]) fuer die Vorlesen-Funktion nachschlagen.
function pickPresentationText(id) {
  const el = engine.elementsById[id];
  const rt = engine.runtime[id];
  const p = el.presentation || {};
  const usedBefore = !!rt.usedBefore;
  const hasFreshChild = childrenOf(id).some(
    (c) => engine.runtime[c].revealedDuringPlay && !engine.runtime[c].usedBefore
  );

  let field = null;
  if (rt.investigation === 'complete' && (p.completeView || p.completeUse)) {
    field = p.completeView ? 'completeView' : 'completeUse';
  } else if (hasFreshChild && (p.openLeadView || p.openLeadUse)) {
    field = p.openLeadView ? 'openLeadView' : 'openLeadUse';
  } else if (!usedBefore) {
    field = p.firstView ? 'firstView' : p.firstUse ? 'firstUse' : p.repeatView ? 'repeatView' : p.repeatUse ? 'repeatUse' : null;
  } else if (p.blockedUse) {
    field = 'blockedUse';
  } else {
    field = p.repeatView ? 'repeatView' : p.repeatUse ? 'repeatUse' : p.firstView ? 'firstView' : p.firstUse ? 'firstUse' : null;
  }
  rt.usedBefore = true;

  let text = field ? p[field] : '(kein Text hinterlegt)';
  const fields = field ? [field] : [];

  // contentText ist der woertliche Wortlaut eines Dokuments/einer Inschrift (Autorenregeln
  // Kapitel 9/10) und getrennt von der einleitenden Rahmenerzaehlung gespeichert - er gehoert
  // aber bei jeder Benutzung mit in den angezeigten Text, sonst liest der Spieler den
  // eigentlichen Inhalt nie.
  if (p.contentText) {
    text = text + '\n\n' + p.contentText;
    fields.push('contentText');
  }
  return { text, fields };
}

// Welches Bild gilt gerade? Das erste Zustandsbild (stateImages), dessen Zustandswerte alle
// zur Laufzeit zutreffen, sonst das Standardbild (image). `_image` (Bildnummer) haengt der
// Server nur an, wenn die Datei schon erzeugt wurde. Fehlt die Datei eines passenden
// Zustandsbilds noch, wird auf ein vorhandenes Standardbild zurueckgegriffen.
// Liefert null (kein Bild vorgesehen) oder { number } (number null = noch nicht erzeugt).
function pickImage(id) {
  const el = engine.elementsById[id];
  const rt = engine.runtime[id];
  const hasDefault = typeof el.image === 'string' && el.image.trim() !== '';
  const match = (el.stateImages || []).find((entry) => {
    const state = entry && entry.state;
    if (!state || typeof state !== 'object' || Object.keys(state).length === 0) return false;
    if (typeof entry.prompt !== 'string' || !entry.prompt.trim()) return false;
    return Object.entries(state).every(([key, value]) => rt[key] === value);
  });
  if (match && match._image != null) return { number: match._image };
  if (hasDefault && el._image != null) return { number: el._image };
  if (match || hasDefault) return { number: null };
  return null;
}

let activeAudio = null;
let narrationEnabled = false;
let lastTopSampleNumbers = [];

// Unterbricht sofort jede laufende Wiedergabe, ohne etwas Neues zu starten.
function stopNarration() {
  if (activeAudio) {
    activeAudio.pause();
    activeAudio = null;
  }
}

function playSamples(numbers) {
  stopNarration();
  if (!numbers || numbers.length === 0) return;

  const audio = new Audio();
  activeAudio = audio;
  let i = 0;

  function playNext() {
    if (i >= numbers.length) {
      if (activeAudio === audio) activeAudio = null;
      return;
    }
    const number = String(numbers[i++]).padStart(5, '0');
    audio.src = `/output_vocs/sample_${number}.mp3`;
    audio.play().catch(() => {
      if (activeAudio === audio) activeAudio = null;
    });
  }

  audio.addEventListener('ended', playNext);
  audio.addEventListener('error', () => {
    if (activeAudio === audio) activeAudio = null;
  });
  playNext();
}

function setNarrationEnabled(value) {
  narrationEnabled = value;
  const btn = document.getElementById('btn-narration');
  btn.textContent = narrationEnabled ? '🔊 Vorlesen: An' : '🔇 Vorlesen: Aus';
  btn.setAttribute('aria-pressed', String(narrationEnabled));
  if (narrationEnabled) {
    playSamples(lastTopSampleNumbers);
  } else {
    stopNarration();
  }
}

// ---------------------------------------------------------------------
// Rendering: Spielbildschirm / Fenster-Stapel
// ---------------------------------------------------------------------

function render() {
  const container = document.getElementById('window-stack');
  container.innerHTML = '';
  lastTopSampleNumbers = [];
  engine.stack.forEach((id, index) => {
    const isTop = index === engine.stack.length - 1;
    const rendered = renderWindow(id, isTop, index > 0);
    container.appendChild(rendered.element);
    if (isTop) lastTopSampleNumbers = rendered.sampleNumbers;
  });
  // Reihenfolge: erst der Text des (neuen) Fensters, dann erzaehlende Meldungen.
  // Meldungen werden nur einmal - bei der Aktion, die sie ausgeloest hat - vorgelesen.
  const messageSamples = engine.pendingSamples || [];
  engine.pendingSamples = [];
  if (narrationEnabled) {
    playSamples([...lastTopSampleNumbers, ...messageSamples]);
  }
}

function renderWindow(id, isTop, showCloseButton) {
  const el = engine.elementsById[id];
  const div = document.createElement('div');
  div.className = 'window' + (isTop ? '' : ' dimmed');

  const header = document.createElement('div');
  header.className = 'window-header';
  if (showCloseButton) {
    const closeBtn = document.createElement('button');
    closeBtn.className = 'close-btn';
    closeBtn.textContent = '← ' + (el.exitLabel || 'Zurück');
    closeBtn.addEventListener('click', closeTopWindow);
    header.appendChild(closeBtn);
  }
  const nameSpan = document.createElement('span');
  nameSpan.className = 'window-name';
  nameSpan.textContent = el.name;
  header.appendChild(nameSpan);
  div.appendChild(header);

  const picture = pickImage(id);
  if (picture) {
    const imgBox = document.createElement('div');
    imgBox.className = 'window-image';
    if (picture.number != null) {
      const img = document.createElement('img');
      img.src = `/output_pics/pic_${String(picture.number).padStart(5, '0')}.jpg`;
      img.alt = el.name;
      imgBox.appendChild(img);
    } else {
      imgBox.classList.add('is-pending');
      imgBox.textContent = '[Bild noch nicht erzeugt]';
    }
    div.appendChild(imgBox);
  }

  const textBox = document.createElement('div');
  textBox.className = 'window-text';
  const picked = pickPresentationText(id);
  textBox.textContent = picked.text;
  div.appendChild(textBox);

  const sampleNumbers = picked.fields
    .map((field) => el._samples && el._samples[field])
    .filter((n) => n != null);

  const kids = childrenOf(id).filter(isVisible);
  if (id === PLAYER_ID && kids.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'inventory-empty';
    empty.textContent = 'Du trägst noch nichts bei dir.';
    textBox.appendChild(empty);
  }

  if (isTop && el.portable) {
    const actions = document.createElement('div');
    actions.className = 'window-actions';
    const btn = document.createElement('button');
    if (isCarried(id)) {
      const targetName = engine.elementsById[dropTargetFor(id)].name;
      btn.className = 'action-btn';
      btn.textContent = `⬇ Ablegen (${targetName})`;
      btn.title = `„${el.name}“ aus dem Inventar nehmen und hier ablegen.`;
      btn.addEventListener('click', () => dropItem(id));
    } else {
      btn.className = 'action-btn';
      btn.textContent = '✋ Aufnehmen';
      btn.title = `„${el.name}“ ins Inventar legen.`;
      btn.addEventListener('click', () => takeItem(id));
    }
    actions.appendChild(btn);
    div.appendChild(actions);
  }

  const menu = document.createElement('div');
  menu.className = 'window-menu';
  for (const cat of MENU_CATEGORIES) {
    const members = kids.filter((cid) => menuCategoryOf(engine.elementsById[cid]) === cat);
    if (members.length === 0) continue;
    const group = document.createElement('div');
    group.className = `menu-group cat-${cat.key}`;
    const title = document.createElement('div');
    title.className = 'menu-group-title';
    title.textContent = cat.label;
    group.appendChild(title);
    const list = document.createElement('div');
    list.className = 'menu-group-list';
    for (const childId of members) {
      const child = engine.elementsById[childId];
      const btn = document.createElement('button');
      btn.className = 'menu-btn';
      const icon = document.createElement('span');
      icon.className = 'menu-icon';
      icon.textContent = cat.icon;
      btn.appendChild(icon);
      btn.appendChild(document.createTextNode(child.name));
      if (child.portable && !isCarried(childId)) {
        const badge = document.createElement('span');
        badge.className = 'menu-badge';
        badge.textContent = 'aufnehmbar';
        btn.appendChild(badge);
      }
      btn.title = cat.hint;
      btn.addEventListener('click', () => use(childId));
      list.appendChild(btn);
    }
    group.appendChild(list);
    menu.appendChild(group);
  }
  div.appendChild(menu);

  return { element: div, sampleNumbers };
}

// ---------------------------------------------------------------------
// Logbuch (Gegenwart + Gerüchte kombiniert, v0.0-Vereinfachung)
// ---------------------------------------------------------------------

// Ein "Seed" ist ein sichtbares, nicht-physisches Element mit echtem erzählerischen Inhalt
// (Fakten oder ein Beschreibungstext). Rein strukturelle Sammel-Story-Elemente (z.B. ein
// uebergeordneter "Fall", der von Anfang an sichtbar ist, aber selbst keine Fakten traegt)
// zaehlen bewusst NICHT als Seed - sonst waeren ueber sie sofort alle verbundenen Personen
// "bekannt", noch bevor der Spieler etwas herausgefunden hat.
function isKnowledgeSeed(id) {
  const el = engine.elementsById[id];
  if (el.physical) return false;
  if (!isVisible(id)) return false;
  const hasFragments = Array.isArray(el.fragments) && el.fragments.length > 0;
  const hasBody = !!(el.presentation && el.presentation.body);
  return hasFragments || hasBody;
}

function computeKnownIds() {
  const seeds = new Set(Object.keys(engine.runtime).filter(isKnowledgeSeed));
  const known = new Set(seeds);
  for (const id of Object.keys(engine.runtime)) {
    const po = engine.runtime[id].partOf || [];
    if (po.some((t) => seeds.has(t))) known.add(id);
  }
  for (const s of seeds) {
    for (const t of engine.runtime[s].partOf || []) known.add(t);
  }
  return known;
}

function renderLog() {
  const content = document.getElementById('log-content');
  content.innerHTML = '';
  const known = computeKnownIds();

  const contradictions = [...known].filter(
    (id) => engine.elementsById[id].presentation && engine.elementsById[id].presentation.style === 'contradiction'
  );
  const discoveries = [...known].filter(
    (id) =>
      engine.elementsById[id].presentation &&
      engine.elementsById[id].presentation.style === 'discovery'
  );

  content.appendChild(
    renderLogSection(
      'Widersprüche & offene Fragen',
      contradictions,
      (id) => {
        const p = engine.elementsById[id].presentation;
        const div = document.createElement('div');
        div.className = 'log-entry contradiction';
        div.innerHTML = `<p class="fact">${escapeHtml(p.body || '')}</p>` +
          (p.openQuestion ? `<p class="open-question">${escapeHtml(p.openQuestion)}</p>` : '');
        return div;
      }
    )
  );

  content.appendChild(
    renderLogSection('Neue Erkenntnisse', discoveries, (id) => {
      const p = engine.elementsById[id].presentation;
      const div = document.createElement('div');
      div.className = 'log-entry';
      div.innerHTML = `<p class="fact">${escapeHtml(p.body || '')}</p>`;
      return div;
    })
  );

  content.appendChild(
    renderLogSection('Entdeckte Fakten', engine.discoveredOrder, (fragId) => {
      const frag = engine.fragmentsById[fragId];
      const div = document.createElement('div');
      div.className = 'log-entry';
      div.innerHTML =
        `<p class="fact">${escapeHtml(frag.fact)}</p>` +
        `<p class="assumption">${escapeHtml(frag.assumption)} (${escapeHtml(frag.ownerName)})</p>`;
      return div;
    })
  );

  const relationsSection = document.createElement('div');
  relationsSection.className = 'log-section';
  const relHeading = document.createElement('h2');
  relHeading.textContent = 'Bekannte Zusammenhänge';
  relationsSection.appendChild(relHeading);
  let anyRelation = false;
  for (const id of known) {
    for (const target of engine.runtime[id].partOf || []) {
      if (!known.has(target)) continue;
      anyRelation = true;
      const line = document.createElement('div');
      line.className = 'relation-line';
      line.textContent = `${engine.elementsById[id].name} → ${engine.elementsById[target].name}`;
      relationsSection.appendChild(line);
    }
  }
  if (!anyRelation) {
    const none = document.createElement('p');
    none.className = 'empty-note';
    none.textContent = 'Noch keine Zusammenhänge bekannt.';
    relationsSection.appendChild(none);
  }
  content.appendChild(relationsSection);
}

function renderLogSection(title, ids, renderEntry) {
  const section = document.createElement('div');
  section.className = 'log-section';
  const heading = document.createElement('h2');
  heading.textContent = title;
  section.appendChild(heading);
  if (ids.length === 0) {
    const none = document.createElement('p');
    none.className = 'empty-note';
    none.textContent = 'Noch nichts hierzu bekannt.';
    section.appendChild(none);
  } else {
    for (const id of ids) {
      section.appendChild(renderEntry(id));
    }
  }
  return section;
}

// ---------------------------------------------------------------------
// UI-Hilfsfunktionen
// ---------------------------------------------------------------------

function showScreen(id) {
  document.querySelectorAll('.screen').forEach((s) => {
    s.hidden = s.id !== id;
  });
}

let toastTimer = null;
function showToast(text) {
  const toast = document.getElementById('toast');
  toast.textContent = text;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.hidden = true;
  }, 6000);
}

// ---------------------------------------------------------------------
// Geschichte verlassen (Sicherheitsabfrage, solange es keinen Spielstand gibt)
// ---------------------------------------------------------------------

// Fortschritt geht nur verloren, wenn man mitten in einer Geschichte ist (Spiel oder
// Logbuch offen, nicht beendet) und schon mindestens eine Aktion gemacht hat.
function hasUnsavedProgress() {
  const inStory = !document.getElementById('screen-game').hidden || !document.getElementById('screen-log').hidden;
  return inStory && !engine.gameFinished && engine.actionCount > 0;
}

function requestQuitStory() {
  if (!hasUnsavedProgress()) {
    quitStory();
    return;
  }
  document.getElementById('quit-dialog').hidden = false;
  document.getElementById('btn-quit-stay').focus();
}

function hideQuitDialog() {
  document.getElementById('quit-dialog').hidden = true;
}

function quitStory() {
  stopNarration();
  showScreen('screen-select');
  loadStoryList();
}

function showEndScreen() {
  stopNarration();
  // Abschieds-/Aufloesungstext (erzaehlende Meldung) auch auf dem Endbildschirm vorlesen.
  if (narrationEnabled && engine.pendingSamples.length) playSamples(engine.pendingSamples);
  engine.pendingSamples = [];
  const messages = engine.pendingMessages.join('\n\n');
  document.getElementById('end-heading').textContent = 'Die Geschichte ist zu Ende';
  document.getElementById('end-body').textContent = messages;
  showScreen('screen-end');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

// ---------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
  loadStoryList();

  document.getElementById('btn-back-to-select').addEventListener('click', requestQuitStory);
  document.getElementById('btn-quit-stay').addEventListener('click', hideQuitDialog);
  document.getElementById('btn-quit-leave').addEventListener('click', () => {
    hideQuitDialog();
    quitStory();
  });
  document.getElementById('quit-dialog').addEventListener('click', (e) => {
    if (e.target.id === 'quit-dialog') hideQuitDialog();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !document.getElementById('quit-dialog').hidden) hideQuitDialog();
  });
  // Schliessen/Neuladen des Browserfensters: Browser-eigene Rueckfrage.
  window.addEventListener('beforeunload', (e) => {
    if (hasUnsavedProgress()) {
      e.preventDefault();
      e.returnValue = '';
    }
  });
  document.getElementById('btn-narration').addEventListener('click', () => {
    setNarrationEnabled(!narrationEnabled);
  });
  document.getElementById('btn-inventory').addEventListener('click', openInventory);
  document.getElementById('btn-log').addEventListener('click', () => {
    renderLog();
    showScreen('screen-log');
  });
  document.getElementById('btn-log-close').addEventListener('click', () => {
    showScreen('screen-game');
  });
  document.getElementById('btn-end-to-select').addEventListener('click', () => {
    stopNarration();
    showScreen('screen-select');
    loadStoryList();
  });
  document.getElementById('toast').addEventListener('click', (e) => {
    e.target.hidden = true;
  });
});
