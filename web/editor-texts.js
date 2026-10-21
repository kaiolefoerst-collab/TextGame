'use strict';

/* Editor-Erweiterung: Texte eines Elements (Textmodell siehe vocs_fields.py).
 *   - feste Texte: Erste / Erneute Betrachtung (presentation.firstView / repeatView)
 *   - Wortlaut (presentation.contentText) mit eigenem Sprecher (contentVoice) - nur Schriftstuecke
 *   - Zustandstexte (stateTexts): Bedingungen wie bei Reaktionen, je eigene erste/erneute Betrachtung
 *   - Meldungen (messages: {Name: Text}) - eingeblendet per Reaktion "Zeige Meldung"
 *   - Logbuch-Felder (body/openQuestion/style) - vorerst unveraendert, Neugestaltung folgt
 * Nutzt globale Helfer aus editor.js / editor-triggers.js (ed, setTip, infoIcon, renderSection,
 * makeRow, markDirty, renderEditorStack, renderRuleRow, ruleAddButton, ruleDeleteButton,
 * ruleBlockTitle, CONDITION_DEFS, buildRuleValue, collectStateVocabulary, ensureDatalist,
 * fillSpeakerSelect, speakerLabel, FIELD_INFO, TEXT_PRIORITY_TIP, DOCUMENT_TYPES).
 */

const TEXT_TIPS = {
  stateText: 'Zustandstext: Ersetzt die festen Betrachtungen, solange ALLE Bedingungen erfüllt sind.\n'
    + 'Bedingungen wie bei Reaktionen – auch Zustände anderer Elemente oder „Spieler trägt …“.\n'
    + 'Beispiele: Truhe geöffnet, Fluch gebrochen, Spieler hat den Brief gelesen.\n'
    + 'Passen mehrere Zustandstexte, gilt der oberste. Jeder hat eine eigene erste und erneute Betrachtung.',
  newLead: 'Tipp „Neue Spur“: Setze in der Reaktion, die etwas freischaltet, einen Zustand (z.B. neue_spur = ja) '
    + 'und lege dafür hier einen Zustandstext an. Beim Öffnen des neuen Elements setzt eine Reaktion den Zustand wieder zurück.',
  messages: 'Meldungen: kurze erzählende Texte, die eine Reaktion mit „Zeige Meldung“ einblendet – '
    + 'z.B. „Der Weg verschwindet im Nebel …“, wenn ein Weg versperrt ist.\n'
    + 'Sie erscheinen im Fenster zwischen Text und Auswahl, werden vorgelesen und bleiben bis zur nächsten Aktion stehen.\n'
    + 'Den Namen wählst du frei; er dient nur dazu, die Meldung in der Reaktion auszuwählen.',
  contentVoice: 'Sprecher für den Wortlaut – z.B. die Stimme der Person, die den Brief geschrieben hat.\n'
    + 'Leer = derselbe Sprecher wie für die Betrachtung dieses Elements.',
  logbook: 'Logbuch-Angaben (für Erkenntnisse und Widersprüche). Bleiben vorerst wie bisher – das Logbuch wird später neu gestaltet.',
};

const LOGBOOK_FIELDS = ['body', 'openQuestion', 'style'];
const KNOWN_PRESENTATION_FIELDS = ['firstView', 'repeatView', 'contentText', 'takeText', 'dropText', ...LOGBOOK_FIELDS];

function isDocumentLike(el) {
  return DOCUMENT_TYPES.includes(el.type);
}

// Mehrzeiliges Textfeld mit Beschriftung; leerer Inhalt entfernt den Schluessel (wenn removeEmpty).
function textAreaRow(obj, key, label, tip, placeholder, removeEmpty = true) {
  const row = document.createElement('div');
  row.className = 'field-row';
  const head = document.createElement('span');
  head.className = 'field-label';
  head.textContent = label;
  head.appendChild(infoIcon(tip));
  row.appendChild(head);
  const ta = document.createElement('textarea');
  ta.rows = 3;
  ta.value = obj[key] || '';
  ta.placeholder = placeholder || '';
  setTip(ta, tip);
  ta.addEventListener('input', () => {
    if (ta.value || !removeEmpty) obj[key] = ta.value;
    else delete obj[key];
    markDirty();
  });
  row.appendChild(ta);
  return row;
}

