'use strict';

/* Editor-Erweiterung: Startzustand (initialState) und Reaktionen beim Benutzen (onUse:
 * Bedingungen + Effekte) eines Elements. Wird von renderEditorWindow() in editor.js
 * aufgerufen und nutzt dessen globale Helfer (ed, setTip, infoIcon, renderSection,
 * markDirty, renderEditorStack, isLocation, isDoor, fieldLabel) sowie PLAYER_ID aus game.js.
 *
 * Die Bausteine bilden 1:1 die Bedingungs-/Effekttypen ab, die game.js (evalCondition,
 * applyEffect) versteht. Neue Typen in game.js hier in CONDITION_DEFS/EFFECT_DEFS ergaenzen.
 */

// ---------------------------------------------------------------------
// Baustein-Definitionen
// ---------------------------------------------------------------------
// shape beschreibt, wie die Argumente im YAML stehen:
//   single: wert            array: [a, b, c]        object (replacePartOf): {elementId, remove, add}
//   path (showTextFrom): "elementId.presentation.feld"                flag (finishGame): true
// args: je Argument die Art des Eingabefelds (kind) und ein Verbindungswort davor (before).

const CONDITION_DEFS = {
  stateEquals: {
    label: 'Zustand ist',
    tip: 'Prüft einen Zustandswert eines Elements, z.B. ob „Verlassenes Mühlendorf“ curseActive = ja hat.\n'
      + 'Zustände legst du unter „Startzustand“ an und änderst sie mit dem Effekt „Setze Zustand“.',
    shape: 'array',
    args: [{ kind: 'element' }, { kind: 'stateName', before: 'Zustand' }, { kind: 'stateValue', before: '=' }],
    defaults: (el) => [el.id, 'investigation', 'complete'],
  },
  inInventory: {
    label: 'Spieler trägt',
    tip: 'Erfüllt, wenn der Spieler den Gegenstand im Inventar hat (auch in einem getragenen Behälter).\n'
      + 'Typisch: Eine Tür geht nur mit Schlüssel auf.',
    shape: 'single',
    args: [{ kind: 'element' }],
    defaults: () => [firstPortableId()],
  },
  notInInventory: {
    label: 'Spieler trägt nicht',
    tip: 'Erfüllt, wenn der Spieler den Gegenstand NICHT bei sich hat.\n'
      + 'Typisch als Gegenstück zu „Spieler trägt“ für eine zweite Reaktion („Die Tür ist verschlossen.“).',
    shape: 'single',
    args: [{ kind: 'element' }],
    defaults: () => [firstPortableId()],
  },
  partOfExists: {
    label: 'Verknüpfung besteht',
    tip: 'Erfüllt, wenn das erste Element mit dem zweiten verknüpft ist („gehört zu“).\n'
      + 'Verknüpfungen bilden das Wissensnetz: wer mit welchem Ereignis zu tun hat.',
    shape: 'array',
    args: [{ kind: 'element' }, { kind: 'element', before: 'mit' }],
    defaults: (el) => [el.id, el.id],
  },
  partOfMissing: {
    label: 'Verknüpfung fehlt',
    tip: 'Erfüllt, wenn das erste Element NICHT mit dem zweiten verknüpft ist.\n'
      + 'Nützlich, um zu prüfen, ob ein Irrtum schon ausgeräumt wurde.',
    shape: 'array',
    args: [{ kind: 'element' }, { kind: 'element', before: 'mit' }],
    defaults: (el) => [el.id, el.id],
  },
};

