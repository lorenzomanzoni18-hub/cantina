/* Backup automatico.
   1) Sul telefono: una copia al mese dei dati (bottiglie e scaffali), tengo le ultime 6.
      Serve se cancelli qualcosa per sbaglio o un aggiornamento va storto.
   2) Nel cloud, su un tuo repository GitHub privato: ogni mese (o settimana) all'apertura
      dell'app carica i dati e le foto nuove. Serve se perdi o cambi il telefono. */

const BK_KEY = 'cantina.bk';
const SNAP_KEEP = 6;
function getBk() { try { return { repo: '', token: '', every: 30, ...JSON.parse(localStorage.getItem(BK_KEY) || '{}') }; } catch (_) { return { repo: '', token: '', every: 30 }; } }
function setBk(c) { try { localStorage.setItem(BK_KEY, JSON.stringify(c)); } catch (_) {} }
const cloudOn = () => { const c = getBk(); return !!(c.repo && c.token); };
const ymd = (d) => new Date(d).toLocaleDateString('sv-SE');
const fmtWhen = (t) => (t ? new Date(t).toLocaleString('it-IT', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'mai');

function snapshotData() {
  return { app: 'cantina', version: 2, exported: new Date().toISOString(), shelves: S.shelves, glasses: GLASSES, bottles: Object.values(S.bottles) };
}

/* ---- Copie sul telefono ---- */
async function snapKeys() {
  const keys = await req('kv', 'readonly', (s) => s.getAllKeys());
  return (keys || []).filter((k) => typeof k === 'string' && k.startsWith('snap:')).sort().reverse();
}
async function localSnapshot(force) {
  const key = 'snap:' + new Date().toISOString().slice(0, 7);
  const keys = await snapKeys();
  if (!force && keys.includes(key)) return false;
  if (!Object.keys(S.bottles).length && !S.shelves.length) return false;
  await dbPut('kv', snapshotData(), key);
  for (const k of (await snapKeys()).slice(SNAP_KEEP)) await dbDel('kv', k);
  return true;
}
async function restoreSnapshot(key) {
  const j = await dbGet('kv', key);
  if (!j || !Array.isArray(j.bottles)) throw new Error('copia non trovata');
  const ids = new Set(j.bottles.map((b) => b.id));
  const tomb = (await dbGet('kv', 'tomb')) || {};
  for (const id of Object.keys(S.bottles)) if (!ids.has(id)) { await dbDel('bottles', id); tomb[id] = Date.now(); }
  await dbPut('kv', tomb, 'tomb');
  S.bottles = {};
  for (const b of j.bottles) { b.upd = Date.now(); await dbPut('bottles', b); S.bottles[b.id] = b; }
  S.shelves = j.shelves || [];
  if (typeof markMeta === 'function') { await markMeta('shelves'); await markMeta('glasses'); }
  await dbPut('kv', S.shelves, 'shelves');
  if (Array.isArray(j.glasses)) { GLASSES = j.glasses; await saveGlasses(); }
  render();
}

/* ---- GitHub ---- */
function b64FromBytes(u8) {
  let s = '';
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  return btoa(s);
}
const b64Text = (t) => b64FromBytes(new TextEncoder().encode(t));
const b64Blob = async (b) => b64FromBytes(new Uint8Array(await b.arrayBuffer()));
const repoPath = () => getBk().repo.trim().replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '').replace(/\/$/, '');
async function ghCheck() {
  const r = await fetch('https://api.github.com/repos/' + repoPath(), { headers: { authorization: 'Bearer ' + getBk().token.trim(), accept: 'application/vnd.github+json' }, cache: 'no-store' });
  if (r.status === 401) throw new Error('Token GitHub non valido o scaduto.');
  if (r.status === 404) throw new Error('Repository «' + repoPath() + '» non trovato, oppure il token non ha accesso a quel repository.');
  if (!r.ok) throw new Error('Errore GitHub ' + r.status);
}
async function gh(path, opt) {
  const c = getBk();
  const r = await fetch('https://api.github.com/repos/' + repoPath() + '/contents/' + path, {
    method: (opt && opt.method) || 'GET',
    headers: { authorization: 'Bearer ' + c.token.trim(), accept: (opt && opt.raw) ? 'application/vnd.github.raw' : 'application/vnd.github+json', 'x-github-api-version': '2022-11-28', ...(opt && opt.body ? { 'content-type': 'application/json' } : {}) },
    body: opt && opt.body ? JSON.stringify(opt.body) : undefined,
    cache: 'no-store',
  });
  if (opt && opt.raw && r.ok) return r;
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const e = new Error(r.status === 401 ? 'Token GitHub non valido o scaduto.' : r.status === 404 ? 'Repository non trovato, oppure il token non ha accesso a quel repository.' : r.status === 403 ? 'Il token non ha il permesso di scrivere (serve «Contents: Read and write»).' : (j.message || 'Errore GitHub ' + r.status));
    e.status = r.status;
    throw e;
  }
  return j;
}
async function ghPut(path, content, message) {
  let sha;
  try { const cur = await gh(path); sha = cur.sha; } catch (e) { if (e.status !== 404) throw e; }
  return gh(path, { method: 'PUT', body: { message, content, ...(sha ? { sha } : {}) } });
}

