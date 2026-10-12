'use strict';
/* ===== Utilità ===== */
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const eur = (n) => (n === null || n === undefined || n === '' || isNaN(n) ? '–' : new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n));
const gid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);
const num = (v) => {
  if (v === '' || v == null) return null;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

/* ===== Formati di bottiglia (in millilitri) ===== */
const SIZES = [
  [187, 'Piccolo', '18,7 cl'], [375, 'Mezza', '37,5 cl'], [500, '', '50 cl'], [620, 'Clavelin', '62 cl'], [700, '', '70 cl'],
  [750, 'Standard', '75 cl'], [1000, 'Litro', '1 L'], [1500, 'Magnum', '1,5 L'], [3000, 'Doppio magnum / Jéroboam', '3 L'],
  [4500, 'Réhoboam', '4,5 L'], [5000, 'Jéroboam bordolese', '5 L'], [6000, 'Mathusalem / Impériale', '6 L'], [9000, 'Salmanazar', '9 L'],
  [12000, 'Balthazar', '12 L'], [15000, 'Nabuchodonosor', '15 L'], [18000, 'Melchior', '18 L'],
];
const sizeMl = (b) => (b && Number(b.size) > 0 ? Number(b.size) : 750);
const volTxt = (ml) => (ml >= 1000 ? String(+(ml / 1000).toFixed(2)).replace('.', ',') + ' L' : String(+(ml / 10).toFixed(1)).replace('.', ',') + ' cl');
function sizeName(ml) { const s = SIZES.find((x) => x[0] === ml); return s ? (s[1] && s[1] !== 'Standard' ? s[1] + ' ' + s[2] : s[2]) : volTxt(ml); }
const sizeShort = (ml) => volTxt(ml).replace(' ', '');
const isStd = (b) => sizeMl(b) === 750;

/* ===== Stato ===== */
let S = { shelves: [], bottles: {} };
let dayOff = 0, tab = 'cantina', q = '', px = null;

let pzone = null, py = 0;
document.addEventListener('pointerdown', (e) => {
  pzone = e.target.closest('.dialwrap') ? 'dial' : e.target.closest('.calwrap') ? 'cal' : null;
  px = pzone ? e.clientX : null; py = e.clientY;
});
document.addEventListener('pointerup', (e) => {
  if (px === null) return;
  const dx = e.clientX - px, dy = e.clientY - py;
  px = null;
  if (Math.abs(dx) <= 40 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
  if (pzone === 'cal') { swallowClick = Date.now(); calShift(dx < 0 ? 1 : -1); return; }
  dayOff += dx < 0 ? 1 : -1; syncCal(); render();
});
let swallowClick = 0;

/* ===== Salvataggio sul telefono (IndexedDB) ===== */
let db;
function openDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('cantina', 1);
    r.onupgradeneeded = () => {
      const d = r.result;
      d.createObjectStore('bottles', { keyPath: 'id' });
      d.createObjectStore('photos');
      d.createObjectStore('kv');
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
function req(store, mode, make) {
  return new Promise((res, rej) => {
    const t = db.transaction(store, mode);
    const r = make(t.objectStore(store));
    t.oncomplete = () => res(r && 'result' in r ? r.result : undefined);
    t.onerror = t.onabort = () => rej(t.error);
  });
}
const dbGet = (store, key) => req(store, 'readonly', (s) => s.get(key));
const dbPut = (store, val, key) => req(store, 'readwrite', (s) => (key === undefined ? s.put(val) : s.put(val, key)));
const dbDel = (store, key) => req(store, 'readwrite', (s) => s.delete(key));

function msg(html) { $('#msg').innerHTML = html ? `<div class="note">${html}</div>` : ''; }

async function persistShelves() {
  render();
  try { await dbPut('kv', S.shelves, 'shelves'); } catch (e) { msg('Salvataggio non riuscito: ' + esc(e.message)); }
}
async function persistBottle(b) {
  S.bottles[b.id] = b;
  render();
  try { await dbPut('bottles', b); } catch (e) { msg('Salvataggio non riuscito: ' + esc(e.message)); }
}
async function removeBottle(id) {
  const gone = S.bottles[id], heir = gone ? siblings(gone)[0] : null;
  delete S.bottles[id];
  render();
  try {
    // se la foto del gruppo era su questa bottiglia, la passo a un'altra uguale
    if (heir) for (const k of ['c', 'f', 'r']) { const ph = await dbGet('photos', id + ':' + k); if (ph && !(await dbGet('photos', heir.id + ':' + k))) await dbPut('photos', ph, heir.id + ':' + k); }
    await dbDel('bottles', id);
    await dbDel('photos', id + ':c');
    await dbDel('photos', id + ':f');
    await dbDel('photos', id + ':r');
  } catch (e) { msg('Eliminazione non riuscita: ' + esc(e.message)); }
}

/* ===== Impostazioni e IA ===== */
const APP_VERSION = '42';
window.addEventListener('unhandledrejection', (e) => { try { const m = (e.reason && e.reason.message) || String(e.reason || ''); if (!m) return; const sc = document.getElementById('scs'); if (sc && document.getElementById('dlg').open) sc.textContent = 'Qualcosa non è andato: ' + m; else if (typeof msg === 'function') msg('Qualcosa non è andato: ' + esc(m)); } catch (_) {} });
const CFG_KEY = 'cantina.cfg';
const DEF = { provider: 'gemini', geminiKey: '', geminiModel: 'gemini-3.1-flash-lite', anthropicKey: '', anthropicModel: 'claude-haiku-5-5', autoDeep: false };
function getCfg() { try { return { ...DEF, ...JSON.parse(localStorage.getItem(CFG_KEY) || '{}') }; } catch (_) { return { ...DEF }; } }
function setCfg(c) { try { localStorage.setItem(CFG_KEY, JSON.stringify(c)); } catch (_) {} }
function errorHint(msg) {
  const m = String(msg || '').toLowerCase();
  if (m.includes('credit balance')) return 'Il credito di Claude è finito o non è ancora stato caricato. Vai su console.anthropic.com › Billing e ricarica (bastano 5 $): poi riprova.';
  if (m.includes('overloaded')) return 'Claude è molto occupato in questo momento: riprova tra qualche minuto.';
  if (m.includes('si azzera')) return 'Il limite gratuito di oggi è finito su tutti i modelli Gemini che l\'app prova. Le bottiglie già aggiornate restano salvate: riprova dopo l\'orario indicato.';
  if (m.includes('api key') || m.includes('api_key') || m.includes('invalid x-api-key') || m.includes('authentication')) return 'La chiave non risulta valida. Controlla di averla copiata tutta, senza spazi, e che sia quella del servizio scelto.';
  if (m.includes('quota') || m.includes('rate') || m.includes('429') || m.includes('resource_exhausted')) return 'Hai raggiunto il limite gratuito del servizio. Riprova tra un minuto o piu tardi.';
  if (m.includes('not found') || m.includes('404') || m.includes('model')) return 'Il modello indicato non e stato trovato. Nelle Impostazioni prova a cambiare il nome del modello.';
  if (m.includes('failed to fetch') || m.includes('load failed') || m.includes('network')) return 'Non riesco a collegarmi al servizio: controlla la connessione internet.';
  return 'Riprova. Se continua, mandami questo messaggio.';
}
function notice(title, body, actions) {
  const d = $('#dlg2');
  d.innerHTML = `<h2>${esc(title)}</h2><p style="font-size:16px;margin:10px 0 14px">${body}</p><div class="acts"></div>`;
  const a = d.querySelector('.acts');
  (actions || [{ t: 'OK' }]).forEach((x) => {
    const b = document.createElement('button');
    b.className = 'btn' + (x.pri ? ' pri' : '');
    b.textContent = x.t;
    b.onclick = () => { d.close(); if (x.fn) x.fn(); };
    a.appendChild(b);
  });
  d.onclose = null;
  if (!d.open) d.showModal();
}
function aiReady() { const c = getCfg(); return !!(c.provider === 'anthropic' ? c.anthropicKey : c.geminiKey); }

/* ===== Gemini: modelli di riserva e limiti gratuiti =====
   Google conta il limite gratuito giornaliero separatamente per ogni modello:
   quando uno finisce, l'app passa da sola al successivo. Il limite al minuto
   invece si aspetta e si riprova. I limiti si azzerano a mezzanotte in California. */
const GEM_MODELS = ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-3.6-flash', 'gemini-3.8-flash', 'gemini-3-flash-preview'];
const GEMX_KEY = 'cantina.gemx';
let aiWaitNote = null; // chi chiama può mostrare "aspetto N secondi"
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function gemModels() { const c = getCfg(); return [c.geminiModel, ...GEM_MODELS].filter((m, i, a) => m && a.indexOf(m) === i); }
function msToReset() {
  try {
    const p = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }).formatToParts(new Date());
    const h = +p.find((x) => x.type === 'hour').value, m = +p.find((x) => x.type === 'minute').value;
    return Math.max(60000, ((24 - h) * 60 - m) * 60000);
  } catch (_) { return 6 * 3600000; }
}
const resetTime = () => new Date(Date.now() + msToReset()).toLocaleString('it-IT', { weekday: 'long', hour: '2-digit', minute: '2-digit' });
function gemx() { try { const o = JSON.parse(localStorage.getItem(GEMX_KEY) || '{}'), n = Date.now(), r = {}; Object.keys(o).forEach((k) => { if (o[k] > n) r[k] = o[k]; }); return r; } catch (_) { return {}; } }
function gemxMark(k, ms) { const o = gemx(); o[k] = Date.now() + (ms || msToReset()); try { localStorage.setItem(GEMX_KEY, JSON.stringify(o)); } catch (_) {} }
function gemxClear() { try { localStorage.removeItem(GEMX_KEY); } catch (_) {} }
// v35: i blocchi salvati prima erano spesso sbagliati (ricerca web non gratuita scambiata per limite giornaliero)
try { if (localStorage.getItem('cantina.gemxv') !== '35') { gemxClear(); localStorage.setItem('cantina.gemxv', '35'); } } catch (_) {}
function gemClassify(status, j) {
  const e = (j && j.error) || {}, m = String(e.message || 'Errore ' + status), ml = m.toLowerCase();
  const det = Array.isArray(e.details) ? e.details : [];
  const qids = det.flatMap((d) => (d.violations || []).map((v) => String(v.quotaId || v.quotaMetric || ''))).join(' ');
  const ri = det.find((d) => d.retryDelay);
  const wait = ri ? parseFloat(ri.retryDelay) || 0 : 0;
  if (status === 429 || e.status === 'RESOURCE_EXHAUSTED' || ml.includes('quota')) {
    const search = /search|ground/i.test(qids + ' ' + m);
    // "limit: 0": la funzione (o il modello) non è proprio inclusa nel piano gratuito, non è un limite che si azzera domani
    const zero = /limit:\s*0\b/.test(ml) || det.some((d) => (d.violations || []).some((v) => String(v.quotaValue) === '0'));
    if (zero) return { kind: 'nofree', m, search };
    if (/perday|per_day|daily/i.test(qids + ' ' + m)) return { kind: 'day', m, search };
    if (wait && wait <= 90) return { kind: 'minute', m, wait, search };
    if (/perminute|per_minute/i.test(qids)) return { kind: 'minute', m, wait: 30, search };
    return { kind: 'day', m, search };
  }
  if (status === 401 || status === 403 || ml.includes('api key') || ml.includes('api_key') || ml.includes('permission')) return { kind: 'key', m };
  if (status === 404 || ml.includes('not found') || (ml.includes('model') && ml.includes('not supported'))) return { kind: 'model', m };
  if (/search|ground/.test(ml) && status === 400) return { kind: 'nosearch', m };
  if (status >= 500) return { kind: 'busy', m };
  return { kind: 'other', m };
}
async function gemCall(body, search) {
  const c = getCfg();
  let last = null, tried = 0, nofreeSearch = false;
  for (const model of gemModels()) {
    const x = gemx();
    if (x[model] || (search && x[model + '|s'])) continue;
    tried++;
    for (let attempt = 0; attempt < 3; attempt++) {
      let r, j;
      try {
        r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent', {
          method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': c.geminiKey }, body: JSON.stringify(body),
        });
        j = await r.json().catch(() => ({}));
      } catch (e) { throw new Error('Failed to fetch: ' + e.message); }
      if (r.ok) return j;
      const k = gemClassify(r.status, j);
      last = k;
      if (k.kind === 'key') throw new Error(k.m);
      if (k.kind === 'minute' && attempt < 2) {
        if (aiWaitNote) aiWaitNote(Math.ceil(k.wait));
        await sleep(k.wait * 1000 + 800);
        continue;
      }
      if (k.kind === 'day' || k.kind === 'minute') gemxMark(k.search && search ? model + '|s' : model, k.kind === 'minute' ? 120000 : 0);
      else if (k.kind === 'model') gemxMark(model, 24 * 3600000);
      else if (k.kind === 'nofree') { gemxMark(k.search && search ? model + '|s' : model, 7 * 24 * 3600000); if (search) nofreeSearch = true; }
      else if (k.kind === 'nosearch') gemxMark(model + '|s', 7 * 24 * 3600000);
      break; // passo al modello successivo
    }
  }
  if (last && last.kind === 'minute') {
    const err = new Error('Gemini chiede di rallentare (limite al minuto, quota). Riprova tra un paio di minuti.');
    err.quota = true;
    throw err;
  }
  if (search && (nofreeSearch || (last && (last.kind === 'nofree' || last.kind === 'nosearch')) || (!tried && gemModels().every((md) => gemx()[md + '|s'])))) {
    const err = new Error('nosearch'); err.nosearch = true; throw err;
  }
  if (!tried || (last && last.kind === 'day')) {
    const err = new Error((search ? 'Ricerca web gratuita di Gemini esaurita' : 'Limite gratuito di Gemini esaurito') + ' per oggi su tutti i modelli (quota). Si azzera ' + resetTime() + '.');
    err.quota = true;
    throw err;
  }
  throw new Error(last ? last.m : 'Nessun modello Gemini disponibile.');
}
function parseJsonLoose(text) {
  const t = String(text || '').replace(/```(?:json)?/gi, '');
  const a = t.indexOf('{'), z = t.lastIndexOf('}');
  if (a < 0 || z < a) return null;
  const s = t.slice(a, z + 1);
  try { return JSON.parse(s); } catch (_) {}
  try { return JSON.parse(s.replace(/[\u0000-\u001f]+/g, ' ').replace(/,\s*([}\]])/g, '$1').replace(/\s*\[\d+(?:,\s*\d+)*\]/g, '')); } catch (_) { return null; }
}

async function aiJson(prompt, image) {
  const c = getCfg();
  let text;
  if (c.provider === 'anthropic') {
    const content = [];
    if (image) content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: image } });
    content.push({ type: 'text', text: prompt });
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': c.anthropicKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({ model: c.anthropicModel, max_tokens: 3000, messages: [{ role: 'user', content }] }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error((j.error && j.error.message) || 'Errore ' + r.status);
    text = (j.content || []).map((x) => x.text || '').join('');
  } else {
    const parts = [{ text: prompt }];
    if (image) parts.push({ inline_data: { mime_type: 'image/jpeg', data: image } });
    const j = await gemCall({ contents: [{ parts }], generationConfig: { temperature: 0.2, responseMimeType: 'application/json' } }, false);
    text = ((((j.candidates || [])[0] || {}).content || {}).parts || []).map((x) => x.text || '').join('');
  }
  const o = parseJsonLoose(text);
  if (!o) throw new Error('La risposta non era nel formato atteso. Riprova.');
  return o;
}

let lastSearchNote = '';
async function aiSearch(prompt, maxUses) {
  const c = getCfg();
  let text = '', links = [];
  if (c.provider === 'anthropic') {
    // ricerca web di Claude: circa 1 centesimo per ricerca, al massimo 4 ricerche per domanda
    let tool = 'web_search_20250305';
    const msgs = [{ role: 'user', content: prompt }];
    const call = () => fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': c.anthropicKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({ model: c.anthropicModel, max_tokens: 6000, tools: [{ type: tool, name: 'web_search', max_uses: maxUses || 3 }], messages: msgs }),
    });
    let all = [];
    for (let turn = 0; turn < 3; turn++) {
      let r = await call(), j = await r.json().catch(() => ({}));
      if (r.status === 400 && turn === 0 && /web_search|tool/i.test((j.error && j.error.message) || '')) { tool = 'web_search_20260209'; r = await call(); j = await r.json().catch(() => ({})); }
      if (!r.ok) throw new Error((j.error && j.error.message) || 'Errore ' + r.status);
      all = all.concat(j.content || []);
      // ricerche lunghe: Claude si ferma a metà ("pause_turn") e va fatto proseguire
      if (j.stop_reason === 'pause_turn') { msgs.push({ role: 'assistant', content: j.content }); continue; }
      if (j.stop_reason === 'max_tokens') lastSearchNote = 'risposta troppo lunga, tagliata';
      break;
    }
    // il testo utile è quello scritto dopo l'ultima ricerca (prima ci sono solo frasi tipo "Cerco...")
    let lastRes = -1; all.forEach((x, i) => { if (x.type === 'web_search_tool_result') lastRes = i; });
    for (let i = 0; i < all.length; i++) {
      const x = all[i];
      if (x.type === 'text' && i > lastRes) text += x.text || '';
      if (x.type === 'web_search_tool_result' && Array.isArray(x.content)) x.content.forEach((y) => y.url && links.push({ t: y.title || y.url, u: y.url }));
    }
    if (!text.trim()) text = all.filter((x) => x.type === 'text').map((x) => x.text || '').join('');
  } else {
    let j;
    try { j = await gemCall({ contents: [{ parts: [{ text: prompt }] }], tools: [{ google_search: {} }], generationConfig: { temperature: 0.2 } }, true); }
    catch (e) {
      if (!e.nosearch && !(e.quota && /ricerca web/i.test(e.message))) throw e;
      // la ricerca web non è nel piano gratuito di Gemini: rispondo con quello che il modello sa già
      j = await gemCall({ contents: [{ parts: [{ text: prompt + '\n\nNota: non puoi navigare sul web in questo momento. Rispondi con le tue conoscenze, senza inventare; dove non sei sicuro dillo. Non citare link.' }] }], generationConfig: { temperature: 0.2 } }, false);
    }
    const cand = (j.candidates || [])[0] || {};
    text = ((cand.content || { parts: [] }).parts || []).map((x) => x.text || '').join('');
    ((cand.groundingMetadata || {}).groundingChunks || []).forEach((g) => g.web && g.web.uri && links.push({ t: g.web.title || g.web.uri, u: g.web.uri }));
  }
  const seen = new Set();
  links = links.filter((l) => /^https?:/.test(l.u) && !seen.has(l.u) && seen.add(l.u)).slice(0, 8);
  if (!text.trim()) throw new Error('Nessun risultato trovato. Riprova.');
  return { text: text.trim(), links };
}
function ratingsPrompt(b) {
  return `Cerca sul web le valutazioni più recenti di questo vino, della stessa annata: ${[b.producer, b.cuvee, b.vintage].filter(Boolean).join(' ')}${b.region ? ' (' + b.region + ')' : ''}.
Fonti da provare: Vivino, CellarTracker, Wine-Searcher, guide e critici, blog di vino, post pubblici (Instagram se raggiungibile).
Scrivi in italiano, senza Markdown, in questo formato:
Prima riga: "Sintesi:" con i punteggi trovati e la fonte accanto (es. "Vivino 4,1/5") e, se emerge, se è pronto da bere.
Poi da 1 a 3 righe, ognuna che inizia con "• " e riguarda UNA recensione recente o un parere recente di QUESTA annata: fonte (e mese/anno se noto), poi una frase breve che riassume con parole tue cosa dice (non copiare il testo).
Regole: riporta solo ciò che trovi davvero nelle fonti, niente punteggi inventati o a memoria. Se per questa annata non trovi nulla, scrivilo chiaramente. Se usi un'altra annata, dillo. Se una fonte non è raggiungibile (Instagram e Vivino spesso lo sono poco), dillo invece di supporre. Non usare Markdown.`;
}

const infoRules = (ml) => `Scrivi in italiano. Non inventare: niente punteggi, premi, date o dati che non conosci con buona certezza; usa stringa vuota o null per ciò che non sai. Se non conosci questo vino in particolare, scrivi informazioni generali su tipo, zona e uve e inizia quel testo con "Indicazione generica:".
Campi informativi:
"producer_info": 2-3 frasi sul produttore (dove si trova, filosofia, stile);
"wine_info": 3-4 frasi sulla cuvée (vinificazione, affinamento, profilo di degustazione);
"vintage_info": 1-2 frasi sull'annata in quella zona;
"drink_text": 1-2 frasi su quando berla, in base a tipo di vino, annata e parere comune di critici e guide: indica la finestra con anni, il picco e se è pronta adesso o da aspettare;
"drink_from" e "drink_to": anni (numeri) di inizio e fine della finestra ideale, oppure null;
"pairing": 3 abbinamenti, in una frase breve;
"price_eur": prezzo indicativo di mercato in euro per una bottiglia nel formato ${sizeName(ml || 750)}, oppure null se incerto;
"grapes": uvaggio con le percentuali se note (es. "Nebbiolo 100%", "Chardonnay 60%, Pinot Noir 40%"); se non è scritto ma è noto per questa cuvée o imposto dal disciplinare scrivilo comunque; null solo se davvero non si sa;
"abv": gradazione alcolica in % (numero) se scritta o nota per questo vino, altrimenti null;
"disgorgement": solo per spumanti metodo classico/Champagne: data di sboccatura (dégorgement) se scritta in etichetta, controetichetta o capsula (es. "03/2022", "Q2 2021"), altrimenti null;
"dosage": solo per spumanti: dosaggio (es. "Extra Brut", "Brut Nature 0 g/l", "Brut 6 g/l") se scritto o noto, altrimenti null.`;

function scanPrompt() {
  return `Questa è la foto di una bottiglia o di un'etichetta di vino. Siamo nel ${new Date().getFullYear()}. Rispondi solo con un oggetto JSON con questi campi:
{"producer":string|null,"cuvee":string|null,"vintage":number|null,"type":"rosso"|"bianco"|"bollicine"|"rosato"|"altro","region":string|null,"barcode":string|null,"box_2d":[ymin,xmin,ymax,xmax]|null,"label_box_2d":[ymin,xmin,ymax,xmax]|null,"quality":"buona"|"scarsa","producer_info":string,"wine_info":string,"vintage_info":string,"drink_text":string,"drink_from":number|null,"drink_to":number|null,"pairing":string,"price_eur":number|null,"size_ml":number|null,"grapes":string|null,"abv":number|null,"disgorgement":string|null,"dosage":string|null}
"size_ml" è la capacità della bottiglia in millilitri se scritta sull'etichetta o riconoscibile con certezza (es. 750, 375, 1500), altrimenti null.
"box_2d" è il rettangolo che contiene la bottiglia intera (o solo l'etichetta se la bottiglia non si vede): quattro numeri interi [ymin, xmin, ymax, xmax] da 0 a 1000, dove 0,0 è l'angolo in alto a sinistra dell'immagine e 1000,1000 quello in basso a destra. "label_box_2d" è il rettangolo stretto della sola etichetta frontale principale (senza collo, capsula o sfondo), nello stesso formato; null se l'etichetta non si vede. Misura con precisione: il ritaglio deve essere centrato sull'etichetta. "quality" è "scarsa" se la foto è sfocata, buia, tagliata o l'etichetta è poco leggibile. "barcode" contiene solo le cifre del codice a barre, se leggibili. Per produttore, cuvée, annata, zona e codice usa null se non li leggi con certezza.
${infoRules(750)}`;
}
function deepPrompt(b) {
  return `Cerca sul web informazioni precise e verificabili su questo vino: produttore ${b.producer || 'non indicato'}, cuvée ${b.cuvee || 'non indicata'}, annata ${b.vintage || 'non indicata'}${b.region ? ', zona ' + b.region : ''}${b.disg ? ', sboccatura ' + b.disg : ''}${b.dosage ? ', dosaggio ' + b.dosage : ''}, formato ${sizeName(b.size || 750)}. Siamo nel ${new Date().getFullYear()}.
Consulta il sito del produttore, guide e riviste, Wine-Searcher, Vivino, CellarTracker, enoteche e case d'asta.
Rispondi SOLO con un oggetto JSON, senza altro testo, con questi campi:
{"type":"rosso"|"bianco"|"bollicine"|"rosato"|"altro"|null,"region":string|null,"grapes":string|null,"abv":number|null,"dosage":string|null,"producer_info":string,"wine_info":string,"vintage_info":string,"drink_text":string,"drink_from":number|null,"drink_to":number|null,"pairing":string,"price_eur":number|null,"price_note":string}
- grapes: uvaggio con percentuali (es. "Sangiovese 100%"), dalla scheda tecnica del produttore se la trovi; dosage solo per spumanti (es. "Extra Brut 3 g/l"); abv gradazione in %.
- producer_info: chi è e dove si trova, filosofia e stile, 2-3 frasi.
- wine_info: vigneto, vinificazione e affinamento, profilo di degustazione, 3-4 frasi.
- vintage_info: com'è stata l'annata nella zona, 1-2 frasi.
- price_eur: prezzo medio di mercato attuale in euro per UNA bottiglia nel formato ${sizeName(b.size || 750)} di QUESTA annata (se trovi solo il prezzo da 75 cl e il formato è diverso, rapportalo e dillo in price_note), preso da Wine-Searcher, aste o enoteche. Non stimarlo a memoria: se non trovi un prezzo per questa annata usa null.
- Per gli spumanti metodo classico tieni conto della data di sboccatura (se indicata) per dire quando berlo: di solito dà il meglio da 1-2 anni dopo la sboccatura.
- price_note: fonte e fascia di prezzo trovate, per esempio "Wine-Searcher: 85-120 €, media 98 €".
Regole: scrivi in italiano. Riporta solo ciò che trovi nelle fonti; per ogni dato che non trovi scrivi "Dato non reperito" invece di inventare. Cita la fonte tra parentesi per i numeri importanti. Se non conosci questo vino in particolare, dillo e inizia il testo con "Indicazione generica:".${skipProd(b)}`;
}
// Se in cantina c'è già un'altra bottiglia dello stesso produttore con la scheda, la riuso: niente da chiedere all'IA
function knownProducerInfo(prod, exceptId) { if (!prod || typeof sameProd !== 'function') return ''; const x = Object.values(S.bottles).find((o) => o.id !== exceptId && o.info && o.producer && sameProd(o.producer, prod)); return x ? x.info : ''; }
const skipProd = (b) => b.knownProd ? '\nIl produttore lo conosco già: lascia "producer_info" come stringa vuota.' : '';
// Solo conoscenze dell'IA, senza ricerca web: costa una frazione di centesimo
async function quickInfo(b) { const j = await aiJson(enrichPrompt(b)); if (j) j.price_eur = null; return { j, links: [], deep: false, quick: true }; }
async function deepInfo(b) {
  let limited = false, why = '';
  try {
    lastSearchNote = '';
    const r = await aiSearch(deepPrompt(b), 2);
    const j = parseJsonLoose(r.text);
    if (j) return { j, links: r.links, deep: true };
    why = lastSearchNote || 'la risposta della ricerca non era leggibile';
  } catch (e) {
    if (/api key|api_key|permission|failed to fetch|network|load failed|credit balance/i.test(e.message)) throw e;
    limited = !!e.quota || /quota|429|exhausted|rate/i.test(e.message);
    why = e.nosearch ? 'Gemini gratuito non include la ricerca web' : e.message;
  }
  const j = await aiJson(enrichPrompt(b));
  if (j) j.price_eur = null;
  return { j, links: [], deep: false, limited, why };
}
function enrichPrompt(b) {
  return `Bottiglia di vino: produttore ${b.producer || 'non indicato'}, cuvée ${b.cuvee || 'non indicata'}, annata ${b.vintage || 'non indicata'}, tipo ${b.type}, formato ${sizeName(b.size || 750)}, zona ${b.region || 'non indicata'}. Siamo nel ${new Date().getFullYear()}. Rispondi solo con un oggetto JSON con questi campi:
{"type":"rosso"|"bianco"|"bollicine"|"rosato"|"altro"|null,"region":string|null,"producer_info":string,"wine_info":string,"vintage_info":string,"drink_text":string,"drink_from":number|null,"drink_to":number|null,"pairing":string,"price_eur":number|null,"grapes":string|null,"abv":number|null,"dosage":string|null}
${infoRules(b.size)}${skipProd(b)}`;
}

/* ===== Calendario biodinamico (dal tuo file) ===== */
function moonLon(d){const T=(d/86400000+2440587.5-2451545)/36525,r=Math.PI/180,L=218.3164477+481267.88123421*T,D=297.8501921+445267.1114034*T,M=357.5291092+35999.0502909*T,Mp=134.9633964+477198.8675055*T,F=93.272095+483202.0175233*T,s=x=>Math.sin(x*r);
  let l=L+6.288774*s(Mp)+1.274027*s(2*D-Mp)+.658314*s(2*D)+.213618*s(2*Mp)-.185116*s(M)-.114332*s(2*F)+.058793*s(2*D-2*Mp)+.057066*s(2*D-M-Mp)+.053322*s(2*D+Mp)+.045758*s(2*D-M);
  l-=1.397*T;return((l%360)+360)%360}
const CONS=[[29.1,'Pesci','foglia'],[53.5,'Ariete','frutto'],[90.4,'Toro','radice'],[118.3,'Gemelli','fiore'],[138.2,'Cancro','foglia'],[174.2,'Leone','frutto'],[217.8,'Vergine','radice'],[241.1,'Bilancia','fiore'],[247.7,'Scorpione','foglia'],[299.7,'Sagittario','frutto'],[327.9,'Capricorno','radice'],[351.6,'Acquario','fiore'],[360,'Pesci','foglia']];
const kind=d=>{const l=moonLon(d);return CONS.find(c=>l<c[0])};
const isGood=k=>k[2]==='frutto'||k[2]==='fiore';
const COL={frutto:'#D9A441',fiore:'#D98BA3',radice:'#8A6B4F',foglia:'#6FA27A'};
const ICO={radice:'<path d="M7.5 8c3-2.2 6-2.2 9 0L12 21z"/><path d="M12 6V2.5M10 6.5 8.5 3.5M14 6.5l1.5-3"/>',fiore:'<circle cx="12" cy="12" r="2"/><circle cx="12" cy="6.8" r="2.8"/><circle cx="16.9" cy="10.4" r="2.8"/><circle cx="14.9" cy="16.1" r="2.8"/><circle cx="9.1" cy="16.1" r="2.8"/><circle cx="7.1" cy="10.4" r="2.8"/>',frutto:'<path d="M12 8c-2-1.5-6-1-6 4 0 4 3 8 6 8s6-4 6-8c0-5-4-5.5-6-4z"/><path d="M12 8c0-2 1-3.5 3-4"/>',foglia:'<path d="M5 19C5 9 11 4 20 4c0 9-5 15-15 15z"/><path d="M5 19 14 10"/>'};
const ic=(t,s,x,y,col)=>`<g transform="translate(${x-s/2} ${y-s/2}) scale(${s/24})" fill="none" style="stroke:${col||'#1E2824'}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${ICO[t]}</g>`;
function dial(){const now=new Date(),b0=new Date();b0.setDate(b0.getDate()+dayOff);const d0=new Date(b0.getFullYear(),b0.getMonth(),b0.getDate()).getTime();
  const pt=(h,R)=>{const a=(h/24*360-90)*Math.PI/180;return[120+R*Math.cos(a),120+R*Math.sin(a)]};
  const segs=[];for(let m=0;m<1440;m+=10){const t=kind(d0+(m+5)*60000)[2],l=segs[segs.length-1];if(l&&l.t===t)l.to=(m+10)/60;else segs.push({t,from:m/60,to:(m+10)/60})}
  let s='';
  segs.forEach(g=>{const a=pt(g.from,108),b=pt(g.to,108),c=pt(g.to,70),e=pt(g.from,70),big=g.to-g.from>12?1:0,ok=g.t==='frutto'||g.t==='fiore';
    s+=g.to-g.from>=23.9?`<circle cx="120" cy="120" r="89" fill="none" stroke="${COL[g.t]}" stroke-opacity="${ok?1:.4}" stroke-width="38"/>`:`<path d="M${a} A108 108 0 ${big} 1 ${b} L${c} A70 70 0 ${big} 0 ${e}Z" fill="${COL[g.t]}" fill-opacity="${ok?1:.4}" style="stroke:var(--bg);stroke-width:2"/>`;
    const L=g.to-g.from;if(L>=1.6){const n=Math.max(1,Math.floor(L/4));for(let i=0;i<n;i++){const m=pt(g.from+(i+.5)*L/n,89);s+=ic(g.t,17,m[0],m[1])}}});
  [0,6,12,18].forEach(h=>{const p=pt(h,57);s+=`<text x="${p[0]}" y="${p[1]}" font-size="10" text-anchor="middle" dominant-baseline="middle" style="fill:var(--mute)">${h}</text>`});
  const today0=dayOff===0,h=now.getHours()+now.getMinutes()/60,p1=pt(h,70),p2=pt(h,113),c=kind(today0?now.getTime():d0+12*3600000),ok=c[2]==='frutto'||c[2]==='fiore';
  s+=!today0?'':`<line x1="${p1[0]}" y1="${p1[1]}" x2="${p2[0]}" y2="${p2[1]}" style="stroke:var(--ink);stroke-width:3"/><circle cx="${p2[0]}" cy="${p2[1]}" r="5" style="fill:var(--ink)"/>`;
  s+=ic(c[2],28,120,92,'var(--ink)')+`<text x="120" y="124" font-size="17" font-weight="600" text-anchor="middle" style="fill:var(--ink)">${today0?c[2][0].toUpperCase()+c[2].slice(1):new Date(d0).toLocaleDateString('it-IT',{weekday:'short',day:'numeric'})}</text><text x="120" y="142" font-size="11" text-anchor="middle" style="fill:var(--mute)">${today0?(ok?'buon giorno':'meglio aspettare'):'a mezzogiorno: '+c[2]}</text>`;
  const leg=['frutto','fiore','radice','foglia'].map(t=>`<span style="display:inline-flex;align-items:center;gap:3px;margin:0 6px"><svg width="18" height="18" viewBox="0 0 18 18"><circle cx="9" cy="9" r="9" fill="${COL[t]}" fill-opacity="${t==='frutto'||t==='fiore'?1:.4}"/>${ic(t,12,9,9)}</svg>${t}</span>`).join('');
  return `<div class="dialwrap" style="touch-action:pan-y"><svg viewBox="0 0 240 240" style="width:100%;max-width:260px;display:block;margin:0 auto" role="img" aria-label="Quadrante del giorno">${s}</svg></div><div class="info" style="text-align:center;margin:6px 0">${leg}</div>`}
function dayStart(o){const b=new Date();b.setDate(b.getDate()+o);return new Date(b.getFullYear(),b.getMonth(),b.getDate()).getTime()}
function dayFrac(d0){let g=0;for(let m=0;m<1440;m+=10)if(isGood(kind(d0+(m+5)*60000)))g++;return g/144}
function nav(){const dt=new Date(dayStart(dayOff)),y=dt.getFullYear()!==new Date().getFullYear();
  const lab=dayOff===0?'Oggi':dayOff===1?'Domani':dayOff===-1?'Ieri':dt.toLocaleDateString('it-IT',{weekday:'long',day:'numeric',month:'long',year:y?'numeric':undefined});
  return `<div class="dnav"><button class="link" data-a="day" data-d="-1" aria-label="Giorno precedente">‹</button><b>${lab}</b><button class="link" data-a="day" data-d="1" aria-label="Giorno successivo">›</button></div>`}
function other(){const d0=dayStart(dayOff),segs=[];for(let m=0;m<1440;m+=10){const t=kind(d0+(m+5)*60000)[2],l=segs[segs.length-1];if(l&&l.t===t)l.to=(m+10)/60;else segs.push({t,from:m/60,to:(m+10)/60})}
  const good=segs.filter(g=>g.t==='frutto'||g.t==='fiore'),hrs=good.reduce((a,g)=>a+g.to-g.from,0),f=h=>{const mm=Math.round(h*60);return String(Math.floor(mm/60)).padStart(2,'0')+':'+String(mm%60).padStart(2,'0')};
  const win=[];good.forEach(g=>{const l=win[win.length-1];if(l&&Math.abs(l[1]-g.from)<.01)l[1]=g.to;else win.push([g.from,g.to])});
  const v=hrs>=12?'Buon giorno per bere':hrs>0?'Giorno misto: bene solo in certi orari':'Giorno da evitare per bere';
  return `<div class="today ${hrs>=12?'good':hrs>0?'':'bad'}">${nav()}${dial()}<p style="text-align:center;margin-top:8px"><b>${v}</b></p><p>${hrs>0?'Orari favorevoli: '+win.map(w=>f(w[0])+'–'+f(w[1])).join(', ')+'.':'Nessun orario favorevole in questa giornata.'}</p><p class="info" style="margin:6px 0 0">Calendario biodinamico, calcolato in modo approssimato.</p></div>`}
function today(){if(dayOff!==0)return other();const now=Date.now(),c=kind(now),good=isGood(c);let n=null;
  for(let i=1;i<=480;i++){const t=now+i*900000,k=kind(t);if(isGood(k)!==good){n={t,k};break}}
  const ready=Object.values(S.bottles).filter(b=>status(b)==='st-now').slice(0,3).map(name);
  return `<div class="today ${good?'good':'bad'}">${nav()}${dial()}<p style="text-align:center;margin-top:8px"><b>${good?'Oggi è un buon giorno per bere':'Oggi non è il giorno migliore per bere'}</b></p><p>La Luna è in ${c[1]}: giorno ${c[2]}. ${good?'Il vino dovrebbe esprimersi al meglio.':'Il vino tende a essere più chiuso.'}${n?` Cambia ${new Date(n.t).toLocaleString('it-IT',{weekday:'long',hour:'2-digit',minute:'2-digit'})}: diventa giorno ${n.k[2]}.`:''}</p>${good&&ready.length?`<p>Pronte da aprire: ${esc(ready.join(', '))}.</p>`:''}<p class="info" style="margin:6px 0 0">Calendario biodinamico (frutto e fiore sì, radice e foglia no), calcolato in modo approssimato: l'orario del cambio può variare di qualche ora.</p></div>`}

/* ===== Schermate ===== */
const imgSrc = (b) => b.thumb || '';
const keyBanner = () => aiReady() || (() => { try { return +localStorage.getItem('cantina.keyLater') > Date.now(); } catch (_) { return false; } })() ? '' : `<div class="note keyban"><b>Lettura automatica spenta.</b> Per leggere le etichette serve la chiave dell'IA.<div class="acts"><button class="btn" data-a="settings">Impostazioni</button><button class="btn" data-a="keylater">Non ora</button></div></div>`;
/* Bottiglie uguali (una cassa) condividono lo stesso wid: le informazioni si aggiornano insieme. */
const inCellar = (b) => !b.drunk && !b.pending && !b.wish;
const widOf = (b) => b.wid || b.id;
function siblings(b) { const w = widOf(b); return Object.values(S.bottles).filter((x) => x.id !== b.id && widOf(x) === w); }
function groupOf(b) { const w = widOf(b); return Object.values(S.bottles).filter((x) => widOf(x) === w); }
const uniqW = (arr) => { const seen = new Set(); return arr.filter((b) => { const w = widOf(b); if (seen.has(w)) return false; seen.add(w); return true; }); };
const SHARED = ['producer', 'cuvee', 'vintage', 'type', 'size', 'region', 'price', 'value', 'valueAuto', 'valueNote', 'drink', 'drinkFrom', 'drinkTo', 'pairing', 'info', 'winfo', 'vinfo', 'prod', 'srcLinks', 'touched', 'thumb', 'useFull', 'barcode', 'aiAt', 'aiDeep', 'buyDate', 'buyWhere', 'buyNote', 'tags', 'tastings', 'grapes', 'abv', 'lot', 'disg', 'dosage'];
async function syncGroup(nb) {
  for (const x of siblings(nb)) {
    const y = { ...x };
    SHARED.forEach((k) => { if (k in nb) y[k] = nb[k]; else delete y[k]; });
    await persistBottle(y);
  }
}
// La foto di un gruppo è salvata una volta sola, sotto una delle bottiglie.
async function photoOf(b, s) {
  for (const x of [b, ...siblings(b)]) { const p = await dbGet('photos', x.id + ':' + s); if (p) return p; }
  return null;
}
// Degustazioni del vino: quelle salvate più le bottiglie bevute del gruppo (anche dati vecchi).
function tastingsOf(b) {
  const out = [], seen = new Set();
  const add = (t) => { if (!t || !t.date) return; const k = t.date + '|' + (t.rating || 0) + '|' + (t.notes || ''); if (seen.has(k)) return; seen.add(k); out.push(t); };
  groupOf(b).forEach((x) => (x.tastings || []).forEach(add));
  groupOf(b).forEach((x) => { if (x.drunk) add({ ...x.drunk, drunk: true }); });
  return out;
}
let placeQ = [];
function name(b) { return [b.producer, b.cuvee].filter(Boolean).join(' ') || 'Bottiglia senza nome'; }
function posMap() { const m = {}; Object.values(S.bottles).forEach((b) => { if (b.shelf && inCellar(b)) m[b.shelf + '|' + b.r + '|' + b.c] = b; }); return m; }
function posText(b) { const s = S.shelves.find((x) => x.id === b.shelf); return s ? `${s.name}, riga ${b.r + 1}, posto ${b.c + 1}` : 'Da posizionare'; }
function status(b) {
  let a = b.drinkFrom, z = b.drinkTo;
  if (!(a && z)) {
    const ys = (b.drink || '').match(/(?:19|20)\d\d/g);
    if (!ys || ys.length < 2) return '';
    a = Math.min(...ys); z = Math.max(...ys);
  }
  const y = new Date().getFullYear();
  return y < a ? 'st-wait' : y > z ? 'st-past' : 'st-now';
}

function render() {
  if (typeof killMap === 'function') killMap();
  const all = Object.values(S.bottles);
  const bs = all.filter((b) => inCellar(b));
  const spent = bs.reduce((a, b) => a + (b.price || 0), 0);
  const val = bs.reduce((a, b) => a + (b.value ?? b.price ?? 0), 0);
  // intestazione: ogni sezione ha il suo titolo; il riepilogo solo in Cantina
  const nW = uniqW(bs).length, gain = spent ? Math.round(((val - spent) / spent) * 100) : 0;
  const c0 = kind(Date.now());
  const H = {
    cantina: ['Cantina', new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })],
    lista: ['Elenco', bs.length + (bs.length === 1 ? ' bottiglia' : ' bottiglie') + ' · ' + nW + (nW === 1 ? ' vino' : ' vini')],
    stasera: ['Sommelier', (typeof mealLabel === 'function' ? mealLabel() : 'Oggi') + ' · giorno ' + c0[2]],
    calici: ['Calici', GLASSES.length ? GLASSES.length + (GLASSES.length === 1 ? ' calice' : ' calici') : 'I tuoi bicchieri'],
    luna: ['Luna', 'Calendario biodinamico'],
    stats: ['Statistiche', '‹ Cantina', 'cantina'],
    mappa: ['Mappa', 'Dove nascono i tuoi vini'],
  }[tab] || ['Cantina', ''];
  $('#ptitle').textContent = H[0];
  const eb = $('#eyebrow');
  eb.textContent = H[1];
  if (H[2]) { eb.dataset.a = 'tab'; eb.dataset.t = H[2]; eb.classList.add('back'); eb.tabIndex = 0; } else { delete eb.dataset.a; eb.classList.remove('back'); eb.tabIndex = -1; }
  document.body.dataset.tab = tab;
  $('#tot').innerHTML = tab === 'cantina' && all.length ? `<button class="sumc" data-a="tab" data-t="stats"><span class="sum-l"><small>Valore della cantina</small><b>${eur(val)}${spent && gain ? ` <i class="${gain >= 0 ? 'up' : 'down'}">${gain >= 0 ? '+' : ''}${gain}%</i>` : ''}</b><small>${bs.length} ${bs.length === 1 ? 'bottiglia' : 'bottiglie'} · ${nW} ${nW === 1 ? 'vino' : 'vini'} · speso ${eur(spent)}</small></span><span class="sum-r">Statistiche ›</span></button>` : '';
  const navT = tab === 'stats' ? 'cantina' : tab;
  document.querySelectorAll('nav [data-t]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.t === navT));
  const pages = { cantina, lista: () => lista(all), stasera, mappa, luna, stats, calici: caliciPage };
  $('#app').innerHTML = (pages[tab] || cantina)();
  if (tab === 'mappa') setTimeout(initMap, 0);
}