const EFFECT_DEFS = {
  revealElement: {
    label: 'Mache sichtbar',
    tip: 'Ein bisher verborgenes Element taucht auf (z.B. ein Geheimfach, ein neuer Weg).\n'
      + 'Das Element muss unter „Startzustand“ als „zu Beginn verborgen“ angelegt sein.\n'
      + 'Liegt es in einem Element, zeigt dieses danach seinen „Neue Spur“-Text.',
    shape: 'single',
    args: [{ kind: 'element' }],
    defaults: () => [firstHiddenId()],
  },
  hideElement: {
    label: 'Verstecke',
    tip: 'Ein Element verschwindet aus dem Spiel (z.B. ein widerlegtes Gerücht, ein eingestürzter Weg).',
    shape: 'single',
    args: [{ kind: 'element' }],
    defaults: (el) => [el.id],
  },
  showText: {
    label: 'Zeige Meldung',
    tip: 'Zeigt eine kurze Meldung unten im Bildschirm, z.B. „Mit einem Klicken springt das Fach auf.“',
    shape: 'single',
    args: [{ kind: 'text' }],
    defaults: () => [''],
  },
  showTextFrom: {
    label: 'Zeige Textfeld',
    tip: 'Zeigt den Inhalt eines Textfelds als Meldung – typischerweise „Weg versperrt“ oder „Abschiedstext“.\n'
      + 'Vorteil gegenüber „Zeige Meldung“: Der Text wird mitvorgelesen und steht beim Element.',
    shape: 'path',
    args: [{ kind: 'element', before: 'von' }, { kind: 'textField', before: 'Feld' }],
    defaults: (el) => [el.id, 'blockedText'],
  },
  setCurrentElement: {
    label: 'Gehe zu',
    tip: 'Statt dieses Element zu öffnen, landet der Spieler hier – an einem anderen Ort oder in einem anderen Element.\n'
      + 'So funktionieren Wege. Ohne diesen Effekt öffnet ein Klick einfach das Element selbst.',
    shape: 'single',
    args: [{ kind: 'element' }],
    defaults: (el) => [el.locatedIn || el.id],
  },
  setElementState: {
    label: 'Setze Zustand',
    tip: 'Ändert einen Zustandswert. Andere Reaktionen können ihn mit „Zustand ist“ prüfen.\n'
      + 'Sonderfall „investigation = complete“: Das Element zeigt danach seinen „Abgeschlossen“-Text.',
    shape: 'array',
    args: [{ kind: 'element', before: 'von' }, { kind: 'stateName', before: 'Zustand' }, { kind: 'stateValue', before: 'auf' }],
    defaults: (el) => [el.id, 'investigation', 'complete'],
  },
  setLocatedIn: {
    label: 'Verschiebe',
    tip: 'Legt ein Element an eine andere Stelle – z.B. ins Inventar des Spielers oder in einen anderen Raum.',
    shape: 'array',
    args: [{ kind: 'element' }, { kind: 'container', before: 'nach' }],
    defaults: (el) => [el.id, PLAYER_ID],
  },
  discoverFragment: {
    label: 'Entdecke Fakt',
    tip: 'Trägt einen Fakt (mit der zugehörigen Vermutung) ins Logbuch unter „Entdeckte Fakten“ ein.\n'
      + 'Fakten sind bei den Elementen hinterlegt (Bearbeitung im Editor folgt).',
    shape: 'single',
    args: [{ kind: 'fragment' }],
    defaults: () => [firstFragmentId()],
  },
  addPartOf: {
    label: 'Verknüpfe',
    tip: 'Verknüpft zwei Elemente im Wissensnetz („gehört zu“), z.B. „Brandt“ mit „Illegale Kanalsperrung“.\n'
      + 'Verknüpfungen bestimmen, was im Logbuch als bekannt gilt, und können Teil der Lösungsbedingung sein.',
    shape: 'array',
    args: [{ kind: 'element' }, { kind: 'element', before: 'mit' }],
    defaults: (el) => [el.id, el.id],
  },
  removePartOf: {
    label: 'Löse Verknüpfung',
    tip: 'Entfernt eine Verknüpfung – z.B. wenn ein Fund eine falsche Annahme widerlegt.',
    shape: 'array',
    args: [{ kind: 'element' }, { kind: 'element', before: 'von' }],
    defaults: (el) => [el.id, el.id],
  },
  replacePartOf: {
    label: 'Ersetze Verknüpfung',
    tip: 'Tauscht eine Verknüpfung gegen eine andere – z.B. „Clara ist tot“ wird zu „Clara hat überlebt“.',
    shape: 'object',
    args: [{ kind: 'element', before: 'bei' }, { kind: 'element', before: 'entferne' }, { kind: 'element', before: 'füge hinzu' }],
    defaults: (el) => [el.id, el.id, el.id],
  },
  enableTrigger: {
    label: 'Schalte Reaktion ein',
    tip: 'Aktiviert eine Reaktion eines (anderen) Elements, die zu Beginn ausgeschaltet war.',
    shape: 'array',
    args: [{ kind: 'element', before: 'von' }, { kind: 'trigger' }],
    defaults: (el) => [el.id, ''],
  },
  disableTrigger: {
    label: 'Schalte Reaktion ab',
    tip: 'Deaktiviert eine Reaktion eines (anderen) Elements dauerhaft.',
    shape: 'array',
    args: [{ kind: 'element', before: 'von' }, { kind: 'trigger' }],
    defaults: (el) => [el.id, ''],
  },
  disableSelfTrigger: {
    label: 'Schalte eigene Reaktion ab',
    tip: 'Deaktiviert eine Reaktion dieses Elements. Für „diese Reaktion nur einmal“ einfach das Häkchen „nur beim ersten Mal“ nutzen.',
    shape: 'single',
    args: [{ kind: 'ownTrigger' }],
    defaults: () => [''],
  },
  finishGame: {
    label: 'Beende das Spiel',
    tip: 'Beendet die Geschichte sofort und zeigt den Endbildschirm.',
    shape: 'flag',
    args: [],
    defaults: () => [],
  },
};

