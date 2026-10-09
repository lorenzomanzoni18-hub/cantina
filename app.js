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

/* ===== Stato ===== */
let S = { shelves: [], bottles: {} };
let dayOff = 0, tab = 'cantina', q = '', px = null;

document.addEventListener('pointerdown', (e) => { px = e.target.closest('.dialwrap') ? e.clientX : null; });
document.addEventListener('pointerup', (e) => {
  if (px === null) return;
  const dx = e.clientX - px;
  px = null;
  if (Math.abs(dx) > 40) { dayOff = Math.max(-7, Math.min(60, dayOff + (dx < 0 ? 1 : -1))); render(); }
});

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
  delete S.bottles[id];
  render();
  try {
    await dbDel('bottles', id);
    await dbDel('photos', id + ':c');
    await dbDel('photos', id + ':f');
  } catch (e) { msg('Eliminazione non riuscita: ' + esc(e.message)); }
}

/* ===== Impostazioni e IA ===== */
const APP_VERSION = '12';
const CFG_KEY = 'cantina.cfg';
const DEF = { provider: 'gemini', geminiKey: '', geminiModel: 'gemini-3.1-flash-lite', anthropicKey: '', anthropicModel: 'claude-haiku-5-5' };
function getCfg() { try { return { ...DEF, ...JSON.parse(localStorage.getItem(CFG_KEY) || '{}') }; } catch (_) { return { ...DEF }; } }
function setCfg(c) { try { localStorage.setItem(CFG_KEY, JSON.stringify(c)); } catch (_) {} }
function errorHint(msg) {
  const m = String(msg || '').toLowerCase();
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
  d.showModal();
}
function aiReady() { const c = getCfg(); return !!(c.provider === 'anthropic' ? c.anthropicKey : c.geminiKey); }

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
    const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(c.geminiModel) + ':generateContent', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': c.geminiKey },
      body: JSON.stringify({ contents: [{ parts }], generationConfig: { temperature: 0.2, responseMimeType: 'application/json' } }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error((j.error && j.error.message) || 'Errore ' + r.status);
    text = (((j.candidates || [])[0] || {}).content || { parts: [] }).parts.map((x) => x.text || '').join('');
  }
  const a = text.indexOf('{'), z = text.lastIndexOf('}');
  if (a < 0 || z < a) throw new Error('La risposta non era nel formato atteso. Riprova.');
  return JSON.parse(text.slice(a, z + 1));
}

