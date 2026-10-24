'use strict';

/* Editor-Erweiterung: Bild-Prompts eines Elements (Standardbild `image` und Zustandsbilder
 * `stateImages`). Die Bilder selbst entstehen ausserhalb des Editors genau wie die Sprach-
 * samples: generate_pictures.py -> Stories/<Name>/pictures/.
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
  hide(el.cutscene);
}

function imagePreview(number) {
  if (number == null) return null;
  const wrap = document.createElement('div');
  wrap.className = 'image-preview';
  const img = document.createElement('img');
  img.src = `/stories/${encodeURIComponent(ed.storyId)}/pictures/pic_${String(number).padStart(5, '0')}.jpg`;
  img.alt = 'Vorschau';
  wrap.appendChild(img);
  setTip(wrap, IMAGE_TIPS.preview);
  return wrap;
}

// ---------------------------------------------------------------------
// "Beschreibung uebernehmen": haengt die Beschreibung des Elements als Szenen-Block an den
// Bild-Prompt, damit das Bild ihr nicht widerspricht. Bewusst nur per Knopf (kein Automatismus):
// Der Level-Designer kuerzt den Block danach von Hand auf das Sichtbare.
// ---------------------------------------------------------------------

const SCENE_START = 'Szene laut Geschichte:';
const SCENE_END = 'Das Bild darf dem nicht widersprechen.';
// Ein schon vorhandener Block wird ersetzt statt ein zweites Mal angehaengt.
const SCENE_BLOCK_RE = /\s*Szene laut Geschichte:[\s\S]*?Das Bild darf dem nicht widersprechen\.?/;

// Die Beschreibung, die der Spieler beim ersten Oeffnen liest (Reihenfolge wie pickPresentationText).
function sceneDescription(el) {
  const p = el.presentation || {};
  const text = p.firstView || p.firstUse || p.repeatView || p.repeatUse || '';
  return text.replace(/\s+/g, ' ').trim();
}

function promptWithScene(prompt, description) {
  const own = String(prompt || '').replace(SCENE_BLOCK_RE, '').trim();
  const block = `${SCENE_START} „${description}“ ${SCENE_END}`;
  return own ? `${own}\n\n${block}` : block;
}

function sceneButton(el, textarea) {
  const btn = document.createElement('button');
  btn.className = 'rule-add-btn small scene-btn';
  btn.textContent = '📝 Beschreibung übernehmen';
  const description = sceneDescription(el);
  if (!description) {
    btn.disabled = true;
    setTip(btn, 'Dieses Element hat noch keinen Text für „Erster Besuch“ – es gibt nichts zu übernehmen.');
    return btn;
  }
  setTip(btn, 'Hängt die Beschreibung des Elements („Erster Besuch“) an den Prompt an:\n'
    + `${SCENE_START} „…“ ${SCENE_END}\n`
    + 'Danach von Hand kürzen: Handlung („Du wischst …“) und Gedanken streichen, nur Sichtbares stehen lassen.\n'
    + 'Erneut drücken ersetzt den Szenen-Block durch die aktuelle Beschreibung – deine eigenen Zeilen bleiben.');
  btn.addEventListener('click', () => {
    textarea.value = promptWithScene(textarea.value, description);
    textarea.dispatchEvent(new Event('input'));
    textarea.focus();
  });
  return btn;
}

// ---------------------------------------------------------------------
// Vorlagebilder je Bild-Prompt (hoechstens 3): Dateinamen aus Stories/<Name>/vorlagen/.
// generate_pictures.py schickt sie mit und nennt sie "Vorlage 1..3" - der Prompt bezieht sich
// darauf. Feld: imageRefs (zu image) bzw. refs (zu stateImages[].prompt), siehe pics_fields.py.
// ---------------------------------------------------------------------

const MAX_IMAGE_REFS = 3;
const REFS_TIP = 'Vorlagen: bis zu drei Bilder aus dem Ordner „vorlagen“ dieser Geschichte. Sie werden beim Erzeugen '
  + 'zusammen mit dem Prompt an Gemini geschickt und heißen dort „Vorlage 1“, „Vorlage 2“, „Vorlage 3“ (in dieser Reihenfolge).\n'
  + 'Im Prompt darauf Bezug nehmen, z.B. „Die Glover genau wie auf Vorlage 1, jetzt gelandet in einem dunklen Hangar.“\n'
  + 'So sieht ein Motiv auf allen Bildern gleich aus. Ändert sich eine Vorlage, wird das Bild beim nächsten Lauf neu erzeugt.\n'
  + 'Neue Vorlagen: python generate_picprompt.py oder ein Bild in den Ordner legen, dann den Editor neu laden.';

function refImageUrl(name) {
  return `/stories/${encodeURIComponent(ed.storyId)}/vorlagen/${encodeURIComponent(name)}`;
}

// Zeile "Vorlagen" unter einem Bild-Prompt. owner[key] ist die Liste der Dateinamen;
// onChange wird nach jeder Aenderung aufgerufen (z.B. sync der Zwischensequenz).
function renderRefsRow(owner, key, onChange) {
  const refs = Array.isArray(owner[key]) ? owner[key] : [];
  const row = document.createElement('div');
  row.className = 'field-row refs-row';
  const label = document.createElement('span');
  label.className = 'field-label';
  label.textContent = 'Vorlagen';
  label.appendChild(infoIcon(REFS_TIP));
  row.appendChild(label);

  const list = document.createElement('div');
  list.className = 'ref-list';
  const changed = () => {
    if (Array.isArray(owner[key]) && owner[key].length === 0) delete owner[key];
    if (onChange) onChange();
    markDirty();
    renderEditorStack();
  };

  refs.forEach((name, i) => {
    const missing = !ed.references.includes(name);
    const chip = document.createElement('div');
    chip.className = 'ref-chip' + (missing ? ' is-missing' : '');
    const num = document.createElement('span');
    num.className = 'ref-num';
    num.textContent = `Vorlage ${i + 1}`;
    chip.appendChild(num);
    if (!missing) {
      const img = document.createElement('img');
      img.src = refImageUrl(name);
      img.alt = name;
      chip.appendChild(img);
    }
    const nameSpan = document.createElement('span');
    nameSpan.className = 'ref-name';
    nameSpan.textContent = missing ? `⚠ fehlt: ${name}` : name;
    chip.appendChild(nameSpan);
    setTip(chip, missing
      ? `Die Datei „${name}“ liegt nicht im Ordner „vorlagen“. Ohne sie schlägt das Erzeugen dieses Bilds fehl.`
      : `Im Prompt als „Vorlage ${i + 1}“ ansprechen.`);
    chip.appendChild(ruleDeleteButton('Diese Vorlage entfernen.', () => {
      owner[key].splice(i, 1);
      changed();
    }));
    list.appendChild(chip);
  });

  const available = ed.references.filter((name) => !refs.includes(name));
  if (refs.length < MAX_IMAGE_REFS && available.length > 0) {
    const select = document.createElement('select');
    select.className = 'ref-add';
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = '+ Vorlage hinzufügen …';
    select.appendChild(placeholder);
    for (const name of available) {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      select.appendChild(opt);
    }
    setTip(select, REFS_TIP);
    select.addEventListener('change', () => {
      if (!select.value) return;
      owner[key] = [...refs, select.value];
      changed();
    });
    list.appendChild(select);
  } else if (refs.length === 0) {
    const note = document.createElement('span');
    note.className = 'ref-note';
    note.textContent = 'Keine Vorlagebilder vorhanden (Ordner „vorlagen“ der Geschichte).';
    list.appendChild(note);
  } else if (refs.length >= MAX_IMAGE_REFS) {
    const note = document.createElement('span');
    note.className = 'ref-note';
    note.textContent = 'Höchstens drei Vorlagen pro Bild.';
    list.appendChild(note);
  }
  row.appendChild(list);
  return row;
}

function promptTextarea(value, placeholder, tip, onInput) {
  const ta = document.createElement('textarea');
  ta.rows = 3;
  ta.value = value || '';
  ta.placeholder = placeholder;
  setTip(ta, tip);
  // Feld waechst mit dem Inhalt, damit ein angehaengter Szenen-Block sichtbar ist.
  const fit = () => {
    ta.style.height = 'auto';
    ta.style.height = ta.scrollHeight + 2 + 'px';
  };
  ta.addEventListener('input', () => {
    onInput(ta.value);
    markDirty();
    fit();
  });
  requestAnimationFrame(fit); // erst nach dem Einfuegen ins Fenster ist die Hoehe messbar
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
  const defArea = promptTextarea(el.image, 'leer = kein Bild. z.B. Ein vermoderter Schreibtisch unter einem eingestürzten Dach, Papiere liegen verstreut.',
    IMAGE_TIPS.defaultImage, (v) => {
      if (v.trim()) el.image = v;
      else delete el.image;
    });
  defBody.appendChild(defArea);
  const defPreview = imagePreview(el._image);
  if (defPreview) defBody.appendChild(defPreview);
  defRow.appendChild(defBody);
  defRow.appendChild(sceneButton(el, defArea));
  frag.appendChild(defRow);
  frag.appendChild(renderRefsRow(el, 'imageRefs'));

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
  const area = promptTextarea(entry.prompt, 'z.B. Dieselbe Truhe, jetzt geöffnet, darin ein vergilbter Brief.',
    IMAGE_TIPS.stateImage, (v) => { entry.prompt = v; });
  body.appendChild(area);
  const preview = imagePreview(entry._image);
  if (preview) body.appendChild(preview);
  card.appendChild(body);
  card.appendChild(renderRefsRow(entry, 'refs'));
  card.appendChild(sceneButton(el, area));
  return card;
}

// ---------------------------------------------------------------------
// Zwischensequenz eines Weges (`cutscene`): Text, Bild und eine einzige Taste. Sie trennt
// Handlungsabschnitte. Aktiv nur mit Text oder Bild-Prompt - sonst bleibt der Weg wie bisher.
// Spiel: showCutscene in game.js. Ein Film ist spaeter geplant (noch nicht).
// ---------------------------------------------------------------------

const CUTSCENE_TIPS = {
  section: 'Zwischensequenz: Ein eigener Schirm mit Bild, Text und nur einer Taste („Weiter“), '
    + 'bevor der Spieler am Zielort ankommt. Damit trennst du Handlungsabschnitte.\n'
    + 'Sie erscheint nur, wenn der Weg wirklich woanders hinführt (oder das Spiel beendet) – dafür braucht er ein Ziel unter „Führt zu“. '
    + 'ein versperrter Weg zeigt nur seine Meldung.\n'
    + 'Mit „Wenn“ legst du fest, in welchem Zustand sie erscheint.\n'
    + 'Ohne Text und ohne Bild-Prompt gibt es keine Zwischensequenz.',
  text: 'Text der Zwischensequenz. Wird vorgelesen (mit dem Sprecher dieses Weges), '
    + 'nachdem die Sprachdateien erzeugt wurden: python generate_samples.py',
  image: 'Bild der Zwischensequenz: Was soll zu sehen sein? Der Masterprompt der Geschichte wird mitgegeben.\n'
    + 'Erzeugen: Speichern, dann python generate_pictures.py.\nLeer = kein Bild.',
  button: 'Beschriftung der einzigen Taste. Leer = „Weiter“.',
  conditions: 'Wenn: Die Zwischensequenz erscheint nur, wenn alle Bedingungen erfüllt sind (UND) – '
    + 'z.B. ein Zustand eines anderen Elements. Geprüft wird im Moment des Klicks, bevor die Reaktionen des Weges laufen.\n'
    + 'Ohne Bedingung erscheint sie immer.',
  onlyOnce: 'Angehakt: Die Zwischensequenz erscheint nur beim ersten Mal, wenn der Spieler diesen Weg geht. '
    + 'Danach führt der Weg direkt zum Ziel.\nNicht angehakt: bei jedem Gang über den Weg.',
};

function renderCutsceneSection(el) {
  const frag = document.createDocumentFragment();
  frag.appendChild(renderSection('Zwischensequenz', CUTSCENE_TIPS.section));
  const c = el.cutscene || { onlyOnce: true };
  if (Array.isArray(c.conditions) && c.conditions.length === 0) delete c.conditions;
  // Der Block steht nur in der Datei, solange etwas drinsteht (onlyOnce allein zaehlt nicht).
  const sync = () => {
    const filled = ['text', 'image', 'buttonLabel'].some((k) => typeof c[k] === 'string' && c[k].trim())
      || (c.conditions || []).length > 0;
    if (filled) el.cutscene = c;
    else delete el.cutscene;
  };

  frag.appendChild(ruleBlockTitle('Wenn', CUTSCENE_TIPS.conditions));
  const conditions = c.conditions || [];
  if (conditions.length === 0) {
    const none = document.createElement('div');
    none.className = 'rule-always';
    none.textContent = 'keine Bedingung – die Zwischensequenz erscheint immer';
    frag.appendChild(none);
  }
  conditions.forEach((_c, i) => frag.appendChild(renderRuleRow(el, c, conditions, i, CONDITION_DEFS, 'Bedingung')));
  frag.appendChild(ruleAddButton('+ Bedingung', 'Bedingung hinzufügen. Alle müssen erfüllt sein.', () => {
    const key = 'stateEquals';
    c.conditions = c.conditions || [];
    c.conditions.push({ [key]: buildRuleValue(CONDITION_DEFS[key], CONDITION_DEFS[key].defaults(el)) });
    sync();
  }));

  frag.appendChild(ruleBlockTitle('Dann zeige', 'Text, Bild und Taste der Zwischensequenz.'));

  const textRow = textAreaRow(c, 'text', 'Text', CUTSCENE_TIPS.text,
    'z.B. Drei Tage später. Der Nebel hat sich gelichtet, und die Mühle liegt still im Morgenlicht.');
  textRow.querySelector('textarea').addEventListener('input', sync);
  frag.appendChild(textRow);

  const imgRow = document.createElement('div');
  imgRow.className = 'field-row';
  const imgLabel = document.createElement('span');
  imgLabel.className = 'field-label';
  imgLabel.textContent = 'Bild';
  imgLabel.appendChild(infoIcon(CUTSCENE_TIPS.image));
  imgRow.appendChild(imgLabel);
  const imgBody = document.createElement('div');
  imgBody.className = 'image-row';
  imgBody.appendChild(promptTextarea(c.image, 'leer = kein Bild. z.B. Ein Pfad durch den Nebel, im Hintergrund die Umrisse der Mühle.',
    CUTSCENE_TIPS.image, (v) => {
      if (v.trim()) c.image = v;
      else delete c.image;
      sync();
    }));
  const preview = imagePreview(c._image);
  if (preview) imgBody.appendChild(preview);
  imgRow.appendChild(imgBody);
  frag.appendChild(imgRow);
  frag.appendChild(renderRefsRow(c, 'imageRefs', sync));

  const grid = document.createElement('div');
  grid.className = 'field-grid';

  const btnRow = makeRow('Taste', CUTSCENE_TIPS.button);
  const btnInput = document.createElement('input');
  btnInput.value = c.buttonLabel || '';
  btnInput.placeholder = 'Weiter';
  setTip(btnInput, CUTSCENE_TIPS.button);
  btnInput.addEventListener('input', () => {
    if (btnInput.value.trim()) c.buttonLabel = btnInput.value;
    else delete c.buttonLabel;
    sync();
    markDirty();
  });
  btnRow.appendChild(btnInput);
  grid.appendChild(btnRow);

  const onceRow = document.createElement('label');
  onceRow.className = 'field-row field-row-inline';
  const cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.checked = !!c.onlyOnce;
  cb.addEventListener('change', () => {
    if (cb.checked) c.onlyOnce = true;
    else delete c.onlyOnce;
    sync();
    markDirty();
  });
  onceRow.appendChild(cb);
  const onceLabel = document.createElement('span');
  onceLabel.className = 'field-label';
  onceLabel.textContent = 'Nur beim ersten Mal';
  onceLabel.appendChild(infoIcon(CUTSCENE_TIPS.onlyOnce));
  onceRow.appendChild(onceLabel);
  setTip(onceRow, CUTSCENE_TIPS.onlyOnce);
  grid.appendChild(onceRow);

  grid.appendChild(renderVoiceRow(el));
  frag.appendChild(grid);
  return frag;
}
