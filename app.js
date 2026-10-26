'use strict';
/* Reflux Diary — single-user ingredient & symptom tracker. All data stays in this browser. */

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const byId = (arr, id) => arr.find(x => x.id === id);

/* ---------------- storage ---------------- */
const KEY = 'refluxdiary.v1';
const blankDb = () => ({ version: 1, products: [], entries: [], checkins: [], aliases: {} });
let db = load();
function load() {
  try { const raw = localStorage.getItem(KEY); if (raw) return Object.assign(blankDb(), JSON.parse(raw)); } catch (e) { }
  return blankDb();
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(db)); }
  catch (e) { toast('Could not save — storage may be full. Export a backup.'); }
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => { });
}

/* ---------------- constants ---------------- */
const SEVERITY = [
  { v: 0, label: 'None', cls: 's0' }, { v: 1, label: 'Mild', cls: 's1' },
  { v: 2, label: 'Moderate', cls: 's2' }, { v: 3, label: 'Severe', cls: 's3' }];
const SYMPTOMS = [['heartburn', 'Heartburn'], ['regurg', 'Regurgitation'], ['sour', 'Sour / bitter taste'], ['throat', 'Throat / cough'],
  ['burping', 'Burping / bloating'], ['chest', 'Chest discomfort'], ['nausea', 'Nausea']];
const BEHAVIOURS = [['rushed', 'Ate quickly / rushed'], ['large', 'Large portion'], ['lay', 'Lay down or bent over after'],
  ['late', 'Ate late (within 3h of bed)'], ['stress', 'Stressed'], ['exercise', 'Exercised soon after'],
  ['tight', 'Tight clothing / waistband'], ['nsaid', 'Took painkillers (e.g. ibuprofen)'], ['smoke', 'Smoked / vaped'],
  ['antacid', 'Took antacid / reflux meds']];
const DRINKS = [
  { id: 'water', label: 'Water', f: {} }, { id: 'sparkling', label: 'Sparkling water', f: { fizzy: 1 } },
  { id: 'tea', label: 'Tea', f: { caffeine: 1 } }, { id: 'herbal', label: 'Herbal tea', f: {} },
  { id: 'coffee', label: 'Coffee', f: { caffeine: 1 } }, { id: 'decaf', label: 'Decaf coffee', f: {} },
  { id: 'soft', label: 'Fizzy soft drink', f: { fizzy: 1 } }, { id: 'cola', label: 'Cola', f: { fizzy: 1, caffeine: 1 } },
  { id: 'energy', label: 'Energy drink', f: { fizzy: 1, caffeine: 1 } }, { id: 'juice', label: 'Juice', f: {} },
  { id: 'milk', label: 'Milk / plant milk', f: {} }, { id: 'beer', label: 'Beer / cider', f: { fizzy: 1, alcohol: 1 } },
  { id: 'wine', label: 'Wine', f: { alcohol: 1 } }, { id: 'spirits', label: 'Spirits / mixer', f: { alcohol: 1 } },
  { id: 'other', label: 'Other', f: {} }];
const VOLUMES = [150, 250, 330, 500];
const FLAGS = [['caffeine', 'Caffeine'], ['alcohol', 'Alcohol'], ['fizzy', 'Fizzy']];
const volBucket = ml => ml <= 200 ? 'small' : ml <= 400 ? 'medium' : 'large';
const BUCKET_LABEL = { small: 'small (≤200 ml)', medium: 'medium (≤400 ml)', large: 'large (>400 ml)' };
const HIGH_FAT = 17.5; // g per 100g — UK "high" traffic-light threshold

/* --- PARSER START --- */
const ENUM = {
  e100: 'curcumin', e101: 'riboflavin', e120: 'carmine', e150a: 'caramel colour', e150c: 'caramel colour', e150d: 'caramel colour',
  e160a: 'carotenes', e160c: 'paprika extract', e162: 'beetroot red', e170: 'calcium carbonate', e200: 'sorbic acid',
  e202: 'potassium sorbate', e211: 'sodium benzoate', e220: 'sulphur dioxide', e223: 'sodium metabisulphite', e224: 'potassium metabisulphite',
  e250: 'sodium nitrite', e252: 'potassium nitrate', e260: 'acetic acid', e262: 'sodium acetates', e270: 'lactic acid', e282: 'calcium propionate',
  e290: 'carbon dioxide', e296: 'malic acid', e300: 'ascorbic acid', e301: 'sodium ascorbate', e306: 'tocopherols', e307: 'tocopherols',
  e322: 'lecithins', e325: 'sodium lactate', e330: 'citric acid', e331: 'sodium citrates', e332: 'potassium citrates', e333: 'calcium citrates',
  e334: 'tartaric acid', e338: 'phosphoric acid', e339: 'sodium phosphates', e340: 'potassium phosphates', e341: 'calcium phosphates',
  e401: 'sodium alginate', e406: 'agar', e407: 'carrageenan', e410: 'locust bean gum', e412: 'guar gum', e414: 'gum arabic',
  e415: 'xanthan gum', e418: 'gellan gum', e420: 'sorbitol', e422: 'glycerol', e440: 'pectin', e450: 'diphosphates', e451: 'triphosphates',
  e452: 'polyphosphates', e460: 'cellulose', e461: 'methyl cellulose', e464: 'hydroxypropyl methyl cellulose', e466: 'carboxymethyl cellulose',
  e471: 'mono- and diglycerides of fatty acids', e472e: 'datem', e476: 'pgpr', e481: 'sodium stearoyl lactylate', e500: 'sodium carbonates',
  e501: 'potassium carbonates', e503: 'ammonium carbonates', e504: 'magnesium carbonates', e508: 'potassium chloride', e509: 'calcium chloride',
  e516: 'calcium sulphate', e524: 'sodium hydroxide', e551: 'silicon dioxide', e621: 'monosodium glutamate', e627: 'disodium guanylate',
  e631: 'disodium inosinate', e635: 'disodium ribonucleotides', e901: 'beeswax', e903: 'carnauba wax', e920: 'l-cysteine',
  e950: 'acesulfame k', e951: 'aspartame', e952: 'cyclamate', e954: 'saccharin', e955: 'sucralose', e960: 'steviol glycosides',
  e965: 'maltitol', e967: 'xylitol', e968: 'erythritol', e1422: 'acetylated distarch adipate', e1442: 'hydroxypropyl distarch phosphate'
};
const CLASS_WORDS = /^(emulsifiers?|stabili[sz]ers?|acidity regulators?|preservatives?|antioxidants?|thickeners?|gelling agents?|colou?rs?|sweeteners?|raising agents?|humectants?|firming agents?|anti-?caking agents?|flavour enhancers?|flavor enhancers?|glazing agents?|acids?|acidulants?|bulking agents?|thickening agents?|vitamins?|minerals?)$/;
const SYN = {
  'tomato puree': 'tomato paste', 'tomato concentrate': 'tomato paste', 'double concentrated tomato paste': 'tomato paste', 'tomatoes': 'tomato',
  'chopped tomatoes': 'tomato', 'onions': 'onion', 'onion powder': 'onion', 'dried onion': 'onion', 'garlic puree': 'garlic',
  'garlic powder': 'garlic', 'dried garlic': 'garlic', 'sunflower seed oil': 'sunflower oil', 'soya lecithin': 'lecithins',
  'soy lecithin': 'lecithins', 'sunflower lecithin': 'lecithins', 'lecithin': 'lecithins', 'chili': 'chilli', 'chillies': 'chilli',
  'chilli powder': 'chilli', 'chili powder': 'chilli', 'black pepper': 'pepper', 'cane sugar': 'sugar', 'peppermint': 'mint',
  'spearmint': 'mint', 'peppermint oil': 'mint', 'cocoa mass': 'cocoa', 'cocoa powder': 'cocoa', 'fat reduced cocoa powder': 'cocoa',
  'concentrated lemon juice': 'lemon juice', 'lemon juice from concentrate': 'lemon juice', 'spirit vinegar': 'vinegar',
  'water': 'water', 'salt': 'salt', 'sea salt': 'salt', 'onion extract': 'onion', 'garlic extract': 'garlic'
};
const stripAccents = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
function parseIngredients(text) {
  if (!text) return [];
  let t = stripAccents(String(text)).toLowerCase().replace(/-\s*\n/g, '').replace(/\s*\n\s*/g, ' ');
  const m = t.match(/ingredients?\s*[:\-]?\s*/);
  if (m && m.index < 40) t = t.slice(m.index + m[0].length);
  t = t.split(/\b(?:may contain|allergy advice|for allergens|allergens\s*:|made in a factory|produced in a factory|nutrition|storage|best before|serving suggestion)/)[0];
  t = t.replace(/\d+(?:[.,]\d+)?\s*%/g, ' ').replace(/[*†‡]/g, '').replace(/[\[\]{}()]/g, ',').replace(/[;•·|]/g, ',').replace(/\.(\s|$)/g, ',');
  const out = [], seen = new Set();
  for (let part of t.split(',')) {
    if (part.includes(':')) part = part.split(':').pop();
    let p = part.replace(/\s+/g, ' ').trim()
      .replace(/^(and|contains?|with|from|including)\s+/, '')
      .replace(/^organic\s+/, '').replace(/[.\s\-]+$/, '').trim();
    if (!p || p.length < 2 || /^\d+$/.test(p)) continue;
    p = p.replace(/^e\s?(\d{3,4}[a-z]?)$/, 'e$1');
    if (ENUM[p]) p = ENUM[p];
    if (CLASS_WORDS.test(p)) continue;
    if (!seen.has(p)) { seen.add(p); out.push(p); }
  }
  return out;
}
/* --- PARSER END --- */