async function aiSearch(prompt) {
  const c = getCfg();
  let text = '', links = [];
  if (c.provider === 'anthropic') {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': c.anthropicKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({ model: c.anthropicModel, max_tokens: 2000, tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }], messages: [{ role: 'user', content: prompt }] }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error((j.error && j.error.message) || 'Errore ' + r.status);
    for (const x of j.content || []) {
      if (x.type === 'text') text += x.text || '';
      if (x.type === 'web_search_tool_result' && Array.isArray(x.content)) x.content.forEach((y) => y.url && links.push({ t: y.title || y.url, u: y.url }));
    }
  } else {
    const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(c.geminiModel) + ':generateContent', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': c.geminiKey },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], tools: [{ google_search: {} }], generationConfig: { temperature: 0.2 } }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error((j.error && j.error.message) || 'Errore ' + r.status);
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

const INFO_RULES = `Scrivi in italiano. Non inventare: niente punteggi, premi, date o dati che non conosci con buona certezza; usa stringa vuota o null per ciò che non sai. Se non conosci questo vino in particolare, scrivi informazioni generali su tipo, zona e uve e inizia quel testo con "Indicazione generica:".
Campi informativi:
"producer_info": 3-5 frasi sul produttore (dove si trova, filosofia, stile, cosa lo rende noto);
"wine_info": 3-5 frasi sulla cuvée e sulla bottiglia (uve, vinificazione, affinamento, profilo di degustazione);
"vintage_info": 2-3 frasi sull'annata in quella zona (andamento climatico, carattere dei vini);
"drink_text": 1-2 frasi su quando berla, in base a tipo di vino, annata e parere comune di critici e guide: indica la finestra con anni, il picco e se è pronta adesso o da aspettare;
"drink_from" e "drink_to": anni (numeri) di inizio e fine della finestra ideale, oppure null;
"pairing": 3-4 abbinamenti migliori, in una frase breve;
"price_eur": prezzo indicativo di mercato per una bottiglia da 75 cl in euro, oppure null se incerto.`;

function scanPrompt() {
  return `Questa è la foto di una bottiglia o di un'etichetta di vino. Siamo nel ${new Date().getFullYear()}. Rispondi solo con un oggetto JSON con questi campi:
{"producer":string|null,"cuvee":string|null,"vintage":number|null,"type":"rosso"|"bianco"|"bollicine"|"rosato"|"altro","region":string|null,"barcode":string|null,"box":{"left":0-1,"top":0-1,"right":0-1,"bottom":0-1}|null,"label_box":{"left":0-1,"top":0-1,"right":0-1,"bottom":0-1}|null,"quality":"buona"|"scarsa","producer_info":string,"wine_info":string,"vintage_info":string,"drink_text":string,"drink_from":number|null,"drink_to":number|null,"pairing":string,"price_eur":number|null}
"box" è il rettangolo che contiene la bottiglia intera (o solo l'etichetta se la bottiglia non si vede), in frazioni di larghezza e altezza dell'immagine. "label_box" è il rettangolo stretto della sola etichetta frontale principale (senza collo, capsula o sfondo), nello stesso formato; null se l'etichetta non si vede. "quality" è "scarsa" se la foto è sfocata, buia, tagliata o l'etichetta è poco leggibile. "barcode" contiene solo le cifre del codice a barre, se leggibili. Per produttore, cuvée, annata, zona e codice usa null se non li leggi con certezza.
${INFO_RULES}`;
}
function deepPrompt(b) {
  return `Cerca sul web informazioni precise e verificabili su questo vino: produttore ${b.producer || 'non indicato'}, cuvée ${b.cuvee || 'non indicata'}, annata ${b.vintage || 'non indicata'}${b.region ? ', zona ' + b.region : ''}. Siamo nel ${new Date().getFullYear()}.
Consulta il sito del produttore, guide e riviste, Wine-Searcher, Vivino, CellarTracker, enoteche e case d'asta.
Rispondi SOLO con un oggetto JSON, senza altro testo, con questi campi:
{"type":"rosso"|"bianco"|"bollicine"|"rosato"|"altro"|null,"region":string|null,"producer_info":string,"wine_info":string,"production":string,"vintage_info":string,"drink_text":string,"drink_from":number|null,"drink_to":number|null,"pairing":string,"price_eur":number|null,"price_note":string}
- producer_info: storia, proprietà, ettari e filosofia dell'azienda, 5-8 frasi.
- wine_info: uve e percentuali, vigneto (suolo, altitudine, esposizione), vinificazione, affinamento (contenitori e mesi), gradazione alcolica, stile e profilo di degustazione, 5-8 frasi.
- production: numero di bottiglie prodotte per questa annata (o la produzione media annua) e resa, solo se lo trovi in una fonte; altrimenti "Dato non reperito".
- vintage_info: andamento climatico dell'annata nella zona e giudizio generale, con eventuali punteggi di critici con la fonte.
- price_eur: prezzo medio di mercato attuale in euro per una bottiglia da 0,75 litri di QUESTA annata, preso da Wine-Searcher, aste o enoteche. Non stimarlo a memoria: se non trovi un prezzo per questa annata usa null.
- price_note: fonte e fascia di prezzo trovate, per esempio "Wine-Searcher: 85-120 €, media 98 €".
Regole: scrivi in italiano. Riporta solo ciò che trovi nelle fonti; per ogni dato che non trovi scrivi "Dato non reperito" invece di inventare. Cita la fonte tra parentesi per i numeri importanti. Se non conosci questo vino in particolare, dillo e inizia il testo con "Indicazione generica:".`;
}
async function deepInfo(b) {
  let limited = false;
  try {
    const r = await aiSearch(deepPrompt(b));
    const a = r.text.indexOf('{'), z = r.text.lastIndexOf('}');
    if (a >= 0 && z > a) { try { return { j: JSON.parse(r.text.slice(a, z + 1)), links: r.links, deep: true }; } catch (_) {} }
  } catch (e) { if (/api key|network|fetch|load failed/i.test(e.message)) throw e; limited = /quota|429|exhausted|rate/i.test(e.message); }
  const j = await aiJson(enrichPrompt(b));
  if (j) j.price_eur = null;
  return { j, links: [], deep: false, limited };
}
function enrichPrompt(b) {
  return `Bottiglia di vino: produttore ${b.producer || 'non indicato'}, cuvée ${b.cuvee || 'non indicata'}, annata ${b.vintage || 'non indicata'}, tipo ${b.type}, zona ${b.region || 'non indicata'}. Siamo nel ${new Date().getFullYear()}. Rispondi solo con un oggetto JSON con questi campi:
{"type":"rosso"|"bianco"|"bollicine"|"rosato"|"altro"|null,"region":string|null,"producer_info":string,"wine_info":string,"vintage_info":string,"drink_text":string,"drink_from":number|null,"drink_to":number|null,"pairing":string,"price_eur":number|null}
${INFO_RULES}`;
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
const ic=(t,s,x,y)=>`<g transform="translate(${x-s/2} ${y-s/2}) scale(${s/24})" fill="none" stroke="#1E2824" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${ICO[t]}</g>`;
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
  s+=ic(c[2],28,120,92)+`<text x="120" y="124" font-size="17" font-weight="600" text-anchor="middle" style="fill:var(--ink)">${today0?c[2][0].toUpperCase()+c[2].slice(1):new Date(d0).toLocaleDateString('it-IT',{weekday:'short',day:'numeric'})}</text><text x="120" y="142" font-size="11" text-anchor="middle" style="fill:var(--mute)">${today0?(ok?'buon giorno':'meglio aspettare'):'a mezzogiorno: '+c[2]}</text>`;
  const leg=['frutto','fiore','radice','foglia'].map(t=>`<span style="display:inline-flex;align-items:center;gap:3px;margin:0 6px"><svg width="18" height="18" viewBox="0 0 18 18"><circle cx="9" cy="9" r="9" fill="${COL[t]}" fill-opacity="${t==='frutto'||t==='fiore'?1:.4}"/>${ic(t,12,9,9)}</svg>${t}</span>`).join('');
  return `<div class="dialwrap" style="touch-action:pan-y"><svg viewBox="0 0 240 240" style="width:100%;max-width:260px;display:block;margin:0 auto" role="img" aria-label="Quadrante del giorno">${s}</svg></div><div class="info" style="text-align:center;margin:6px 0">${leg}</div>`}
function dayStart(o){const b=new Date();b.setDate(b.getDate()+o);return new Date(b.getFullYear(),b.getMonth(),b.getDate()).getTime()}
function dayFrac(d0){let g=0;for(let m=0;m<1440;m+=10)if(isGood(kind(d0+(m+5)*60000)))g++;return g/144}
function nav(){let chips='';for(let o=0;o<14;o++){const d0=dayStart(o),f=dayFrac(d0),col=f>=.6?'#4C9A6A':f>0?'#D9A441':'#B85C5C',dt=new Date(d0);
    chips+=`<button class="chip${o===dayOff?' on':''}" data-a="day" data-o="${o}"><span>${dt.toLocaleDateString('it-IT',{weekday:'short'})}</span><b>${dt.getDate()}</b><i style="background:${col}"></i></button>`}
  const lab=dayOff===0?'Oggi':new Date(dayStart(dayOff)).toLocaleDateString('it-IT',{weekday:'long',day:'numeric',month:'long'});
  return `<div class="dnav"><button class="link" data-a="day" data-d="-1">‹</button><b>${lab}</b><button class="link" data-a="day" data-d="1">›</button></div><div class="strip">${chips}</div><p class="info" style="margin:2px 0 6px">Verde: giorno buono. Giallo: buono solo in certi orari. Rosso: da evitare. Scorri il quadrante di lato per cambiare giorno.</p>`}
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
const keyBanner = () => aiReady() ? '' : `<div class="note"><b>Lettura automatica spenta.</b> Per scansionare le etichette serve la chiave dell'IA. <button class="link" data-a="settings">Apri le impostazioni</button></div>`;
function name(b) { return [b.producer, b.cuvee].filter(Boolean).join(' ') || 'Bottiglia senza nome'; }
function posMap() { const m = {}; Object.values(S.bottles).forEach((b) => { if (b.shelf) m[b.shelf + '|' + b.r + '|' + b.c] = b; }); return m; }
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
  const bs = Object.values(S.bottles);
  const spent = bs.reduce((a, b) => a + (b.price || 0), 0);
  const val = bs.reduce((a, b) => a + (b.value ?? b.price ?? 0), 0);
  $('#tot').innerHTML = `<div><b>${bs.length}</b>bottiglie</div><div><b>${eur(spent)}</b>speso</div><div><b>${eur(val)}</b>valore stimato</div>`;
  document.querySelectorAll('nav [data-t]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.t === tab));
  $('#app').innerHTML = tab === 'cantina' ? cantina() : lista(bs);
}

let moving = null;
function moveTo(id, sh, r, c) {
  const m = S.bottles[id];
  if (!m) return;
  const b = posMap()[sh + '|' + r + '|' + c];
  if (b && b.id === m.id) return;
  const from = { shelf: m.shelf, r: m.r, c: m.c };
  if (b) persistBottle({ ...b, shelf: from.shelf, r: from.r, c: from.c });
  persistBottle({ ...m, shelf: sh, r, c });
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
    let cells = '';
    for (let r = 0; r < s.rows; r++) for (let c = 0; c < s.cols; c++) {
      const b = pm[s.id + '|' + r + '|' + c];
      const has = b && imgSrc(b);
      const lbl = b ? `<span class="lbl"><b>${esc(b.producer || name(b))}</b>${b.producer && b.cuvee ? `<i>${esc(b.cuvee)}</i>` : ''}</span>` : '';
      cells += `<button class="cell${b && b.id === moving ? ' mv' : ''}" data-a="slot" data-s="${esc(s.id)}" data-r="${r}" data-c="${c}" title="${esc(b ? name(b) + ' ' + (b.vintage || '') : 'Posto libero')}" aria-label="${esc(b ? name(b) : 'Posto libero')}"><span class="dot ${b ? 't-' + esc(b.type) : ''} ${b ? status(b) : ''}${has ? ' has' : ''}"${has ? ` style="background-image:url('${imgSrc(b)}')"` : ''}>${b ? `<span class="vin">${esc(b.vintage || '')}</span>` : ''}</span>${lbl}</button>${c === s.cols - 1 ? '<i class="plank"></i>' : ''}`;
    }
    return `<section class="shelf"><header><h2>${esc(s.name)}</h2><button class="link" data-a="editShelf" data-id="${esc(s.id)}">Modifica</button></header><div class="grid" style="--c:${s.cols}">${cells}</div></section>`;
  }).join('');
  if (!S.shelves.length) h = `<p class="empty">Nessuno scaffale. Crea il primo, poi tocca un posto libero per inserire una bottiglia.</p>`;
  const loose = Object.values(S.bottles).filter((b) => !b.shelf).length;
  const mvb = moving && S.bottles[moving] ? `<div class="note"><b>Sposta: ${esc(name(S.bottles[moving]))}</b><br>Tocca il nuovo posto. Se è occupato, le due bottiglie si scambiano.<div class="acts"><button class="btn" data-a="unplace">Togli dallo scaffale</button><button class="btn" data-a="cancelMove">Annulla</button></div></div>` : '';
  return mvb + keyBanner() + today() + h + '<div class="legend"><span><i class="lg" style="box-shadow:0 0 0 6px #4C9A6A"></i>Pronta da bere</span><span><i class="lg" style="box-shadow:0 0 0 6px #D9A441"></i>Da aspettare</span><span><i class="lg" style="box-shadow:0 0 0 6px #B85C5C"></i>Oltre il picco</span></div>' + (loose ? `<p class="info">${loose} bottiglie da posizionare: tocca un posto libero per sceglierle.</p>` : '') + `<button class="btn" data-a="newShelf">Nuovo scaffale</button>`;
}

function lista(bs) {
  const f = bs
    .filter((b) => (name(b) + ' ' + (b.region || '') + ' ' + (b.vintage || '')).toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (!!a.shelf - !!b.shelf) || name(a).localeCompare(name(b)));
  const st = { 'st-now': ', pronta da bere', 'st-wait': ', da aspettare', 'st-past': ', oltre il picco' };
  return keyBanner() + `<input id="q" placeholder="Cerca per produttore, cuvée, annata" value="${esc(q)}">` + (f.length
    ? f.map((b) => `<button class="row" data-a="open" data-id="${esc(b.id)}"><span style="display:flex;gap:12px">${imgSrc(b) ? `<img class="th" src="${imgSrc(b)}" alt="">` : ''}<span>${esc(name(b))} ${esc(b.vintage || '')}<small>${esc(posText(b))}${st[status(b)] || ''}</small></span></span><span>${eur(b.value ?? b.price)}</span></button>`).join('')
    : `<p class="empty">Nessuna bottiglia${q ? ' trovata' : ' ancora: tocca Aggiungi'}.</p>`);
}

/* ===== Foto ===== */
function loadImg(blob) {
  return new Promise((res, rej) => {
    const u = URL.createObjectURL(blob), im = new Image();
    im.onload = () => { URL.revokeObjectURL(u); res(im); };
    im.onerror = () => { URL.revokeObjectURL(u); rej(new Error('Immagine non leggibile')); };
    im.src = u;
  });
}
function normBox(b) {
  if (!b || typeof b !== 'object') return null;
  let v = ['left', 'top', 'right', 'bottom'].map((k) => Number(b[k]));
  if (v.some((n) => !Number.isFinite(n) || n < 0)) return null;
  const m = Math.max(...v);
  if (m > 1) v = v.map((n) => n / (m > 100 ? 1000 : 100));
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
  const b = old ? { ...old } : { id: gid(), type: 'rosso', shelf: null, r: 0, c: 0, ...pre };
  let photo = null, photoFull = null, labelThumb = false, thumb = b.thumb || null, useFull = !!b.useFull;
  let onlineLabel = false, valueNote = b.valueNote || '', srcLinks = b.srcLinks || [], busy = false, again = false, autoVal = !!b.valueAuto, dFrom = b.drinkFrom || null, dTo = b.drinkTo || null, picUrl = null, orig = null;
  if (id) {
    try { photo = (await dbGet('photos', id + ':c')) || null; photoFull = (await dbGet('photos', id + ':f')) || null; } catch (_) {}
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
  d.innerHTML = `<h2>${id ? 'Modifica bottiglia' : 'Nuova bottiglia'}</h2><div id="picbox"></div>
  <div id="photoctl">
  <p class="info">Fotografa l'etichetta: compilo io i campi, tu controlli.</p>
  <div class="acts"><label class="btn">Scatta foto<input type="file" accept="image/*" capture="environment" hidden class="ph"></label><label class="btn">Dalla galleria<input type="file" accept="image/*" hidden class="ph"></label><button class="btn" id="pasteimg" type="button">Incolla immagine</button></div>
  <div class="acts" style="margin-top:8px"><a class="btn" id="srch" target="_blank" rel="noopener" href="#">Cerca etichetta online</a></div>
  <div id="pbox" class="pbox" contenteditable="true" inputmode="none">Per incollare un'immagine trovata online: tieni premuto qui e scegli Incolla.</div>
  </div>
  <div class="acts" id="photoact" hidden><button class="btn" id="whole" type="button" hidden></button><button class="btn" id="chg" type="button">Cambia foto</button></div>
  <div class="acts" style="margin-top:8px"><button class="btn" id="enr" type="button">Cerca dati ed etichetta</button></div>
  <p class="info" id="scs"></p>
  <label>Produttore</label><input id="f_producer" value="${esc(b.producer)}">
  <label>Cuvée o etichetta</label><input id="f_cuvee" value="${esc(b.cuvee)}">
  <div class="two"><div><label>Annata</label><input id="f_vintage" inputmode="numeric" value="${esc(b.vintage)}"></div>
  <div><label>Tipo</label><select id="f_type">${['rosso', 'bianco', 'bollicine', 'rosato', 'altro'].map((t) => `<option ${b.type === t ? 'selected' : ''}>${t}</option>`).join('')}</select></div></div>
  <label>Zona o denominazione</label><input id="f_region" value="${esc(b.region)}">
  <div class="two"><div><label>Prezzo d'acquisto (€)</label><input id="f_price" inputmode="decimal" value="${esc(b.price)}"></div>
  <div><label>Valore di mercato (€)</label><input id="f_value" inputmode="decimal" value="${esc(b.value)}"></div></div>
  <p class="info" id="f_basis">${autoVal ? (valueNote ? 'Stima non verificata da ricerca online: ' + esc(valueNote) : 'Stima automatica non verificata: puoi correggerla.') : ''}</p>
  <a class="link" id="ws" target="_blank" rel="noopener" href="#">Cerca il prezzo su Wine-Searcher</a>
  <label style="margin-top:12px">Quando berla</label><textarea id="f_drink" rows="3">${esc(b.drink)}</textarea>
  <label>Abbinamenti consigliati</label><textarea id="f_pairing" rows="2">${esc(b.pairing)}</textarea>
  <div class="info" id="rext"></div>
  <label>Posizione</label><select id="f_pos">${opts}</select>
  <label>Il produttore</label><textarea id="f_info" rows="6">${esc(b.info)}</textarea>
  <label>Sulla cuvée e sulla bottiglia</label><textarea id="f_winfo" rows="7">${esc(b.winfo)}</textarea>
  <label>Produzione e bottiglie prodotte</label><textarea id="f_prod" rows="3">${esc(b.prod)}</textarea>
  <label>Sull'annata</label><textarea id="f_vinfo" rows="4">${esc(b.vinfo)}</textarea>
  <div class="info" id="esrc"></div>
  <p class="info">Le informazioni automatiche sono stime dell'IA e possono contenere errori: controllale prima di fidarti.</p>
  <div class="acts"><button class="btn pri" id="sv">Salva</button><button class="btn" id="cl">Annulla</button>${id ? '<button class="btn" id="del">Elimina</button>' : ''}</div>`;

  const g = (k) => $('#f_' + k).value.trim();
  const scs = (t) => { const el = $('#scs'); el.textContent = t; if (t) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); };
  const touched = new Set(b.touched || []);
  let typeTouched = !!id;
  $('#f_type').addEventListener('change', () => { typeTouched = true; });
  ['info', 'winfo', 'vinfo', 'prod', 'pairing', 'drink'].forEach((f) => $('#f_' + f).addEventListener('input', () => touched.add(f)));
  $('#f_drink').addEventListener('input', () => { dFrom = dTo = null; });

  const cur = () => (useFull && photoFull ? photoFull : photo || photoFull);
  const showPic = () => {
    if (picUrl) URL.revokeObjectURL(picUrl);
    const bl = cur();
    picUrl = bl ? URL.createObjectURL(bl) : null;
    $('#picbox').innerHTML = picUrl ? `<img class="pic" src="${picUrl}" alt="Foto della bottiglia">` : '';
    const w = $('#whole');
    w.hidden = !(photo && photoFull);
    w.textContent = useFull ? 'Usa il ritaglio' : 'Usa la foto intera';
    $('#photoctl').hidden = !!bl;
    $('#photoact').hidden = !bl;
  };
  const setPhoto = async (file, box, lbox, code, poor) => {
    orig = file;
    photoFull = await canvasBlob(await drawCrop(file, null, 2400), 0.92);
    photo = box ? await canvasBlob(await drawCrop(file, box, 2400), 0.92) : photoFull;
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
  $('#chg').onclick = () => { $('#photoctl').hidden = false; $('#photoact').hidden = true; $('#photoctl').scrollIntoView({ block: 'nearest', behavior: 'smooth' }); };
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
  const applyInfo = (j) => {
    const put = (f, v) => { if (v && typeof v === 'string' && !touched.has(f)) $('#f_' + f).value = v; };
    if (j.region && typeof j.region === 'string' && !$('#f_region').value.trim()) $('#f_region').value = j.region;
    if (!typeTouched && ['rosso', 'bianco', 'bollicine', 'rosato', 'altro'].includes(j.type)) $('#f_type').value = j.type;
    put('info', j.producer_info); put('winfo', j.wine_info); put('prod', j.production); put('vinfo', j.vintage_info); put('pairing', j.pairing);
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
  const enrich = async () => {
    if (busy) { again = true; return; }
    if (!aiReady()) { notice('Manca la chiave dell\'IA', 'Per le informazioni automatiche serve la chiave del servizio di IA. Aprila dalle Impostazioni.', [{ t: 'Apri le impostazioni', pri: true, fn: openSettings }, { t: 'Chiudi' }]); return; }
    if (!g('producer') && !g('cuvee')) { scs('Scrivi almeno il produttore o la cuvée.'); return; }
    busy = true;
    scs('Cerco informazioni approfondite online… può volerci fino a un minuto.');
    try {
      const r = await deepInfo({ producer: g('producer'), cuvee: g('cuvee'), vintage: g('vintage'), type: g('type'), region: g('region') });
      applyInfo(r.j);
      if (r.links.length) { srcLinks = r.links; showSrc(); }
      let lab = '';
      if (!cur()) {
        scs('Cerco l\'etichetta online…');
        const ob = await offByName(g('producer'), g('cuvee'));
        if (ob) {
          try {
            photoFull = photo = ob; useFull = false;
            thumb = await makeLabelThumb(ob, null); labelThumb = true; onlineLabel = true;
            showPic(); lab = ' Etichetta trovata online.';
          } catch (_) {}
        } else lab = ' Etichetta non trovata online: puoi aggiungere una foto tua.';
      }
      scs((r.deep ? 'Fatto, con ricerca online: controlla le fonti in fondo e i dati importanti.' : (r.limited ? 'Limite gratuito della ricerca web raggiunto: ho usato solo le conoscenze dell\'IA, senza fonti e senza aggiornare il valore. Riprova più tardi con "Cerca dati ed etichetta".' : 'Fatto, ma senza ricerca online (non disponibile): sono stime dell\'IA, controllale.')) + lab);
    } catch (e) {
      scs('Ricerca non riuscita: ' + e.message);
      notice('Ricerca non riuscita', esc(errorHint(e.message)) + '<br><br><small>Dettaglio: ' + esc(e.message) + '</small>', [{ t: 'Chiudi', pri: true }]);
    } finally { busy = false; if (again) { again = false; enrich(); } }
  };
  $('#enr').onclick = enrich;
  const showR = () => {
    const q = encodeURIComponent([g('producer'), g('cuvee'), g('vintage')].filter(Boolean).join(' '));
    $('#rext').innerHTML = `Cerca su: <a class="link" target="_blank" rel="noopener" href="https://www.vivino.com/search/wines?q=${q}">Vivino</a> · <a class="link" target="_blank" rel="noopener" href="https://www.google.com/search?q=${q}+site%3Ainstagram.com">Instagram</a> · <a class="link" target="_blank" rel="noopener" href="https://www.google.com/search?q=${q}+recensione">Blog</a>`;
  };
  showR();
  ['producer', 'cuvee', 'vintage'].forEach((k) => $('#f_' + k).addEventListener('input', showR));
  let autoT = null;
  ['producer', 'cuvee', 'vintage'].forEach((k) => $('#f_' + k).addEventListener('change', () => {
    clearTimeout(autoT);
    autoT = setTimeout(() => {
      if (!aiReady() || !(g('producer') || g('cuvee'))) return;
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
    try {
      const j = await aiJson(scanPrompt(), await toB64(file, 1600));
      const set = (k, v) => { if (v !== null && v !== undefined && v !== '') $('#f_' + k).value = v; };
      set('producer', j.producer); set('cuvee', j.cuvee); set('vintage', j.vintage); set('region', j.region);
      if (['rosso', 'bianco', 'bollicine', 'rosato', 'altro'].includes(j.type)) $('#f_type').value = j.type;
      if (j.barcode && /^\d{8,14}$/.test(String(j.barcode))) b.barcode = String(j.barcode);
      applyInfo({ ...j, price_eur: null });
      await setPhoto(file, j.box, j.label_box, j.barcode, j.quality === 'scarsa');
      ws();
      const poor = j.quality === 'scarsa' ? ' Foto poco chiara (sfocata, buia o tagliata): riscattala, oppure incolla una foto migliore.' : '';
      scs('Etichetta letta.' + (onlineLabel ? ' Etichetta scaricata da internet: se non è quella giusta, rifai la foto.' : ''));
      if (g('producer') || g('cuvee')) await enrich();
      scs($('#scs').textContent + poor);
    } catch (err) {
      await setPhoto(file, null);
      scs('Lettura non riuscita: ' + err.message);
      notice('Lettura non riuscita', esc(errorHint(err.message)) + '<br><br><small>Dettaglio: ' + esc(err.message) + '</small>', [{ t: 'Impostazioni', fn: openSettings }, { t: 'Chiudi', pri: true }]);
    }
  });

  $('#sv').onclick = async () => {
    const p = g('pos'), [sh, r, c] = p ? p.split('|') : [null, 0, 0];
    const nb = {
      ...b, producer: g('producer'), cuvee: g('cuvee'), vintage: num(g('vintage')), type: g('type'), region: g('region'),
      price: num(g('price')), value: num(g('value')), valueAuto: autoVal && g('value') !== '',
      drink: g('drink'), drinkFrom: dFrom, drinkTo: dTo, pairing: g('pairing'),
      info: g('info'), winfo: g('winfo'), vinfo: g('vinfo'), prod: g('prod'), srcLinks, valueNote: autoVal && g('value') !== '' ? valueNote : '', touched: [...touched],
      thumb: photo || photoFull ? thumb : null, useFull, shelf: sh, r: +r, c: +c,
    };
    try {
      if (photo) await dbPut('photos', photo, nb.id + ':c'); else await dbDel('photos', nb.id + ':c');
      if (photoFull) await dbPut('photos', photoFull, nb.id + ':f'); else await dbDel('photos', nb.id + ':f');
    } catch (e) { msg('Foto non salvata: ' + esc(e.message)); }
    await persistBottle(nb);
    d.close();
  };
  if (id) {
    let armed = false;
    $('#del').onclick = (e) => {
      if (!armed) { armed = true; e.target.textContent = 'Conferma eliminazione'; return; }
      removeBottle(id); d.close();
    };
  }
  d.onclose = () => { if (picUrl) { URL.revokeObjectURL(picUrl); picUrl = null; } };
  d.showModal();
}

function openPlace(sh, r, c) {
  const un = Object.values(S.bottles).filter((b) => !b.shelf);
  if (!un.length) return openBottle(null, { shelf: sh, r, c });
  const d = $('#dlg');
  d.innerHTML = `<h2>Cosa metto qui?</h2><p class="info">Scegli una bottiglia da posizionare o aggiungine una nuova.</p>` + un.map((b) => `<button class="row" data-p="${esc(b.id)}"><span style="display:flex;gap:12px">${imgSrc(b) ? `<img class="th" src="${imgSrc(b)}" alt="">` : ''}<span>${esc(name(b))} ${esc(b.vintage || '')}</span></span></button>`).join('') + `<div class="acts"><button class="btn pri" id="pn">Nuova bottiglia</button><button class="btn" id="pc">Annulla</button></div>`;
  d.querySelectorAll('[data-p]').forEach((x) => x.onclick = () => { persistBottle({ ...S.bottles[x.dataset.p], shelf: sh, r, c }); d.close(); });
  $('#pn').onclick = () => { d.close(); openBottle(null, { shelf: sh, r, c }); };
  $('#pc').onclick = () => d.close();
  d.onclose = null;
  d.showModal();
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
  d.showModal();
}

/* ===== Impostazioni e backup ===== */
async function enrichRecord(b0) {
  const b = { ...b0 };
  const r = await deepInfo({ producer: b.producer, cuvee: b.cuvee, vintage: b.vintage, type: b.type, region: b.region });
  const j = r.j || {};
  const t = new Set(b.touched || []);
  const put = (k, f) => { if (typeof j[f] === 'string' && j[f].trim() && !t.has(k)) b[k] = j[f].trim(); };
  put('info', 'producer_info'); put('winfo', 'wine_info'); put('prod', 'production'); put('vinfo', 'vintage_info'); put('pairing', 'pairing');
  if (j.region && !b.region) b.region = j.region;
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
  if (!b.thumb) {
    const ob = await offByName(b.producer, b.cuvee);
    if (ob) {
      try {
        b.thumb = await makeLabelThumb(ob, null);
        await dbPut('photos', ob, b.id + ':c'); await dbPut('photos', ob, b.id + ':f');
      } catch (_) {}
    }
  }
  return { b, deep: r.deep, limited: r.limited };
}
async function bulkEnrich() {
  if (!aiReady()) { notice('Manca la chiave dell\'IA', 'Serve la chiave del servizio di IA, dalle Impostazioni.', [{ t: 'Apri le impostazioni', pri: true, fn: openSettings }, { t: 'Chiudi' }]); return; }
  const todo = Object.values(S.bottles).filter((b) => (b.producer || b.cuvee) && !b.prod);
  if (!todo.length) { notice('Tutto completo', 'Tutte le bottiglie hanno già i dati di produzione.', [{ t: 'OK', pri: true }]); return; }
  const d = $('#dlg2');
  let stop = false;
  d.innerHTML = `<h2>Completo le bottiglie</h2><p id="bk_t" style="font-size:16px;margin:10px 0">Preparo…</p><div class="acts"><button class="btn" id="bk_x">Ferma</button></div>`;
  $('#bk_x').onclick = () => { stop = true; $('#bk_x').textContent = 'Mi fermo dopo questa…'; };
  d.onclose = null;
  if (!d.open) d.showModal();
  let ok = 0, note = '';
  for (let i = 0; i < todo.length && !stop; i++) {
    const cur = S.bottles[todo[i].id];
    if (!cur) continue;
    $('#bk_t').textContent = (i + 1) + ' di ' + todo.length + ': ' + name(cur) + (cur.vintage ? ' ' + cur.vintage : '') + '…';
    try {
      const r = await enrichRecord(cur);
      if (r.limited) { note = 'Il limite gratuito della ricerca web è finito: mi fermo qui. Riprova più tardi, ripartirò dalle bottiglie rimaste.'; break; }
      await persistBottle(r.b);
      ok++;
    } catch (e) { note = 'Mi fermo: ' + errorHint(e.message) + ' (' + e.message + ')'; break; }
    await new Promise((res) => setTimeout(res, 1200));
  }
  $('#bk_t').textContent = 'Completate ' + ok + ' bottiglie su ' + todo.length + '.' + (note ? ' ' + note : '') + ' Controlla le schede: sono dati trovati online dall\'IA.';
  $('#bk_x').textContent = 'Chiudi'; $('#bk_x').onclick = () => d.close();
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
  <p class="info">Gemini gratuito: pochi usi al giorno, senza ricerca web con fonti, e Google può usare i dati inviati per migliorare i suoi prodotti. Gemini con fatturazione attiva o Anthropic: nessun limite giornaliero stretto, si paga solo ciò che usi.</p>
  <div class="acts"><button class="btn pri" id="c_save">Salva</button><button class="btn" id="c_test">Prova la connessione</button></div>
  <p class="info" id="c_msg"></p>
  <h3 style="margin:16px 0 4px;font-size:16px">Completa le bottiglie</h3>
  <p class="info">Cerca online produzione, informazioni, valore di mercato ed etichetta per le bottiglie già inserite che non hanno ancora i dati di produzione. I campi che hai scritto tu e i valori che hai inserito non vengono toccati.</p>
  <div class="acts"><button class="btn" id="b_bulk">Completa tutte le bottiglie</button></div>
  <h3 style="margin:16px 0 4px;font-size:16px">Backup</h3>
  <p class="info">Un file con tutte le bottiglie, gli scaffali e le foto. Fanne uno ogni tanto e conservalo (iCloud Drive, Mail).</p>
  <div class="acts"><button class="btn" id="b_exp">Esporta backup</button><label class="btn">Importa backup<input type="file" accept="application/json,.json" hidden id="b_imp"></label></div>
  <p class="info" id="b_msg"></p>
  <p class="info">Versione dell'app: ${APP_VERSION}</p>
  <div class="acts"><button class="btn" id="c_close">Chiudi</button></div>`;
  const showState = () => { const cc = getCfg(); const k = cc.provider === 'anthropic' ? cc.anthropicKey : cc.geminiKey; $('#c_state').textContent = k ? 'Chiave salvata (' + k.slice(0, 4) + '…, ' + k.length + ' caratteri)' : 'Chiave mancante'; };
  showState();
  const sync = () => { const a = $('#c_prov').value === 'anthropic'; $('#c_gem').hidden = a; $('#c_ant').hidden = !a; };
  sync();
  $('#c_prov').onchange = sync;
  const read = () => ({ provider: $('#c_prov').value, geminiKey: $('#c_gk').value.trim(), geminiModel: $('#c_gm').value.trim() || DEF.geminiModel, anthropicKey: $('#c_ak').value.trim(), anthropicModel: $('#c_am').value.trim() || DEF.anthropicModel });
  $('#c_save').onclick = () => { setCfg(read()); showState(); render(); $('#c_msg').textContent = 'Impostazioni salvate.'; };
  $('#c_test').onclick = async () => {
    setCfg(read());
    if (!aiReady()) { $('#c_msg').textContent = 'Inserisci prima la chiave.'; return; }
    $('#c_msg').textContent = 'Provo…';
    try { await aiJson('Rispondi solo con questo JSON: {"ok":true}'); $('#c_msg').textContent = 'Funziona.'; showState(); render(); }
    catch (e) { $('#c_msg').textContent = 'Non funziona: ' + e.message + ' ' + errorHint(e.message); }
  };
  $('#c_close').onclick = () => d.close();
  $('#b_bulk').onclick = bulkEnrich;
  $('#b_exp').onclick = exportBackup;
  $('#b_imp').onchange = importBackup;
  d.onclose = null;
  d.showModal();
}

async function exportBackup() {
  const m = $('#b_msg');
  m.textContent = 'Preparo il backup…';
  try {
    const bottles = [];
    for (const b of Object.values(S.bottles)) {
      const c = await dbGet('photos', b.id + ':c'), f = await dbGet('photos', b.id + ':f');
      bottles.push({ ...b, photoC: c ? await blobToDataURL(c) : null, photoF: f ? await blobToDataURL(f) : null });
    }
    const data = JSON.stringify({ app: 'cantina', version: 1, exported: new Date().toISOString(), shelves: S.shelves, bottles });
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
      const { photoC, photoF, ...b } = x;
      await dbPut('bottles', b);
      if (photoC) await dbPut('photos', await dataURLToBlob(photoC), b.id + ':c');
      if (photoF) await dbPut('photos', await dataURLToBlob(photoF), b.id + ':f');
      S.bottles[b.id] = b;
    }
    if (Array.isArray(j.shelves) && j.shelves.length) { S.shelves = j.shelves; await dbPut('kv', S.shelves, 'shelves'); }
    render();
    m.textContent = 'Importazione completata.';
  } catch (err) { m.textContent = 'Importazione non riuscita: ' + err.message; }
}

/* ===== Comandi ===== */
document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-a]');
  if (!t) return;
  const a = t.dataset.a;
  if (a === 'tab') { tab = t.dataset.t; render(); }
  else if (a === 'new') openBottle(null, {});
  else if (a === 'newShelf') openShelf(null);
  else if (a === 'settings') openSettings();
  else if (a === 'day') { dayOff = Math.max(-7, Math.min(60, t.dataset.o !== undefined ? +t.dataset.o : dayOff + (+t.dataset.d))); render(); }
  else if (a === 'editShelf') openShelf(t.dataset.id);
  else if (a === 'open') openBottle(t.dataset.id);
  else if (a === 'cancelMove') { moving = null; render(); }
  else if (a === 'unplace') { const m = S.bottles[moving]; moving = null; if (m) persistBottle({ ...m, shelf: null, r: 0, c: 0 }); else render(); }
  else if (a === 'slot') {
    if (Date.now() - justDragged < 600) return;
    const sh = t.dataset.s, r = +t.dataset.r, c = +t.dataset.c, b = posMap()[sh + '|' + r + '|' + c];
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
  } catch (e) { msg('Non riesco ad aprire il salvataggio sul telefono: ' + esc(e.message)); }
  render();
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