let moving = null;
function moveTo(id, sh, r, c) {
  const m = S.bottles[id];
  if (!m) return;
  const b = posMap()[sh + '|' + r + '|' + c];
  if (b && b.id === m.id) return;
  const from = { shelf: m.shelf, r: m.r, c: m.c };
  const snap = snapIds(b ? [m.id, b.id] : [m.id]);
  if (b) persistBottle({ ...b, shelf: from.shelf, r: from.r, c: from.c });
  persistBottle({ ...m, shelf: sh, r, c });
  haptic();
  showUndo(b ? 'Bottiglie scambiate di posto' : 'Bottiglia spostata', snap);
}
let justDragged = 0;
(function dragSetup() {
  let timer = null, st = null, ghost = null, hot = null;
  const cellAt = (x, y) => { const el = document.elementFromPoint(x, y); return el && el.closest ? el.closest('.cell[data-a="slot"]') : null; };
  const clear = () => { clearTimeout(timer); timer = null; if (ghost) ghost.remove(); ghost = null; if (hot) hot.classList.remove('hot'); hot = null; if (st && st.cell) st.cell.classList.remove('lift'); st = null; };
  document.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) { clear(); return; }
    const cell = e.target.closest && e.target.closest('.cell[data-a="slot"]');
    if (!cell || moving) return;
    const b = posMap()[cell.dataset.s + '|' + cell.dataset.r + '|' + cell.dataset.c];
    if (!b) return;
    const t = e.touches[0];
    st = { id: b.id, cell, x: t.clientX, y: t.clientY, on: false };
    timer = setTimeout(() => {
      if (!st) return;
      st.on = true;
      cell.classList.add('lift');
      const dot = cell.querySelector('.dot');
      const rc = dot.getBoundingClientRect();
      ghost = dot.cloneNode(true);
      ghost.className += ' ghost';
      ghost.style.width = rc.width + 'px'; ghost.style.height = rc.height + 'px';
      ghost.style.left = (st.x - rc.width / 2) + 'px'; ghost.style.top = (st.y - rc.height / 2) + 'px';
      document.body.appendChild(ghost);
      try { navigator.vibrate && navigator.vibrate(30); } catch (_) {}
    }, 420);
  }, { passive: true });
  document.addEventListener('touchmove', (e) => {
    if (!st) return;
    const t = e.touches[0];
    if (!st.on) { if (Math.hypot(t.clientX - st.x, t.clientY - st.y) > 10) clear(); return; }
    e.preventDefault();
    st.x = t.clientX; st.y = t.clientY;
    const w = ghost.offsetWidth;
    ghost.style.left = (t.clientX - w / 2) + 'px'; ghost.style.top = (t.clientY - w / 2) + 'px';
    if (t.clientY < 90) window.scrollBy(0, -12); else if (t.clientY > innerHeight - 90) window.scrollBy(0, 12);
    const c = cellAt(t.clientX, t.clientY);
    if (hot && hot !== c) hot.classList.remove('hot');
    hot = c; if (c) c.classList.add('hot');
  }, { passive: false });
  const end = (e) => {
    if (!st) return;
    if (st.on) {
      const t = (e.changedTouches && e.changedTouches[0]) || { clientX: st.x, clientY: st.y };
      const c = e.type === 'touchcancel' ? null : cellAt(t.clientX, t.clientY);
      const id = st.id;
      justDragged = Date.now();
      clear();
      if (c) moveTo(id, c.dataset.s, +c.dataset.r, +c.dataset.c);
      e.preventDefault && e.cancelable && e.preventDefault();
      return;
    }
    clear();
  };
  document.addEventListener('touchend', end, { passive: false });
  document.addEventListener('touchcancel', end, { passive: false });
})();
function cantina() {
  const pm = posMap();
  let h = S.shelves.map((s) => {
    let cells = '', used = 0;
    for (let r = 0; r < s.rows; r++) for (let c = 0; c < s.cols; c++) {
      const b = pm[s.id + '|' + r + '|' + c];
      if (b) used++;
      const has = b && imgSrc(b);
      const lbl = b ? `<span class="lbl"><b>${esc(b.producer || name(b))}</b>${b.producer && b.cuvee ? `<i>${esc(b.cuvee)}</i>` : ''}</span>` : '';
      cells += `<button class="cell${b && b.id === moving ? ' mv' : ''}" data-a="slot" data-s="${esc(s.id)}" data-r="${r}" data-c="${c}" title="${esc(b ? name(b) + ' ' + (b.vintage || '') + (isStd(b) ? '' : ' · ' + sizeName(sizeMl(b))) : 'Posto libero')}" aria-label="${esc(b ? name(b) : 'Posto libero')}"><span class="dot ${b ? 't-' + esc(b.type) : ''} ${b ? status(b) : ''}${has ? ' has' : ''}"${has ? ` style="background-image:url('${imgSrc(b)}')"` : ''}>${b ? `<span class="vin">${esc(b.vintage || '')}</span>` : ''}${b && !isStd(b) ? `<span class="fmt">${esc(sizeShort(sizeMl(b)))}</span>` : ''}${b && status(b) ? `<span class="sdot ${status(b)}"></span>` : ''}</span>${lbl}</button>${c === s.cols - 1 ? '<i class="plank"></i>' : ''}`;
    }
    const tot = s.rows * s.cols;
    return `<section class="shelf"><header><h2>${esc(s.name)} <small class="free">${used} di ${tot}${tot - used ? ' · ' + (tot - used === 1 ? '1 posto libero' : (tot - used) + ' liberi') : ' · pieno'}</small></h2><button class="link" data-a="editShelf" data-id="${esc(s.id)}">Modifica</button></header><div class="grid" style="--c:${s.cols}">${cells}</div></section>`;
  }).join('');
  if (!S.shelves.length) h = `<p class="empty">Nessuno scaffale. Crea il primo, poi tocca un posto libero per inserire una bottiglia.</p>`;
  const loose = Object.values(S.bottles).filter((b) => !b.shelf && inCellar(b)).length;
  placeQ = placeQ.filter((id) => S.bottles[id] && inCellar(S.bottles[id]) && !S.bottles[id].shelf);
  const pq = placeQ.length ? `<div class="note place"><b>Posiziona ${placeQ.length === 1 ? 'l\'ultima bottiglia' : 'le ' + placeQ.length + ' bottiglie'}: ${esc(name(S.bottles[placeQ[0]]))}</b><br>Tocca i posti liberi uno dopo l'altro.<div class="acts"><button class="btn" data-a="placeStop">Le posiziono dopo</button></div></div>` : '';
  const mvb = moving && S.bottles[moving] ? `<div class="note"><b>Sposta: ${esc(name(S.bottles[moving]))}</b><br>Tocca il nuovo posto. Se è occupato, le due bottiglie si scambiano.<div class="acts"><button class="btn" data-a="unplace">Togli dallo scaffale</button><button class="btn" data-a="cancelMove">Annulla</button></div></div>` : '';
  return pq + mvb + (typeof cloudBanner === 'function' ? cloudBanner() : '') + keyBanner() + moonChip() + h + '<div class="legend"><span><i class="lg st-now"></i>Pronta da bere</span><span><i class="lg st-wait"></i>Da aspettare</span><span><i class="lg st-past"></i>Oltre il picco</span></div>' + (loose ? `<p class="info">${loose} bottiglie da posizionare: tocca un posto libero per sceglierle.</p>` : '') + `<button class="btn" data-a="newShelf">Nuovo scaffale</button>`;
}

