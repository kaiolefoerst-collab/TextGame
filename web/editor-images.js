'use strict';

/* Editor-Erweiterung: Bild-Prompts eines Elements (Standardbild `image` und Zustandsbilder
 * `stateImages`). Die Bilder selbst entstehen ausserhalb des Editors genau wie die Sprach-
 * samples: export_pics.py -> input_pics.txt -> generate_pictures.py -> output_pics/.
 * Nutzt globale Helfer aus editor.js / editor-triggers.js (ed, setTip, infoIcon,
 * renderSection, markDirty, renderEditorStack, ruleDeleteButton, ruleAddButton,
 * formatStateValue, parseStateValue, collectStateVocabulary, ensureDatalist, openMetaDialog).
 */

const IMAGE_TIPS = {
  section: 'Bilder zu diesem Element – optional. Nicht jedes Element braucht ein Bild, und schon gar nicht jeder Zustand.\n'
    + 'Du schreibst hier nur die Bildbeschreibung (Prompt). Erzeugt werden die Bilder außerhalb des Editors:\n'
    + '1. Speichern  2. python export_pics.py  3. python generate_pictures.py  4. Spiel neu laden.\n'
    + 'Der Masterprompt der Geschichte (Stil, Farben, Stimmung) wird automatisch bei jedem Bild mitgegeben.',
  defaultImage: 'Standardbild: Was soll auf dem Bild zu sehen sein? Beschreibe Motiv, Blickwinkel und Details.\n'
    + 'Den Stil (z.B. „düstere Aquarell-Illustration“) legst du einmal im Masterprompt der Geschichte fest.\n'
    + 'Leer lassen = kein Bild.',
  stateImage: 'Zustandsbild: Wird statt des Standardbilds gezeigt, solange ALLE angegebenen Zustandswerte dieses Elements zutreffen '
    + '(z.B. offen = ja oder investigation = complete).\n'
    + 'Passen mehrere Zustandsbilder, gewinnt das oberste. Ist das Zustandsbild noch nicht erzeugt, zeigt das Spiel das Standardbild.',
  preview: 'Vorschau des zuletzt erzeugten Bildes. Nach einer Änderung am Prompt erst neu exportieren und erzeugen.',
};

// `_image` (Bildnummer) kommt vom Server und soll beim Speichern NICHT in die YAML-Datei.
// Als nicht-aufzaehlbare Eigenschaft bleibt sie fuer die Vorschau lesbar, JSON.stringify
// ignoriert sie aber.
function hideImageNumbers(el) {
  const hide = (obj) => {
    if (obj && Object.prototype.hasOwnProperty.call(obj, '_image')) {
      const value = obj._image;
      delete obj._image;
      Object.defineProperty(obj, '_image', { value, enumerable: false, writable: true, configurable: true });
    }
  };
  hide(el);
  for (const entry of el.stateImages || []) hide(entry);
}

function imagePreview(number) {
  if (number == null) return null;
  const wrap = document.createElement('div');
  wrap.className = 'image-preview';
  const img = document.createElement('img');
  img.src = `/output_pics/pic_${String(number).padStart(5, '0')}.jpg`;
  img.alt = 'Vorschau';
  wrap.appendChild(img);
  setTip(wrap, IMAGE_TIPS.preview);
  return wrap;
}

function promptTextarea(value, placeholder, tip, onInput) {
  const ta = document.createElement('textarea');
  ta.rows = 3;
  ta.value = value || '';
  ta.placeholder = placeholder;
  setTip(ta, tip);
  ta.addEventListener('input', () => {
    onInput(ta.value);
    markDirty();
  });
  return ta;
}

function renderImagesSection(el) {
  const frag = document.createDocumentFragment();
  frag.appendChild(renderSection('Bilder', IMAGE_TIPS.section));

  const master = (ed.story.header.imageMasterPrompt || '').trim();
  const masterNote = document.createElement('div');
  masterNote.className = 'image-master-note';
  masterNote.textContent = master
    ? `Masterprompt der Geschichte: „${master.length > 90 ? master.slice(0, 87) + '…' : master}“ `
    : 'Noch kein Masterprompt für die Geschichte festgelegt. ';
  const masterBtn = document.createElement('button');
  masterBtn.className = 'link-btn';
  masterBtn.textContent = master ? 'ändern' : 'festlegen';
  setTip(masterBtn, 'Öffnet „📝 Geschichte“. Dort legst du den Stil fest, der für alle Bilder gilt.');
  masterBtn.addEventListener('click', openMetaDialog);
  masterNote.appendChild(masterBtn);
  frag.appendChild(masterNote);

  // Standardbild
  const defRow = document.createElement('div');
  defRow.className = 'field-row';
  const defLabel = document.createElement('span');
  defLabel.className = 'field-label';
  defLabel.textContent = 'Standardbild';
  defLabel.appendChild(infoIcon(IMAGE_TIPS.defaultImage));
  defRow.appendChild(defLabel);
  const defBody = document.createElement('div');
  defBody.className = 'image-row';
  defBody.appendChild(promptTextarea(el.image, 'leer = kein Bild. z.B. Ein vermoderter Schreibtisch unter einem eingestürzten Dach, Papiere liegen verstreut.',
    IMAGE_TIPS.defaultImage, (v) => {
      if (v.trim()) el.image = v;
      else delete el.image;
    }));
  const defPreview = imagePreview(el._image);
  if (defPreview) defBody.appendChild(defPreview);
  defRow.appendChild(defBody);
  frag.appendChild(defRow);

  // Zustandsbilder
  const vocab = collectStateVocabulary();
  ensureDatalist('dl-state-names', vocab.names);
  ensureDatalist('dl-state-values', vocab.values);
  (el.stateImages || []).forEach((entry, i) => frag.appendChild(renderStateImageCard(el, entry, i)));

  const addBtn = document.createElement('button');
  addBtn.className = 'rule-add-btn';
  addBtn.textContent = '+ Bild für einen Zustand';
  setTip(addBtn, 'Eigenes Bild, solange dieses Element in einem bestimmten Zustand ist – z.B. die Truhe geöffnet, die Ruine nach dem Fluch.\n'
    + 'Den Zustand legst du unter „Startzustand“ an und änderst ihn mit einer Reaktion („Setze Zustand“).');
  addBtn.addEventListener('click', () => {
    // Vorschlag: der GEGENWERT eines eigenen Ja/Nein-Zustands - ein Zustandsbild zeigt
    // meist die Veraenderung (Truhe offen, Fluch gebrochen), nicht den Startzustand.
    const initial = el.initialState || {};
    const boolKey = Object.keys(initial).find((k) => k !== 'visible' && typeof initial[k] === 'boolean');
    const state = boolKey ? { [boolKey]: !initial[boolKey] } : { investigation: 'complete' };
    el.stateImages = el.stateImages || [];
    el.stateImages.push({ state, prompt: '' });
    markDirty();
    renderEditorStack();
  });
  frag.appendChild(addBtn);
  return frag;
}