let bkBusy = false;
async function cloudBackup(onStep) {
  if (bkBusy) return { skipped: true };
  if (!cloudOn()) throw new Error('Backup nel cloud non configurato.');
  bkBusy = true;
  try {
    const step = onStep || (() => {});
    await ghCheck();
    const sent = (await dbGet('kv', 'ghPhotos')) || {};
    const bs = Object.values(S.bottles);
    let n = 0, up = 0;
    for (const b of bs) {
      n++;
      for (const s of ['c', 'f', 'r']) {
        const blob = await dbGet('photos', b.id + ':' + s);
        const k = b.id + ':' + s;
        if (!blob || sent[k] === blob.size) continue;
        step('Carico le foto: bottiglia ' + n + ' di ' + bs.length + '…');
        await ghPut('foto/' + b.id + '-' + s + '.jpg', await b64Blob(blob), 'Foto ' + name(b));
        sent[k] = blob.size; up++;
        await dbPut('kv', sent, 'ghPhotos');
      }
    }
    step('Carico i dati…');
    await ghPut('backup/cantina-' + ymd(Date.now()) + '.json', b64Text(JSON.stringify(snapshotData())), 'Backup cantina ' + ymd(Date.now()) + ' (' + bs.length + ' bottiglie)');
    const t = Date.now();
    await dbPut('kv', t, 'ghLast');
    return { photos: up, bottles: bs.length, at: t };
  } finally { bkBusy = false; }
}
async function cloudRestore(onStep) {
  const step = onStep || (() => {});
  step('Cerco l\'ultimo backup…');
  await ghCheck();
  let list = [];
  try { list = await gh('backup'); } catch (e) { if (e.status !== 404) throw e; }
  const f = (Array.isArray(list) ? list : []).filter((x) => /^cantina-.*\.json$/.test(x.name)).sort((a, b) => b.name.localeCompare(a.name))[0];
  if (!f) throw new Error('Nel repository non c\'è ancora nessun backup.');
  const j = await (await gh('backup/' + f.name, { raw: true })).json();
  if (j.app !== 'cantina' || !Array.isArray(j.bottles)) throw new Error('Il file di backup non è valido.');
  if (!confirm('Ripristinare il backup del ' + f.name.slice(8, 18) + ' con ' + j.bottles.length + ' bottiglie? Le bottiglie con lo stesso codice vengono sostituite, le altre restano.')) return null;
  const sent = (await dbGet('kv', 'ghPhotos')) || {};
  let n = 0;
  for (const b of j.bottles) {
    n++;
    b.upd = Date.now(); // il ripristino vince sulle copie degli altri dispositivi
    await dbPut('bottles', b); S.bottles[b.id] = b;
    for (const s of ['c', 'f', 'r']) {
      if (await dbGet('photos', b.id + ':' + s)) continue;
      step('Scarico le foto: ' + n + ' di ' + j.bottles.length + '…');
      try {
        const blob = await (await gh('foto/' + b.id + '-' + s + '.jpg', { raw: true })).blob();
        await dbPut('photos', blob, b.id + ':' + s);
        sent[b.id + ':' + s] = blob.size;
      } catch (_) {}
    }
  }
  await dbPut('kv', sent, 'ghPhotos');
  if (Array.isArray(j.shelves) && j.shelves.length) { S.shelves = j.shelves; await dbPut('kv', S.shelves, 'shelves'); }
  if (Array.isArray(j.glasses) && j.glasses.length) { GLASSES = j.glasses; await saveGlasses(); }
  render();
  return j.bottles.length;
}