function canon(i) {
  let c = SYN[i] || i, guard = 0;
  while (db.aliases[c] && guard++ < 10) c = db.aliases[c];
  return c;
}
function allIngredients() {
  const s = new Set(); db.products.forEach(p => p.ingredients.forEach(i => s.add(canon(i))));
  return [...s].sort();
}

/* ---------------- helpers ---------------- */
function startOfDay(ts) { const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); }
function addDays(ts, n) { const d = new Date(ts); d.setDate(d.getDate() + n); return d.getTime(); }
const fmtTime = ts => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
function fmtDay(ts) {
  const t = startOfDay(Date.now()), d = startOfDay(ts);
  if (d === t) return 'Today'; if (d === addDays(t, -1)) return 'Yesterday';
  return new Date(ts).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
}
function ago(ts) {
  const m = Math.max(0, Math.round((Date.now() - ts) / 60000));
  if (m < 60) return m + ' min'; const h = Math.floor(m / 60);
  if (h < 48) return h + 'h ' + (m % 60) + 'm'; return Math.floor(h / 24) + ' days';
}
function toLocalInput(ts) {
  const d = new Date(ts), p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
const fromLocalInput = v => v ? new Date(v).getTime() : Date.now();
const productLabel = p => p ? (p.brand ? `${p.name} · ${p.brand}` : p.name) : '(deleted item)';
const drinkType = id => DRINKS.find(x => x.id === id) || DRINKS[DRINKS.length - 1];
const flagText = f => FLAGS.filter(([k]) => f && f[k]).map(([, l]) => l.toLowerCase()).join(', ');
function entrySummary(e) {
  const names = (e.items || []).map(id => productLabel(byId(db.products, id)));
  if (e.kind === 'drink' && e.drink) {
    const fl = flagText(e.drink.flags);
    return `${drinkType(e.drink.type).label} ${e.drink.ml} ml${fl ? ' (' + fl + ')' : ''}${names.length ? ' — ' + names.join(', ') : ''}`;
  }
  return names.join(', ') || '(no items)';
}
const sevChip = v => `<span class="chip ${SEVERITY[v].cls}">${SEVERITY[v].label}</span>`;
const pending = () => db.entries.filter(e => !e.checkinId).sort((a, b) => a.ts - b.ts);
function lastUsedMap() {
  const m = {}; db.entries.forEach(e => (e.items || []).forEach(id => { if (!m[id] || m[id] < e.ts) m[id] = e.ts; })); return m;
}
const brands = () => [...new Set(db.products.map(p => p.brand).filter(Boolean))].sort();

let toastTimer;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

/* ---------------- sheets (full-screen modals, Android back closes) ---------------- */
const sheetStack = []; let ignorePop = 0;
function openSheet(title, bodyHtml) {
  const el = document.createElement('div');
  el.className = 'sheet';
  el.innerHTML = `<div class="sheet-head"><button class="icon" data-s="close" aria-label="Close">✕</button><h2>${esc(title)}</h2></div><div class="sheet-body">${bodyHtml}</div>`;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('open'));
  el.addEventListener('click', e => { if (e.target.closest('[data-s="close"]')) closeSheet(el); });
  history.pushState({ sheet: sheetStack.length + 1 }, '');
  sheetStack.push(el);
  return el;
}
function closeSheet(el, fromPop) {
  const i = sheetStack.indexOf(el); if (i < 0) return;
  sheetStack.splice(i, 1);
  el.onClose && el.onClose();
  el.classList.remove('open'); setTimeout(() => el.remove(), 220);
  if (!fromPop) { ignorePop++; history.back(); }
}
window.addEventListener('popstate', () => {
  if (ignorePop > 0) { ignorePop--; return; }
  const top = sheetStack[sheetStack.length - 1]; if (top) closeSheet(top, true);
});

/* ---------------- routing ---------------- */
let tab = 'log', viewDay = startOfDay(Date.now()), insightTab = 'ingredients', cmpA = '', cmpB = '';
function setTab(t) {
  tab = t; $$('.nav button').forEach(b => b.classList.toggle('active', b.dataset.v === t));
  render(); window.scrollTo(0, 0);
}
function render() {
  const m = $('#main'); m.onclick = null; m.onchange = null; m.oninput = null;
  ({ log: renderLog, checkin: renderCheckin, insights: renderInsights, library: renderLibrary, data: renderData })[tab](m);
  const n = pending().length, dot = $('.nav .dot');
  dot.hidden = !n; dot.textContent = n;
}