function renderTextsSection(el, body) {
  const p = el.presentation;
  const vocab = collectStateVocabulary();
  ensureDatalist('dl-state-names', vocab.names);
  ensureDatalist('dl-state-values', vocab.values);

  body.appendChild(renderSection('Texte', TEXT_PRIORITY_TIP));
  body.appendChild(textAreaRow(p, 'firstView', FIELD_INFO.firstView.label, FIELD_INFO.firstView.tip, FIELD_INFO.firstView.placeholder));
  body.appendChild(textAreaRow(p, 'repeatView', FIELD_INFO.repeatView.label, FIELD_INFO.repeatView.tip, FIELD_INFO.repeatView.placeholder));
  if (isDocumentLike(el) || p.contentText) body.appendChild(renderContentText(el));

  // Zustandstexte
  (el.stateTexts || []).forEach((st, i) => body.appendChild(renderStateTextCard(el, st, i)));
  const addState = document.createElement('button');
  addState.className = 'rule-add-btn';
  addState.textContent = '+ Text für einen Zustand';
  setTip(addState, TEXT_TIPS.stateText + '\n\n' + TEXT_TIPS.newLead);
  addState.addEventListener('click', () => {
    el.stateTexts = el.stateTexts || [];
    const key = 'stateEquals';
    el.stateTexts.push({
      id: uniqueStateTextId(el),
      conditions: [{ [key]: buildRuleValue(CONDITION_DEFS[key], CONDITION_DEFS[key].defaults(el)) }],
      firstView: '',
      repeatView: '',
    });
    markDirty();
    renderEditorStack();
  });
  body.appendChild(addState);

  if (el.portable || p.takeText || p.dropText) {
    body.appendChild(textAreaRow(p, 'takeText', FIELD_INFO.takeText.label, FIELD_INFO.takeText.tip, FIELD_INFO.takeText.placeholder));
    body.appendChild(textAreaRow(p, 'dropText', FIELD_INFO.dropText.label, FIELD_INFO.dropText.tip, FIELD_INFO.dropText.placeholder));
  }

  body.appendChild(renderMessagesSection(el));

  if (el.physical === false || LOGBOOK_FIELDS.some((k) => k in p)) body.appendChild(renderLogbookSection(el));
  renderLegacyFields(el, body);
}

function renderContentText(el) {
  const wrap = document.createElement('div');
  wrap.className = 'content-text-block';
  wrap.appendChild(textAreaRow(el.presentation, 'contentText', FIELD_INFO.contentText.label,
    FIELD_INFO.contentText.tip, FIELD_INFO.contentText.placeholder));
  const voiceRow = makeRow('Sprecher des Wortlauts', TEXT_TIPS.contentVoice);
  voiceRow.classList.add('field-row-narrow');
  const select = document.createElement('select');
  fillSpeakerSelect(select, el.contentVoice, `(wie Sprecher des Elements: ${speakerLabel(el.voice || ed.story.header.narratorVoice || ed.voices.default)})`);
  setTip(select, TEXT_TIPS.contentVoice);
  select.addEventListener('change', () => {
    if (select.value) el.contentVoice = select.value;
    else delete el.contentVoice;
    markDirty();
  });
  voiceRow.appendChild(select);
  wrap.appendChild(voiceRow);
  return wrap;
}

function uniqueStateTextId(el) {
  const used = new Set((el.stateTexts || []).map((st) => st.id));
  let n = used.size + 1;
  while (used.has(`zt_${n}`)) n++;
  return `zt_${n}`;
}

function renderStateTextCard(el, st, index) {
  st.conditions = st.conditions || [];
  const card = document.createElement('div');
  card.className = 'trigger-card state-text-card';

  const head = document.createElement('div');
  head.className = 'trigger-head';
  const title = document.createElement('span');
  title.className = 'trigger-title';
  title.textContent = `Zustandstext ${index + 1}`;
  title.appendChild(infoIcon(TEXT_TIPS.stateText));
  head.appendChild(title);
  const tools = document.createElement('span');
  tools.className = 'trigger-tools';
  const moveBtn = (label, tip, delta) => {
    const b = document.createElement('button');
    b.className = 'field-del-btn';
    b.textContent = label;
    setTip(b, tip);
    const target = index + delta;
    b.disabled = target < 0 || target >= el.stateTexts.length;
    b.addEventListener('click', () => {
      const [moved] = el.stateTexts.splice(index, 1);
      el.stateTexts.splice(target, 0, moved);
      markDirty();
      renderEditorStack();
    });
    return b;
  };
  tools.appendChild(moveBtn('↑', 'Nach oben: wird früher geprüft (gewinnt, wenn mehrere passen).', -1));
  tools.appendChild(moveBtn('↓', 'Nach unten: wird später geprüft.', 1));
  tools.appendChild(ruleDeleteButton('Diesen Zustandstext löschen.', () => {
    if ((st.firstView || st.repeatView) && !confirm(`Zustandstext ${index + 1} samt Texten löschen?`)) return;
    el.stateTexts.splice(index, 1);
    if (el.stateTexts.length === 0) delete el.stateTexts;
    markDirty();
    renderEditorStack();
  }));
  head.appendChild(tools);
  card.appendChild(head);

  card.appendChild(ruleBlockTitle('Wenn', 'Alle Bedingungen müssen gleichzeitig erfüllt sein (UND). Sie dürfen sich auch auf andere Elemente beziehen.'));
  if (st.conditions.length === 0) {
    const none = document.createElement('div');
    none.className = 'rule-always';
    none.textContent = 'keine Bedingung – dieser Text wird nie gezeigt';
    card.appendChild(none);
  }
  st.conditions.forEach((_c, i) => card.appendChild(renderRuleRow(el, st, st.conditions, i, CONDITION_DEFS, 'Bedingung')));
  card.appendChild(ruleAddButton('+ Bedingung', 'Weitere Bedingung hinzufügen. Alle müssen erfüllt sein.', () => {
    const key = 'stateEquals';
    st.conditions.push({ [key]: buildRuleValue(CONDITION_DEFS[key], CONDITION_DEFS[key].defaults(el)) });
  }));

  card.appendChild(ruleBlockTitle('Dann zeige', 'Die Texte für diesen Zustand.'));
  card.appendChild(textAreaRow(st, 'firstView', 'Erste Betrachtung in diesem Zustand',
    'Wird gezeigt, wenn der Spieler das Element zum ersten Mal in diesem Zustand sieht.', 'z.B. Die Truhe steht jetzt offen. Darin liegt ein vergilbter Brief.', false));
  card.appendChild(textAreaRow(st, 'repeatView', 'Erneute Betrachtung in diesem Zustand',
    'Ab dem zweiten Mal in diesem Zustand – meist eine Kurzfassung. Leer = die erste wird wiederholt.', 'z.B. Die offene Truhe.', false));
  return card;
}