const STATE_TIPS = {
  initial: 'Startzustand: wie dieses Element zu Spielbeginn ist.\n'
    + '„Zu Beginn sichtbar“ entscheidet, ob es von Anfang an im Spiel auftaucht.\n'
    + 'Eigene Zustände (z.B. verschlossen = ja) sind frei benennbare Schalter, die Reaktionen prüfen und ändern können.',
  visible: 'Ohne Häkchen ist das Element zu Beginn verborgen und erscheint erst, wenn eine Reaktion es mit „Mache sichtbar“ freischaltet.\n'
    + 'So baust du Geheimfächer, neue Spuren oder später zugängliche Wege.',
  custom: 'Eigener Zustand: Name und Startwert. Werte: ja / nein, eine Zahl oder ein Wort.\n'
    + 'Besonderer Name „investigation“: Wert „complete“ lässt das Element seinen „Abgeschlossen“-Text zeigen.',
  reactions: 'Reaktionen: was passiert, wenn der Spieler dieses Element anklickt.\n'
    + 'Jede Reaktion hat Bedingungen („Wenn“) und Effekte („Dann“). Es werden ALLE Reaktionen ausgeführt, deren Bedingungen erfüllt sind – von oben nach unten.\n'
    + 'Sollen sich zwei Reaktionen ausschließen (z.B. Tür offen / verschlossen), gib ihnen gegensätzliche Bedingungen.\n'
    + 'Ohne „Gehe zu“ öffnet ein Klick immer das Element selbst und zeigt seinen Text.',
  enabled: 'Aktiv zu Beginn: Ohne Häkchen ist diese Reaktion anfangs ausgeschaltet und wartet, bis eine andere Reaktion sie mit „Schalte Reaktion ein“ aktiviert.',
  once: 'Nur beim ersten Mal: Die Reaktion schaltet sich nach dem ersten Auslösen selbst ab.\n'
    + 'Ohne Häkchen passiert sie bei jedem Klick erneut (solange die Bedingungen erfüllt sind).',
  when: 'Wenn: Alle Bedingungen müssen gleichzeitig erfüllt sein (UND).\n'
    + 'Für ODER legst du einfach eine zweite Reaktion mit denselben Effekten an.\nKeine Bedingung = passiert immer.',
  then: 'Dann: Diese Effekte werden der Reihe nach ausgeführt.',
};

// ---------------------------------------------------------------------
// Datenhelfer
// ---------------------------------------------------------------------

function firstPortableId() {
  const item = Object.values(ed.elementsById).find((e) => e.portable);
  return item ? item.id : '';
}

function firstHiddenId() {
  const hidden = Object.values(ed.elementsById).find((e) => e.initialState && e.initialState.visible === false);
  return hidden ? hidden.id : '';
}

function allFragments() {
  const list = [];
  for (const el of Object.values(ed.elementsById)) {
    for (const frag of el.fragments || []) list.push({ id: frag.id, fact: frag.fact || '', owner: el });
  }
  return list;
}

function firstFragmentId() {
  const frags = allFragments();
  return frags.length ? frags[0].id : '';
}

function getRuleArgs(def, val) {
  switch (def.shape) {
    case 'single': return [val];
    case 'array': return Array.isArray(val) ? [...val] : [];
    case 'object': return [val && val.elementId, val && val.remove, val && val.add];
    case 'path': {
      const parts = String(val || '').split('.');
      return [parts[0] || '', parts[2] || ''];
    }
    default: return [];
  }
}

function buildRuleValue(def, args) {
  switch (def.shape) {
    case 'single': return args[0];
    case 'array': return [...args];
    case 'object': return { elementId: args[0], remove: args[1], add: args[2] };
    case 'path': return `${args[0]}.presentation.${args[1]}`;
    default: return true;
  }
}

function formatStateValue(v) {
  if (v === true) return 'ja';
  if (v === false) return 'nein';
  return v == null ? '' : String(v);
}

function parseStateValue(s) {
  const t = String(s).trim();
  if (/^(ja|true)$/i.test(t)) return true;
  if (/^(nein|false)$/i.test(t)) return false;
  if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t);
  return t;
}