const nrm = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
let fltSheetHtml = () => '';
let flt = { view: 'in', type: '', stat: '', region: '', vint: '', size: '', tag: '', sort: 'az' };
const tagsOf = (b) => (Array.isArray(b.tags) ? b.tags : []);
function posSummary(g) {
  const m = new Map();
  g.forEach((b) => { const s = S.shelves.find((x) => x.id === b.shelf); const k = s ? s.name : 'da posizionare'; m.set(k, (m.get(k) || 0) + 1); });
  return [...m.entries()].map(([k, n]) => k + (n > 1 ? ' (' + n + ')' : '')).join(', ');
}
function lista(all) {
  const V = flt.view, drunkView = V === 'drunk';
  const inView = (b) => (V === 'drunk' ? !!b.drunk : V === 'pend' ? !b.drunk && !!b.pending : V === 'wish' ? !b.drunk && !!b.wish : inCellar(b));
  const pool = all.filter(inView);
  const words = nrm(q).split(/\s+/).filter(Boolean);
  const key = (b) => nrm(b.producer || b.cuvee || '').replace(/^[^a-z0-9]+/, '');
  const f = pool
    .filter((b) => { const h = nrm([name(b), b.region, b.vintage, b.type, posText(b), b.buyWhere, tagsOf(b).join(' '), isStd(b) ? '' : sizeName(sizeMl(b))].join(' ')); return words.every((w) => h.includes(w)); })
    .filter((b) => (!flt.type || b.type === flt.type) && (!flt.stat || status(b) === flt.stat) && (!flt.region || (b.region || '') === flt.region) && (!flt.vint || String(b.vintage || '') === flt.vint) && (!flt.size || String(sizeMl(b)) === flt.size) && (!flt.tag || tagsOf(b).includes(flt.tag)));
  const az = (a, b) => (key(a) || '~').localeCompare(key(b) || '~', 'it') || (a.vintage || 0) - (b.vintage || 0);
  const sortMode = flt.sort === 'az' && drunkView ? 'date' : flt.sort;
  if (sortMode === 'az') f.sort(az);
  else if (sortMode === 'value') f.sort((a, b) => (b.value ?? b.price ?? -1) - (a.value ?? a.price ?? -1) || az(a, b));
  else if (sortMode === 'vint') f.sort((a, b) => (a.vintage || 9999) - (b.vintage || 9999) || az(a, b));
  else if (sortMode === 'drink') { const o = { 'st-now': 0, 'st-wait': 2, 'st-past': 1, '': 3 }; f.sort((a, b) => o[status(a)] - o[status(b)] || az(a, b)); }
  else f.sort((a, b) => String((b.drunk && b.drunk.date) || '').localeCompare(String((a.drunk && a.drunk.date) || '')));
  // bottiglie uguali in una riga sola (tranne tra le bevute, dove ogni bottiglia ha la sua data)
  const groups = [];
  if (drunkView) f.forEach((b) => groups.push([b]));
  else { const gm = new Map(); f.forEach((b) => { const w = widOf(b); if (!gm.has(w)) { gm.set(w, []); groups.push(gm.get(w)); } gm.get(w).push(b); }); }
  const st = { 'st-now': ', pronta da bere', 'st-wait': ', da aspettare', 'st-past': ', oltre il picco' };
  const letter = (b) => { const c = key(b).charAt(0).toUpperCase(); return /[A-Z]/.test(c) ? c : '#'; };
  const showLetters = sortMode === 'az';
  const letters = showLetters ? [...new Set(f.map(letter))] : [];
  const jump = letters.length > 1 ? `<div class="az">${letters.map((l) => `<button data-a="jump" data-l="${l}">${l}</button>`).join('')}</div>` : '';
  let last = '', rows = '';
  groups.forEach((g) => {
    const b = g.find((x) => x.shelf) || g[0], n = g.length;
    if (showLetters) { const l = letter(b); if (l !== last) { rows += `<h3 class="letter" id="az-${l === '#' ? 'x' : l}">${l}</h3>`; last = l; } }
    const fmt = isStd(b) ? '' : esc(sizeName(sizeMl(b))) + ' · ';
    let sub;
    if (drunkView) sub = `${esc(exitLabel(b))} il ${new Date(b.drunk.date).toLocaleDateString('it-IT')}${b.drunk.rating ? ' · ' + '★'.repeat(b.drunk.rating) : ''}${b.drunk.notes ? ' · ' + esc(b.drunk.notes.slice(0, 50)) : ''}`;
    else if (V === 'pend') sub = fmt + (n > 1 ? n + ' bottiglie · ' : '') + 'In arrivo' + (b.eta ? ' per il ' + esc(new Date(b.eta).toLocaleDateString('it-IT')) : '') + (b.buyWhere ? ' da ' + esc(b.buyWhere) : '');
    else if (V === 'wish') sub = fmt + esc([b.region, b.buyNote].filter(Boolean).join(' · ') || 'Nei desideri');
    else sub = fmt + (n > 1 ? n + ' bottiglie · ' + esc(posSummary(g)) : esc(posText(b)));
    const tg = tagsOf(b).length ? `<span class="tags">${tagsOf(b).map((t) => `<i>${esc(t)}</i>`).join('')}</span>` : '';
    const sp = !drunkView && V === 'in' ? { 'st-now': ['Pronta', 'ok'], 'st-wait': ['Aspetta', 'wait'], 'st-past': ['Aprila', 'past'] }[status(b)] : null;
    rows += `<button class="row lrow" data-a="open" data-id="${esc(b.id)}">${imgSrc(b) ? `<img class="th" src="${imgSrc(b)}" alt="">` : `<span class="vdot t-${esc(b.type)}">${b.vintage ? String(b.vintage).slice(-2) : 'SA'}</span>`}<span class="lmain"><span class="lname">${esc(name(b))} ${esc(b.vintage || '')}${n > 1 ? ` <b class="qty">×${n}</b>` : ''}</span><small>${sub}</small>${tg}</span><span class="lside">${drunkView ? '' : `<b>${eur(b.value ?? b.price)}</b>`}${sp ? `<i class="spill ${sp[1]}">${sp[0]}</i>` : ''}</span></button>`;
  });
  const uniq = (fn) => [...new Set(pool.map(fn).filter(Boolean))];
  const opt = (arr, cur, lab) => `<option value="">${lab}</option>` + arr.map((v) => `<option ${String(v) === cur ? 'selected' : ''}>${esc(v)}</option>`).join('');
  const nIn = all.filter(inCellar).length, nDr = all.filter((b) => b.drunk).length, nPe = all.filter((b) => !b.drunk && b.pending).length, nWi = uniqW(all.filter((b) => !b.drunk && b.wish)).length;
  const allTags = [...new Set(all.flatMap(tagsOf))].sort((a, b) => a.localeCompare(b, 'it'));
  // filtri: pillole per tipo e maturità, il resto nel foglio «Filtri»
  const TYP = [['rosso', 'Rossi'], ['bianco', 'Bianchi'], ['bollicine', 'Bollicine'], ['rosato', 'Rosati'], ['altro', 'Altri']];
  const STA = [['st-now', 'Pronte'], ['st-wait', 'Da aspettare'], ['st-past', 'Da aprire presto']];
  const nAdv = [flt.region, flt.vint, flt.size, flt.tag].filter(Boolean).length + (flt.sort !== 'az' ? 1 : 0);
  const chip = (k, v, l) => `<button class="fchip${flt[k] === v ? ' on' : ''}" data-a="fchip" data-k="${k}" data-v="${esc(v)}">${esc(l)}</button>`;
  const adv = [['region', flt.region], ['vint', flt.vint], ['size', flt.size ? sizeName(+flt.size) : ''], ['tag', flt.tag]].filter((x) => x[1]).map(([k, l]) => `<button class="fchip on x" data-a="fclear" data-k="${k}">${esc(l)} ✕</button>`).join('');
  const filters = `<div class="fchips"><button class="fchip fbtn${nAdv ? ' on' : ''}" data-a="fltsheet"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4"/></svg>Filtri${nAdv ? ' · ' + nAdv : ''}</button>${adv}${TYP.map(([v, l]) => chip('type', v, l)).join('')}${!drunkView ? STA.map(([v, l]) => chip('stat', v, l)).join('') : ''}</div>`;
  fltSheetHtml = () => `<h2>Filtri</h2>
    <label>Zona</label><select data-flt="region">${opt(uniq((b) => b.region).sort((a, b) => a.localeCompare(b, 'it')), flt.region, 'Tutte le zone')}</select>
    <label>Annata</label><select data-flt="vint">${opt(uniq((b) => b.vintage).sort(), flt.vint, 'Tutte le annate')}</select>
    <label>Formato</label><select data-flt="size"><option value="">Tutti i formati</option>${[...new Set(pool.map(sizeMl))].sort((a, b) => a - b).map((v) => `<option value="${v}" ${String(v) === flt.size ? 'selected' : ''}>${esc(sizeName(v))}</option>`).join('')}</select>
    ${allTags.length ? `<label>Lista</label><select data-flt="tag">${opt(allTags, flt.tag, 'Tutte le liste')}</select>` : ''}
    <label>Ordine</label><select data-flt="sort"><option value="az" ${flt.sort === 'az' ? 'selected' : ''}>${drunkView ? 'Più recenti prima' : 'Ordine alfabetico'}</option><option value="value" ${flt.sort === 'value' ? 'selected' : ''}>Valore più alto</option><option value="vint" ${flt.sort === 'vint' ? 'selected' : ''}>Annata più vecchia</option>${!drunkView ? `<option value="drink" ${flt.sort === 'drink' ? 'selected' : ''}>Da bere prima</option>` : ''}</select>
    <div class="acts"><button class="btn pri" data-a="fltdone">Fatto</button><button class="btn" data-a="clearflt">Azzera tutto</button></div>`;
  const any = flt.type || flt.stat || flt.region || flt.vint || flt.size || flt.tag || q;
  const prods = words.length ? [...new Set(all.map((b) => b.producer).filter((p) => p && words.every((w) => nrm(p).includes(w))))].slice(0, 3) : [];
  const prodChips = prods.length ? `<div class="acts" style="margin:0 0 8px">${prods.map((p) => `<button class="link prodlink" data-a="producer" data-p="${esc(p)}">Produttore: ${esc(p)} ›</button>`).join('')}</div>` : '';
  const nf = f.length, gl = groups.length;
  const countTxt = V === 'wish' ? gl + (gl === 1 ? ' vino' : ' vini') : nf + (nf === 1 ? ' bottiglia' : ' bottiglie') + (gl < nf ? ' (' + gl + (gl === 1 ? ' vino)' : ' vini)') : '');
  const empty = { in: ' ancora: tocca +', pend: ' in arrivo. Quando ordini un vino, nella sua scheda scegli «In arrivo»', drunk: ' bevuta ancora', wish: ' nei desideri: tocca + per aggiungere un vino che vuoi comprare o assaggiare' }[V];
  const tools = V === 'in' && nIn ? `<div class="acts"><button class="btn" data-a="pdf">Inventario in PDF</button><button class="btn" data-a="carta">Carta dei vini</button><button class="btn" data-a="csv">Esporta in Excel</button><button class="btn" data-a="ics">Promemoria nel calendario</button></div><p class="info" id="pdfmsg"></p>` : '';
  return `<div class="seg seg4"><button data-a="view" data-v="in" aria-pressed="${V === 'in'}">Cantina<small>${nIn}</small></button><button data-a="view" data-v="pend" aria-pressed="${V === 'pend'}">In arrivo<small>${nPe}</small></button><button data-a="view" data-v="drunk" aria-pressed="${V === 'drunk'}">Bevute<small>${nDr}</small></button><button data-a="view" data-v="wish" aria-pressed="${V === 'wish'}">Desideri<small>${nWi}</small></button></div><div class="azbar"><div class="srow"><input id="q" type="search" placeholder="Cerca per produttore, cuvée, annata, zona, lista" value="${esc(q)}"><button class="iconbtn" data-a="scanfind" aria-label="Cerca con il codice a barre"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 8v8M10 8v8M13 8v8M17 8v8"/></svg></button></div>${jump}</div>${filters}${prodChips}<p class="info">${countTxt}${any ? ' trovati' : ''}${any ? ' <button class="link" data-a="clearflt">Azzera filtri</button>' : ''}</p>` + (f.length ? rows
    : `<p class="empty">${V === 'wish' ? 'Nessun vino' : 'Nessuna bottiglia'}${any ? ' trovata' : empty}.</p>`) + tools;
}