// ---------------------------------------------------------------------
// Meldungen
// ---------------------------------------------------------------------

function messagePath(el, name) {
  return `${el.id}.messages.${name}`;
}

// Alle Stellen (Reaktionen, Loesung), die diese Meldung einblenden.
function messageUsers(el, name) {
  const path = messagePath(el, name);
  const users = [];
  for (const other of Object.values(ed.elementsById)) {
    (other.onUse || []).forEach((t, i) => {
      if ((t.effects || []).some((e) => e.showTextFrom === path)) users.push(`„${other.name}“ (Reaktion ${i + 1})`);
    });
  }
  const res = ed.story.resolution;
  if (res && (res.effects || []).some((e) => e.showTextFrom === path)) users.push('die Lösung der Geschichte');
  return users;
}

function renameMessageReferences(el, oldName, newName) {
  const oldPath = messagePath(el, oldName);
  const newPath = messagePath(el, newName);
  const lists = [((ed.story.resolution || {}).effects) || []];
  for (const other of Object.values(ed.elementsById)) {
    for (const t of other.onUse || []) lists.push(t.effects || []);
  }
  for (const effects of lists) {
    for (const e of effects) if (e.showTextFrom === oldPath) e.showTextFrom = newPath;
  }
}

function renderMessagesSection(el) {
  const frag = document.createDocumentFragment();
  frag.appendChild(renderSection('Meldungen', TEXT_TIPS.messages));
  const messages = el.messages || {};
  for (const name of Object.keys(messages)) {
    const card = document.createElement('div');
    card.className = 'message-card';
    const head = document.createElement('div');
    head.className = 'trigger-head';
    const nameInput = document.createElement('input');
    nameInput.className = 'rule-input message-name';
    nameInput.value = name;
    setTip(nameInput, 'Name der Meldung – frei wählbar, z.B. „Weg versperrt“. Damit wählst du sie in der Reaktion „Zeige Meldung“ aus.\n'
      + 'Beim Umbenennen werden alle Reaktionen, die sie verwenden, automatisch angepasst.');
    nameInput.addEventListener('change', () => {
      const newName = nameInput.value.trim();
      if (!newName || newName === name) {
        nameInput.value = name;
        return;
      }
      if (newName.includes('.') || newName in messages) {
        alert(newName.includes('.') ? 'Der Name darf keinen Punkt enthalten.' : 'Eine Meldung mit diesem Namen gibt es schon.');
        nameInput.value = name;
        return;
      }
      const rebuilt = {};
      for (const [k, v] of Object.entries(messages)) rebuilt[k === name ? newName : k] = v;
      el.messages = rebuilt;
      renameMessageReferences(el, name, newName);
      markDirty();
      renderEditorStack();
    });
    head.appendChild(nameInput);
    const users = messageUsers(el, name);
    const usage = document.createElement('span');
    usage.className = 'message-usage' + (users.length ? '' : ' unused');
    usage.textContent = users.length ? `eingeblendet von ${users.join(', ')}` : '⚠ wird noch von keiner Reaktion eingeblendet';
    setTip(usage, users.length ? 'Diese Reaktionen zeigen die Meldung an.'
      : 'Damit die Meldung erscheint, lege in einer Reaktion den Effekt „Zeige Meldung“ an und wähle sie dort aus.');
    head.appendChild(usage);
    const tools = document.createElement('span');
    tools.className = 'trigger-tools';
    tools.appendChild(ruleDeleteButton(`Meldung „${name}“ löschen.`, () => {
      const msg = users.length
        ? `Meldung „${name}“ wird noch von ${users.join(', ')} verwendet. Trotzdem löschen?`
        : `Meldung „${name}“ löschen?`;
      if (!confirm(msg)) return;
      delete messages[name];
      if (Object.keys(messages).length === 0) delete el.messages;
      markDirty();
      renderEditorStack();
    }));
    head.appendChild(tools);
    card.appendChild(head);
    const ta = document.createElement('textarea');
    ta.rows = 2;
    ta.value = messages[name] || '';
    ta.placeholder = 'z.B. Der Weg verschwindet im Nebel. Wenige Schritte später stehst du wieder auf dem Dorfplatz.';
    setTip(ta, TEXT_TIPS.messages);
    ta.addEventListener('input', () => {
      messages[name] = ta.value;
      markDirty();
    });
    card.appendChild(ta);
    frag.appendChild(card);
  }
  const addBtn = document.createElement('button');
  addBtn.className = 'rule-add-btn';
  addBtn.textContent = '+ Meldung';
  setTip(addBtn, TEXT_TIPS.messages);
  addBtn.addEventListener('click', () => {
    el.messages = el.messages || {};
    let n = Object.keys(el.messages).length + 1;
    while (`Meldung ${n}` in el.messages) n++;
    el.messages[`Meldung ${n}`] = '';
    markDirty();
    renderEditorStack();
  });
  frag.appendChild(addBtn);
  return frag;
}