// Alle bisher in der Story verwendeten Zustandsnamen/-werte - als Vorschlagsliste, damit
// ein Zustand nicht durch Tippfehler (curseActiv vs. curseActive) still ins Leere laeuft.
function collectStateVocabulary() {
  const names = new Set(['investigation']);
  const values = new Set(['ja', 'nein', 'open', 'complete']);
  const addValue = (v) => { if (v !== undefined && v !== null && v !== '') values.add(formatStateValue(v)); };
  for (const el of Object.values(ed.elementsById)) {
    for (const [k, v] of Object.entries(el.initialState || {})) {
      if (k !== 'visible') names.add(k);
      addValue(v);
    }
    for (const trig of el.onUse || []) {
      for (const c of trig.conditions || []) {
        if (c.stateEquals) { names.add(c.stateEquals[1]); addValue(c.stateEquals[2]); }
      }
      for (const e of trig.effects || []) {
        if (e.setElementState) { names.add(e.setElementState[1]); addValue(e.setElementState[2]); }
      }
    }
  }
  return { names: [...names].filter(Boolean).sort(), values: [...values].sort() };
}

function ensureDatalist(id, values) {
  let dl = document.getElementById(id);
  if (!dl) {
    dl = document.createElement('datalist');
    dl.id = id;
    document.body.appendChild(dl);
  }
  dl.innerHTML = '';
  for (const v of values) {
    const opt = document.createElement('option');
    opt.value = v;
    dl.appendChild(opt);
  }
}

function elementGroupLabel(e) {
  if (e.type === 'player') return 'Spieler';
  if (isLocation(e)) return 'Orte';
  if (isDoor(e)) return 'Wege';
  if (e.physical === false) return 'Wissen & Story (nicht-physisch)';
  if (e.type === 'person' || e.type === 'group') return 'Personen';
  return 'Objekte, Details & Schriftstücke';
}

const ELEMENT_GROUP_ORDER = ['Orte', 'Wege', 'Objekte, Details & Schriftstücke', 'Personen', 'Wissen & Story (nicht-physisch)', 'Spieler'];

function elementDisplayName(id, selfId) {
  const e = ed.elementsById[id];
  if (!e) return `⚠ fehlt: ${id}`;
  return (e.name || e.id) + (id === selfId ? ' (dieses Element)' : '');
}

// Element-Auswahl, gruppiert nach Art. Ein Verweis auf ein nicht (mehr) vorhandenes
// Element bleibt als Warn-Eintrag erhalten, statt still ueberschrieben zu werden.
function elementSelect(value, selfId, opts = {}) {
  const select = document.createElement('select');
  select.className = 'rule-select';
  if (opts.extraOptions) {
    for (const [v, label] of opts.extraOptions) {
      const opt = document.createElement('option');
      opt.value = v;
      opt.textContent = label;
      select.appendChild(opt);
    }
  }
  if (!value && !opts.extraOptions) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = '– wählen –';
    select.appendChild(opt);
  }
  const groups = {};
  for (const e of Object.values(ed.elementsById)) {
    (groups[elementGroupLabel(e)] = groups[elementGroupLabel(e)] || []).push(e);
  }
  for (const label of ELEMENT_GROUP_ORDER) {
    if (!groups[label]) continue;
    const og = document.createElement('optgroup');
    og.label = label;
    for (const e of groups[label].sort((a, b) => (a.name || '').localeCompare(b.name || ''))) {
      const opt = document.createElement('option');
      opt.value = e.id;
      opt.textContent = elementDisplayName(e.id, selfId);
      og.appendChild(opt);
    }
    select.appendChild(og);
  }
  if (value && !ed.elementsById[value] && !(opts.extraOptions || []).some(([v]) => v === value)) {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = `⚠ fehlt: ${value}`;
    select.appendChild(opt);
  }
  select.value = value == null ? '' : value;
  return select;
}

function triggerLabel(owner, trig, index) {
  const verbs = (trig.effects || [])
    .map((e) => Object.keys(e)[0])
    .filter((k) => k !== 'disableSelfTrigger')
    .map((k) => (EFFECT_DEFS[k] ? EFFECT_DEFS[k].label : k));
  return `Reaktion ${index + 1}${verbs.length ? ': ' + verbs.join(', ') : ''}`;
}

function triggerSelect(ownerId, value) {
  const select = document.createElement('select');
  select.className = 'rule-select';
  const owner = ed.elementsById[ownerId];
  const trigs = (owner && owner.onUse) || [];
  if (trigs.length === 0) {
    const opt = document.createElement('option');
    opt.value = value || '';
    opt.textContent = value ? `⚠ fehlt: ${value}` : '(hat keine Reaktionen)';
    select.appendChild(opt);
    return select;
  }
  if (!value) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = '– Reaktion wählen –';
    select.appendChild(opt);
  }
  trigs.forEach((t, i) => {
    const opt = document.createElement('option');
    opt.value = t.id;
    opt.textContent = triggerLabel(owner, t, i);
    select.appendChild(opt);
  });
  if (value && !trigs.some((t) => t.id === value)) {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = `⚠ fehlt: ${value}`;
    select.appendChild(opt);
  }
  select.value = value || '';
  return select;
}