/* ---------------- LOG ---------------- */
function renderLog(m) {
  const pend = pending(); let html = '';
  if (pend.length) {
    const due = Date.now() - pend[0].ts >= 60 * 60000;
    html += `<button class="banner ${due ? 'due' : ''}" data-act="tab" data-v="checkin"><b>${due ? 'Check-in due' : 'Waiting for a check-in'}</b>
      <span>${pend.length} item${pend.length > 1 ? 's' : ''} · oldest ${ago(pend[0].ts)} ago — tap to rate symptoms</span></button>`;
  }
  html += `<div class="quick"><button class="big" data-act="add-food">+ Food</button><button class="big" data-act="add-drink">+ Drink</button></div>`;
  const isToday = viewDay >= startOfDay(Date.now());
  html += `<div class="daynav"><button data-act="day" data-v="-1" aria-label="Previous day">‹</button><h2>${fmtDay(viewDay)}</h2>
    <button data-act="day" data-v="1" ${isToday ? 'disabled' : ''} aria-label="Next day">›</button></div>`;
  const end = addDays(viewDay, 1);
  const items = [
    ...db.entries.filter(e => e.ts >= viewDay && e.ts < end).map(o => ({ t: o.ts, e: o })),
    ...db.checkins.filter(c => c.ts >= viewDay && c.ts < end).map(o => ({ t: o.ts, c: o }))].sort((a, b) => b.t - a.t);
  html += items.length ? '<ul class="timeline">' + items.map(x => x.e ? entryCard(x.e) : checkinCard(x.c)).join('') + '</ul>'
    : `<p class="empty">Nothing logged${isToday ? ' yet today' : ''}.</p>`;
  m.innerHTML = html;
}
function entryCard(e) {
  const c = e.checkinId && e.checkinId !== 'skipped' ? byId(db.checkins, e.checkinId) : null;
  const status = e.checkinId === 'skipped' ? '<span class="chip muted">skipped</span>'
    : c ? sevChip(c.severity) : '<span class="chip pending">pending</span>';
  return `<li class="card" data-act="entry" data-id="${e.id}"><div class="row"><span class="time">${fmtTime(e.ts)}</span>
    <span>${e.kind === 'food' ? '🍽️' : '🥤'}</span><div class="grow">${esc(entrySummary(e))}</div>${status}</div></li>`;
}
function checkinCard(c) {
  const tags = [...(c.symptoms || []).map(k => (SYMPTOMS.find(s => s[0] === k) || [, k])[1]),
  ...(c.behaviours || []).map(k => (BEHAVIOURS.find(s => s[0] === k) || [, k])[1])];
  return `<li class="card ci" data-act="checkin" data-id="${c.id}"><div class="row"><span class="time">${fmtTime(c.ts)}</span>
    <div class="grow"><b>Check-in</b> <span class="small muted">· ${c.entryIds.length} item${c.entryIds.length === 1 ? '' : 's'}</span>
    ${tags.length ? `<div class="small muted">${esc(tags.join(' · '))}</div>` : ''}</div>${sevChip(c.severity)}</div></li>`;
}

/* ---------------- add food ---------------- */
function addFoodSheet() {
  const items = [];
  const el = openSheet('Log food', `
    <label class="field">When<input type="datetime-local" name="ts" value="${toLocalInput(Date.now())}"></label>
    <div class="label">Items</div><div class="items list"></div>
    <div class="grid2">
      <button class="btn" data-s="scan">📷 Scan barcode</button>
      <button class="btn" data-s="ocr">🔤 Photo of label</button>
      <button class="btn" data-s="lib">📚 From library</button>
      <button class="btn" data-s="new">✏️ Type it in</button>
    </div>
    <button class="btn primary block" data-s="save">Log food</button>`);
  const draw = () => {
    $('.items', el).innerHTML = items.length ? items.map((id, i) => {
      const p = byId(db.products, id);
      return `<div class="item"><div class="grow"><b>${esc(p.name)}</b> <span class="muted">${esc(p.brand || '')}</span>
        <div class="small muted">${p.ingredients.length} ingredient${p.ingredients.length === 1 ? '' : 's'}</div></div>
        <button class="icon" data-s="rm" data-i="${i}" aria-label="Remove">✕</button></div>`;
    }).join('') : '<p class="small muted">Add one or more items — packaged products, or a homemade dish saved with its ingredients.</p>';
  };
  draw();
  const add = p => { if (p && !items.includes(p.id)) { items.push(p.id); draw(); } };
  el.addEventListener('click', async e => {
    const b = e.target.closest('[data-s]'); if (!b) return;
    const s = b.dataset.s;
    if (s === 'scan') add(await scanFlow());
    else if (s === 'ocr') add(await productEditor({}, { autoOcr: true, source: 'ocr' }));
    else if (s === 'lib') add(await libraryPicker());
    else if (s === 'new') add(await productEditor({}));
    else if (s === 'rm') { items.splice(+b.dataset.i, 1); draw(); }
    else if (s === 'save') {
      if (!items.length) return toast('Add at least one item');
      db.entries.push({ id: uid(), ts: fromLocalInput($('[name=ts]', el).value), kind: 'food', items: [...items], drink: null, checkinId: null });
      save(); closeSheet(el); toast('Logged — check in after an hour or two'); render();
    }
  });
}

/* ---------------- add drink ---------------- */
function addDrinkSheet() {
  const d = { type: 'water', ml: 250, flags: {}, productId: null };
  const el = openSheet('Log drink', `
    <label class="field">When<input type="datetime-local" name="ts" value="${toLocalInput(Date.now())}"></label>
    <div class="label">What</div><div class="chips sel types">${DRINKS.map(x => `<button class="chip" data-s="type" data-v="${x.id}">${x.label}</button>`).join('')}</div>
    <div class="label">Contains</div><div class="chips sel flags">${FLAGS.map(([k, l]) => `<button class="chip" data-s="flag" data-v="${k}">${l}</button>`).join('')}</div>
    <div class="label">How much</div>
    <div class="chips sel vols">${VOLUMES.map(v => `<button class="chip" data-s="vol" data-v="${v}">${v} ml</button>`).join('')}<input class="ml" name="ml" type="number" inputmode="numeric" min="10" max="3000" step="10" value="250"> ml</div>
    <div class="small muted">Analysed as small ≤200 ml · medium ≤400 ml · large above that.</div>
    <div class="label">Product <span class="muted small">optional</span></div><div class="prod"></div>
    <div class="grid2"><button class="btn" data-s="scan">📷 Scan</button><button class="btn" data-s="lib">📚 Library</button></div>
    <button class="btn primary block" data-s="save">Log drink</button>`);
  const draw = () => {
    $$('.types .chip', el).forEach(c => c.classList.toggle('on', c.dataset.v === d.type));
    $$('.flags .chip', el).forEach(c => c.classList.toggle('on', !!d.flags[c.dataset.v]));
    $$('.vols .chip', el).forEach(c => c.classList.toggle('on', +c.dataset.v === d.ml));
    $('[name=ml]', el).value = d.ml || '';
    const p = d.productId && byId(db.products, d.productId);
    $('.prod', el).innerHTML = p ? `<div class="item"><div class="grow"><b>${esc(p.name)}</b> <span class="muted">${esc(p.brand || '')}</span></div><button class="icon" data-s="rmprod">✕</button></div>`
      : '<p class="small muted">Attach a scanned product (e.g. a can) to include its ingredients.</p>';
  };
  draw();
  $('[name=ml]', el).addEventListener('input', e => { d.ml = +e.target.value || 0; $$('.vols .chip', el).forEach(c => c.classList.toggle('on', +c.dataset.v === d.ml)); });
  el.addEventListener('click', async e => {
    const b = e.target.closest('[data-s]'); if (!b) return;
    const s = b.dataset.s, v = b.dataset.v;
    if (s === 'type') { d.type = v; d.flags = { ...drinkType(v).f }; }
    else if (s === 'flag') d.flags[v] = d.flags[v] ? 0 : 1;
    else if (s === 'vol') d.ml = +v;
    else if (s === 'scan') { const p = await scanFlow(); if (p) d.productId = p.id; }
    else if (s === 'lib') { const p = await libraryPicker(); if (p) d.productId = p.id; }
    else if (s === 'rmprod') d.productId = null;
    else if (s === 'save') {
      if (!(d.ml > 0)) return toast('Enter a volume');
      db.entries.push({ id: uid(), ts: fromLocalInput($('[name=ts]', el).value), kind: 'drink', items: d.productId ? [d.productId] : [], drink: { type: d.type, ml: d.ml, flags: { ...d.flags } }, checkinId: null });
      save(); closeSheet(el); toast('Drink logged'); render(); return;
    } else return;
    draw();
  });
}