/* ---- Valore della cantina mese per mese ---- */
let HIST = {};
async function recordHist() {
  HIST = (await dbGet('kv', 'hist')) || {};
  if (!Object.keys(HIST).length) { // prima volta: ricostruisco dai mesi delle copie sul telefono
    for (const k of await snapKeys()) {
      if (!/^snap:\d{4}-\d{2}$/.test(k)) continue;
      const sn = await dbGet('kv', k), bs = (sn.bottles || []).filter((b) => !b.drunk && !b.pending && !b.wish);
      HIST[k.slice(5)] = { v: bs.reduce((t, b) => t + (b.value ?? b.price ?? 0), 0), s: bs.reduce((t, b) => t + (b.price || 0), 0), n: bs.length };
    }
  }
  const bs = Object.values(S.bottles).filter(inCellar);
  if (bs.length) HIST[new Date().toISOString().slice(0, 7)] = { v: bs.reduce((t, b) => t + (b.value ?? b.price ?? 0), 0), s: bs.reduce((t, b) => t + (b.price || 0), 0), n: bs.length };
  await dbPut('kv', HIST, 'hist');
}

/* ---- Automatico, all'apertura dell'app ---- */
async function autoBackup() {
  try { await localSnapshot(false); } catch (_) {}
  try { await recordHist(); } catch (_) {}
  if (!cloudOn() || !navigator.onLine) return;
  try {
    const last = (await dbGet('kv', 'ghLast')) || 0;
    if (Date.now() - last < getBk().every * 86400000) return;
    msg('Backup automatico nel cloud in corso…');
    const r = await cloudBackup((t) => msg('Backup automatico: ' + esc(t)));
    msg('Backup automatico salvato su GitHub (' + r.bottles + ' bottiglie).');
    setTimeout(() => { if ($('#msg').textContent.startsWith('Backup automatico salvato')) msg(''); }, 5000);
  } catch (e) {
    msg('Backup automatico non riuscito: ' + esc(e.message) + ' <button class="link" data-a="settings">Impostazioni</button>');
  }
}
setTimeout(() => { if (db) autoBackup(); }, 4000);