function fragmentSelect(value) {
  const select = document.createElement('select');
  select.className = 'rule-select';
  const frags = allFragments();
  if (frags.length === 0) {
    const opt = document.createElement('option');
    opt.value = value || '';
    opt.textContent = value ? `⚠ fehlt: ${value}` : '(noch keine Fakten in dieser Geschichte)';
    select.appendChild(opt);
    return select;
  }
  const byOwner = {};
  for (const f of frags) (byOwner[f.owner.id] = byOwner[f.owner.id] || []).push(f);
  for (const ownerId of Object.keys(byOwner)) {
    const og = document.createElement('optgroup');
    og.label = ed.elementsById[ownerId].name || ownerId;
    for (const f of byOwner[ownerId]) {
      const opt = document.createElement('option');
      opt.value = f.id;
      opt.textContent = f.fact.length > 70 ? f.fact.slice(0, 67) + '…' : f.fact || f.id;
      opt.title = f.fact;
      og.appendChild(opt);
    }
    select.appendChild(og);
  }
  if (value && !frags.some((f) => f.id === value)) {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = `⚠ fehlt: ${value}`;
    select.appendChild(opt);
  }
  select.value = value || '';
  return select;
}

function textFieldSelect(ownerId, value) {
  const select = document.createElement('select');
  select.className = 'rule-select';
  const owner = ed.elementsById[ownerId];
  const fields = Object.keys((owner && owner.presentation) || {});
  if (value && !fields.includes(value)) fields.push(value);
  if (fields.length === 0) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = '(Element hat keine Textfelder)';
    select.appendChild(opt);
    return select;
  }
  for (const f of fields) {
    const opt = document.createElement('option');
    opt.value = f;
    const exists = owner && owner.presentation && f in owner.presentation;
    opt.textContent = exists ? fieldLabel(f) : `⚠ fehlt: ${fieldLabel(f)}`;
    select.appendChild(opt);
  }
  select.value = value || fields[0];
  return select;
}

function uniqueTriggerId(el) {
  const used = new Set((el.onUse || []).map((t) => t.id));
  let n = used.size + 1;
  while (used.has(`reaktion_${n}`)) n++;
  return `reaktion_${n}`;
}

// ---------------------------------------------------------------------
// Startzustand
// ---------------------------------------------------------------------

function renderInitialStateSection(el) {
  const frag = document.createDocumentFragment();
  frag.appendChild(renderSection('Startzustand', STATE_TIPS.initial));
  el.initialState = el.initialState || {};
  const state = el.initialState;

  const visRow = document.createElement('label');
  visRow.className = 'field-row field-row-inline';
  const cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.checked = state.visible !== false;
  cb.addEventListener('change', () => {
    state.visible = cb.checked;
    markDirty();
    renderGraph();
    renderEditorStack();
  });
  visRow.appendChild(cb);
  const span = document.createElement('span');
  span.className = 'field-label';
  span.textContent = cb.checked ? '👁 Zu Beginn sichtbar' : '🙈 Zu Beginn verborgen – wird durch eine Reaktion freigeschaltet';
  span.appendChild(infoIcon(STATE_TIPS.visible));
  visRow.appendChild(span);
  setTip(visRow, STATE_TIPS.visible);
  frag.appendChild(visRow);

  const vocab = collectStateVocabulary();
  ensureDatalist('dl-state-names', vocab.names);
  ensureDatalist('dl-state-values', vocab.values);

  const customKeys = Object.keys(state).filter((k) => k !== 'visible');
  for (const key of customKeys) {
    const row = document.createElement('div');
    row.className = 'state-row';
    const label = document.createElement('span');
    label.className = 'rule-word';
    label.textContent = 'Zustand';
    row.appendChild(label);
    const nameInput = document.createElement('input');
    nameInput.className = 'rule-input';
    nameInput.value = key;
    nameInput.setAttribute('list', 'dl-state-names');
    setTip(nameInput, STATE_TIPS.custom);
    // Umbenennen erst beim Verlassen des Feldes, damit beim Tippen nicht fuer jeden
    // Buchstaben ein neuer Schluessel entsteht. Reihenfolge der Schluessel bleibt erhalten.
    nameInput.addEventListener('change', () => {
      const newKey = nameInput.value.trim();
      if (!newKey || newKey === key || newKey === 'visible' || newKey in state) {
        nameInput.value = key;
        return;
      }
      const rebuilt = {};
      for (const [k, v] of Object.entries(state)) rebuilt[k === key ? newKey : k] = v;
      el.initialState = rebuilt;
      markDirty();
      renderEditorStack();
    });
    row.appendChild(nameInput);
    const eq = document.createElement('span');
    eq.className = 'rule-word';
    eq.textContent = '=';
    row.appendChild(eq);
    const valueInput = document.createElement('input');
    valueInput.className = 'rule-input';
    valueInput.value = formatStateValue(state[key]);
    valueInput.setAttribute('list', 'dl-state-values');
    setTip(valueInput, STATE_TIPS.custom);
    valueInput.addEventListener('input', () => {
      el.initialState[nameInput.value.trim() || key] = parseStateValue(valueInput.value);
      markDirty();
    });
    row.appendChild(valueInput);
    row.appendChild(ruleDeleteButton(`Zustand „${key}“ entfernen.`, () => {
      delete el.initialState[key];
      markDirty();
      renderEditorStack();
    }));
    frag.appendChild(row);
  }

  const addBtn = document.createElement('button');
  addBtn.className = 'rule-add-btn';
  addBtn.textContent = '+ Eigener Zustand';
  setTip(addBtn, 'Neuen Zustandswert anlegen, z.B. verschlossen = ja oder investigation = open.\n' + STATE_TIPS.custom);
  addBtn.addEventListener('click', () => {
    let n = 1;
    while (`zustand_${n}` in state) n++;
    state[`zustand_${n}`] = true;
    markDirty();
    renderEditorStack();
  });
  frag.appendChild(addBtn);
  return frag;
}