/* ---------------- product editor ---------------- */
function productEditor(p = {}, opts = {}) {
  return new Promise(resolve => {
    const isNew = !p.id;
    const el = openSheet(isNew ? 'New item' : 'Edit item', `
      ${opts.msg ? `<p class="note">${esc(opts.msg)}</p>` : ''}
      <label class="field">Name<input name="name" value="${esc(p.name || '')}" placeholder="e.g. Tomato & basil sauce, or Chickpea curry"></label>
      <label class="field">Brand<input name="brand" value="${esc(p.brand || '')}" placeholder="e.g. Tesco, or Homemade" list="brandlist"></label>
      <datalist id="brandlist">${['Homemade', ...brands()].map(b => `<option value="${esc(b)}">`).join('')}</datalist>
      <label class="field">Barcode <span class="muted small">optional</span><input name="barcode" inputmode="numeric" value="${esc(p.barcode || '')}"></label>
      <label class="field">Ingredients <span class="muted small">comma-separated, as on the label</span><textarea name="ing" rows="5" placeholder="e.g. tomatoes, onion, olive oil, garlic, basil, salt">${esc(p.ingredientsText || '')}</textarea></label>
      <button class="btn" data-s="ocr">🔤 Fill from photo of label</button>
      <div class="ocrstatus small muted" style="margin-top:6px"></div>
      <div class="preview" style="margin-top:8px"></div>
      <div class="row gap">${!isNew ? '<button class="btn danger" data-s="del">Delete</button>' : ''}<button class="btn primary grow" data-s="save">Save</button></div>`);
    let done = false; const finish = v => { if (done) return; done = true; resolve(v); };
    el.onClose = () => finish(null);
    const ta = $('[name=ing]', el);
    const preview = () => {
      const list = parseIngredients(ta.value);
      $('.preview', el).innerHTML = list.length ? `<div class="small muted">${list.length} ingredients detected:</div>` + list.map(i => `<span class="chip">${esc(canon(i))}</span>`).join('') : '';
    };
    ta.addEventListener('input', preview); preview();
    const runOcr = async () => {
      const file = await pickImage(); if (!file) return;
      const st = $('.ocrstatus', el); st.textContent = 'Loading text recognition (first time needs internet)…';
      try {
        const text = await ocrImage(file, pr => st.textContent = `Reading label… ${Math.round(pr * 100)}%`);
        ta.value = cleanOcr(text); preview();
        st.textContent = 'Check and correct the text above — label reading makes mistakes.';
      } catch (err) { st.textContent = 'Could not read the label: ' + (err.message || err); }
    };
    el.addEventListener('click', e => {
      const b = e.target.closest('[data-s]'); if (!b) return;
      if (b.dataset.s === 'ocr') runOcr();
      if (b.dataset.s === 'del') {
        if (!confirm('Delete this item? Past logs that used it will lose it.')) return;
        db.products = db.products.filter(x => x.id !== p.id);
        db.entries.forEach(en => en.items = (en.items || []).filter(id => id !== p.id));
        save(); finish(null); closeSheet(el); render();
      }
      if (b.dataset.s === 'save') {
        const name = $('[name=name]', el).value.trim(); if (!name) return toast('Give it a name');
        const text = ta.value.trim();
        const rec = isNew ? { id: uid(), created: Date.now(), source: opts.source || 'manual', fat: p.fat ?? null } : byId(db.products, p.id);
        Object.assign(rec, { name, brand: $('[name=brand]', el).value.trim(), barcode: $('[name=barcode]', el).value.replace(/\s/g, ''), ingredientsText: text, ingredients: parseIngredients(text) });
        if (isNew) db.products.push(rec);
        save(); finish(rec); closeSheet(el); render();
      }
    });
    if (opts.autoOcr) runOcr();
  });
}

function libraryPicker() {
  return new Promise(resolve => {
    const el = openSheet('Choose from library', `<input class="search" type="search" placeholder="Search name, brand or ingredient"><div class="list" style="margin-top:10px"></div>`);
    let done = false; const finish = v => { if (done) return; done = true; resolve(v); };
    el.onClose = () => finish(null);
    const lu = lastUsedMap();
    const draw = () => {
      const q = $('.search', el).value.toLowerCase().trim();
      const list = db.products.filter(p => !q || (p.name + ' ' + (p.brand || '') + ' ' + p.ingredients.join(' ')).toLowerCase().includes(q))
        .sort((a, b) => (lu[b.id] || b.created || 0) - (lu[a.id] || a.created || 0));
      $('.list', el).innerHTML = list.length ? list.map(p => `<button class="item" data-s="pick" data-id="${p.id}"><div class="grow"><b>${esc(p.name)}</b> <span class="muted">${esc(p.brand || '')}</span></div><span class="small muted">${p.ingredients.length} ingr.</span></button>`).join('')
        : `<p class="empty">${db.products.length ? 'No matches.' : 'Your library is empty — scan or type in your first item.'}</p>`;
    };
    $('.search', el).addEventListener('input', draw); draw();
    el.addEventListener('click', e => { const b = e.target.closest('[data-s="pick"]'); if (!b) return; finish(byId(db.products, b.dataset.id)); closeSheet(el); });
  });
}