/* ===== Foto ===== */
function loadImg(blob) {
  return new Promise((res, rej) => {
    const u = URL.createObjectURL(blob), im = new Image();
    im.onload = () => { URL.revokeObjectURL(u); res(im); };
    im.onerror = async () => {
      URL.revokeObjectURL(u);
      // alcune foto della galleria (HEIC, molto grandi) non si aprono come immagine: provo un'altra strada
      try {
        const bm = await createImageBitmap(blob);
        const c = document.createElement('canvas'); c.width = bm.width; c.height = bm.height; c.getContext('2d').drawImage(bm, 0, 0);
        const im2 = new Image(); im2.onload = () => res(im2); im2.onerror = () => rej(new Error('Immagine non leggibile: prova a fare uno screenshot della foto e usa quello.')); im2.src = c.toDataURL('image/jpeg', 0.9);
      } catch (_) { rej(new Error('Immagine non leggibile: prova a fare uno screenshot della foto e usa quello.')); }
    };
    im.src = u;
  });
}
function normBox(b) {
  if (Array.isArray(b) && b.length === 4) { const [y0, x0, y1, x1] = b.map(Number); b = { left: Math.min(x0, x1), top: Math.min(y0, y1), right: Math.max(x0, x1), bottom: Math.max(y0, y1), _k: 1000 }; }
  if (!b || typeof b !== 'object') return null;
  let v = ['left', 'top', 'right', 'bottom'].map((k) => Number(b[k]));
  if (v.some((n) => !Number.isFinite(n) || n < 0)) return null;
  const m = Math.max(...v);
  if (b._k) v = v.map((n) => n / b._k);
  else if (m > 1) v = v.map((n) => n / (m > 100 ? 1000 : 100));
  v = v.map((n) => Math.min(1, n));
  const o = { left: v[0], top: v[1], right: v[2], bottom: v[3] };
  return o.right - o.left > 0.03 && o.bottom - o.top > 0.03 ? o : null;
}
async function drawCrop(blob, box, max, pad) {
  box = normBox(box);
  const im = await loadImg(blob);
  let x = 0, y = 0, w = im.naturalWidth, h = im.naturalHeight;
  if (box) {
    const p = pad === undefined ? 0.04 : pad, l = Math.max(0, box.left - p), t = Math.max(0, box.top - p), r = Math.min(1, box.right + p), bt = Math.min(1, box.bottom + p);
    x = l * w; y = t * h; w = (r - l) * w; h = (bt - t) * h;
  }
  const k = Math.min(1, max / Math.max(w, h));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * k));
  c.height = Math.max(1, Math.round(h * k));
  c.getContext('2d').drawImage(im, x, y, w, h, 0, 0, c.width, c.height);
  return c;
}
const canvasBlob = (c, q) => new Promise((r) => c.toBlob(r, 'image/jpeg', q));
async function toB64(blob, max) { const c = await drawCrop(blob, null, max); return c.toDataURL('image/jpeg', 0.85).split(',')[1]; }
/* Editor per centrare a mano l'etichetta: riquadro quadrato da trascinare sulla foto. */
async function labelEditor(blob, done) {
  if (!blob) return;
  let d = document.getElementById('dlg4');
  if (!d) { d = document.createElement('dialog'); d.id = 'dlg4'; document.body.append(d); }
  const url = URL.createObjectURL(blob);
  d.innerHTML = `<h2>Centra l'etichetta</h2><p class="info">Trascina il riquadro sull'etichetta; con il cursore lo allarghi o lo stringi.</p>
  <div class="lced"><div class="lcw" id="lc_w"><img id="lc_img" src="${url}" alt="" draggable="false"><div id="lc_box"></div></div></div>
  <input type="range" id="lc_sz" min="15" max="100" value="55" aria-label="Grandezza del riquadro">
  <div class="acts"><button class="btn pri" id="lc_ok" type="button">Usa questo ritaglio</button><button class="btn" id="lc_x" type="button">Annulla</button></div>`;
  const img = $('#lc_img'), bx = $('#lc_box'), wrap = $('#lc_w');
  await new Promise((r) => { if (img.complete && img.naturalWidth) r(); else { img.onload = r; img.onerror = r; } });
  let cx = 0.5, cy = 0.5, sz = 0.55;
  const dims = () => ({ w: img.clientWidth, h: img.clientHeight });
  const side = () => { const { w, h } = dims(); return sz * Math.min(w, h); };
  const draw = () => {
    const { w, h } = dims(), s = side();
    if (!w || !h) return;
    cx = Math.min(1 - s / 2 / w, Math.max(s / 2 / w, cx)); cy = Math.min(1 - s / 2 / h, Math.max(s / 2 / h, cy));
    Object.assign(bx.style, { width: s + 'px', height: s + 'px', left: cx * w - s / 2 + 'px', top: cy * h - s / 2 + 'px' });
  };
  draw();
  let drag = null;
  wrap.onpointerdown = (e) => { e.preventDefault(); wrap.setPointerCapture(e.pointerId); const r = img.getBoundingClientRect(); drag = { x: e.clientX, y: e.clientY, cx, cy, w: r.width, h: r.height }; if (e.target !== bx) { cx = (e.clientX - r.left) / r.width; cy = (e.clientY - r.top) / r.height; drag.cx = cx; drag.cy = cy; draw(); } };
  wrap.onpointermove = (e) => { if (!drag) return; cx = drag.cx + (e.clientX - drag.x) / drag.w; cy = drag.cy + (e.clientY - drag.y) / drag.h; draw(); };
  wrap.onpointerup = wrap.onpointercancel = () => { drag = null; };
  $('#lc_sz').oninput = (e) => { sz = e.target.value / 100; draw(); };
  const close = () => { URL.revokeObjectURL(url); d.close(); };
  $('#lc_x').onclick = close;
  $('#lc_ok').onclick = () => {
    const { w, h } = dims(), s = side();
    // riquadro in frazioni; makeLabelThumb aggiunge un piccolo margine, quindi lo stringo dello stesso tanto
    const k = 1 / 1.08, sw = s * k / w, sh = s * k / h;
    done({ left: cx - sw / 2, right: cx + sw / 2, top: cy - sh / 2, bottom: cy + sh / 2 });
    close();
  };
  d.onclose = null;
  if (!d.open) d.showModal();
  requestAnimationFrame(draw);
}
async function makeLabelThumb(blob, box) {
  box = normBox(box);
  if (!box) { const c0 = await drawCrop(blob, null, 360); return c0.toDataURL('image/jpeg', 0.85); }
  const im = await loadImg(blob), W = im.naturalWidth, H = im.naturalHeight;
  const bw = (box.right - box.left) * W, bh = (box.bottom - box.top) * H;
  let side = Math.min(Math.max(bw, bh) * 1.08, W, H);
  let x = (box.left + box.right) / 2 * W - side / 2, y = (box.top + box.bottom) / 2 * H - side / 2;
  x = Math.max(0, Math.min(W - side, x)); y = Math.max(0, Math.min(H - side, y));
  const c = document.createElement('canvas'); c.width = c.height = 480;
  c.getContext('2d').drawImage(im, x, y, side, side, 0, 0, 480, 480);
  return c.toDataURL('image/jpeg', 0.88);
}
async function offImg(u, signal) {
  const hi = u.replace(/\.400\.jpg$/, '.full.jpg');
  if (hi !== u) { try { const r = await fetch(hi, { signal }); if (r.ok) return await r.blob(); } catch (_) {} }
  const ir = await fetch(u, { signal }); if (!ir.ok) return null;
  return await ir.blob();
}
async function offByName(producer, cuvee) {
  const norm = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]/g, ' ');
  const stop = new Set(['the', 'des', 'del', 'della', 'di', 'de', 'la', 'le', 'il', 'azienda', 'agricola', 'cantina', 'cantine', 'domaine', 'chateau', 'societa', 'vini', 'wine', 'winery', 'vino', 'tenuta', 'podere', 'cascina']);
  const toks = (t) => norm(t).split(/\s+/).filter((w) => w.length > 2 && !stop.has(w));
  const pt = toks(producer), ct = toks(cuvee);
  const q = [producer, cuvee].filter(Boolean).join(' ').trim();
  if (!q || !(pt.length || ct.length)) return null;
  const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 8000);
  try {
    const r = await fetch('https://world.openfoodfacts.org/cgi/search.pl?search_terms=' + encodeURIComponent(q) + '&search_simple=1&action=process&json=1&page_size=10&fields=product_name,brands,image_front_url', { signal: ctl.signal });
    const j = await r.json();
    let best = null, bs = 0;
    for (const p of j.products || []) {
      if (!p.image_front_url) continue;
      const hay = norm((p.brands || '') + ' ' + (p.product_name || ''));
      const hp = pt.filter((w) => hay.includes(w)).length, hc = ct.filter((w) => hay.includes(w)).length;
      if (pt.length && !hp) continue;
      if (ct.length && !hc) continue;
      const sc = hp + hc;
      if (sc > bs) { bs = sc; best = p; }
    }
    if (!best) return null;
    return await offImg(best.image_front_url, ctl.signal);
  } catch (_) { return null; } finally { clearTimeout(to); }
}
async function offFront(code) {
  const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 8000);
  try {
    const r = await fetch('https://world.openfoodfacts.org/api/v2/product/' + encodeURIComponent(code) + '.json?fields=image_front_url', { signal: ctl.signal });
    const j = await r.json(); const u = j && j.product && j.product.image_front_url;
    if (!u) return null;
    return await offImg(u, ctl.signal);
  } catch (_) { return null; } finally { clearTimeout(to); }
}
async function makeThumb(blob) { const c = await drawCrop(blob, null, 240); return c.toDataURL('image/jpeg', 0.75); }
const blobToDataURL = (b) => new Promise((res, rej) => { const f = new FileReader(); f.onload = () => res(f.result); f.onerror = () => rej(f.error); f.readAsDataURL(b); });
const dataURLToBlob = (u) => fetch(u).then((r) => r.blob());