// ---------------------------------------------------------------------
// Reaktionen (onUse)
// ---------------------------------------------------------------------

function renderReactionsSection(el) {
  const frag = document.createDocumentFragment();
  frag.appendChild(renderSection('Beim Benutzen', STATE_TIPS.reactions));
  const vocab = collectStateVocabulary();
  ensureDatalist('dl-state-names', vocab.names);
  ensureDatalist('dl-state-values', vocab.values);

  const trigs = el.onUse || [];
  if (trigs.length === 0) {
    const note = document.createElement('p');
    note.className = 'field-empty-note';
    note.textContent = 'Keine Reaktionen: Ein Klick öffnet nur das Element und zeigt seinen Text.';
    frag.appendChild(note);
  }
  trigs.forEach((trig, i) => frag.appendChild(renderTriggerCard(el, trig, i)));

  const addBtn = document.createElement('button');
  addBtn.className = 'rule-add-btn';
  addBtn.textContent = '+ Reaktion hinzufügen';
  setTip(addBtn, 'Neue Reaktion anlegen: Wenn … dann …\nBeispiel: Wenn der Spieler den Schlüssel trägt, dann mache das Geheimfach sichtbar.');
  addBtn.addEventListener('click', () => {
    el.onUse = el.onUse || [];
    el.onUse.push({ id: uniqueTriggerId(el), enabled: true, conditions: [], effects: [] });
    markDirty();
    renderEditorStack();
  });
  frag.appendChild(addBtn);
  return frag;
}

function isOnceMarker(trig, effect) {
  return effect && effect.disableSelfTrigger !== undefined && effect.disableSelfTrigger === trig.id;
}