/* ---------------- barcode scanning + Open Food Facts ---------------- */
function scanBarcode() {
  return new Promise(async resolve => {
    const supported = 'BarcodeDetector' in window;
    const el = openSheet('Scan barcode', `
      ${supported ? '<div class="scanner"><video playsinline muted></video><div class="reticle"></div></div><p class="small muted center">Hold the barcode inside the box.</p>'
        : '<p class="note">Live scanning isn\'t available in this browser — type the number printed under the barcode.</p>'}
      <label class="field">Or type the barcode number<input name="code" inputmode="numeric" placeholder="e.g. 5000157024671"></label>
      <button class="btn primary block" data-s="use">Use this number</button>`);
    let stream, timer, done = false;
    const stop = () => { clearInterval(timer); if (stream) stream.getTracks().forEach(t => t.stop()); };
    const finish = v => { if (done) return; done = true; stop(); resolve(v); };
    el.onClose = () => finish(null);
    el.addEventListener('click', e => {
      if (!e.target.closest('[data-s="use"]')) return;
      const v = $('[name=code]', el).value.replace(/\D/g, '');
      if (v.length < 6) return toast('That doesn\'t look like a barcode');
      finish(v); closeSheet(el);
    });
    if (!supported) return;
    try {
      const det = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] });
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } }, audio: false });
      if (done) { stop(); return; }
      const v = $('video', el); v.srcObject = stream; await v.play();
      let busy = false;
      timer = setInterval(async () => {
        if (busy || done || v.readyState < 2) return; busy = true;
        try {
          const r = await det.detect(v);
          if (r.length && !done) { if (navigator.vibrate) navigator.vibrate(60); finish(r[0].rawValue); closeSheet(el); }
        } catch (e) { }
        busy = false;
      }, 200);
    } catch (err) {
      const sc = $('.scanner', el);
      if (sc) sc.insertAdjacentHTML('afterend', `<p class="note">Camera unavailable (${esc(err.message || err.name)}). Check camera permission, or type the number.</p>`);
    }
  });
}
async function lookupOFF(code) {
  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=product_name,product_name_en,brands,ingredients_text_en,ingredients_text,nutriments`;
  const r = await fetch(url); if (!r.ok) return null;
  const j = await r.json(); if (!j.product || j.status === 0) return null;
  const p = j.product;
  return {
    name: p.product_name_en || p.product_name || '', brand: (p.brands || '').split(',')[0].trim(),
    ingredientsText: p.ingredients_text_en || p.ingredients_text || '',
    fat: p.nutriments && typeof p.nutriments.fat_100g === 'number' ? p.nutriments.fat_100g : null
  };
}
async function scanFlow() {
  const code = await scanBarcode(); if (!code) return null;
  const existing = db.products.find(p => p.barcode === code);
  if (existing) { toast('Already in your library'); return existing; }
  toast('Looking up product…');
  let info = null; try { info = await lookupOFF(code); } catch (e) { }
  if (info && info.ingredientsText) return productEditor({ ...info, barcode: code }, { source: 'off', msg: 'Found on Open Food Facts — check it looks right, then save.' });
  return productEditor({ ...(info || {}), barcode: code }, {
    source: 'ocr', msg: info ? 'Found the product, but it has no ingredient list online. Tap "Fill from photo of label" or type them in.'
      : 'Not found on Open Food Facts (or you\'re offline). Tap "Fill from photo of label" or type the ingredients in.'
  });
}

/* ---------------- OCR (Tesseract.js, on-device) ---------------- */
let tessLoading = null;
function loadTesseract() {
  if (window.Tesseract) return Promise.resolve();
  return tessLoading || (tessLoading = new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
    s.onload = res; s.onerror = () => { tessLoading = null; rej(new Error('could not load the text recogniser — are you online?')); };
    document.head.appendChild(s);
  }));
}
function pickImage() {
  return new Promise(res => {
    const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*';
    i.onchange = () => res(i.files[0] || null); i.click();
  });
}
async function ocrImage(file, onProgress) {
  await loadTesseract();
  const img = await createImageBitmap(file);
  const scale = Math.min(1, 2200 / Math.max(img.width, img.height));
  const c = document.createElement('canvas'); c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
  const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0, c.width, c.height);
  const d = ctx.getImageData(0, 0, c.width, c.height), a = d.data;
  for (let i = 0; i < a.length; i += 4) { // greyscale + contrast boost
    let g = 0.299 * a[i] + 0.587 * a[i + 1] + 0.114 * a[i + 2];
    g = (g - 128) * 1.4 + 128; g = g < 0 ? 0 : g > 255 ? 255 : g;
    a[i] = a[i + 1] = a[i + 2] = g;
  }
  ctx.putImageData(d, 0, 0);
  const { data } = await Tesseract.recognize(c, 'eng', { logger: m => { if (m.status === 'recognizing text') onProgress(m.progress); } });
  return data.text;
}
function cleanOcr(t) {
  t = t.replace(/-\s*\n/g, '').replace(/\s*\n\s*/g, ' ').replace(/\s{2,}/g, ' ').trim();
  const m = t.match(/ingredients?\s*[:\-]?\s*/i);
  return m ? t.slice(m.index) : t;
}

/* ---------------- CHECK-IN ---------------- */
let ci = { severity: null, symptoms: new Set(), behaviours: new Set(), exclude: new Set(), note: '' };
function renderCheckin(m) {
  const pend = pending();
  m.innerHTML = `<h1>Symptom check-in</h1>
    ${pend.length ? `<div class="label">Covering these <span class="muted small">untick any that don't apply</span></div>
      <div class="list">${pend.map(e => `<label class="item check"><input type="checkbox" data-c="ex" value="${e.id}" ${ci.exclude.has(e.id) ? '' : 'checked'}>
      <div class="grow">${e.kind === 'food' ? '🍽️' : '🥤'} ${esc(entrySummary(e))}<div class="small muted">${fmtDay(e.ts)} ${fmtTime(e.ts)} · ${ago(e.ts)} ago</div></div></label>`).join('')}</div>`
      : '<p class="note">Nothing is waiting for a check-in. You can still record how you feel.</p>'}
    <div class="label">How is your reflux now?</div>
    <div class="sev">${SEVERITY.map(s => `<button class="sevbtn ${s.cls} ${ci.severity === s.v ? 'on' : ''}" data-c="sev" data-v="${s.v}">${s.label}</button>`).join('')}</div>
    <div class="label">Symptoms <span class="muted small">optional</span></div>
    <div class="chips sel">${SYMPTOMS.map(([k, l]) => `<button class="chip ${ci.symptoms.has(k) ? 'on' : ''}" data-c="sym" data-v="${k}">${l}</button>`).join('')}</div>
    <div class="label">Looking back, did any of these happen?</div>
    <div class="chips sel">${BEHAVIOURS.map(([k, l]) => `<button class="chip ${ci.behaviours.has(k) ? 'on' : ''}" data-c="beh" data-v="${k}">${l}</button>`).join('')}</div>
    <label class="field">Note<textarea name="note" rows="2" placeholder="Anything else worth remembering">${esc(ci.note)}</textarea></label>
    <label class="field">Time of check-in<input type="datetime-local" name="ts" value="${toLocalInput(Date.now())}"></label>
    <button class="btn primary block" data-c="save">Save check-in</button>`;
  m.onchange = e => { if (e.target.dataset.c === 'ex') e.target.checked ? ci.exclude.delete(e.target.value) : ci.exclude.add(e.target.value); };
  m.oninput = e => { if (e.target.name === 'note') ci.note = e.target.value; };
  m.onclick = e => {
    const b = e.target.closest('[data-c]'); if (!b || b.dataset.c === 'ex') return;
    const k = b.dataset.c, v = b.dataset.v;
    if (k === 'sev') { ci.severity = +v; $$('.sevbtn', m).forEach(x => x.classList.toggle('on', +x.dataset.v === ci.severity)); }
    else if (k === 'sym' || k === 'beh') {
      const set = k === 'sym' ? ci.symptoms : ci.behaviours;
      set.has(v) ? set.delete(v) : set.add(v); b.classList.toggle('on', set.has(v));
    } else if (k === 'save') {
      if (ci.severity === null) return toast('Pick how your reflux is');
      const entryIds = pend.filter(x => !ci.exclude.has(x.id)).map(x => x.id);
      const c = { id: uid(), ts: fromLocalInput($('[name=ts]', m).value), severity: ci.severity, symptoms: [...ci.symptoms], behaviours: [...ci.behaviours], note: ci.note.trim(), entryIds };
      db.checkins.push(c); entryIds.forEach(id => byId(db.entries, id).checkinId = c.id);
      save(); ci = { severity: null, symptoms: new Set(), behaviours: new Set(), exclude: new Set(), note: '' };
      toast('Check-in saved'); viewDay = startOfDay(Date.now()); setTab('log');
    }
  };
}

/* ---------------- entry / check-in detail sheets ---------------- */
function entrySheet(e) {
  if (!e) return;
  const c = e.checkinId && e.checkinId !== 'skipped' ? byId(db.checkins, e.checkinId) : null;
  const el = openSheet(e.kind === 'food' ? 'Food' : 'Drink', `
    <label class="field">When<input type="datetime-local" name="ts" value="${toLocalInput(e.ts)}"></label>
    <div class="list">
      ${e.kind === 'drink' ? `<div class="item">🥤 ${esc(drinkType(e.drink.type).label)} · ${e.drink.ml} ml${flagText(e.drink.flags) ? ' · ' + esc(flagText(e.drink.flags)) : ''}</div>` : ''}
      ${(e.items || []).map(id => { const p = byId(db.products, id); return p ? `<button class="item" data-s="prod" data-id="${p.id}"><div class="grow"><b>${esc(p.name)}</b> <span class="muted">${esc(p.brand || '')}</span><div class="small muted">${esc(p.ingredients.map(canon).join(', ') || 'no ingredients listed')}</div></div></button>` : ''; }).join('')}
    </div>
    <p class="small muted">${c ? `Rated ${SEVERITY[c.severity].label} at ${fmtTime(c.ts)}` : e.checkinId === 'skipped' ? 'Check-in skipped — excluded from insights.' : 'Waiting for a check-in.'}</p>
    <div class="row gap"><button class="btn danger" data-s="del">Delete</button>
      ${!e.checkinId ? '<button class="btn" data-s="skip">Skip check-in</button>' : ''}
      ${e.checkinId === 'skipped' ? '<button class="btn" data-s="unskip">Back to pending</button>' : ''}
      <button class="btn primary grow" data-s="save">Save</button></div>`);
  el.addEventListener('click', async ev => {
    const b = ev.target.closest('[data-s]'); if (!b) return;
    const s = b.dataset.s;
    if (s === 'prod') { await productEditor(byId(db.products, b.dataset.id)); return; }
    if (s === 'del') {
      if (!confirm('Delete this entry?')) return;
      db.entries = db.entries.filter(x => x.id !== e.id);
      db.checkins.forEach(k => k.entryIds = k.entryIds.filter(id => id !== e.id));
    }
    if (s === 'skip') e.checkinId = 'skipped';
    if (s === 'unskip') e.checkinId = null;
    if (s === 'save') e.ts = fromLocalInput($('[name=ts]', el).value);
    if (s !== 'close') { save(); closeSheet(el); render(); }
  });
}
function checkinSheet(c) {
  if (!c) return;
  const names = (arr, list) => (arr || []).map(k => (list.find(x => x[0] === k) || [, k])[1]).join(', ') || '—';
  const el = openSheet('Check-in', `
    <p>${sevChip(c.severity)} <span class="muted">${fmtDay(c.ts)} ${fmtTime(c.ts)}</span></p>
    <div class="label">Symptoms</div><p>${esc(names(c.symptoms, SYMPTOMS))}</p>
    <div class="label">Behaviours</div><p>${esc(names(c.behaviours, BEHAVIOURS))}</p>
    ${c.note ? `<div class="label">Note</div><p>${esc(c.note)}</p>` : ''}
    <div class="label">Covered</div><div class="list">${c.entryIds.map(id => byId(db.entries, id)).filter(Boolean).map(e => `<div class="item">${e.kind === 'food' ? '🍽️' : '🥤'} ${esc(entrySummary(e))} <span class="small muted">${fmtTime(e.ts)}</span></div>`).join('') || '<p class="small muted">Nothing.</p>'}</div>
    <button class="btn danger block" data-s="del">Delete check-in</button>
    <p class="small muted">Deleting puts its items back in the pending list.</p>`);
  el.addEventListener('click', ev => {
    if (!ev.target.closest('[data-s="del"]')) return;
    if (!confirm('Delete this check-in?')) return;
    db.entries.forEach(e => { if (e.checkinId === c.id) e.checkinId = null; });
    db.checkins = db.checkins.filter(x => x.id !== c.id);
    save(); closeSheet(el); render();
  });
}

/* ---------------- INSIGHTS ---------------- */
function featuresFor(c) {
  const f = new Set();
  for (const eid of c.entryIds) {
    const e = byId(db.entries, eid); if (!e) continue;
    for (const pid of e.items || []) {
      const p = byId(db.products, pid); if (!p) continue;
      f.add('prod:' + p.id);
      p.ingredients.forEach(i => f.add('ing:' + canon(i)));
      if (p.fat != null && p.fat > HIGH_FAT) f.add('nut:highfat');
    }
    if (e.kind === 'drink' && e.drink) {
      f.add('drink:' + e.drink.type); f.add('dv:' + e.drink.type + ':' + volBucket(e.drink.ml));
      for (const k in e.drink.flags) if (e.drink.flags[k]) f.add('flag:' + k);
    }
  }
  (c.behaviours || []).forEach(b => f.add('beh:' + b));
  return f;
}
function computeStats() {
  const cs = db.checkins.filter(c => c.entryIds && c.entryIds.length);
  const rows = new Map(); let sumAll = 0;
  cs.forEach(c => {
    sumAll += c.severity;
    for (const k of featuresFor(c)) {
      let r = rows.get(k); if (!r) rows.set(k, r = { key: k, n: 0, sum: 0, bad: 0 });
      r.n++; r.sum += c.severity; if (c.severity >= 2) r.bad++;
    }
  });
  for (const r of rows.values()) {
    r.mean = r.sum / r.n; const an = cs.length - r.n;
    r.absMean = an ? (sumAll - r.sum) / an : null;
    r.diff = r.absMean == null ? 0 : r.mean - r.absMean;
  }
  return { total: cs.length, mean: cs.length ? sumAll / cs.length : 0, rows };
}
function statRow(r, label, act) {
  const w = Math.min(Math.abs(r.diff) / 2, 1) * 50;
  const cls = r.diff > 0.05 ? 'worse' : r.diff < -0.05 ? 'better' : '';
  const few = r.n < 3;
  return `<li class="${few ? 'few' : ''}" ${act ? `data-act="${act}" data-id="${esc(r.key)}"` : ''}>
    <div class="lbl">${esc(label)}<span class="small muted"> · ${r.n}×${few ? ' · few' : ''} · ${Math.round(100 * r.bad / r.n)}% mod+</span></div>
    <div class="bar"><span class="${cls}" style="${r.diff >= 0 ? 'left' : 'right'}:50%;width:${w}%"></span></div>
    <div class="num ${cls}">${r.diff >= 0 ? '+' : ''}${r.diff.toFixed(1)}</div></li>`;
}
function statList(st, prefix, labelFn, act) {
  const rows = [...st.rows.values()].filter(r => r.key.startsWith(prefix));
  rows.sort((a, b) => ((b.n >= 3) - (a.n >= 3)) || (b.diff - a.diff) || (b.n - a.n));
  if (!rows.length) return '<p class="empty">No data yet.</p>';
  return '<div class="legend small muted"><span>Item · times · % moderate+</span><span>vs. without it</span></div><ul class="stat">'
    + rows.map(r => statRow(r, labelFn(r.key.slice(prefix.length)), act)).join('') + '</ul>';
}
const behLabel = k => (BEHAVIOURS.find(b => b[0] === k) || [, k])[1];
function renderInsights(m) {
  const st = computeStats();
  const counts = [0, 0, 0, 0]; db.checkins.filter(c => c.entryIds.length).forEach(c => counts[c.severity]++);
  let html = `<h1>Insights</h1>
    <div class="stats"><div><b>${st.total}</b><span>check-ins with food or drink</span></div>
    <div><b>${st.total ? st.mean.toFixed(1) : '–'}</b><span>average severity (0 none – 3 severe)</span></div></div>`;
  if (st.total) html += `<div class="dist">${counts.map(n => `<span style="flex:${n}"></span>`).join('')}</div>
    <div class="small muted">${SEVERITY.map((s, i) => `${s.label} ${counts[i]}`).join(' · ')}</div>`;
  html += `<p class="note">The number on each row is how much worse (+, red) or better (−, green) your symptoms averaged, on the none→severe scale, in check-ins that included it compared with those that didn't. ${st.total < 20 ? '<b>Early days:</b> patterns become trustworthy after roughly 20–30 check-ins.' : ''} Faded rows have fewer than 3 check-ins.</p>`;
  const T = [['ingredients', 'Ingredients'], ['products', 'Products'], ['drinks', 'Drinks'], ['habits', 'Habits'], ['compare', 'Compare']];
  html += `<div class="tabs">${T.map(([k, l]) => `<button class="${insightTab === k ? 'on' : ''}" data-act="itab" data-v="${k}">${l}</button>`).join('')}</div>`;
  if (insightTab === 'ingredients') html += '<p class="small muted">Tap an ingredient to see where it appears or merge duplicates.</p>' + statList(st, 'ing:', k => k, 'ing');
  if (insightTab === 'products') html += statList(st, 'prod:', id => productLabel(byId(db.products, id)), 'prod');
  if (insightTab === 'drinks') html += '<h3>Contents</h3>' + statList(st, 'flag:', k => (FLAGS.find(f => f[0] === k) || [, k])[1])
    + '<h3>Drink type</h3>' + statList(st, 'drink:', k => drinkType(k).label)
    + '<h3>Type × amount</h3>' + statList(st, 'dv:', k => { const [t, b] = k.split(':'); return `${drinkType(t).label} · ${BUCKET_LABEL[b]}`; });
  if (insightTab === 'habits') html += statList(st, 'beh:', behLabel)
    + '<h3>Nutrition</h3>' + statList(st, 'nut:', () => `High-fat product (>${HIGH_FAT} g/100 g)`)
    + '<p class="small muted">Fat content only comes from barcode lookups on Open Food Facts.</p>';
  if (insightTab === 'compare') html += renderCompare(st);
  m.innerHTML = html;
  m.onchange = e => {
    if (e.target.name === 'cmpA') { cmpA = e.target.value; render(); }
    if (e.target.name === 'cmpB') { cmpB = e.target.value; render(); }
  };
}
function renderCompare(st) {
  const prods = [...db.products].sort((a, b) => productLabel(a).localeCompare(productLabel(b)));
  if (prods.length < 2) return '<p class="empty">Add at least two products to compare.</p>';
  const opt = sel => '<option value="">Choose…</option>' + prods.map(p => `<option value="${p.id}" ${p.id === sel ? 'selected' : ''}>${esc(productLabel(p))}</option>`).join('');
  let html = `<p class="small muted">Pick two similar products (e.g. two brands of pasta sauce) to see which ingredients differ.</p>
    <label class="field">Product A<select name="cmpA">${opt(cmpA)}</select></label>
    <label class="field">Product B<select name="cmpB">${opt(cmpB)}</select></label>`;
  const A = byId(db.products, cmpA), B = byId(db.products, cmpB);
  if (!A || !B) return html;
  const score = p => { const r = st.rows.get('prod:' + p.id); return r ? `${sevWord(r.mean)} on average · ${r.n} check-in${r.n === 1 ? '' : 's'}` : 'not rated yet'; };
  const sa = new Set(A.ingredients.map(canon)), sb = new Set(B.ingredients.map(canon));
  const chip = i => {
    const r = st.rows.get('ing:' + i); let cls = '';
    if (r && r.n >= 3) cls = r.diff > 0.3 ? 'worse' : r.diff < -0.3 ? 'better' : '';
    return `<span class="chip ${cls}" data-act="ing" data-id="ing:${esc(i)}">${esc(i)}</span>`;
  };
  const only = (x, y) => [...x].filter(i => !y.has(i));
  const both = [...sa].filter(i => sb.has(i));
  html += `<div class="note"><b>A:</b> ${esc(productLabel(A))} — ${score(A)}<br><b>B:</b> ${esc(productLabel(B))} — ${score(B)}</div>
    <h3>Only in A</h3><div>${only(sa, sb).map(chip).join('') || '<span class="small muted">none</span>'}</div>
    <h3>Only in B</h3><div>${only(sb, sa).map(chip).join('') || '<span class="small muted">none</span>'}</div>
    <h3>In both</h3><div>${both.map(chip).join('') || '<span class="small muted">none</span>'}</div>
    <p class="small muted">Red-outlined ingredients are linked to worse symptoms across all your check-ins (3+ times); green to better.</p>`;
  return html;
}
const sevWord = v => v < 0.5 ? `none (${v.toFixed(1)})` : v < 1.5 ? `mild (${v.toFixed(1)})` : v < 2.5 ? `moderate (${v.toFixed(1)})` : `severe (${v.toFixed(1)})`;
function ingredientSheet(name) {
  const prods = db.products.filter(p => p.ingredients.some(i => canon(i) === name));
  const raw = new Set(); db.products.forEach(p => p.ingredients.forEach(i => { if (canon(i) === name) raw.add(i); }));
  const el = openSheet(name, `
    <p class="small muted">Written on labels as: ${[...raw].map(esc).join(', ') || name}</p>
    <div class="label">In ${prods.length} item${prods.length === 1 ? '' : 's'}</div>
    <div class="list">${prods.map(p => `<div class="item"><b>${esc(p.name)}</b> <span class="muted">${esc(p.brand || '')}</span></div>`).join('')}</div>
    <div class="label">Merge into another ingredient</div>
    <p class="small muted">For two names that mean the same thing (e.g. “tomato puree” and “tomato paste”). Applies to all past and future logs, and can be undone in Library.</p>
    <input name="target" list="inglist" placeholder="Ingredient to merge into">
    <datalist id="inglist">${allIngredients().filter(x => x !== name).map(x => `<option value="${esc(x)}">`).join('')}</datalist>
    <button class="btn primary block" data-s="merge">Merge</button>`);
  el.addEventListener('click', e => {
    if (!e.target.closest('[data-s="merge"]')) return;
    const target = $('[name=target]', el).value.trim().toLowerCase();
    if (!target || target === name) return toast('Choose a different ingredient');
    if (canon(target) === name) return toast('That would create a loop');
    db.aliases[name] = target; save(); closeSheet(el); toast(`Merged into “${target}”`); render();
  });
}