function renderStateImageCard(el, entry, index) {
  const card = document.createElement('div');
  card.className = 'trigger-card image-card';
  entry.state = entry.state && typeof entry.state === 'object' ? entry.state : {};

  const head = document.createElement('div');
  head.className = 'trigger-head';
  const title = document.createElement('span');
  title.className = 'trigger-title';
  title.textContent = `Zustandsbild ${index + 1}`;
  title.appendChild(infoIcon(IMAGE_TIPS.stateImage));
  head.appendChild(title);
  const tools = document.createElement('span');
  tools.className = 'trigger-tools';
  tools.appendChild(ruleDeleteButton('Dieses Zustandsbild entfernen.', () => {
    if (entry.prompt && !confirm(`Zustandsbild ${index + 1} samt Prompt entfernen?`)) return;
    el.stateImages.splice(index, 1);
    if (el.stateImages.length === 0) delete el.stateImages;
    markDirty();
    renderEditorStack();
  }));
  head.appendChild(tools);
  card.appendChild(head);

  card.appendChild(ruleBlockTitle('Wenn dieses Element', 'Alle Zustandswerte müssen gleichzeitig zutreffen.'));
  const keys = Object.keys(entry.state);
  if (keys.length === 0) {
    const none = document.createElement('div');
    none.className = 'rule-always';
    none.textContent = 'kein Zustand angegeben – dieses Bild wird nie gezeigt';
    card.appendChild(none);
  }
  for (const key of keys) {
    const row = document.createElement('div');
    row.className = 'rule-row';
    const w = document.createElement('span');
    w.className = 'rule-word';
    w.textContent = 'Zustand';
    row.appendChild(w);
    const nameInput = document.createElement('input');
    nameInput.className = 'rule-input';
    nameInput.value = key;
    nameInput.setAttribute('list', 'dl-state-names');
    setTip(nameInput, 'Name des Zustands, z.B. offen oder investigation.');
    nameInput.addEventListener('change', () => {
      const newKey = nameInput.value.trim();
      if (!newKey || newKey === key || newKey in entry.state) {
        nameInput.value = key;
        return;
      }
      const rebuilt = {};
      for (const [k, v] of Object.entries(entry.state)) rebuilt[k === key ? newKey : k] = v;
      entry.state = rebuilt;
      markDirty();
      renderEditorStack();
    });
    row.appendChild(nameInput);
    const eq = document.createElement('span');
    eq.className = 'rule-word';
    eq.textContent = '=';
    row.appendChild(eq);
    const valueInput = document.createElement('input');
    valueInput.className = 'rule-input short';
    valueInput.value = formatStateValue(entry.state[key]);
    valueInput.setAttribute('list', 'dl-state-values');
    setTip(valueInput, 'Wert: ja / nein, eine Zahl oder ein Wort (z.B. complete).');
    valueInput.addEventListener('input', () => {
      entry.state[key] = parseStateValue(valueInput.value);
      markDirty();
    });
    row.appendChild(valueInput);
    row.appendChild(ruleDeleteButton('Diese Zustandsbedingung entfernen.', () => {
      delete entry.state[key];
      markDirty();
      renderEditorStack();
    }));
    card.appendChild(row);
  }
  card.appendChild(ruleAddButton('+ weitere Bedingung', 'Noch einen Zustandswert verlangen (alle müssen zutreffen).', () => {
    let n = 1;
    while (`zustand_${n}` in entry.state) n++;
    entry.state[`zustand_${n}`] = true;
  }));

  card.appendChild(ruleBlockTitle('Dann zeige', 'Bildbeschreibung (Prompt) für diesen Zustand.'));
  const body = document.createElement('div');
  body.className = 'image-row';
  body.appendChild(promptTextarea(entry.prompt, 'z.B. Dieselbe Truhe, jetzt geöffnet, darin ein vergilbter Brief.',
    IMAGE_TIPS.stateImage, (v) => { entry.prompt = v; }));
  const preview = imagePreview(entry._image);
  if (preview) body.appendChild(preview);
  card.appendChild(body);
  return card;
}