function renderTriggerCard(el, trig, index) {
  const card = document.createElement('div');
  card.className = 'trigger-card' + (trig.enabled === false ? ' is-disabled' : '');
  trig.conditions = trig.conditions || [];
  trig.effects = trig.effects || [];

  const head = document.createElement('div');
  head.className = 'trigger-head';
  const title = document.createElement('span');
  title.className = 'trigger-title';
  title.textContent = `Reaktion ${index + 1}`;
  const idSpan = document.createElement('span');
  idSpan.className = 'field-key';
  idSpan.textContent = trig.id;
  setTip(idSpan, 'Interne Kennung dieser Reaktion. Andere Reaktionen können sie damit ein- oder ausschalten.');
  title.appendChild(idSpan);
  head.appendChild(title);

  head.appendChild(trigCheckbox('aktiv zu Beginn', trig.enabled !== false, STATE_TIPS.enabled, (checked) => {
    trig.enabled = checked;
  }));
  head.appendChild(trigCheckbox('nur beim ersten Mal', trig.effects.some((e) => isOnceMarker(trig, e)), STATE_TIPS.once, (checked) => {
    trig.effects = trig.effects.filter((e) => !isOnceMarker(trig, e));
    if (checked) trig.effects.push({ disableSelfTrigger: trig.id });
  }));

  const tools = document.createElement('span');
  tools.className = 'trigger-tools';
  const moveBtn = (label, tip, delta) => {
    const b = document.createElement('button');
    b.className = 'field-del-btn';
    b.textContent = label;
    setTip(b, tip);
    const target = index + delta;
    b.disabled = target < 0 || target >= el.onUse.length;
    b.addEventListener('click', () => {
      const [moved] = el.onUse.splice(index, 1);
      el.onUse.splice(target, 0, moved);
      markDirty();
      renderEditorStack();
    });
    return b;
  };
  tools.appendChild(moveBtn('↑', 'Reaktion nach oben schieben (wird früher ausgeführt).', -1));
  tools.appendChild(moveBtn('↓', 'Reaktion nach unten schieben (wird später ausgeführt).', 1));
  tools.appendChild(ruleDeleteButton('Diese Reaktion löschen.', () => {
    const refs = triggerReferences(el.id, trig.id);
    const msg = refs.length
      ? `Diese Reaktion wird von ${refs.join(', ')} ein-/ausgeschaltet. Trotzdem löschen?`
      : `Reaktion ${index + 1} wirklich löschen?`;
    if (!confirm(msg)) return;
    el.onUse.splice(index, 1);
    markDirty();
    renderEditorStack();
  }));
  head.appendChild(tools);
  card.appendChild(head);

  card.appendChild(ruleBlockTitle('Wenn', STATE_TIPS.when));
  if (trig.conditions.length === 0) {
    const always = document.createElement('div');
    always.className = 'rule-always';
    always.textContent = 'immer (keine Bedingung)';
    card.appendChild(always);
  }
  trig.conditions.forEach((cond, i) => {
    card.appendChild(renderRuleRow(el, trig, trig.conditions, i, CONDITION_DEFS, 'Bedingung'));
  });
  card.appendChild(ruleAddButton('+ Bedingung', 'Weitere Bedingung hinzufügen. Alle Bedingungen müssen erfüllt sein.', () => {
    const key = 'stateEquals';
    trig.conditions.push({ [key]: buildRuleValue(CONDITION_DEFS[key], CONDITION_DEFS[key].defaults(el)) });
  }));

  card.appendChild(ruleBlockTitle('Dann', STATE_TIPS.then));
  const visibleEffects = trig.effects.map((e, i) => [e, i]).filter(([e]) => !isOnceMarker(trig, e));
  if (visibleEffects.length === 0) {
    const none = document.createElement('div');
    none.className = 'rule-always';
    none.textContent = 'noch nichts – füge einen Effekt hinzu';
    card.appendChild(none);
  }
  for (const [, i] of visibleEffects) {
    card.appendChild(renderRuleRow(el, trig, trig.effects, i, EFFECT_DEFS, 'Effekt'));
  }
  card.appendChild(ruleAddButton('+ Effekt', 'Weiteren Effekt hinzufügen, z.B. etwas sichtbar machen oder eine Meldung zeigen.', () => {
    const key = 'revealElement';
    const effect = { [key]: buildRuleValue(EFFECT_DEFS[key], EFFECT_DEFS[key].defaults(el)) };
    // Vor dem "nur beim ersten Mal"-Marker einfuegen, damit er am Ende bleibt.
    const markerIndex = trig.effects.findIndex((e) => isOnceMarker(trig, e));
    if (markerIndex >= 0) trig.effects.splice(markerIndex, 0, effect);
    else trig.effects.push(effect);
  }));
  return card;
}

function triggerReferences(ownerId, trigId) {
  const refs = [];
  for (const e of Object.values(ed.elementsById)) {
    for (const t of e.onUse || []) {
      for (const eff of t.effects || []) {
        const v = eff.enableTrigger || eff.disableTrigger;
        if (Array.isArray(v) && v[0] === ownerId && v[1] === trigId) refs.push(`„${e.name}“`);
      }
    }
  }
  return [...new Set(refs)];
}

function trigCheckbox(label, checked, tip, onChange) {
  const wrap = document.createElement('label');
  wrap.className = 'trigger-check';
  const cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.checked = checked;
  cb.addEventListener('change', () => {
    onChange(cb.checked);
    markDirty();
    renderEditorStack();
  });
  wrap.appendChild(cb);
  wrap.appendChild(document.createTextNode(label));
  setTip(wrap, tip);
  return wrap;
}

function ruleBlockTitle(text, tip) {
  const t = document.createElement('div');
  t.className = 'rule-block-title';
  t.textContent = text;
  t.appendChild(infoIcon(tip));
  return t;
}

function ruleAddButton(label, tip, onClick) {
  const b = document.createElement('button');
  b.className = 'rule-add-btn small';
  b.textContent = label;
  setTip(b, tip);
  b.addEventListener('click', () => {
    onClick();
    markDirty();
    renderEditorStack();
  });
  return b;
}

function ruleDeleteButton(tip, onClick) {
  const b = document.createElement('button');
  b.className = 'field-del-btn';
  b.textContent = '✕';
  setTip(b, tip);
  b.addEventListener('click', onClick);
  return b;
}