// ---------------------------------------------------------------------
// Logbuch (vorerst unveraendert) und alte Felder
// ---------------------------------------------------------------------

function renderLogbookSection(el) {
  const p = el.presentation;
  const frag = document.createDocumentFragment();
  frag.appendChild(renderSection('Logbuch', TEXT_TIPS.logbook));
  frag.appendChild(textAreaRow(p, 'body', FIELD_INFO.body.label, FIELD_INFO.body.tip, FIELD_INFO.body.placeholder));
  frag.appendChild(textAreaRow(p, 'openQuestion', FIELD_INFO.openQuestion.label, FIELD_INFO.openQuestion.tip, FIELD_INFO.openQuestion.placeholder));
  const row = makeRow(FIELD_INFO.style.label, FIELD_INFO.style.tip);
  row.classList.add('field-row-narrow');
  const select = document.createElement('select');
  for (const [v, label] of [['', '(keine)'], ['discovery', 'Neue Erkenntnisse'], ['contradiction', 'Widersprüche & offene Fragen']]) {
    const opt = document.createElement('option');
    opt.value = v;
    opt.textContent = label;
    select.appendChild(opt);
  }
  select.value = p.style || '';
  select.addEventListener('change', () => {
    if (select.value) p.style = select.value;
    else delete p.style;
    markDirty();
  });
  row.appendChild(select);
  frag.appendChild(row);
  return frag;
}

// Felder aus dem alten Textmodell, falls eine Geschichte noch nicht umgestellt ist:
// sichtbar machen statt verstecken, damit nichts unbemerkt in der Datei liegen bleibt.
function renderLegacyFields(el, body) {
  const p = el.presentation;
  const legacy = Object.keys(p).filter((k) => !KNOWN_PRESENTATION_FIELDS.includes(k));
  if (legacy.length === 0) return;
  body.appendChild(renderSection('Alte Felder', 'Diese Felder stammen aus dem alten Textmodell und werden vom Spiel nicht mehr angezeigt. '
    + 'Übertrage den Text bei Bedarf in eine Betrachtung, einen Zustandstext oder eine Meldung und lösche das Feld dann.'));
  for (const key of legacy) {
    const row = document.createElement('div');
    row.className = 'field-row legacy-row';
    const head = document.createElement('div');
    head.className = 'field-head';
    const label = document.createElement('span');
    label.className = 'field-label';
    label.textContent = key;
    head.appendChild(label);
    head.appendChild(ruleDeleteButton(`Altes Feld „${key}“ löschen.`, () => {
      delete p[key];
      markDirty();
      renderEditorStack();
    }));
    row.appendChild(head);
    const ta = document.createElement('textarea');
    ta.rows = 2;
    ta.value = typeof p[key] === 'string' ? p[key] : JSON.stringify(p[key]);
    ta.readOnly = true;
    row.appendChild(ta);
    body.appendChild(row);
  }
}