/* ---------------- LIBRARY ---------------- */
let libQuery = '';
function renderLibrary(m) {
  const lu = lastUsedMap();
  const q = libQuery.toLowerCase();
  const list = db.products.filter(p => !q || (p.name + ' ' + (p.brand || '') + ' ' + p.ingredients.join(' ')).toLowerCase().includes(q))
    .sort((a, b) => productLabel(a).localeCompare(productLabel(b)));
  const aliases = Object.entries(db.aliases);
  m.innerHTML = `<h1>Library</h1>
    <div class="row"><input class="grow" type="search" name="q" placeholder="Search ${db.products.length} items" value="${esc(libQuery)}" style="margin:0"><button class="btn primary" data-act="new-product">+ New</button></div>
    <div class="list" style="margin-top:12px">${list.map(p => `<button class="item" data-act="prod" data-id="prod:${p.id}"><div class="grow"><b>${esc(p.name)}</b> <span class="muted">${esc(p.brand || '')}</span>
      <div class="small muted">${p.ingredients.length} ingredients · ${{ off: 'barcode lookup', ocr: 'label photo', manual: 'typed' }[p.source] || p.source}${lu[p.id] ? ' · last ' + fmtDay(lu[p.id]) : ''}</div></div></button>`).join('')
    || `<p class="empty">${db.products.length ? 'No matches.' : 'Items you log are saved here for reuse. For batch-cooked meals, add the dish once as “Homemade” with its ingredients.'}</p>`}</div>
    <h3>Ingredient merges</h3>
    ${aliases.length ? '<div class="list">' + aliases.map(([a, b]) => `<div class="item"><div class="grow">${esc(a)} → <b>${esc(b)}</b></div><button class="icon" data-act="unalias" data-id="${esc(a)}" aria-label="Undo">↺</button></div>`).join('') + '</div>'
      : '<p class="small muted">None yet. Tap an ingredient in Insights to merge duplicates.</p>'}`;
  m.oninput = e => {
    if (e.target.name !== 'q') return;
    libQuery = e.target.value; const pos = e.target.selectionStart; render();
    const i = $('[name=q]', m); i.focus(); i.setSelectionRange(pos, pos);
  };
}