/* ===== Scheda bottiglia ===== */
async function openBottle(id, pre) {
  const old = id ? S.bottles[id] : null;
  const b = old ? { ...old } : { id: gid(), type: 'rosso', shelf: null, r: 0, c: 0, added: Date.now(), buyDate: pre && pre.wish ? '' : new Date().toLocaleDateString('sv-SE'), ...pre };
  if (!old) b.wid = b.id;
  const grp = old ? groupOf(b) : [b];
  let tastings = tastingsOf(b);
  const state0 = b.drunk ? 'drunk' : b.wish ? 'wish' : b.pending ? 'pend' : 'in';
  let photo = null, photoFull = null, labelThumb = !!b.thumb, thumb = b.thumb || null, useFull = !!b.useFull;
  let aiAt = b.aiAt || null, aiDeep = !!b.aiDeep;
  let onlineLabel = false, valueNote = b.valueNote || '', srcLinks = b.srcLinks || [], busy = false, again = false, autoVal = !!b.valueAuto, dFrom = b.drinkFrom || null, dTo = b.drinkTo || null, picUrl = null, orig = null;
  if (id) {
    try { photo = (await photoOf(b, 'c')) || null; photoFull = (await photoOf(b, 'f')) || null; } catch (_) {}
  }
  const pm = posMap();
  const opts = '<option value="">Da posizionare dopo</option>' + S.shelves.map((s) => {
    let o = '';
    for (let r = 0; r < s.rows; r++) for (let c = 0; c < s.cols; c++) {
      const k = s.id + '|' + r + '|' + c, x = pm[k];
      if (!x || x.id === b.id) o += `<option value="${esc(k)}" ${b.shelf === s.id && b.r === r && b.c === c ? 'selected' : ''}>Riga ${r + 1}, posto ${c + 1}</option>`;
    }
    return `<optgroup label="${esc(s.name)}">${o}</optgroup>`;
  }).join('');
  const d = $('#dlg');
  const gIn = grp.filter(inCellar).length, gPe = grp.filter((x) => !x.drunk && x.pending).length, gDr = grp.filter((x) => x.drunk).length;
  const sizeOpts = (() => { const ml = sizeMl(b), known = SIZES.some((x) => x[0] === ml); return SIZES.map((x) => `<option value="${x[0]}" ${x[0] === ml ? 'selected' : ''}>${x[1] ? esc(x[1]) + ' · ' : ''}${x[2]}</option>`).join('') + `<option value="other" ${known ? '' : 'selected'}>Altro formato…</option>`; })();
  const knownSize = SIZES.some((x) => x[0] === sizeMl(b));
  const nPend = grp.filter((x) => !x.drunk && x.pending).length;
  d.innerHTML = `<div class="shtop"><button class="link plain" id="cl" type="button">Chiudi</button><button class="link plain strong" id="sv2" type="button">Salva</button></div>
  <div class="shead"><div id="picbox"></div><div class="sh-t"><p class="eyebrow">${b.wish ? (id ? 'Vino nei desideri' : 'Nuovo vino nei desideri') : id ? 'Scheda bottiglia' : 'Nuova bottiglia'}</p><h2 id="dtitle" class="dtitle"></h2><div class="chips" id="dchips"></div><div id="dprod"></div></div></div>
  ${grp.length > 1 ? `<p class="note">Bottiglie uguali: <b>${grp.length}</b> (${[gIn ? gIn + ' in cantina' : '', gPe ? gPe + ' in arrivo' : '', gDr ? gDr + ' uscite' : ''].filter(Boolean).join(', ')}). Le informazioni valgono per tutte; posizione e stato solo per questa.</p>` : ''}${b.drunk ? `<p class="note"><b>${esc(exitLabel(b))} il ${esc(new Date(b.drunk.date).toLocaleDateString('it-IT'))}</b>${b.drunk.rating ? ' · voto ' + '★'.repeat(b.drunk.rating) + '☆'.repeat(5 - b.drunk.rating) : ''}${b.drunk.notes ? '<br>' + esc(b.drunk.notes) : ''}</p>` : ''}
  <div class="sacts"><button class="btn" id="chg" type="button"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>Foto</button><button class="btn" id="enr" type="button"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l1.8 4.6L18.5 9l-4.7 1.4L12 15l-1.8-4.6L5.5 9l4.7-1.4z"/><path d="M19 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/></svg>Cerca dati con l'IA</button>${id && b.shelf && inCellar(b) ? `<button class="btn icon" data-a="locate" data-id="${esc(b.id)}" type="button" aria-label="Dov'è sullo scaffale"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/></svg></button>` : ''}</div>
  <p class="info" id="scs"></p>
  <div id="photoctl" class="photopanel">
  <p class="info">Fotografa l'etichetta: compilo io i campi, tu controlli.</p>
  <div class="pgrid"><label class="btn">Scatta foto<input type="file" accept="image/*" capture="environment" hidden class="ph"></label><label class="btn">Dalla galleria<input type="file" accept="image/*" hidden class="ph"></label><button class="btn" id="pasteimg" type="button">Incolla</button><button class="btn" id="bcode" type="button">Codice a barre</button><a class="btn" id="srch" target="_blank" rel="noopener" href="#">Cerca online</a><label class="btn">Retro-etichetta<input type="file" accept="image/*" hidden class="rph"></label></div>
  <div class="acts" id="photoact" hidden><button class="btn" id="whole" type="button" hidden></button></div>
  <div id="pbox" class="pbox" contenteditable="true" inputmode="none">Per incollare un'immagine trovata online: tieni premuto qui e scegli Incolla.</div>
  </div>
  <div id="retbox"></div>

  <h4 class="gh">Il vino</h4><div class="grp">
  <div class="fr"><label for="f_producer">Produttore</label><input id="f_producer" placeholder="Obbligatorio" value="${esc(b.producer)}"></div>
  <div class="fr"><label for="f_cuvee">Cuvée</label><input id="f_cuvee" placeholder="Etichetta" value="${esc(b.cuvee)}"></div>
  <div class="fr"><label for="f_vintage">Annata</label><input id="f_vintage" inputmode="numeric" placeholder="es. 2019" value="${esc(b.vintage)}"></div>
  <div class="fr"><label for="f_type">Tipo</label><select id="f_type">${['rosso', 'bianco', 'bollicine', 'rosato', 'altro'].map((t) => `<option ${b.type === t ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
  <div class="fr"><label for="f_size">Formato</label><select id="f_size">${sizeOpts}</select></div>
  <div class="fr" id="f_sizeow" ${knownSize ? 'hidden' : ''}><label for="f_sizeo">Centilitri</label><input id="f_sizeo" inputmode="decimal" placeholder="es. 25" value="${knownSize ? '' : esc(String(sizeMl(b) / 10).replace('.', ','))}"></div>
  <div class="fr"><label for="f_region">Zona</label><input id="f_region" placeholder="Denominazione" value="${esc(b.region)}"></div>
  <div class="fr"><label for="f_grapes">Uvaggio</label><input id="f_grapes" placeholder="es. Nebbiolo 100%" value="${esc(b.grapes)}"></div>
  <div class="fr"><label for="f_abv">Gradazione %</label><input id="f_abv" inputmode="decimal" placeholder="es. 14" value="${esc(b.abv)}"></div>
  <div class="fr spk"><label for="f_disg">Sboccatura</label><input id="f_disg" placeholder="es. 03/2022" value="${esc(b.disg)}"></div>
  <div class="fr spk"><label for="f_dosage">Dosaggio</label><input id="f_dosage" placeholder="es. Extra Brut 3 g/l" value="${esc(b.dosage)}"></div>
  </div>

  ${b.drunk ? '' : `<h4 class="gh">Stato e posizione</h4><div class="grp">
  <div class="fr"><label for="f_state">Stato</label><select id="f_state"><option value="in" ${state0 === 'in' ? 'selected' : ''}>In cantina</option><option value="pend" ${state0 === 'pend' ? 'selected' : ''}>In arrivo</option><option value="wish" ${state0 === 'wish' ? 'selected' : ''}>Nei desideri</option></select></div>
  <div class="fr"><label for="f_qty">${id ? 'Aggiungi uguali' : 'Quantità'}</label><input id="f_qty" type="number" min="${id ? 0 : 1}" max="48" inputmode="numeric" value="${id ? 0 : 1}"></div>
  <div class="fr" id="f_etaw" ${state0 === 'pend' ? '' : 'hidden'}><label for="f_eta">Consegna</label><input id="f_eta" type="date" value="${esc(b.eta || '')}"></div>
  <div id="f_posw" ${state0 === 'in' ? '' : 'hidden'}><div class="fr"><label for="f_pos">Posizione</label><select id="f_pos">${opts}</select></div><div class="fb"><button class="link" id="ffree" type="button">Scegli il primo posto libero</button></div></div>
  </div>
  <p class="info" id="f_wishi" ${state0 === 'wish' ? '' : 'hidden'}>Quando lo compri, cambia lo stato in «In cantina» o «In arrivo».</p>${state0 === 'pend' && nPend > 1 ? `<p class="info">Quando arrivano, scegli «In cantina»: cambio stato a tutte le ${nPend} bottiglie in arrivo e poi le posizioni.</p>` : ''}`}

  <h4 class="gh">Acquisto e valore</h4><div class="grp">
  <div class="fr"><label for="f_price">Pagato €</label><input id="f_price" inputmode="decimal" placeholder="Prezzo d'acquisto" value="${esc(b.price)}"></div>
  <div class="fr"><label for="f_value">Valore €</label><input id="f_value" inputmode="decimal" placeholder="Di mercato" value="${esc(b.value)}"></div>
  <div class="fb"><p class="info" id="f_basis">${autoVal ? (valueNote ? 'Stima non verificata da ricerca online: ' + esc(valueNote) : 'Stima automatica non verificata: puoi correggerla.') : ''}</p><a class="link" id="ws" target="_blank" rel="noopener" href="#">Cerca il prezzo su Wine-Searcher</a></div>
  <div class="fr"><label for="f_bdate">Data</label><input id="f_bdate" type="date" value="${esc(b.buyDate || '')}"></div>
  <div class="fr"><label for="f_bwhere">Da</label><input id="f_bwhere" list="dl_where" autocomplete="off" placeholder="Enoteca, cantina, online…" value="${esc(b.buyWhere)}"></div>
  <div class="fr"><label for="f_bnote">Note</label><input id="f_bnote" placeholder="Cassa da 6, regalo…" value="${esc(b.buyNote)}"></div>
  <div class="fr"><label for="f_lot">Lotto</label><input id="f_lot" placeholder="Dalla retro-etichetta" value="${esc(b.lot)}"></div>
  <div class="fr"><label for="f_tags">Liste</label><input id="f_tags" autocomplete="off" placeholder="Regali, ristorante…" value="${esc(tagsOf(b).join(', '))}"></div>
  <div class="fb tagpick">${[...new Set(Object.values(S.bottles).flatMap(tagsOf))].sort((a, c) => a.localeCompare(c, 'it')).map((t) => `<button type="button" class="link" data-tag="${esc(t)}">+ ${esc(t)}</button>`).join('')}</div>
  </div>
  <datalist id="dl_where">${[...new Set(Object.values(S.bottles).map((x) => x.buyWhere).filter(Boolean))].sort((a, c) => a.localeCompare(c, 'it')).map((w) => `<option value="${esc(w)}"></option>`).join('')}</datalist>

  <h4 class="gh">Quando berla</h4><div class="grp"><div class="fb"><div id="dwin"></div><textarea id="f_drink" rows="3" placeholder="Finestra ideale, picco, se è pronta…">${esc(b.drink)}</textarea></div></div>
  <h4 class="gh">Abbinamenti</h4><div class="grp"><div class="fb"><textarea id="f_pairing" rows="2" placeholder="Piatti consigliati">${esc(b.pairing)}</textarea><div class="info" id="rext"></div></div></div>
  <h4 class="gh">Servizio</h4><div id="svcbox">${serviceHtml(b)}</div>
  <h4 class="gh">Degustazioni</h4><div id="tst"></div><div class="acts"><button class="btn" id="addt" type="button">Aggiungi degustazione</button></div>
  <details class="more aiinfo"><summary>Produttore, vino e annata</summary>
  <label>Il produttore</label><textarea id="f_info" rows="6">${esc(b.info)}</textarea>
  <label>Sulla cuvée e sulla bottiglia</label><textarea id="f_winfo" rows="7">${esc(b.winfo)}</textarea>
  <div ${b.prod ? '' : 'hidden'}><label>Produzione e bottiglie prodotte</label><textarea id="f_prod" rows="3">${esc(b.prod)}</textarea></div>
  <label>Sull'annata</label><textarea id="f_vinfo" rows="4">${esc(b.vinfo)}</textarea>
  <div class="info" id="esrc"></div></details>
  <p class="info">Le informazioni automatiche sono stime dell'IA: controllale prima di fidarti.</p>
  <div class="acts">${id ? '' : '<button class="btn" id="svn">Salva e aggiungi un\'altra</button>'}${id ? '<button class="btn danger" id="del">Elimina</button>' : ''}</div>
  <div class="sbar"><button class="btn pri" id="sv">Salva</button>${id && inCellar(b) ? '<button class="btn" id="drk">Bevuta o regalata</button>' : ''}${b.drunk ? '<button class="btn" id="undrk">Rimetti in cantina</button>' : ''}</div>`;

  const g = (k) => $('#f_' + k).value.trim();
  const scs = (t) => { const el = $('#scs'); el.textContent = t; if (t) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); };
  const sizeOf = () => {
    const v = $('#f_size').value;
    if (v !== 'other') return +v;
    const cl = num($('#f_sizeo').value);
    return cl && cl > 0 ? Math.round(cl * 10) : 750;
  };
  let sizeTouched = !!id && !!b.size;
  $('#f_size').addEventListener('change', () => { sizeTouched = true; $('#f_sizeow').hidden = $('#f_size').value !== 'other'; if ($('#f_size').value === 'other') $('#f_sizeo').focus(); });
  const setSize = (ml) => {
    ml = Math.round(Number(ml));
    if (!(ml > 0) || sizeTouched) return;
    if (SIZES.some((x) => x[0] === ml)) { $('#f_size').value = String(ml); $('#f_sizeow').hidden = true; }
    else if (ml >= 50 && ml <= 30000) { $('#f_size').value = 'other'; $('#f_sizeow').hidden = false; $('#f_sizeo').value = String(ml / 10).replace('.', ','); }
  };
  const touched = new Set(b.touched || []);
  let typeTouched = !!id;
  $('#f_type').addEventListener('change', () => { typeTouched = true; showSparkling(); });
  showSparkling();
  ['info', 'winfo', 'vinfo', 'prod', 'pairing', 'drink'].forEach((f) => $('#f_' + f).addEventListener('input', () => touched.add(f)));
  $('#f_drink').addEventListener('input', () => { dFrom = dTo = null; });

  const cur = () => (useFull && photoFull ? photoFull : photo || photoFull);
  const showPic = () => {
    if (picUrl) URL.revokeObjectURL(picUrl);
    const bl = cur();
    picUrl = bl ? URL.createObjectURL(bl) : null;
    $('#picbox').innerHTML = picUrl ? `<button type="button" class="picbtn" id="picedit" aria-label="Centra l'etichetta"><img class="pic" src="${thumb || picUrl}" alt="Etichetta"><span>Centra</span></button>` : '';
    if ($('#picedit')) $('#picedit').onclick = () => labelEditor(photoFull || photo, async (box) => { thumb = await makeLabelThumb(photoFull || photo, box); labelThumb = true; onlineLabel = false; showPic(); });
    const w = $('#whole');
    w.hidden = !(photo && photoFull);
    w.textContent = useFull ? 'Usa il ritaglio' : 'Usa la foto intera';
    $('#photoctl').hidden = !!bl;
    $('#photoact').hidden = !bl;
  };
  const setPhoto = async (file, box, lbox, code, poor) => {
    orig = file;
    // 1600 px bastano per leggere l'etichetta anche ingrandita, e occupano molto meno spazio
    photoFull = await canvasBlob(await drawCrop(file, null, 1600), 0.85);
    photo = box ? await canvasBlob(await drawCrop(file, box, 1600), 0.85) : photoFull;
    useFull = false;
    labelThumb = false;
    thumb = null;
    const okBox = (x) => !!normBox(x);
    if (okBox(lbox)) { try { thumb = await makeLabelThumb(file, lbox); labelThumb = true; } catch (_) {} }
    onlineLabel = false;
    let ob = null;
    if (code && /^\d{8,14}$/.test(String(code))) ob = await offFront(code);
    if (!ob && (g('producer') || g('cuvee'))) ob = await offByName(g('producer'), g('cuvee'));
    if (ob) { try { thumb = await makeLabelThumb(ob, null); labelThumb = true; onlineLabel = true; } catch (_) {} }
    if (!labelThumb && box && okBox(box)) {
      const w = box.right - box.left, h = box.bottom - box.top;
      const g2 = { left: box.left + w * 0.12, right: box.right - w * 0.12, top: box.top + h * 0.35, bottom: box.top + h * 0.8 };
      try { thumb = await makeLabelThumb(file, g2); labelThumb = true; } catch (_) {}
    }
    if (!thumb) thumb = await makeThumb(photo);
    showPic();
  };
  showPic();
  $('#chg').onclick = () => { const p = $('#photoctl'); p.hidden = !p.hidden; if (!p.hidden) p.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); };
  $('#whole').onclick = async () => { useFull = !useFull; if (!labelThumb) thumb = await makeThumb(cur()); showPic(); };

  const ws = () => {
    const t = encodeURIComponent((g('producer') + ' ' + g('cuvee')).trim()).replace(/%20/g, '+');
    $('#ws').href = 'https://www.wine-searcher.com/find/' + t + (g('vintage') ? '/' + g('vintage') : '');
    $('#srch').href = 'https://www.google.com/search?tbm=isch&q=' + encodeURIComponent((g('producer') + ' ' + g('cuvee') + ' ' + g('vintage') + ' etichetta').trim());
  };
  ws();
  ['producer', 'cuvee', 'vintage'].forEach((k) => $('#f_' + k).addEventListener('input', ws));
  $('#cl').onclick = () => d.close();
  $('#f_value').addEventListener('input', () => { autoVal = false; valueNote = ''; $('#f_basis').textContent = ''; });

  // Compila solo i campi che non hai scritto tu e mai il valore che hai inserito a mano.
  function showSparkling() { const on = $('#f_type').value === 'bollicine' || !!(g('disg') || g('dosage')); document.querySelectorAll('#dlg .spk').forEach((x) => { x.hidden = !on; }); }
  const applyInfo = (j) => {
    const put = (f, v) => { if (v && typeof v === 'string' && !touched.has(f)) $('#f_' + f).value = v; };
    if (j.region && typeof j.region === 'string' && !$('#f_region').value.trim()) $('#f_region').value = j.region;
    if (!typeTouched && ['rosso', 'bianco', 'bollicine', 'rosato', 'altro'].includes(j.type)) $('#f_type').value = j.type;
    put('info', j.producer_info); put('winfo', j.wine_info); put('prod', j.production); put('vinfo', j.vintage_info); put('pairing', j.pairing);
    const empty = (f, v) => { const el = $('#f_' + f); if (el && v != null && String(v).trim() && !el.value.trim()) el.value = String(v).trim(); };
    empty('grapes', j.grapes); empty('abv', Number(j.abv) > 0 ? String(j.abv).replace('.', ',') : null); empty('disg', j.disgorgement); empty('dosage', j.dosage);
    showSparkling();
    if (j.drink_text && !touched.has('drink')) {
      $('#f_drink').value = j.drink_text;
      dFrom = Number.isInteger(j.drink_from) ? j.drink_from : null;
      dTo = Number.isInteger(j.drink_to) ? j.drink_to : null;
    }
    const p = Number(j.price_eur);
    if (Number.isFinite(p) && p > 0) {
      const note = typeof j.price_note === 'string' ? j.price_note.trim() : '';
      const setV = () => {
        $('#f_value').value = Math.round(p); autoVal = true; valueNote = note;
        $('#f_basis').textContent = 'Stima non verificata da ricerca online' + (note ? ': ' + note : '') + '. Puoi correggerla.';
      };
      if ($('#f_value').value.trim() === '' || autoVal) setV();
      else if (Math.round(p) !== Math.round(Number($('#f_value').value))) {
        $('#f_basis').innerHTML = 'Online ho trovato circa ' + Math.round(p) + ' €' + (note ? ' (' + esc(note) + ')' : '') + '. Il tuo valore non è stato cambiato. <button class="link" id="useval" type="button">Usa questo</button>';
        $('#useval').onclick = setV;
      }
    }
  };
  const showSrc = () => { $('#esrc').innerHTML = srcLinks.length ? 'Fonti della ricerca: ' + srcLinks.map((l) => `<a class="link" target="_blank" rel="noopener" href="${esc(l.u)}">${esc(l.t)}</a>`).join(' · ') : ''; };
  showSrc();
  const findLabel = async (quiet) => {
    if (cur()) return '';
    if (!quiet) scs('Cerco l\'etichetta online…');
    const ob = await offByName(g('producer'), g('cuvee'));
    if (!ob) return ' Etichetta non trovata online: puoi aggiungere una foto tua.';
    try {
      photoFull = photo = ob; useFull = false;
      thumb = await makeLabelThumb(ob, null); labelThumb = true; onlineLabel = true;
      showPic();
      return ' Etichetta trovata online.';
    } catch (_) { return ''; }
  };
  const enrich = async () => {
    if (busy) { again = true; return; }
    if (!aiReady()) { notice('Manca la chiave dell\'IA', 'Per le informazioni automatiche serve la chiave del servizio di IA. Aprila dalle Impostazioni.', [{ t: 'Apri le impostazioni', pri: true, fn: openSettings }, { t: 'Chiudi' }]); return; }
    if (!g('producer') && !g('cuvee')) { scs('Scrivi almeno il produttore o la cuvée.'); return; }
    busy = true;
    scs('Cerco informazioni approfondite online… può volerci fino a un minuto.');
    aiWaitNote = (s) => scs('Gemini chiede una pausa: riprovo da solo tra ' + s + ' secondi…');
    try {
      const kp = !g('info') ? knownProducerInfo(g('producer'), b.id) : '';
      if (kp) $('#f_info').value = kp;
      const r = await deepInfo({ producer: g('producer'), cuvee: g('cuvee'), vintage: g('vintage'), type: g('type'), region: g('region'), size: sizeOf(), disg: g('disg'), dosage: g('dosage'), knownProd: !!g('info') });
      applyInfo(r.j); updDW(); updHead();
      aiAt = Date.now(); aiDeep = !!r.deep;
      if (r.links.length) { srcLinks = r.links; showSrc(); }
      const lab = await findLabel(true);
      scs((r.deep ? 'Fatto, con ricerca online: controlla le fonti in fondo e i dati importanti.' : (r.limited ? 'Limite gratuito della ricerca web raggiunto: ho usato solo le conoscenze dell\'IA, senza fonti e senza aggiornare il valore. Riprova più tardi con "Cerca dati ed etichetta".' : 'Fatto, ma senza ricerca online' + (r.why ? ' (motivo: ' + r.why + ')' : '') + ': sono stime dell\'IA, controllale.')) + lab);
    } catch (e) {
      scs('Ricerca non riuscita: ' + e.message);
      notice('Ricerca non riuscita', esc(errorHint(e.message)) + '<br><br><small>Dettaglio: ' + esc(e.message) + '</small>', [{ t: 'Chiudi', pri: true }]);
    } finally { aiWaitNote = null; busy = false; if (again) { again = false; enrich(); } }
  };
  $('#enr').onclick = enrich;
  // Retro-etichetta: seconda foto, l'IA legge uvaggio, gradazione e lotto
  let retro = null, retroChanged = false, retroUrl = null;
  const showRetro = () => {
    if (retroUrl) URL.revokeObjectURL(retroUrl);
    retroUrl = retro ? URL.createObjectURL(retro) : null;
    $('#retbox').innerHTML = retroUrl ? `<button type="button" class="retro" id="retimg" aria-label="Ingrandisci la retro-etichetta"><img src="${retroUrl}" alt="Retro-etichetta"><span>Retro-etichetta · tocca per ingrandire</span></button>` : '';
    if ($('#retimg')) $('#retimg').onclick = () => $('#retimg').classList.toggle('big');
  };
  if (id) photoOf(b, 'r').then((x) => { retro = x; showRetro(); }).catch(() => {});
  d.querySelectorAll('.rph').forEach((inp) => inp.onchange = async (e) => {
    const file = e.target.files[0]; e.target.value = '';
    if (!file) return;
    retro = await canvasBlob(await drawCrop(file, null, 1600), 0.85); retroChanged = true; showRetro();
    if (!aiReady()) { scs('Retro-etichetta aggiunta. Con la chiave dell\'IA leggerei uvaggio, gradazione e lotto.'); return; }
    scs('Leggo la retro-etichetta…');
    aiWaitNote = (sec) => scs('Gemini chiede una pausa: riprovo tra ' + sec + ' secondi…');
    try {
      const j = await aiJson(`Questa è la retro-etichetta (o la controetichetta) di una bottiglia di vino. Leggi solo ciò che è scritto, senza inventare. Rispondi solo con JSON: {"grapes": string|null (uvaggio con percentuali se indicate), "abv": number|null (gradazione alcolica in %), "lot": string|null (numero di lotto, spesso dopo "L."), "disgorgement": string|null (data di sboccatura/dégorgement/"dégorgé le", solo spumanti), "dosage": string|null (dosaggio, es. "Extra Brut", "dosage 3 g/l"), "size_ml": number|null, "notes": string|null (in 1-2 frasi altre informazioni utili scritte in etichetta: affinamento, vigneto, temperatura di servizio, abbinamenti; null se non ci sono)}`, await toB64(file, 1600));
      const fill = (k, v) => { if (v !== null && v !== undefined && v !== '' && !$('#f_' + k).value.trim()) $('#f_' + k).value = v; };
      fill('grapes', j.grapes); fill('abv', j.abv); fill('lot', j.lot); fill('disg', j.disgorgement); fill('dosage', j.dosage);
      if (j.size_ml) setSize(j.size_ml);
      if (j.notes && typeof j.notes === 'string' && !touched.has('winfo')) { const w = $('#f_winfo'); if (!w.value.includes(j.notes)) w.value = (w.value ? w.value.trim() + '\n\n' : '') + 'Dalla retro-etichetta: ' + j.notes; }
      updHead();
      scs('Retro-etichetta letta: controlla uvaggio, gradazione e lotto.');
    } catch (err) { scs('Retro-etichetta salvata, ma non sono riuscito a leggerla: ' + errorHint(err.message)); }
    aiWaitNote = null;
  });
  const showR = () => {
    const q = encodeURIComponent([g('producer'), g('cuvee'), g('vintage')].filter(Boolean).join(' '));
    $('#rext').innerHTML = `Cerca su: <a class="link" target="_blank" rel="noopener" href="https://www.vivino.com/search/wines?q=${q}">Vivino</a> · <a class="link" target="_blank" rel="noopener" href="https://www.google.com/search?q=${q}+site%3Ainstagram.com">Instagram</a> · <a class="link" target="_blank" rel="noopener" href="https://www.google.com/search?q=${q}+recensione">Blog</a>`;
  };
  showR();
  ['producer', 'cuvee', 'vintage'].forEach((k) => $('#f_' + k).addEventListener('input', showR));
  let autoT = null;
  ['producer', 'cuvee', 'vintage'].forEach((k) => $('#f_' + k).addEventListener('change', () => {
    clearTimeout(autoT);
    autoT = setTimeout(async () => {
      if (!(g('producer') || g('cuvee'))) return;
      if (!getCfg().autoDeep) {
        if (k !== 'vintage' && !cur() && !busy) { const m = await findLabel(true); if (m.includes('trovata')) scs('Etichetta trovata online. Per produzione, valore e fonti premi «Cerca dati ed etichetta».'); }
        return;
      }
      if (!aiReady()) return;
      const need = k === 'vintage' ? (!g('drink') || autoVal || !g('value')) : (!g('info') && !g('winfo'));
      if (need && (k === 'vintage' || !cur())) enrich();
    }, 2000);
  }));

  const take = async (f) => { await setPhoto(f, null); scs('Immagine aggiunta.'); };
  const imgOf = (dt) => [...((dt && dt.files) || [])].find((x) => x.type.startsWith('image/'));
  $('#pbox').addEventListener('paste', async (e) => {
    e.preventDefault();
    const f = imgOf(e.clipboardData);
    if (!f) { scs('Non ho trovato un\'immagine negli appunti.'); return; }
    await take(f);
  });
  $('#pasteimg').onclick = async () => {
    try {
      for (const it of await navigator.clipboard.read()) {
        const ty = it.types.find((t) => t.startsWith('image/'));
        if (ty) { await take(await it.getType(ty)); return; }
      }
      scs('Negli appunti non c\'è nessuna immagine.');
    } catch (_) { scs('Non riesco a leggere gli appunti: tieni premuto nel riquadro tratteggiato e scegli Incolla.'); }
  };

  document.querySelectorAll('.ph').forEach((inp) => inp.onchange = async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (!aiReady()) {
      await setPhoto(file, null);
      scs('Foto salvata, ma l\'etichetta non e stata letta: manca la chiave dell\'IA.');
      notice('Manca la chiave dell\'IA', 'La foto e stata salvata, ma per leggere l\'etichetta in automatico serve la chiave del servizio di IA. Aprila dalle Impostazioni, poi rifai la foto. Oppure compila i campi a mano.', [{ t: 'Apri le impostazioni', pri: true, fn: openSettings }, { t: 'Compila a mano' }]);
      return;
    }
    scs('Leggo l\'etichetta…');
    aiWaitNote = (s) => scs('Gemini chiede una pausa: riprovo da solo tra ' + s + ' secondi…');
    try {
      const j = await aiJson(scanPrompt(), await toB64(file, 1600));
      aiWaitNote = null;
      const set = (k, v) => { if (v !== null && v !== undefined && v !== '') $('#f_' + k).value = v; };
      set('producer', j.producer); set('cuvee', j.cuvee); set('vintage', j.vintage); set('region', j.region);
      if (j.size_ml) setSize(j.size_ml);
      if (['rosso', 'bianco', 'bollicine', 'rosato', 'altro'].includes(j.type)) $('#f_type').value = j.type;
      if (j.barcode && /^\d{8,14}$/.test(String(j.barcode))) b.barcode = String(j.barcode);
      applyInfo({ ...j, price_eur: null }); updDW(); updHead();
      await setPhoto(file, j.box_2d || j.box, j.label_box_2d || j.label_box, j.barcode, j.quality === 'scarsa');
      ws();
      const poor = j.quality === 'scarsa' ? ' Foto poco chiara (sfocata, buia o tagliata): riscattala, oppure incolla una foto migliore.' : '';
      scs('Etichetta letta.' + (onlineLabel ? ' Etichetta scaricata da internet: se non è quella giusta, rifai la foto.' : ''));
      if (g('producer') || g('cuvee')) { if (getCfg().autoDeep) await enrich(); else scs($('#scs').textContent + ' Per produzione, valore e fonti premi «Cerca dati ed etichetta».'); }
      scs($('#scs').textContent + poor);
    } catch (err) {
      aiWaitNote = null;
      try { await setPhoto(file, null); } catch (e2) { console.error(e2); }
      scs('Lettura non riuscita: ' + err.message);
      notice('Lettura non riuscita', esc(errorHint(err.message)) + '<br><br><small>Dettaglio: ' + esc(err.message) + '</small>', [{ t: 'Impostazioni', fn: openSettings }, { t: 'Chiudi', pri: true }]);
    }
  });

  // Intestazione con nome e dettagli, grafico della finestra di beva
  const updHead = () => {
    const nm = [g('producer'), g('cuvee')].filter(Boolean).join(' ');
    $('#dtitle').textContent = nm || (id ? 'Bottiglia senza nome' : b.wish ? 'Nuovo vino' : 'Nuova bottiglia');
    const st = $('#f_state') ? { in: 'In cantina', pend: 'In arrivo', wish: 'Nei desideri' }[$('#f_state').value] : (b.drunk ? 'Bevuta' : '');
    const sz = sizeOf();
    const pn = g('producer'), pc = pn ? Object.values(S.bottles).filter((x) => x.producer && sameProd(x.producer, pn)).length : 0;
    $('#dprod').innerHTML = pn && pc ? `<button class="link prodlink" type="button" data-a="producer" data-p="${esc(pn)}">Tutto su ${esc(pn)} ›</button>` : '';
    $('#dchips').innerHTML = [g('vintage'), g('type'), sz !== 750 ? sizeName(sz) : '', g('region'), st].filter(Boolean).map((x) => `<span>${esc(x)}</span>`).join('');
  };
  ['producer', 'cuvee', 'vintage', 'region'].forEach((k) => $('#f_' + k).addEventListener('input', updHead));
  ['type', 'size'].forEach((k) => $('#f_' + k).addEventListener('change', updHead));
  if ($('#f_state')) $('#f_state').addEventListener('change', updHead);
  updHead();
  const updDW = () => { const rg = drinkRange(dFrom, dTo, g('drink')); $('#dwin').innerHTML = rg ? drinkBar(rg[0], rg[1], num(g('vintage'))) : ''; };
  $('#f_drink').addEventListener('input', updDW);
  $('#f_vintage').addEventListener('input', updDW);
  updDW();
  // Primo posto libero
  $('#ffree').onclick = () => {
    const sel = $('#f_pos'), cur = sel.value, opt = [...sel.options].find((o) => o.value && (o.value !== cur || !cur));
    const pm2 = posMap(), free = [...sel.options].find((o) => o.value && !pm2[o.value]);
    const pick = free || opt;
    if (pick) { sel.value = pick.value; haptic(); scs('Posto scelto: ' + pick.parentNode.label + ', ' + pick.textContent.toLowerCase() + '.'); } else scs('Non ci sono posti liberi: aggiungi uno scaffale o ingrandiscine uno.');
  };
  // Codice a barre
  const useBarcode = async (code) => {
    if (!code) return;
    b.barcode = code;
    const found = byBarcode(code).filter((x) => x.id !== b.id);
    if (found.length && !id) {
      const f0 = found.find(inCellar) || found[0], n = groupOf(f0).filter(inCellar).length;
      notice('Ce l\'hai già', esc(name(f0) + (f0.vintage ? ' ' + f0.vintage : '')) + `: ${n} ${n === 1 ? 'bottiglia' : 'bottiglie'} in cantina. Vuoi aggiungere una bottiglia uguale, con le stesse informazioni?`, [
        { t: 'Aggiungi una uguale', pri: true, fn: async () => { d.close(); const x = { ...f0, id: gid(), shelf: null, r: 0, c: 0, added: Date.now(), pending: false, wish: false }; delete x.drunk; await persistBottle(x); if (S.shelves.length) { placeQ = [x.id]; tab = 'cantina'; render(); } } },
        { t: 'No, è un altro vino' }]);
      return;
    }
    scs('Cerco il codice ' + code + '…');
    const pr = await offProduct(code);
    if (!pr) { scs('Codice ' + code + ' salvato, ma non l\'ho trovato nell\'archivio libero Open Food Facts (molti vini non ci sono): fotografa l\'etichetta e compilo io.'); return; }
    if (pr.brand && !g('producer')) $('#f_producer').value = pr.brand;
    if (pr.name && !g('cuvee')) $('#f_cuvee').value = pr.name;
    if (pr.qty) setSize(mapSize(pr.qty));
    if (pr.img && !cur()) { try { photoFull = photo = pr.img; useFull = false; thumb = await makeLabelThumb(pr.img, null); labelThumb = true; onlineLabel = true; showPic(); } catch (_) {} }
    updHead(); ws(); showR();
    scs('Trovato su Open Food Facts: controlla produttore e cuvée.' + (aiReady() ? ' Per le informazioni premi «Cerca dati ed etichetta».' : ''));
  };
  $('#bcode').onclick = async () => useBarcode(await scanBarcode());
  if (!id && b.barcode) setTimeout(() => useBarcode(b.barcode), 50);

  // Stato, liste e degustazioni
  const stateOf = () => ($('#f_state') ? $('#f_state').value : 'in');
  if ($('#f_state')) $('#f_state').onchange = () => { const v = stateOf(); $('#f_etaw').hidden = v !== 'pend'; $('#f_wishi').hidden = v !== 'wish'; $('#f_posw').hidden = v !== 'in'; };
  d.querySelectorAll('[data-tag]').forEach((x) => x.onclick = () => {
    const cur = $('#f_tags').value.split(',').map((t) => t.trim()).filter(Boolean);
    if (!cur.includes(x.dataset.tag)) cur.push(x.dataset.tag);
    $('#f_tags').value = cur.join(', ');
  });
  const showT = () => {
    const ts = tastings.slice().sort((x, y) => String(y.date).localeCompare(String(x.date)));
    $('#tst').innerHTML = ts.length ? ts.map((t) => `<div class="tasting"><b>${esc(new Date(t.date).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' }))}</b>${t.rating ? ' <span class="stars">' + '★'.repeat(t.rating) + '☆'.repeat(5 - t.rating) + '</span>' : ''}${t.drunk ? ' <small>bottiglia aperta</small>' : ''}${t.notes ? '<p>' + esc(t.notes) + '</p>' : ''}</div>`).join('') : '<p class="info">Nessuna degustazione ancora. Aggiungine una quando assaggi questo vino, anche fuori casa.</p>';
  };
  showT();
  $('#addt').onclick = () => tastingDialog(name(build()), false, (t) => { tastings.push(t); showT(); });
  const build = () => {
    const p = g('pos'), [sh, r, c] = p ? p.split('|') : [null, 0, 0];
    const stv = stateOf();
    const nb = {
      ...b, producer: g('producer'), cuvee: g('cuvee'), vintage: num(g('vintage')), type: g('type'), size: sizeOf(), region: g('region'), aiAt, aiDeep,
      price: num(g('price')), value: num(g('value')), valueAuto: autoVal && g('value') !== '',
      buyDate: g('bdate'), buyWhere: g('bwhere'), buyNote: g('bnote'), grapes: g('grapes'), abv: num(g('abv')), lot: g('lot'), disg: g('disg'), dosage: g('dosage'),
      tags: [...new Set($('#f_tags').value.split(',').map((t) => t.trim()).filter(Boolean))], tastings: tastings.slice(),
      drink: g('drink'), drinkFrom: dFrom, drinkTo: dTo, pairing: g('pairing'),
      info: g('info'), winfo: g('winfo'), vinfo: g('vinfo'), prod: g('prod'), srcLinks, valueNote: autoVal && g('value') !== '' ? valueNote : '', touched: [...touched],
      thumb: photo || photoFull ? thumb : null, useFull, shelf: sh, r: +r, c: +c,
    };
    if (!b.drunk) {
      nb.wish = stv === 'wish';
      nb.pending = stv === 'pend';
      nb.eta = stv === 'pend' ? ($('#f_eta').value || '') : '';
      if (stv !== 'in') { nb.shelf = null; nb.r = 0; nb.c = 0; }
    }
    return nb;
  };
  const commit = async (nb) => {
    try {
      if (photo) {
        await dbPut('photos', photo, nb.id + ':c');
        if (photoFull && photoFull !== photo) await dbPut('photos', photoFull, nb.id + ':f'); else await dbDel('photos', nb.id + ':f');
        for (const x of siblings(nb)) { await dbDel('photos', x.id + ':c'); await dbDel('photos', x.id + ':f'); }
      } else if (photoFull) {
        await dbPut('photos', photoFull, nb.id + ':c'); await dbDel('photos', nb.id + ':f');
      } else { await dbDel('photos', nb.id + ':c'); await dbDel('photos', nb.id + ':f'); }
      if (retroChanged && retro) { await dbPut('photos', retro, nb.id + ':r'); for (const x of siblings(nb)) await dbDel('photos', x.id + ':r'); }
    } catch (e) { msg('Foto non salvata: ' + esc(e.message)); }
    await persistBottle(nb);
    await syncGroup(nb);
    // se arrivano le bottiglie ordinate (o compri un vino dei desideri), cambio stato anche alle uguali
    const moved = [];
    if ((state0 === 'pend' || state0 === 'wish') && stateOf() !== state0) {
      for (const x of siblings(nb)) if (!x.drunk && (state0 === 'pend' ? x.pending : x.wish)) {
        await persistBottle({ ...x, pending: nb.pending, wish: nb.wish, eta: nb.eta, shelf: null, r: 0, c: 0 });
        moved.push(x.id);
      }
    }
    // bottiglie uguali in più
    const qEl = $('#f_qty');
    const extra = qEl ? Math.max(0, Math.min(47, (+qEl.value || 0) - (id ? 0 : 1))) : 0;
    const made = [];
    for (let i = 0; i < extra; i++) {
      const x = { ...nb, id: gid(), shelf: null, r: 0, c: 0, added: Date.now() };
      delete x.drunk;
      if (b.drunk) { x.pending = false; x.wish = false; }
      await persistBottle(x);
      made.push(x.id);
    }
    d.close();
    if ((made.length || moved.length) && inCellar(S.bottles[nb.id]) && S.shelves.length) {
      placeQ = (nb.shelf ? [] : [nb.id]).concat(moved, made);
      tab = 'cantina'; render(); window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (made.length) { msg(made.length + ' bottiglie uguali aggiunte.'); setTimeout(() => msg(''), 4000); }
  };
  $('#sv').onclick = () => { haptic(); commit(build()); };
  $('#sv2').onclick = () => $('#sv').click();
  if ($('#svn')) $('#svn').onclick = async () => {
    const nb = build();
    await commit(nb);
    haptic();
    // la prossima nasce con gli stessi dati d'acquisto e nel posto libero successivo
    const pm2 = posMap(); let next = null;
    S.shelves.forEach((s) => { if (next) return; for (let r = 0; r < s.rows && !next; r++) for (let c = 0; c < s.cols && !next; c++) if (!pm2[s.id + '|' + r + '|' + c] && !placeQ.length) next = { shelf: s.id, r, c }; });
    openBottle(null, { buyDate: nb.buyDate, buyWhere: nb.buyWhere, buyNote: nb.buyNote, tags: nb.tags, pending: nb.pending, eta: nb.eta, wish: nb.wish, ...(next && inCellar(nb) ? next : {}) });
  };
  if ($('#drk')) $('#drk').onclick = () => tastingDialog(name(build()), true, async (t) => { const snap = snapIds(grp.map((x) => x.id)); const nb = build(); const how = t.how || 'bevuta'; if (how === 'bevuta' || t.rating || t.notes) nb.tastings = [...(nb.tastings || []), { date: t.date, rating: t.rating, notes: t.notes, drunk: how === 'bevuta' }]; nb.drunk = { date: t.date, rating: how === 'bevuta' ? t.rating : 0, notes: t.notes, how, ...(t.to ? { to: t.to } : {}) }; nb.shelf = null; nb.r = 0; nb.c = 0; await commit(nb); haptic(); showUndo(exitLabel(nb), snap); });
  if ($('#undrk')) $('#undrk').onclick = () => { const nb = build(); delete nb.drunk; nb.shelf = null; commit(nb); };
  if (id) {
    let armed = false;
    $('#del').onclick = (e) => {
      if (!armed) { armed = true; e.target.textContent = grp.length > 1 ? 'Conferma: elimino solo questa bottiglia' : 'Conferma eliminazione'; return; }
      (async () => { const snap = snapIds([id]); const ph = { [id + ':c']: await dbGet('photos', id + ':c'), [id + ':f']: await dbGet('photos', id + ':f') }; d.close(); await removeBottle(id); showUndo('Bottiglia eliminata', snap, ph); })();
    };
  }
  d.onclose = () => { if (picUrl) { URL.revokeObjectURL(picUrl); picUrl = null; } };
  if (!d.open) d.showModal();
}

function openPlace(sh, r, c) {
  const unAll = Object.values(S.bottles).filter((b) => !b.shelf && inCellar(b));
  const un = uniqW(unAll);
  const cnt = (b) => unAll.filter((x) => widOf(x) === widOf(b)).length;
  if (!un.length) return openBottle(null, { shelf: sh, r, c });
  const d = $('#dlg');
  d.innerHTML = `<h2>Cosa metto qui?</h2><p class="info">Scegli una bottiglia da posizionare o aggiungine una nuova.</p>` + un.map((b) => `<button class="row" data-p="${esc(b.id)}"><span style="display:flex;gap:12px">${imgSrc(b) ? `<img class="th" src="${imgSrc(b)}" alt="">` : ''}<span>${esc(name(b))} ${esc(b.vintage || '')}${isStd(b) ? '' : ' · ' + esc(sizeName(sizeMl(b)))}${cnt(b) > 1 ? ` <b class="qty">×${cnt(b)}</b>` : ''}</span></span></button>`).join('') + `<div class="acts"><button class="btn pri" id="pn">Nuova bottiglia</button><button class="btn" id="pc">Annulla</button></div>`;
  d.querySelectorAll('[data-p]').forEach((x) => x.onclick = () => { persistBottle({ ...S.bottles[x.dataset.p], shelf: sh, r, c }); d.close(); });
  $('#pn').onclick = () => { d.close(); openBottle(null, { shelf: sh, r, c }); };
  $('#pc').onclick = () => d.close();
  d.onclose = null;
  if (!d.open) d.showModal();
}

function openShelf(id) {
  const s = id ? S.shelves.find((x) => x.id === id) : { id: gid(), name: 'Scaffale ' + (S.shelves.length + 1), rows: 4, cols: 6 };
  const d = $('#dlg');
  d.innerHTML = `<h2>${id ? 'Modifica scaffale' : 'Nuovo scaffale'}</h2><label>Nome</label><input id="s_name" value="${esc(s.name)}">
  <div class="two"><div><label>Righe</label><input id="s_rows" type="number" min="1" max="30" value="${s.rows}"></div><div><label>Posti per riga</label><input id="s_cols" type="number" min="1" max="30" value="${s.cols}"></div></div>
  <div class="acts"><button class="btn pri" id="ssv">Salva</button><button class="btn" id="scl">Annulla</button>${id ? '<button class="btn" id="sdel">Elimina scaffale</button>' : ''}</div>`;
  $('#scl').onclick = () => d.close();
  $('#ssv').onclick = () => {
    const n = { id: s.id, name: $('#s_name').value.trim() || s.name, rows: Math.min(30, Math.max(1, +$('#s_rows').value || 1)), cols: Math.min(30, Math.max(1, +$('#s_cols').value || 1)) };
    S.shelves = id ? S.shelves.map((x) => (x.id === id ? n : x)) : [...S.shelves, n];
    // Le bottiglie fuori dalla nuova misura non si cancellano: tornano "da posizionare".
    Object.values(S.bottles).forEach((b) => { if (b.shelf === n.id && (b.r >= n.rows || b.c >= n.cols)) persistBottle({ ...b, shelf: null, r: 0, c: 0 }); });
    persistShelves(); d.close();
  };
  if (id) {
    let armed = false;
    $('#sdel').onclick = (e) => {
      if (!armed) { armed = true; e.target.textContent = 'Conferma: le bottiglie restano, senza posizione'; return; }
      S.shelves = S.shelves.filter((x) => x.id !== id);
      Object.values(S.bottles).forEach((b) => { if (b.shelf === id) persistBottle({ ...b, shelf: null, r: 0, c: 0 }); });
      persistShelves(); d.close();
    };
  }
  d.onclose = null;
  if (!d.open) d.showModal();
}

/* ===== Impostazioni e backup ===== */
async function enrichRecord(b0, noWeb) {
  const b = { ...b0 };
  if (!b.info) { const kp = knownProducerInfo(b.producer, b.id); if (kp) b.info = kp; }
  const r = await (noWeb ? quickInfo : deepInfo)({ knownProd: !!b.info, producer: b.producer, cuvee: b.cuvee, vintage: b.vintage, type: b.type, region: b.region, size: b.size, disg: b.disg, dosage: b.dosage });
  const j = r.j || {};
  const t = new Set(b.touched || []);
  const put = (k, f) => { if (typeof j[f] === 'string' && j[f].trim() && !t.has(k)) b[k] = j[f].trim(); };
  put('info', 'producer_info'); put('winfo', 'wine_info'); put('prod', 'production'); put('vinfo', 'vintage_info'); put('pairing', 'pairing');
  if (j.region && !b.region) b.region = j.region;
  if (!b.grapes && typeof j.grapes === 'string' && j.grapes.trim()) b.grapes = j.grapes.trim();
  if (!b.abv && Number(j.abv) > 0) b.abv = Number(j.abv);
  if (!b.dosage && typeof j.dosage === 'string' && j.dosage.trim()) b.dosage = j.dosage.trim();
  if (j.drink_text && !t.has('drink')) {
    b.drink = j.drink_text;
    b.drinkFrom = Number.isInteger(j.drink_from) ? j.drink_from : null;
    b.drinkTo = Number.isInteger(j.drink_to) ? j.drink_to : null;
  }
  const p = Number(j.price_eur);
  if (r.deep && Number.isFinite(p) && p > 0 && (b.value == null || b.value === '' || b.valueAuto)) {
    b.value = Math.round(p); b.valueAuto = true; b.valueNote = typeof j.price_note === 'string' ? j.price_note.trim() : '';
  }
  if (r.links.length) b.srcLinks = r.links;
  b.aiAt = Date.now(); b.aiDeep = !!r.deep;
  if (!b.thumb) {
    const ob = await offByName(b.producer, b.cuvee);
    if (ob) {
      try {
        b.thumb = await makeLabelThumb(ob, null);
        await dbPut('photos', ob, b.id + ':c'); await dbPut('photos', ob, b.id + ':f');
      } catch (_) {}
    }
  }
  return { b, deep: r.deep, limited: r.limited, quick: r.quick };
}
// Una bottiglia è "incompleta" se l'IA non l'ha mai elaborata e le mancano le informazioni.
const incomplete = (b) => (b.producer || b.cuvee) && !b.drunk && !b.aiAt && (!b.winfo || !b.info);
const noGrapes = (b) => (b.producer || b.cuvee) && !b.drunk && (!b.grapes || (b.type === 'bollicine' && !b.dosage));
/* Uvaggio, gradazione e dosaggio per le bottiglie che non li hanno: 15 vini per richiesta, senza ricerca web, costa quasi nulla. */
async function fillGrapes(onStep) {
  const todo = uniqW(Object.values(S.bottles).filter(noGrapes));
  let done = 0;
  for (let i = 0; i < todo.length; i += 15) {
    const part = todo.slice(i, i + 15);
    if (onStep) onStep('Uvaggi: ' + Math.min(i + 15, todo.length) + ' di ' + todo.length + '…');
    const list = part.map((b, k) => k + ': ' + [b.producer, b.cuvee, b.vintage, b.region, b.type].filter(Boolean).join(' · ')).join('\n');
    const j = await aiJson(`Per ciascun vino dell'elenco indica uvaggio (con percentuali se note), gradazione alcolica tipica e, solo per gli spumanti, il dosaggio. Usa le tue conoscenze: la scheda tecnica del produttore o il disciplinare della denominazione. Non inventare: se non lo sai, null.
${list}
Rispondi solo con JSON: {"items":[{"i":numero,"grapes":string|null,"abv":number|null,"dosage":string|null}]}`);
    for (const it of (j.items || [])) {
      const b0 = part[it.i]; if (!b0) continue;
      const cur = S.bottles[b0.id]; if (!cur) continue;
      const b = { ...cur };
      if (!b.grapes && typeof it.grapes === 'string' && it.grapes.trim()) b.grapes = it.grapes.trim();
      if (!b.abv && Number(it.abv) > 0) b.abv = Number(it.abv);
      if (b.type === 'bollicine' && !b.dosage && typeof it.dosage === 'string' && it.dosage.trim()) b.dosage = it.dosage.trim();
      if (b.grapes !== cur.grapes || b.abv !== cur.abv || b.dosage !== cur.dosage) { await persistBottle(b); await syncGroup(b); done++; }
    }
  }
  return done;
}
async function bulkEnrich(mode) {
  if (!aiReady()) { notice('Manca la chiave dell\'IA', 'Serve la chiave del servizio di IA, dalle Impostazioni.', [{ t: 'Apri le impostazioni', pri: true, fn: openSettings }, { t: 'Chiudi' }]); return; }
  let todo = uniqW(Object.values(S.bottles).filter((b) => (b.producer || b.cuvee) && !b.drunk)); // una ricerca per vino, non per bottiglia
  if (mode === 'web') todo = todo.filter((b) => !b.aiDeep);
  else if (mode !== 'all') todo = todo.filter(incomplete);
  const needG = uniqW(Object.values(S.bottles).filter(noGrapes)).length;
  if (!todo.length && needG && mode !== 'web') {
    const d0 = $('#dlg2');
    d0.innerHTML = `<h2>Aggiorno le bottiglie</h2><p id="bk_t" style="font-size:16px;margin:10px 0">Cerco gli uvaggi…</p><div class="acts"><button class="btn" id="bk_x">Chiudi</button></div>`;
    $('#bk_x').onclick = () => d0.close(); d0.onclose = null; if (!d0.open) d0.showModal();
    try { const n = await fillGrapes((t) => { $('#bk_t').textContent = t; }); $('#bk_t').textContent = 'Uvaggio aggiunto a ' + n + (n === 1 ? ' vino.' : ' vini.') + ' Le altre informazioni erano già complete.'; }
    catch (e) { $('#bk_t').textContent = 'Uvaggi non riusciti: ' + errorHint(e.message) + ' (' + e.message + ')'; }
    render(); return;
  }
  // prima quelle mai elaborate, poi le più vecchie
  todo.sort((a, b) => (a.aiAt || 0) - (b.aiAt || 0));
  if (!todo.length) {
    notice('Niente da aggiornare', mode === 'web' ? 'Tutte le bottiglie hanno già dati trovati con la ricerca web.' : 'Tutte le bottiglie sono già state completate. Per rifarle tutte usa «Aggiorna tutte le bottiglie».', [{ t: 'OK', pri: true }]);
    return;
  }
  const d = $('#dlg2');
  let stop = false;
  d.innerHTML = `<h2>Aggiorno le bottiglie</h2><p id="bk_t" style="font-size:16px;margin:10px 0">Preparo…</p><p class="info" id="bk_w"></p><div class="acts"><button class="btn" id="bk_x">Ferma</button></div>`;
  $('#bk_x').onclick = () => { stop = true; $('#bk_x').textContent = 'Mi fermo dopo questa…'; };
  d.onclose = null;
  if (!d.open) d.showModal();
  aiWaitNote = (s) => { const w = $('#bk_w'); if (w) w.textContent = 'Gemini chiede una pausa: riprendo da solo tra ' + s + ' secondi, non chiudere l\'app.'; };
  let ok = 0, noWeb = 0, note = '';
  for (let i = 0; i < todo.length && !stop; i++) {
    const cur = S.bottles[todo[i].id];
    if (!cur) continue;
    $('#bk_t').textContent = (i + 1) + ' di ' + todo.length + ': ' + name(cur) + (cur.vintage ? ' ' + cur.vintage : '') + '…';
    try {
      const r = await enrichRecord(cur, mode !== 'web' && getCfg().provider === 'anthropic');
      await persistBottle(r.b); // salvo sempre, anche senza ricerca web
      await syncGroup(r.b);
      ok++;
      if (!r.deep && !r.quick) noWeb++;
    } catch (e) { note = e.quota ? e.message + ' Premi di nuovo il pulsante più tardi: riparto dalle bottiglie rimaste.' : 'Mi fermo: ' + errorHint(e.message) + ' (' + e.message + ')'; break; }
    const w = $('#bk_w'); if (w) w.textContent = '';
    await sleep(1500);
  }
  let gN = 0;
  if (!stop && !note && mode !== 'web') { try { gN = await fillGrapes((t) => { $('#bk_t').textContent = t; }); } catch (_) {} }
  aiWaitNote = null;
  $('#bk_t').textContent = 'Aggiornati ' + ok + ' vini su ' + todo.length + '.' + (gN ? ' Uvaggio aggiunto a ' + gN + ' vini.' : '') + (noWeb ? ' ' + noWeb + ' senza ricerca web (solo conoscenze dell\'IA, valore non cambiato): potrai rifarle con «Rifai quelle senza ricerca web».' : '') + (note ? ' ' + note : '') + ' Controlla le schede: sono dati trovati dall\'IA.';
  $('#bk_x').textContent = 'Chiudi'; $('#bk_x').onclick = () => d.close();
  render();
}
function foldSections(d) {
  // raggruppa ogni titolo h3 delle impostazioni in una sezione che si apre e chiude
  let cur = null;
  [...d.children].forEach((el) => {
    if (el.matches('h2')) return;
    if (el.querySelector('[data-a=appupdate]') || el.querySelector('#c_close')) { cur = null; return; }
    if (el.matches('h3')) {
      cur = document.createElement('details'); cur.className = 'fold';
      const sm = document.createElement('summary'); sm.textContent = el.textContent; cur.append(sm);
      el.replaceWith(cur); return;
    }
    if (cur) cur.append(el);
  });
}
function openSettings() {
  const c = getCfg();
  const d = $('#dlg2');
  d.innerHTML = `<h2>Impostazioni</h2>
  <h3 style="margin:8px 0 4px;font-size:16px">Lettura etichette e informazioni automatiche</h3>
  <p class="badge" id="c_state"></p>
  <p class="info">Serve una chiave di un servizio di IA. La chiave resta solo su questo telefono. Senza chiave l'app funziona uguale, ma compili tu i campi.</p>
  <label>Servizio</label>
  <select id="c_prov"><option value="gemini" ${c.provider === 'gemini' ? 'selected' : ''}>Google Gemini</option><option value="anthropic" ${c.provider === 'anthropic' ? 'selected' : ''}>Anthropic Claude (a consumo)</option></select>
  <div id="c_gem"><label>Chiave Gemini</label><input id="c_gk" type="password" autocomplete="off" value="${esc(c.geminiKey)}"><label>Modello Gemini</label><input id="c_gm" value="${esc(c.geminiModel)}"></div>
  <div id="c_ant"><label>Chiave Anthropic</label><input id="c_ak" type="password" autocomplete="off" value="${esc(c.anthropicKey)}"><label>Modello Anthropic</label><input id="c_am" value="${esc(c.anthropicModel)}"></div>
  <p class="info">Gemini gratuito ha un limite giornaliero per ogni modello: quando uno finisce, l'app passa da sola ai modelli di riserva (${GEM_MODELS.map(esc).join(', ')}), e se Google chiede una pausa di qualche secondo aspetta e riprova. I limiti si azzerano ogni giorno verso le 9 del mattino. Google può usare i dati inviati gratis per migliorare i suoi prodotti. Gemini con fatturazione attiva o Anthropic: nessun limite stretto, si paga solo ciò che usi.</p>
  <p class="info" id="c_gx"></p>
  <label class="chk"><input type="checkbox" id="c_auto" ${c.autoDeep ? 'checked' : ''}> Ricerca approfondita automatica</label>
  <p class="info">Acceso: dopo ogni scansione e quando scrivi il nome, l'app cerca da sola produzione, valore e fonti (usa più richieste, il limite gratuito finisce prima). Spento: lo fa solo quando premi «Cerca dati ed etichetta». La ricerca dell'etichetta online resta sempre automatica.</p>
  <div class="acts"><button class="btn pri" id="c_save">Salva</button><button class="btn" id="c_test">Prova la connessione</button></div>
  <p class="info" id="c_msg"></p>
  <h3 style="margin:16px 0 4px;font-size:16px">Aggiorna le bottiglie già inserite</h3>
  <p class="info">Cerca con l'IA informazioni, produzione, quando berla, valore di mercato ed etichetta. I campi che hai scritto tu e i valori inseriti a mano non vengono toccati. Ogni bottiglia viene salvata appena pronta: se il limite gratuito finisce, la volta dopo riparte da quelle rimaste.</p>
  <div class="acts"><button class="btn" id="b_bulk">Completa quelle incomplete (${uniqW(Object.values(S.bottles).filter((b) => incomplete(b) || noGrapes(b))).length})</button><button class="btn" id="b_web">Cerca sul web quelle senza ricerca (circa 3 cent. a vino con Claude) (${uniqW(Object.values(S.bottles).filter((b) => (b.producer || b.cuvee) && !b.drunk && !b.aiDeep)).length})</button><button class="btn" id="b_all">Aggiorna tutte le bottiglie</button></div>
  ${backupSection()}
  <div class="acts"><button class="btn" id="b_exp">Esporta backup</button><label class="btn">Importa backup<input type="file" accept="application/json,.json" hidden id="b_imp"></label></div>
  <h3 style="margin:16px 0 4px;font-size:16px">Importa da Excel, Vivino o CellarTracker</h3>
  <p class="info">Un file CSV con una riga per vino (anche esportato da Vivino o CellarTracker, o da un tuo foglio Excel salvato come CSV). Riconosco da solo colonne come produttore, vino, annata, tipo, formato, zona, quantità e prezzo.</p>
  <div class="acts"><label class="btn">Importa file CSV<input type="file" accept=".csv,text/csv,text/plain" hidden id="b_csv"></label></div>
  <p class="info" id="b_msg"></p>
  <h3 style="margin:16px 0 4px;font-size:16px">I miei calici</h3>
  <p class="info">${GLASSES.length ? GLASSES.length + ' calici inseriti.' : 'Nessun calice inserito.'} Servono per consigliarti il calice giusto per ogni bottiglia.</p>
  <div class="acts"><button class="btn" data-a="glasses" type="button">Gestisci i calici</button></div>
  <h3 style="margin:16px 0 4px;font-size:16px">Spazio sul telefono</h3>
  <p class="info">Alleggerisce le foto troppo grandi e toglie i doppioni, senza perdita visibile di qualità.</p>
  <div class="acts"><button class="btn" id="o_go">Ottimizza le foto</button></div><p class="info" id="o_msg"></p>
  <p class="info">Versione dell'app: ${APP_VERSION} <button class="link" data-a="appupdate" type="button">Aggiorna adesso</button></p>
  <div class="acts"><button class="btn" id="c_close">Chiudi</button></div>`;
  const showState = () => { const cc = getCfg(); const k = cc.provider === 'anthropic' ? cc.anthropicKey : cc.geminiKey; $('#c_state').textContent = k ? 'Chiave salvata (' + k.slice(0, 4) + '…, ' + k.length + ' caratteri)' : 'Chiave mancante'; };
  showState();
  const sync = () => { const a = $('#c_prov').value === 'anthropic'; $('#c_gem').hidden = a; $('#c_ant').hidden = !a; };
  sync();
  $('#c_prov').onchange = sync;
  const read = () => ({ provider: $('#c_prov').value, geminiKey: $('#c_gk').value.trim(), geminiModel: $('#c_gm').value.trim() || DEF.geminiModel, anthropicKey: $('#c_ak').value.trim(), anthropicModel: $('#c_am').value.trim() || DEF.anthropicModel, autoDeep: $('#c_auto').checked });
  $('#c_save').onclick = () => { setCfg(read()); showState(); render(); $('#c_msg').textContent = 'Impostazioni salvate.'; };
  $('#c_test').onclick = async () => {
    setCfg(read());
    if (!aiReady()) { $('#c_msg').textContent = 'Inserisci prima la chiave.'; return; }
    $('#c_msg').textContent = 'Provo…';
    try { await aiJson('Rispondi solo con questo JSON: {"ok":true}'); $('#c_msg').textContent = 'Funziona.'; showState(); render(); }
    catch (e) { $('#c_msg').textContent = 'Non funziona: ' + e.message + ' ' + errorHint(e.message); }
  };
  $('#c_close').onclick = () => d.close();
  $('#b_bulk').onclick = () => bulkEnrich('incomplete');
  $('#b_web').onclick = () => bulkEnrich('web');
  $('#b_all').onclick = () => notice('Aggiornare tutte le bottiglie?', 'Rifaccio la ricerca per tutti i vini (' + uniqW(Object.values(S.bottles).filter((b) => (b.producer || b.cuvee) && !b.drunk)).length + '). Con Gemini gratuito può servire più di un giorno: riparte sempre da quelle aggiornate da più tempo.', [{ t: 'Aggiorna tutte', pri: true, fn: () => bulkEnrich('all') }, { t: 'Annulla' }]);
  const showGx = () => {
    const x = gemx(), ks = Object.keys(x).filter((k) => x[k] - Date.now() > 300000);
    $('#c_gx').innerHTML = ks.length ? 'Esauriti per oggi: ' + ks.map((k) => esc(k.replace('|s', ' (ricerca web)'))).join(', ') + '. Si azzerano ' + esc(resetTime()) + '. <button class="link" id="c_gxr" type="button">Riprova comunque</button>' : '';
    if ($('#c_gxr')) $('#c_gxr').onclick = () => { gemxClear(); showGx(); };
  };
  showGx();
  $('#b_exp').onclick = exportBackup;
  $('#b_imp').onchange = importBackup;
  $('#b_csv').onchange = importCsv;
  $('#o_go').onclick = optimizePhotos;
  bindBackupSection();
  foldSections(d);
  d.onclose = null;
  if (!d.open) d.showModal();
}

async function optimizePhotos() {
  const m = $('#o_msg');
  m.textContent = 'Controllo le foto…';
  try {
    const keys = await req('photos', 'readonly', (s) => s.getAllKeys());
    let before = 0, after = 0, n = 0;
    for (const k of keys) {
      const bl = await dbGet('photos', k);
      if (!bl) continue;
      before += bl.size;
      const id = String(k).slice(0, -2);
      if (!S.bottles[id]) { await dbDel('photos', k); continue; } // foto di bottiglie eliminate
      if (String(k).endsWith(':f')) { const c = await dbGet('photos', id + ':c'); if (c && c.size === bl.size) { await dbDel('photos', k); continue; } }
      let out = bl;
      if (bl.size > 350000) {
        const im = await loadImg(bl);
        if (Math.max(im.naturalWidth, im.naturalHeight) > 1600 || bl.size > 700000) {
          const nb = await canvasBlob(await drawCrop(bl, null, 1600), 0.85);
          if (nb && nb.size < bl.size) { await dbPut('photos', nb, k); out = nb; n++; }
        }
      }
      after += out.size;
      m.textContent = 'Ottimizzo… ' + n + ' foto alleggerite';
    }
    m.textContent = 'Fatto: le foto occupavano ' + (before / 1048576).toFixed(1).replace('.', ',') + ' MB, ora ' + (after / 1048576).toFixed(1).replace('.', ',') + ' MB.';
  } catch (e) { m.textContent = 'Non riuscito: ' + e.message; }
}

async function exportBackup() {
  const m = $('#b_msg');
  m.textContent = 'Preparo il backup…';
  try {
    const bottles = [];
    for (const b of Object.values(S.bottles)) {
      const c = await dbGet('photos', b.id + ':c'), f = await dbGet('photos', b.id + ':f'), rr = await dbGet('photos', b.id + ':r');
      bottles.push({ ...b, photoC: c ? await blobToDataURL(c) : null, photoF: f ? await blobToDataURL(f) : null, photoR: rr ? await blobToDataURL(rr) : null });
    }
    const data = JSON.stringify({ app: 'cantina', version: 1, exported: new Date().toISOString(), shelves: S.shelves, glasses: GLASSES, bottles });
    const fname = 'cantina-backup-' + new Date().toISOString().slice(0, 10) + '.json';
    const file = new File([data], fname, { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: 'Backup cantina' }); m.textContent = 'Backup pronto.'; return; }
      catch (e) { if (e.name === 'AbortError') { m.textContent = ''; return; } }
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file); a.download = fname;
    document.body.appendChild(a); a.click(); a.remove();
    m.textContent = 'Backup scaricato.';
  } catch (e) { m.textContent = 'Backup non riuscito: ' + e.message; }
}

async function importBackup(e) {
  const m = $('#b_msg'), file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const j = JSON.parse(await file.text());
    if (j.app !== 'cantina' || !Array.isArray(j.bottles)) throw new Error('non è un backup di questa app');
    if (!confirm(`Importare ${j.bottles.length} bottiglie? Quelle con lo stesso codice vengono aggiornate, le altre restano.`)) return;
    m.textContent = 'Importo…';
    for (const x of j.bottles) {
      const { photoC, photoF, photoR, ...b } = x;
      b.upd = Date.now();
      await dbPut('bottles', b);
      if (photoR) await dbPut('photos', await dataURLToBlob(photoR), b.id + ':r');
      if (photoC) await dbPut('photos', await dataURLToBlob(photoC), b.id + ':c');
      if (photoF) await dbPut('photos', await dataURLToBlob(photoF), b.id + ':f');
      S.bottles[b.id] = b;
    }
    if (Array.isArray(j.shelves) && j.shelves.length) { S.shelves = j.shelves; await dbPut('kv', S.shelves, 'shelves'); }
    if (Array.isArray(j.glasses) && j.glasses.length) { GLASSES = j.glasses; await saveGlasses(); }
    render();
    m.textContent = 'Importazione completata.';
  } catch (err) { m.textContent = 'Importazione non riuscita: ' + err.message; }
}

