/* Comodità d'uso: dov'è, annulla, vibrazione, codice a barre, grafico della finestra di beva. */

/* ===== Vibrazione leggera (su iPhone funziona con iOS 18 o successivo) ===== */
(function () {
  const l = document.createElement('label');
  l.id = 'hpt'; l.setAttribute('aria-hidden', 'true');
  l.style.cssText = 'position:fixed;left:-9999px;width:1px;height:1px;overflow:hidden';
  l.innerHTML = '<input type="checkbox" switch tabindex="-1">';
  document.body.appendChild(l);
})();
function haptic() {
  try {
    if (navigator.vibrate && navigator.vibrate(12)) return;
    const l = document.getElementById('hpt'); if (l) l.click();
  } catch (_) {}
}

/* ===== Dov'è: mostra la bottiglia sullo scaffale ===== */
function locate(id) {
  const b = S.bottles[id];
  if (!b) return;
  const d1 = $('#dlg'), d2 = $('#dlg2');
  if (d2.open) d2.close();
  if (d1.open) d1.close();
  if (!b.shelf || !inCellar(b)) {
    notice(name(b), inCellar(b) ? 'Questa bottiglia non è ancora sullo scaffale: tocca un posto libero in Cantina per posizionarla.' : 'Questa bottiglia non è in cantina (' + stateLabel(b).toLowerCase() + ').', [{ t: 'OK', pri: true }]);
    return;
  }
  tab = 'cantina'; render();
  const cell = document.querySelector(`.cell[data-s="${CSS.escape(b.shelf)}"][data-r="${b.r}"][data-c="${b.c}"]`);
  if (!cell) return;
  cell.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
  cell.classList.add('found');
  haptic();
  setTimeout(() => cell.classList.remove('found'), 4500);
}