// Eine Zeile "Typ-Auswahl + Argumente" fuer eine Bedingung oder einen Effekt.
function renderRuleRow(el, trig, list, index, defs, noun) {
  const rule = list[index];
  const key = Object.keys(rule)[0];
  const def = defs[key];
  const row = document.createElement('div');
  row.className = 'rule-row';

  const typeSelect = document.createElement('select');
  typeSelect.className = 'rule-type';
  for (const [k, d] of Object.entries(defs)) {
    const opt = document.createElement('option');
    opt.value = k;
    opt.textContent = d.label;
    typeSelect.appendChild(opt);
  }
  if (!def) {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = `Unbekannt: ${key}`;
    typeSelect.appendChild(opt);
  }
  typeSelect.value = key;
  setTip(typeSelect, def ? def.tip : `Unbekannter ${noun}-Typ „${key}“ – wird unverändert gespeichert.`);
  typeSelect.addEventListener('change', () => {
    const nd = defs[typeSelect.value];
    list[index] = { [typeSelect.value]: buildRuleValue(nd, nd.defaults(el, trig)) };
    markDirty();
    renderEditorStack();
  });
  row.appendChild(typeSelect);

  if (!def) {
    const raw = document.createElement('code');
    raw.className = 'rule-raw';
    raw.textContent = JSON.stringify(rule[key]);
    row.appendChild(raw);
  } else {
    const args = getRuleArgs(def, rule[key]);
    const commit = (rerender) => {
      list[index] = { [key]: buildRuleValue(def, args) };
      markDirty();
      if (rerender) renderEditorStack();
    };
    def.args.forEach((argDef, i) => {
      if (argDef.before) {
        const w = document.createElement('span');
        w.className = 'rule-word';
        w.textContent = argDef.before;
        row.appendChild(w);
      }
      row.appendChild(renderArgWidget(el, argDef.kind, args, i, commit));
    });
  }

  row.appendChild(ruleDeleteButton(`${noun} entfernen.`, () => {
    list.splice(index, 1);
    markDirty();
    renderEditorStack();
  }));
  return row;
}

function renderArgWidget(el, kind, args, i, commit) {
  const onSelect = (select) => {
    select.addEventListener('change', () => {
      args[i] = select.value;
      commit(true);
    });
    return select;
  };
  switch (kind) {
    case 'element':
      return onSelect(elementSelect(args[i], el.id));
    case 'container': {
      const select = elementSelect(args[i] == null ? '' : args[i], el.id, {
        extraOptions: [['', '(oberste Ebene)'], [PLAYER_ID, '🎒 Inventar des Spielers']],
      });
      select.addEventListener('change', () => {
        if (select.value === PLAYER_ID) ensurePlayerElement();
        args[i] = select.value || null;
        commit(true);
      });
      return select;
    }
    case 'trigger':
      return onSelect(triggerSelect(args[0], args[i]));
    case 'ownTrigger':
      return onSelect(triggerSelect(el.id, args[i]));
    case 'fragment':
      return onSelect(fragmentSelect(args[i]));
    case 'textField': {
      const select = textFieldSelect(args[0], args[i]);
      if (!args[i] && select.value) {
        args[i] = select.value;
        commit(false);
      }
      return onSelect(select);
    }
    case 'stateName': {
      const input = document.createElement('input');
      input.className = 'rule-input';
      input.value = args[i] || '';
      input.placeholder = 'Name';
      input.setAttribute('list', 'dl-state-names');
      setTip(input, 'Name des Zustands. Die Liste schlägt alle schon verwendeten Namen vor – auf gleiche Schreibweise achten.');
      input.addEventListener('input', () => {
        args[i] = input.value.trim();
        commit(false);
      });
      return input;
    }
    case 'stateValue': {
      const input = document.createElement('input');
      input.className = 'rule-input short';
      input.value = formatStateValue(args[i]);
      input.placeholder = 'Wert';
      input.setAttribute('list', 'dl-state-values');
      setTip(input, 'Wert: ja / nein, eine Zahl oder ein Wort (z.B. open, complete).');
      input.addEventListener('input', () => {
        args[i] = parseStateValue(input.value);
        commit(false);
      });
      return input;
    }
    case 'text': {
      const ta = document.createElement('textarea');
      ta.className = 'rule-text';
      ta.rows = 2;
      ta.value = args[i] || '';
      ta.placeholder = 'Text der Meldung';
      ta.addEventListener('input', () => {
        args[i] = ta.value;
        commit(false);
      });
      return ta;
    }
    default: {
      const span = document.createElement('span');
      span.textContent = String(args[i]);
      return span;
    }
  }
}