/* ===== Aggiorna l'app senza chiuderla ===== */
async function forceUpdate() {
  msg('Cerco l\'ultima versione…');
  try {
    const r = navigator.serviceWorker && await navigator.serviceWorker.getRegistration();
    if (r) await r.update();
  } catch (_) {}
  // tolgo la copia salvata dei file dell'app (non i tuoi dati: bottiglie, foto e calici restano)
  try { const ks = await caches.keys(); await Promise.all(ks.filter((k) => k.startsWith('cantina-v')).map((k) => caches.delete(k))); } catch (_) {}
  try { sessionStorage.setItem('cantina.updatedFrom', APP_VERSION); } catch (_) {}
  location.reload();
}
(function () {
  try {
    const from = sessionStorage.getItem('cantina.updatedFrom');
    if (from) { sessionStorage.removeItem('cantina.updatedFrom'); setTimeout(() => { msg(from === APP_VERSION ? 'Hai già l\'ultima versione (' + APP_VERSION + ').' : 'Aggiornata alla versione ' + APP_VERSION + '.'); setTimeout(() => msg(''), 4000); }, 300); }
  } catch (_) {}
})();

/* ===== Comandi ===== */
document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-a]');
  if (!t) return;
  const a = t.dataset.a;
  if (a === 'tab') { tab = t.dataset.t; if (tab === 'luna') { calMode = 'month'; syncCal(); } render(); }
  else if (a === 'new') openBottle(null, tab === 'lista' && flt.view === 'wish' ? { wish: true } : tab === 'lista' && flt.view === 'pend' ? { pending: true } : {});
  else if (a === 'newShelf') openShelf(null);
  else if (a === 'settings') openSettings();
  else if (a === 'appupdate') forceUpdate();
  else if (a === 'fchip') { const k = t.dataset.k; flt[k] = flt[k] === t.dataset.v ? '' : t.dataset.v; render(); }
  else if (a === 'fclear') { flt[t.dataset.k] = ''; render(); }
  else if (a === 'fltsheet') { const d2 = $('#dlg2'); d2.innerHTML = fltSheetHtml(); d2.onclose = null; if (!d2.open) d2.showModal(); }
  else if (a === 'fltdone') { $('#dlg2').close(); }
  else if (a === 'keylater') { try { localStorage.setItem('cantina.keyLater', String(Date.now() + 30 * 86400000)); } catch (_) {} render(); }
  else if (a === 'bkwizard') { const d1 = $('#dlg2'); if (d1.open) d1.close(); openWizard(); }
  else if (a === 'bklater') { try { localStorage.setItem('cantina.bkLater', String(Date.now() + 14 * 86400000)); } catch (_) {} render(); }
  else if (a === 'producer') producerPage(t.dataset.p);
  else if (a === 'openp') { ['#dlg2', '#dlg'].forEach((x) => { if ($(x).open) $(x).close(); }); openBottle(t.dataset.id); }
  else if (a === 'day') { dayOff = t.dataset.o !== undefined ? +t.dataset.o : dayOff + (+t.dataset.d); syncCal(); render(); }
  else if (a === 'calday') { if (Date.now() - swallowClick < 400) return; dayOff = +t.dataset.o; render(); }
  else if (a === 'cal') calShift(+t.dataset.d);
  else if (a === 'calyear') { calMode = 'year'; render(); }
  else if (a === 'calmonth') { calMode = 'month'; calM = +t.dataset.m; render(); }
  else if (a === 'caltoday') { dayOff = 0; calMode = 'month'; syncCal(); render(); }
  else if (a === 'editShelf') openShelf(t.dataset.id);
  else if (a === 'open') openBottle(t.dataset.id);
  else if (a === 'jump') { const el = document.getElementById('az-' + (t.dataset.l === '#' ? 'x' : t.dataset.l)); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  else if (a === 'view') { flt.view = t.dataset.v; flt.stat = ''; if (flt.view === 'drunk' && flt.sort === 'drink') flt.sort = 'az'; render(); }
  else if (a === 'clearflt') { flt = { ...flt, type: '', stat: '', region: '', vint: '', size: '', tag: '', sort: 'az' }; q = ''; if ($('#dlg2').open) $('#dlg2').close(); render(); }
  else if (a === 'pdf') exportPdf();
  else if (a === 'carta') openCarta();
  else if (a === 'glasses') { ['#dlg', '#dlg2'].forEach((x) => { if ($(x).open) $(x).close(); }); tab = 'calici'; render(); window.scrollTo({ top: 0 }); }
  else if (a === 'glass') { const gl = GLASSES.find((x) => x.id === t.dataset.id); if (gl) glassDetail(gl); }
  else if (a === 'gshape') glassDetail(null, t.dataset.s);
  else if (a === 'glassnew') glassEdit({ id: gid(), shape: 'universale', name: '', qty: null }, true);
  else if (a === 'csv') exportCsv();
  else if (a === 'ics') exportIcs();
  else if (a === 'pair') pairNow();
  else if (a === 'pairmenu') pairMenu();
  else if (a === 'soon') { tab = 'lista'; flt = { ...flt, view: 'in', stat: '', sort: 'drink' }; render(); window.scrollTo({ top: 0 }); }
  else if (a === 'pmode') { pairMode = t.dataset.m; render(); }
  else if (a === 'asksend') { const ta = $('#ask'); askSend(ta ? ta.value : ''); }
  else if (a === 'askex') askSend(t.dataset.q);
  else if (a === 'askclear') { askLog = []; render(); }
  else if (a === 'mreg') pickRegion(+t.dataset.i, true);
  else if (a === 'cancelMove') { moving = null; render(); }
  else if (a === 'placeStop') { placeQ = []; render(); }
  else if (a === 'unplace') { const m = S.bottles[moving]; moving = null; if (m) { const snap = snapIds([m.id]); persistBottle({ ...m, shelf: null, r: 0, c: 0 }); showUndo('Tolta dallo scaffale', snap); } else render(); }
  else if (a === 'locate') locate(t.dataset.id);
  else if (a === 'scanfind') scanFind();
  else if (a === 'slot') {
    if (Date.now() - justDragged < 600) return;
    const sh = t.dataset.s, r = +t.dataset.r, c = +t.dataset.c, b = posMap()[sh + '|' + r + '|' + c];
    if (placeQ.length && !b) {
      const id = placeQ.shift();
      if (S.bottles[id]) { persistBottle({ ...S.bottles[id], shelf: sh, r, c }); haptic(); }
      return;
    }
    if (moving) {
      const id = moving;
      moving = null;
      if (b && b.id === id) { render(); return; }
      moveTo(id, sh, r, c);
      return;
    }
    if (!b) { openPlace(sh, r, c); return; }
    notice(name(b) + (b.vintage ? ' ' + b.vintage : ''), 'Cosa vuoi fare?', [{ t: 'Apri scheda', pri: true, fn: () => openBottle(b.id) }, { t: 'Sposta', fn: () => { moving = b.id; tab = 'cantina'; render(); window.scrollTo({ top: 0, behavior: 'smooth' }); } }, { t: 'Chiudi' }]);
  }
});
document.addEventListener('change', (e) => {
  const k = e.target && e.target.dataset && e.target.dataset.flt;
  if (k) { flt[k] = e.target.value; render(); }
  else if (e.target.id === 'caljump' && e.target.value) {
    const [y, m, d] = e.target.value.split('-').map(Number);
    dayOff = offOf(y, m - 1, d); calMode = 'month'; syncCal(); render();
    const el = $('#lunaday'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
});
document.addEventListener('input', (e) => {
  if (e.target.id === 'q') { q = e.target.value; const p = e.target.selectionStart; render(); const i = $('#q'); i.focus(); i.setSelectionRange(p, p); }
});

/* ===== Avvio ===== */
(async () => {
  try {
    db = await openDB();
    const bs = await req('bottles', 'readonly', (s) => s.getAll());
    S.bottles = {};
    bs.forEach((b) => { S.bottles[b.id] = b; });
    S.shelves = (await dbGet('kv', 'shelves')) || [];
    await loadGlasses(); await ensureGlassIds();
  } catch (e) { msg('Non riesco ad aprire il salvataggio sul telefono: ' + esc(e.message)); }
  render();
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  if ('serviceWorker' in navigator) {
    // quando arriva una versione nuova, ricarico una volta sola per mostrarla subito
    const hadCtl = !!navigator.serviceWorker.controller;
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadCtl && !reloaded) { reloaded = true; location.reload(); } });
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then((r) => {
      r.update().catch(() => {});
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') r.update().catch(() => {}); });
    }).catch(() => {});
  }
})();