/* ===== Annulla ===== */
let undoT = null;
const snapIds = (ids) => ids.filter((id) => S.bottles[id]).map((id) => JSON.parse(JSON.stringify(S.bottles[id])));
function showUndo(label, snap, photos) {
  let t = $('#toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
  t.innerHTML = `<span>${esc(label)}</span><button type="button">Annulla</button>`;
  t.classList.add('on');
  clearTimeout(undoT);
  undoT = setTimeout(() => t.classList.remove('on'), 7000);
  t.querySelector('button').onclick = async () => {
    clearTimeout(undoT); t.classList.remove('on');
    for (const b of snap) await persistBottle(b);
    if (photos) for (const [k, v] of Object.entries(photos)) if (v) await dbPut('photos', v, k);
    haptic();
    render();
  };
}

/* ===== Finestra di beva disegnata ===== */
function drinkRange(from, to, text) {
  if (from && to) return [from, to];
  const ys = String(text || '').match(/(?:19|20)\d\d/g);
  return ys && ys.length >= 2 ? [Math.min(...ys), Math.max(...ys)] : null;
}
function drinkBar(from, to, vintage) {
  if (!(from && to)) return '';
  const now = new Date().getFullYear();
  const a = Math.min(vintage || from, from, now) - 1, z = Math.max(to, now) + 1, span = Math.max(1, z - a);
  const X = (y) => 8 + ((y - a) / span) * 304;
  const state = now < from ? 'Da aspettare: pronta dal ' + from : now > to ? 'Oltre la finestra: è finita nel ' + to : 'Pronta da bere fino al ' + to;
  const col = now < from ? 'var(--wait)' : now > to ? 'var(--past)' : 'var(--ok)';
  const ticks = [];
  const step = span > 40 ? 10 : span > 20 ? 5 : span > 10 ? 2 : 1;
  for (let y = Math.ceil(a / step) * step; y <= z; y += step) ticks.push(`<line x1="${X(y)}" y1="34" x2="${X(y)}" y2="38" stroke="var(--line)"/><text x="${X(y)}" y="50" text-anchor="middle" font-size="9" fill="var(--mute)">${y}</text>`);
  return `<div class="dwin"><p class="dwlab" style="color:${col}">${esc(state)}</p><svg viewBox="0 0 320 54" role="img" aria-label="Finestra di beva dal ${from} al ${to}, oggi ${now}">
    <rect x="8" y="22" width="304" height="8" rx="4" fill="var(--empty)"/>
    ${vintage && vintage >= a ? `<circle cx="${X(vintage)}" cy="26" r="3" fill="var(--mute)"/>` : ''}
    <rect x="${X(from)}" y="20" width="${Math.max(4, X(to + 1) - X(from))}" height="12" rx="6" fill="${col}" opacity=".9"/>
    <line x1="${X(now + 0.5)}" y1="10" x2="${X(now + 0.5)}" y2="40" stroke="var(--ink)" stroke-width="2"/>
    <text x="${X(now + 0.5)}" y="8" text-anchor="middle" font-size="9" font-weight="700" fill="var(--ink)">oggi</text>
    ${ticks.join('')}</svg>${vintage ? '<p class="info" style="margin:0">Il punto grigio è la vendemmia (' + vintage + ').</p>' : ''}</div>`;
}

/* ===== Codice a barre ===== */
let zxingP = null;
function loadZxing() {
  if (window.ZXing) return Promise.resolve();
  if (zxingP) return zxingP;
  zxingP = new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js';
    s.onload = () => (window.ZXing ? res() : rej(new Error('lettore non disponibile')));
    s.onerror = () => { zxingP = null; rej(new Error('serve internet per il lettore la prima volta')); };
    document.head.appendChild(s);
  });
  return zxingP;
}
function scanBarcode() {
  return new Promise((resolve) => {
    const d = $('#dlg2');
    let reader = null, done = false;
    const finish = (code) => {
      if (done) return; done = true;
      try { if (reader) reader.reset(); } catch (_) {}
      if (d.open) d.close();
      resolve(code ? String(code).replace(/\D/g, '') || String(code).trim() : null);
    };
    d.innerHTML = `<h2>Codice a barre</h2><p class="info">Inquadra il codice a barre sul retro della bottiglia, tenendolo dritto e ben illuminato.</p>
    <div class="scanbox"><video id="sc_v" playsinline muted autoplay></video><i></i></div>
    <p class="info" id="sc_m">Avvio la fotocamera…</p>
    <label>Oppure scrivi le cifre</label><input id="sc_t" inputmode="numeric" autocomplete="off" placeholder="Es. 8001234567890">
    <div class="acts"><button class="btn pri" id="sc_ok" type="button">Usa questo codice</button><button class="btn" id="sc_x" type="button">Annulla</button></div>`;
    $('#sc_x').onclick = () => finish(null);
    $('#sc_ok').onclick = () => { const v = $('#sc_t').value.trim(); if (v) finish(v); };
    d.onclose = () => finish(null);
    d.showModal();
    loadZxing().then(() => {
      if (done) return;
      reader = new ZXing.BrowserMultiFormatReader();
      return reader.decodeFromConstraints({ video: { facingMode: 'environment' } }, $('#sc_v'), (r) => { if (r) { haptic(); finish(r.getText()); } })
        .then(() => { const m = $('#sc_m'); if (m && !done) m.textContent = 'Cerco il codice…'; });
    }).catch((e) => {
      const m = $('#sc_m');
      if (m) m.textContent = /permission|notallowed|denied/i.test(String(e && (e.name || e.message))) ? 'La fotocamera non è autorizzata: puoi scrivere il codice qui sotto, oppure dare il permesso nelle impostazioni dell\'iPhone.' : 'Fotocamera non disponibile (' + (e && e.message ? e.message : 'errore') + '): scrivi il codice qui sotto.';
    });
  });
}
// Dati del prodotto da Open Food Facts (gratis, con attribuzione).
async function offProduct(code) {
  const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 9000);
  try {
    const r = await fetch('https://world.openfoodfacts.org/api/v2/product/' + encodeURIComponent(code) + '.json?fields=product_name,product_name_it,brands,quantity,image_front_url,categories', { signal: ctl.signal });
    const j = await r.json(); const p = j && j.product;
    if (!p) return null;
    let img = null;
    if (p.image_front_url) { try { img = await offImg(p.image_front_url, ctl.signal); } catch (_) {} }
    return { name: p.product_name_it || p.product_name || '', brand: (p.brands || '').split(',')[0].trim(), qty: p.quantity || '', cat: p.categories || '', img };
  } catch (_) { return null; } finally { clearTimeout(to); }
}
const byBarcode = (code) => Object.values(S.bottles).filter((b) => b.barcode && String(b.barcode) === String(code));
// Dall'Elenco: trovo il vino col codice, oppure propongo di aggiungerlo.
async function scanFind() {
  const code = await scanBarcode();
  if (!code) return;
  const found = byBarcode(code);
  if (found.length) {
    const inC = found.filter(inCellar), b = inC.find((x) => x.shelf) || inC[0] || found[0];
    notice(name(b) + (b.vintage ? ' ' + b.vintage : ''), `Ce l'hai già: ${inC.length} ${inC.length === 1 ? 'bottiglia' : 'bottiglie'} in cantina.`, [
      { t: 'Apri la scheda', pri: true, fn: () => openBottle(b.id) },
      ...(b.shelf && inCellar(b) ? [{ t: 'Dov\'è?', fn: () => locate(b.id) }] : []),
      { t: 'Chiudi' }]);
    return;
  }
  openBottle(null, { barcode: code });
}