/* ---- Sezione nelle Impostazioni ---- */
function backupSection() {
  const c = getBk();
  return `<h3 style="margin:16px 0 4px;font-size:16px">Backup automatico</h3>
  <p class="info">Ogni mese l'app salva da sola una copia sul telefono (tengo le ultime ${SNAP_KEEP}). <span id="bk_loc"></span></p>
  <div class="acts"><button class="btn" id="bk_snap">Ripristina una copia del telefono</button></div>
  <p class="info" style="margin-top:12px"><b>Nel cloud (GitHub, gratis):</b> protegge la cantina anche se perdi o cambi telefono. Quando apri l'app, se è passato il tempo scelto, carica dati e foto nuove sul tuo repository privato. <span id="bk_cl"></span></p>
  <details class="more"><summary>Come si configura (una volta sola)</summary><ol style="font-size:14px;padding-left:18px;margin:8px 0">
  <li>Su github.com crea un nuovo repository <b>privato</b>, per esempio <i>cantina-backup</i>.</li>
  <li>Vai in Settings › Developer settings › Personal access tokens › <b>Fine-grained tokens</b> › Generate new token.</li>
  <li>Scadenza: la più lunga possibile. Repository access: <b>Only select repositories</b> › scegli <i>cantina-backup</i>.</li>
  <li>Permissions › Repository permissions › <b>Contents: Read and write</b>. Genera e copia il token.</li>
  <li>Qui sotto scrivi <i>tuonome/cantina-backup</i>, incolla il token e premi «Salva e fai il backup».</li></ol>
  <p class="info">Il token resta solo su questo telefono e può scrivere soltanto in quel repository.</p></details>
  <label>Repository (utente/nome)</label><input id="bk_repo" autocomplete="off" autocapitalize="none" placeholder="tuonome/cantina-backup" value="${esc(c.repo)}">
  <label>Token GitHub</label><input id="bk_tok" type="password" autocomplete="off" value="${esc(c.token)}">
  <label>Frequenza</label><select id="bk_ev"><option value="30" ${c.every >= 30 ? 'selected' : ''}>Ogni mese</option><option value="7" ${c.every < 30 ? 'selected' : ''}>Ogni settimana</option></select>
  <div class="acts"><button class="btn pri" id="bk_save">Salva e fai il backup</button><button class="btn" id="bk_rest">Ripristina dal cloud</button></div>
  <p class="info" id="bk_m"></p>
  ${typeof syncSection === 'function' ? syncSection() : ''}
  <h3 style="margin:16px 0 4px;font-size:16px">Backup a mano</h3>
  <p class="info">Un file con tutte le bottiglie, gli scaffali e le foto, da conservare dove vuoi (iCloud Drive, Mail).</p>`;
}
function bindBackupSection() {
  if (typeof bindSyncSection === 'function') bindSyncSection();
  const st = async () => {
    try {
      const k = (await snapKeys())[0];
      const s = k ? await dbGet('kv', k) : null;
      $('#bk_loc').textContent = 'Ultima copia: ' + (s ? fmtWhen(s.exported) : 'nessuna ancora') + '.';
      $('#bk_cl').textContent = cloudOn() ? 'Ultimo backup nel cloud: ' + fmtWhen(await dbGet('kv', 'ghLast')) + '.' : 'Non ancora configurato.';
    } catch (_) {}
  };
  st();
  const m = (t) => { $('#bk_m').textContent = t; };
  $('#bk_save').onclick = async () => {
    setBk({ repo: $('#bk_repo').value.trim(), token: $('#bk_tok').value.trim(), every: +$('#bk_ev').value });
    if (!cloudOn()) { m('Scrivi il repository e il token.'); return; }
    m('Controllo l\'accesso…');
    try { const r = await cloudBackup(m); m(r.skipped ? 'Un backup è già in corso.' : 'Backup salvato su GitHub: ' + r.bottles + ' bottiglie, ' + r.photos + ' foto nuove caricate.'); st(); }
    catch (e) { m('Non riuscito: ' + e.message); }
  };
  $('#bk_rest').onclick = async () => {
    setBk({ repo: $('#bk_repo').value.trim(), token: $('#bk_tok').value.trim(), every: +$('#bk_ev').value });
    if (!cloudOn()) { m('Scrivi prima il repository e il token.'); return; }
    try { const n = await cloudRestore(m); m(n === null ? '' : 'Ripristinate ' + n + ' bottiglie dal cloud.'); }
    catch (e) { m('Ripristino non riuscito: ' + e.message); }
  };
  $('#bk_snap').onclick = async () => {
    const keys = await snapKeys();
    if (!keys.length) { m('Non c\'è ancora nessuna copia sul telefono: la prima viene fatta in automatico.'); return; }
    const rows = [];
    for (const k of keys) { const s = await dbGet('kv', k); rows.push({ k, t: s.exported, n: (s.bottles || []).filter((b) => inCellar(b)).length }); }
    const d = $('#dlg');
    d.innerHTML = `<h2>Copie sul telefono</h2><p class="info">Ripristinare una copia riporta bottiglie e scaffali com'erano quel giorno. Prima di farlo salvo una copia della situazione attuale, così puoi tornare indietro.</p>` +
      rows.map((r) => `<button class="row" data-k="${esc(r.k)}"><span>${esc(fmtWhen(r.t))}<small>${r.n} bottiglie in cantina</small></span><span>›</span></button>`).join('') +
      `<div class="acts"><button class="btn" id="sn_x">Chiudi</button></div>`;
    $('#sn_x').onclick = () => d.close();
    d.querySelectorAll('[data-k]').forEach((x) => x.onclick = async () => {
      if (!confirm('Ripristinare la copia del ' + fmtWhen(rows.find((r) => r.k === x.dataset.k).t) + '?')) return;
      try {
        const cur = snapshotData();
        await dbPut('kv', cur, 'snap:prima-del-ripristino');
        await restoreSnapshot(x.dataset.k);
        d.close(); m('Copia ripristinata. La situazione precedente è salvata come «prima del ripristino».');
      } catch (e) { m('Ripristino non riuscito: ' + e.message); }
    });
    d.onclose = null;
    if (!d.open) d.showModal();
  };
}