/* ---------------- DATA ---------------- */
function renderData(m) {
  m.innerHTML = `<h1>Your data</h1>
    <p class="note">Everything is stored only on this phone, in this browser. Export a backup now and then — clearing Chrome's site data or uninstalling would erase it.</p>
    <div class="small muted">${db.products.length} items · ${db.entries.length} food/drink entries · ${db.checkins.length} check-ins</div>
    <button class="btn block" data-act="export-json">⬇️ Export backup (JSON)</button>
    <button class="btn block" data-act="import-json">⬆️ Restore from backup</button>
    <button class="btn block" data-act="export-csv">📄 Export check-ins as CSV</button>
    <h3>Install</h3>
    <p class="small muted">In Chrome, tap ⋮ → <b>Add to Home screen</b> (or <b>Install app</b>) so it opens full-screen like an app and works offline. Barcode lookup and the first label photo need internet.</p>
    <h3>Danger zone</h3>
    <button class="btn danger block" data-act="clear-all">Delete all data</button>`;
}
function download(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
const stamp = () => toLocalInput(Date.now()).replace(/[T:]/g, '-');
function exportCsv() {
  const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = [['checkin_time', 'severity', 'severity_label', 'symptoms', 'behaviours', 'note', 'foods', 'drinks', 'ingredients']];
  [...db.checkins].sort((a, b) => a.ts - b.ts).forEach(c => {
    const es = c.entryIds.map(id => byId(db.entries, id)).filter(Boolean);
    const ing = new Set(); es.forEach(e => (e.items || []).forEach(pid => { const p = byId(db.products, pid); if (p) p.ingredients.forEach(i => ing.add(canon(i))); }));
    rows.push([toLocalInput(c.ts).replace('T', ' '), c.severity, SEVERITY[c.severity].label, (c.symptoms || []).join('|'), (c.behaviours || []).join('|'), c.note,
    es.filter(e => e.kind === 'food').map(entrySummary).join(' | '), es.filter(e => e.kind === 'drink').map(entrySummary).join(' | '), [...ing].join('|')]);
  });
  download(`reflux-checkins-${stamp()}.csv`, rows.map(r => r.map(q).join(',')).join('\n'), 'text/csv');
}

/* ---------------- global actions ---------------- */
const ACTIONS = {
  tab: el => setTab(el.dataset.v),
  'add-food': addFoodSheet,
  'add-drink': addDrinkSheet,
  day: el => { viewDay = addDays(viewDay, +el.dataset.v); render(); },
  entry: el => entrySheet(byId(db.entries, el.dataset.id)),
  checkin: el => checkinSheet(byId(db.checkins, el.dataset.id)),
  itab: el => { insightTab = el.dataset.v; render(); },
  ing: el => ingredientSheet(el.dataset.id.slice(4)),
  prod: el => { const p = byId(db.products, el.dataset.id.slice(5)); if (p) productEditor(p); },
  'new-product': () => productEditor({}),
  unalias: el => { delete db.aliases[el.dataset.id]; save(); render(); },
  'export-json': () => download(`reflux-backup-${stamp()}.json`, JSON.stringify(db, null, 1), 'application/json'),
  'export-csv': exportCsv,
  'import-json': async () => {
    const i = document.createElement('input'); i.type = 'file'; i.accept = 'application/json,.json';
    i.onchange = async () => {
      const f = i.files[0]; if (!f) return;
      try {
        const d = JSON.parse(await f.text());
        if (!Array.isArray(d.products) || !Array.isArray(d.entries) || !Array.isArray(d.checkins)) throw new Error('not a Reflux Diary backup');
        if (!confirm(`Replace current data with this backup (${d.checkins.length} check-ins)?`)) return;
        db = Object.assign(blankDb(), d); save(); toast('Backup restored'); render();
      } catch (e) { toast('Could not restore: ' + e.message); }
    };
    i.click();
  },
  'clear-all': () => {
    if (!confirm('Delete ALL data? Export a backup first if unsure.')) return;
    if (!confirm('Really delete everything? This cannot be undone.')) return;
    db = blankDb(); save(); render(); toast('All data deleted');
  }
};
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]'); if (!el) return;
  const fn = ACTIONS[el.dataset.act]; if (fn) fn(el);
});

/* ---------------- boot ---------------- */
render();
setInterval(() => { if (tab === 'log' && !sheetStack.length) render(); }, 60000); // keep "x min ago" fresh
document.addEventListener('visibilitychange', () => { if (!document.hidden && !sheetStack.length) render(); });
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => { });
