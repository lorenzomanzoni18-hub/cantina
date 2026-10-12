/* Strumenti: Excel (CSV) in uscita e in entrata, carta dei vini in PDF, promemoria per il calendario. */

async function giveFile(file, title, m) {
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title }); if (m) m.textContent = 'Pronto.'; return; }
    catch (e) { if (e.name === 'AbortError') { if (m) m.textContent = ''; return; } }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file); a.download = file.name;
  document.body.appendChild(a); a.click(); a.remove();
  if (m) m.textContent = 'File scaricato.';
}
const stateLabel = (b) => (b.drunk ? 'Bevuta' : b.wish ? 'Desideri' : b.pending ? 'In arrivo' : 'In cantina');

/* ===== Excel: esportazione ===== */
const CSV_COLS = [
  ['Produttore', (b) => b.producer], ['Cuvée', (b) => b.cuvee], ['Annata', (b) => b.vintage], ['Tipo', (b) => b.type], ['Formato', (b) => sizeName(sizeMl(b))],
  ['Zona', (b) => b.region], ['Stato', stateLabel], ['Posizione', (b) => (inCellar(b) ? posText(b) : '')], ['Prezzo', (b) => b.price], ['Valore', (b) => b.value],
  ['Data acquisto', (b) => b.buyDate], ['Dove', (b) => b.buyWhere], ['Note acquisto', (b) => b.buyNote], ['Da bere dal', (b) => b.drinkFrom], ['Da bere fino al', (b) => b.drinkTo],
  ['Liste', (b) => tagsOf(b).join(', ')], ['Bevuta il', (b) => (b.drunk ? b.drunk.date : '')], ['Voto', (b) => (b.drunk && b.drunk.rating) || ''], ['Note degustazione', (b) => (b.drunk ? b.drunk.notes : '')],
  ['Consegna prevista', (b) => b.eta], ['Codice', (b) => b.wid || b.id],
];
function exportCsv() {
  const m = $('#pdfmsg');
  const cell = (v) => { const t = v == null ? '' : typeof v === 'number' ? String(v).replace('.', ',') : String(v); return /[;"\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; };
  const key = (b) => nrm(b.producer || b.cuvee || '');
  const bs = Object.values(S.bottles).sort((a, b) => key(a).localeCompare(key(b), 'it') || (a.vintage || 0) - (b.vintage || 0));
  const lines = [CSV_COLS.map((c) => c[0]).join(';')].concat(bs.map((b) => CSV_COLS.map((c) => cell(c[1](b))).join(';')));
  // BOM e punto e virgola: Excel e Numbers in italiano lo aprono già diviso in colonne
  const file = new File(['\ufeff' + lines.join('\r\n')], 'cantina-' + new Date().toLocaleDateString('sv-SE') + '.csv', { type: 'text/csv' });
  giveFile(file, 'Cantina (Excel)', m);
}

/* ===== Excel: importazione (anche da Vivino e CellarTracker) ===== */
function parseCsv(text) {
  text = text.replace(/^\ufeff/, '');
  const first = text.split(/\r?\n/)[0] || '';
  const sep = [';', '\t', ','].map((s) => [s, first.split(s).length]).sort((a, b) => b[1] - a[1])[0][0];
  const rows = []; let row = [], cur = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) { if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else inQ = false; } else cur += ch; }
    else if (ch === '"') inQ = true;
    else if (ch === sep) { row.push(cur); cur = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; }
    else cur += ch;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim()));
}
const COLMAP = {
  producer: ['produttore', 'producer', 'winery', 'azienda', 'cantina produttrice'],
  cuvee: ['cuvee', 'wine', 'wine name', 'vino', 'nome', 'etichetta', 'name'],
  vintage: ['annata', 'vintage', 'anno'],
  type: ['tipo', 'type', 'color', 'colore', 'wine type', 'colour'],
  size: ['formato', 'size', 'bottle size'],
  region: ['zona', 'region', 'regione', 'appellation', 'denominazione', 'regional wine style'],
  country: ['country', 'paese', 'nazione'],
  qty: ['quantita', 'quantity', 'qty', 'bottiglie', 'bottles', 'numero'],
  price: ['prezzo', 'price', 'prezzo d acquisto', 'purchase price', 'cost'],
  value: ['valore', 'value', 'valuation', 'my value', 'valore di mercato'],
  buyDate: ['data acquisto', 'purchase date', 'data d acquisto', 'purchased'],
  buyWhere: ['dove', 'store', 'negozio', 'fornitore', 'supplier', 'store name'],
  buyNote: ['note acquisto', 'purchase note', 'note', 'notes', 'personal note'],
  drinkFrom: ['da bere dal', 'begin consume', 'drink from', 'beginconsume'],
  drinkTo: ['da bere fino al', 'end consume', 'drink to', 'endconsume'],
  state: ['stato', 'status'],
  tags: ['liste', 'lists', 'tags'],
  eta: ['consegna prevista', 'delivery date', 'expected'],
  wid: ['codice'],
  rating: ['voto', 'your rating', 'my score', 'rating'],
  tnote: ['note degustazione', 'your review', 'tasting notes', 'tasting note'],
  drunkDate: ['bevuta il', 'consumed', 'date consumed'],
};
function mapType(t) {
  const x = nrm(t);
  if (/bollic|spark|spuman|champ|cava|cremant|franciacorta|frizz|prosecco/.test(x)) return 'bollicine';
  if (/rosat|rose|pink/.test(x)) return 'rosato';
  if (/bianc|white|blanc|weiss/.test(x)) return 'bianco';
  if (/ross|red|rouge|rot|tinto/.test(x)) return 'rosso';
  return t ? 'altro' : 'rosso';
}
function mapSize(t) {
  const x = nrm(t).replace(',', '.');
  if (!x) return 750;
  const named = SIZES.find((s) => s[1] && x.includes(nrm(s[1]).split(' ')[0]));
  if (named && named[0] !== 750) return named[0];
  const mm = x.match(/([\d.]+)\s*(ml|cl|l)\b/);
  if (mm) { const v = +mm[1]; return Math.round(mm[2] === 'ml' ? v : mm[2] === 'cl' ? v * 10 : v * 1000); }
  const n = parseFloat(x); if (n > 0) return n < 20 ? Math.round(n * 1000) : n < 200 ? Math.round(n * 10) : Math.round(n);
  return 750;
}
function toIsoDate(t) {
  const x = String(t || '').trim(); if (!x) return '';
  let m = x.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/); if (m) return m[1] + '-' + m[2].padStart(2, '0') + '-' + m[3].padStart(2, '0');
  m = x.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/); if (m) { const y = m[3].length === 2 ? '20' + m[3] : m[3]; return y + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0'); }
  return '';
}
async function importCsv(e) {
  const m = $('#b_msg'), file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const rows = parseCsv(await file.text());
    if (rows.length < 2) throw new Error('il file è vuoto');
    const head = rows[0].map((h) => nrm(h).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim());
    const col = {};
    Object.entries(COLMAP).forEach(([k, names]) => { const i = head.findIndex((h) => names.includes(h)); if (i >= 0) col[k] = i; });
    if (col.producer === undefined && col.cuvee === undefined) throw new Error('non trovo le colonne del produttore o del vino (es. «Produttore», «Winery», «Producer»)');
    const v = (r, k) => (col[k] === undefined ? '' : String(r[col[k]] || '').trim());
    const items = rows.slice(1).map((r) => {
      const qty = Math.max(1, Math.min(120, parseInt(v(r, 'qty'), 10) || 1));
      const st = nrm(v(r, 'state'));
      const region = [v(r, 'region'), col.region === undefined ? v(r, 'country') : ''].filter(Boolean).join(', ');
      return { qty, b: {
        producer: v(r, 'producer'), cuvee: v(r, 'cuvee'), vintage: num(v(r, 'vintage')) || null, type: mapType(v(r, 'type')), size: mapSize(v(r, 'size')), region,
        price: num(v(r, 'price').replace(/[^\d,.-]/g, '')), value: num(v(r, 'value').replace(/[^\d,.-]/g, '')), buyDate: toIsoDate(v(r, 'buyDate')), buyWhere: v(r, 'buyWhere'), buyNote: v(r, 'buyNote'),
        drinkFrom: num(v(r, 'drinkFrom')) || null, drinkTo: num(v(r, 'drinkTo')) || null, tags: v(r, 'tags').split(',').map((t) => t.trim()).filter(Boolean), eta: toIsoDate(v(r, 'eta')),
        pending: /arrivo|pending/.test(st), wish: /desider|wish/.test(st), oldWid: v(r, 'wid'),
        drunk: /bevut|consum|drunk/.test(st) ? { date: toIsoDate(v(r, 'drunkDate')) || new Date().toLocaleDateString('sv-SE'), rating: Math.round(Math.min(5, num(v(r, 'rating')) || 0)), notes: v(r, 'tnote') } : null,
      } };
    }).filter((x) => x.b.producer || x.b.cuvee);
    const tot = items.reduce((t, x) => t + x.qty, 0);
    if (!items.length) throw new Error('nessuna riga con produttore o vino');
    if (!confirm(`Importare ${tot} bottiglie (${items.length} righe)? Vanno tra quelle «da posizionare»; quelle già in cantina restano.`)) return;
    m.textContent = 'Importo…';
    const widMap = {};
    for (const { qty, b: x } of items) {
      const wid = x.oldWid ? (widMap[x.oldWid] = widMap[x.oldWid] || gid()) : gid();
      const { oldWid, drunk, ...base } = x;
      if (base.drinkFrom && base.drinkTo) base.drink = 'Da bere tra il ' + base.drinkFrom + ' e il ' + base.drinkTo + '.';
      for (let i = 0; i < qty; i++) {
        const id = gid();
        const nb = { ...base, id, wid, shelf: null, r: 0, c: 0, added: Date.now() };
        if (drunk) { nb.drunk = drunk; nb.tastings = [{ ...drunk, drunk: true }]; }
        S.bottles[id] = nb;
        await dbPut('bottles', nb);
      }
    }
    render();
    m.textContent = 'Importate ' + tot + ' bottiglie. Le trovi in cantina tra quelle da posizionare; con «Completa quelle incomplete» l\'IA aggiunge le informazioni.';
  } catch (err) { m.textContent = 'Importazione non riuscita: ' + err.message; }
}

/* ===== PDF da immagini (per la carta dei vini) ===== */
function pdfFromJpegs(pages) { // pages: [{bytes: Uint8Array, w, h}] in pixel; pagina A4
  const enc = new TextEncoder(), parts = [], off = [];
  let len = 0;
  const push = (x) => { const u = typeof x === 'string' ? enc.encode(x) : x; parts.push(u); len += u.length; };
  push('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n');
  const n = pages.length, kids = pages.map((_, i) => (3 + i * 3) + ' 0 R').join(' ');
  const obj = (i, body) => { off[i] = len; push(i + ' 0 obj\n'); body(); push('\nendobj\n'); };
  obj(1, () => push('<< /Type /Catalog /Pages 2 0 R >>'));
  obj(2, () => push(`<< /Type /Pages /Kids [${kids}] /Count ${n} >>`));
  pages.forEach((p, i) => {
    const pi = 3 + i * 3, ci = pi + 1, ii = pi + 2, content = `q 595.28 0 0 841.89 0 0 cm /Im0 Do Q`;
    obj(pi, () => push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /Im0 ${ii} 0 R >> >> /Contents ${ci} 0 R >>`));
    obj(ci, () => push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`));
    obj(ii, () => { push(`<< /Type /XObject /Subtype /Image /Width ${p.w} /Height ${p.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.bytes.length} >>\nstream\n`); push(p.bytes); push('\nendstream'); });
  });
  const total = 3 + n * 3, xr = len;
  push(`xref\n0 ${total}\n0000000000 65535 f \n` + Array.from({ length: total - 1 }, (_, k) => String(off[k + 1]).padStart(10, '0') + ' 00000 n \n').join(''));
  push(`trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xr}\n%%EOF\n`);
  const out = new Uint8Array(len); let p = 0; parts.forEach((u) => { out.set(u, p); p += u.length; });
  return out;
}

/* ===== Carta dei vini ===== */
const CARTA_SEC = [['bollicine', 'Bollicine'], ['bianco', 'Bianchi'], ['rosato', 'Rosati'], ['rosso', 'Rossi'], ['altro', 'Dolci e altri vini']];
function openCarta() {
  const wines = uniqW(Object.values(S.bottles).filter(inCellar));
  const cnt = (b) => groupOf(b).filter(inCellar).length;
  const pre = (b) => status(b) !== 'st-wait';
  const d = $('#dlg');
  d.innerHTML = `<h2>Carta dei vini</h2><p class="info">Scegli i vini da mettere in carta: viene un PDF elegante da stampare o mandare, diviso per tipo. Ho già selezionato quelli pronti da bere.</p>
  <label>Titolo</label><input id="ca_t" value="Carta dei vini">
  <label>Sottotitolo (facoltativo)</label><input id="ca_s" placeholder="Es. Cena di sabato · 18 ottobre">
  <label class="chk"><input type="checkbox" id="ca_p"> Mostra i prezzi (valore stimato)</label>
  <div class="acts" style="margin:10px 0"><button class="btn" id="ca_all" type="button">Tutti</button><button class="btn" id="ca_none" type="button">Nessuno</button><button class="btn" id="ca_ready" type="button">Solo pronti</button></div>
  <div class="cpick">${CARTA_SEC.map(([t, l]) => { const ws = wines.filter((b) => b.type === t); return ws.length ? `<h3 class="letter">${l}</h3>` + ws.map((b) => `<label class="chk"><input type="checkbox" data-w="${esc(b.id)}" ${pre(b) ? 'checked' : ''}> <span>${esc(name(b))} ${esc(b.vintage || '')}${cnt(b) > 1 ? ' <b class="qty">×' + cnt(b) + '</b>' : ''}</span></label>`).join('') : ''; }).join('')}</div>
  <div class="acts"><button class="btn pri" id="ca_go">Crea il PDF</button><button class="btn" id="ca_x">Chiudi</button></div><p class="info" id="ca_m"></p>`;
  const boxes = () => [...d.querySelectorAll('[data-w]')];
  $('#ca_all').onclick = () => boxes().forEach((x) => { x.checked = true; });
  $('#ca_none').onclick = () => boxes().forEach((x) => { x.checked = false; });
  $('#ca_ready').onclick = () => boxes().forEach((x) => { x.checked = status(S.bottles[x.dataset.w]) === 'st-now'; });
  $('#ca_x').onclick = () => d.close();
  $('#ca_go').onclick = async () => {
    const sel = boxes().filter((x) => x.checked).map((x) => S.bottles[x.dataset.w]).filter(Boolean);
    if (!sel.length) { $('#ca_m').textContent = 'Scegli almeno un vino.'; return; }
    $('#ca_m').textContent = 'Preparo il PDF…';
    try {
      const bytes = await buildCarta(sel, $('#ca_t').value.trim() || 'Carta dei vini', $('#ca_s').value.trim(), $('#ca_p').checked);
      await giveFile(new File([bytes], 'carta-dei-vini.pdf', { type: 'application/pdf' }), 'Carta dei vini', $('#ca_m'));
    } catch (e) { $('#ca_m').textContent = 'Non riuscito: ' + e.message; }
  };
  d.onclose = null;
  if (!d.open) d.showModal();
}
async function buildCarta(sel, title, sub, prices) {
  const SERIF = '"Cormorant Garamond", Georgia, serif', SANS = '"Plus Jakarta Sans", system-ui, sans-serif';
  try { await Promise.all([document.fonts.load('700 60px "Cormorant Garamond"'), document.fonts.load('600 30px "Cormorant Garamond"'), document.fonts.load('400 20px "Plus Jakarta Sans"'), document.fonts.load('600 18px "Plus Jakarta Sans"')]); } catch (_) {}
  const W = 1240, H = 1754, M = 130, PAPER = '#FBF7F0', INK = '#231A16', MUTE = '#7A6A5E', GOLD = '#A8813E';
  const key = (b) => nrm(b.producer || b.cuvee || '');
  const blocks = [];
  CARTA_SEC.forEach(([t, l]) => { const ws = sel.filter((b) => b.type === t).sort((a, b) => key(a).localeCompare(key(b), 'it') || (a.vintage || 0) - (b.vintage || 0)); if (ws.length) { blocks.push({ h: l }); ws.forEach((b) => blocks.push({ b })); } });
  const pages = [];
  let c, x, y;
  const newPage = (firstPage) => {
    c = document.createElement('canvas'); c.width = W; c.height = H; x = c.getContext('2d');
    x.fillStyle = PAPER; x.fillRect(0, 0, W, H);
    x.strokeStyle = GOLD; x.lineWidth = 2; x.strokeRect(60, 60, W - 120, H - 120); x.lineWidth = 0.8; x.strokeRect(72, 72, W - 144, H - 144);
    y = 170;
    if (firstPage) {
      x.fillStyle = INK; x.textAlign = 'center'; x.font = '700 72px ' + SERIF; x.fillText(title, W / 2, y + 30); y += 80;
      if (sub) { x.fillStyle = MUTE; x.font = '400 24px ' + SANS; x.fillText(sub, W / 2, y); y += 40; }
      x.strokeStyle = GOLD; x.lineWidth = 1.5; x.beginPath(); x.moveTo(W / 2 - 60, y); x.lineTo(W / 2 + 60, y); x.stroke(); y += 60;
    } else y += 10;
    pages.push(c);
  };
  const fit = (t, font, maxW) => { x.font = font; if (x.measureText(t).width <= maxW) return t; while (t.length > 1 && x.measureText(t + '…').width > maxW) t = t.slice(0, -1); return t + '…'; };
  newPage(true);
  blocks.forEach((k, i) => {
    const need = k.h ? 140 : 92;
    if (y + need > H - 150) newPage(false);
    if (k.h) {
      y += 20; x.textAlign = 'center'; x.fillStyle = GOLD; x.font = '600 22px ' + SANS;
      x.fillText(k.h.toUpperCase().split('').join(String.fromCharCode(8202)), W / 2, y); y += 56; return;
    }
    const b = k.b, right = W - M;
    x.textAlign = 'left'; x.fillStyle = INK;
    const vint = b.vintage ? String(b.vintage) : '';
    x.font = '700 34px ' + SERIF; const vw = vint ? x.measureText(vint).width + 30 : 0;
    const pr = prices && (b.value ?? b.price) ? eur(b.value ?? b.price) : '';
    x.font = '600 22px ' + SANS; const pw = pr ? x.measureText(pr).width + 30 : 0;
    x.fillText('', 0, 0);
    x.fillStyle = INK; x.fillText(fit(b.producer || b.cuvee || '', '700 34px ' + SERIF, right - M - vw - pw), M, y);
    if (vint) { x.font = '700 34px ' + SERIF; x.textAlign = 'right'; x.fillText(vint, right - pw, y); }
    if (pr) { x.font = '600 22px ' + SANS; x.textAlign = 'right'; x.fillStyle = MUTE; x.fillText(pr, right, y - 4); }
    x.textAlign = 'left'; x.fillStyle = MUTE;
    const line2 = [b.producer ? b.cuvee : '', b.region, isStd(b) ? '' : sizeName(sizeMl(b))].filter(Boolean).join(' · ');
    if (line2) { x.fillText(fit(line2, '400 21px ' + SANS, right - M), M, y + 32); }
    y += 92;
  });
  const out = [];
  for (let i = 0; i < pages.length; i++) {
    const p = pages[i], cx = p.getContext('2d');
    cx.fillStyle = MUTE; cx.font = '400 18px ' + SANS; cx.textAlign = 'center';
    if (pages.length > 1) cx.fillText((i + 1) + ' / ' + pages.length, W / 2, H - 92);
    const blob = await new Promise((r) => p.toBlob(r, 'image/jpeg', 0.9));
    out.push({ bytes: new Uint8Array(await blob.arrayBuffer()), w: W, h: H });
  }
  return pdfFromJpegs(out);
}

/* ===== Promemoria nel calendario (.ics) ===== */
function exportIcs() {
  const m = $('#pdfmsg');
  const y = new Date().getFullYear(), stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
  const wines = uniqW(Object.values(S.bottles).filter((b) => inCellar(b) || (!b.drunk && b.pending)));
  const ev = [];
  const esc2 = (t) => String(t).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
  const add = (date, sum, desc, uid) => ev.push(['BEGIN:VEVENT', 'UID:' + uid + '@cantina', 'DTSTAMP:' + stamp, 'DTSTART;VALUE=DATE:' + date, 'SUMMARY:' + esc2(sum), 'DESCRIPTION:' + esc2(desc), 'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + esc2(sum), 'TRIGGER:PT10H', 'END:VALARM', 'END:VEVENT'].join('\r\n'));
  const soon = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10).replace(/-/g, '');
  wines.forEach((b) => {
    const n = groupOf(b).filter((x) => !x.drunk).length, nm = name(b) + (b.vintage ? ' ' + b.vintage : ''), q = n > 1 ? ' (' + n + ' bottiglie)' : '';
    const pos = posText(b);
    if (b.drinkFrom && b.drinkFrom > y) add(b.drinkFrom + '0115', 'Pronto da bere: ' + nm, 'Entra nella finestra ideale (' + b.drinkFrom + '–' + (b.drinkTo || '?') + ')' + q + '. ' + pos, widOf(b) + '-from');
    if (b.drinkTo && b.drinkTo >= y) add(b.drinkTo + '0901', 'Ultimo anno per bere: ' + nm, 'Finestra ideale fino al ' + b.drinkTo + q + '. ' + pos, widOf(b) + '-to');
    if (b.drinkTo && b.drinkTo < y) add(soon, 'Da aprire presto: ' + nm, 'È oltre la finestra ideale (fino al ' + b.drinkTo + ')' + q + '. ' + pos, widOf(b) + '-past');
    if (b.pending && b.eta) add(b.eta.replace(/-/g, ''), 'Consegna vino: ' + nm, 'Bottiglie in arrivo' + q + (b.buyWhere ? ' da ' + b.buyWhere : '') + '.', widOf(b) + '-eta');
  });
  if (!ev.length) { if (m) m.textContent = 'Nessun promemoria da creare: servono bottiglie con la finestra di beva (anni «da… a…») o consegne con data.'; return; }
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Cantina//IT', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:Cantina', ...ev, 'END:VCALENDAR'].join('\r\n');
  giveFile(new File([ics], 'cantina-promemoria.ics', { type: 'text/calendar' }), 'Promemoria cantina', m).then(() => { if (m && m.textContent === 'Pronto.') m.textContent = ev.length + ' promemoria pronti: scegli Calendario, oppure salvali in File e aprili. Se li rifai più avanti, quelli vecchi vengono aggiornati.'; });
}
