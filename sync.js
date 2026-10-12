/* Sincronizzazione tra dispositivi (iPhone, Mac…) tramite il tuo repository GitHub privato,
   backup guidato e valori di mercato aggiornati ogni mese.
   Ogni bottiglia ha "upd", il momento dell'ultima modifica: in caso di modifiche su due dispositivi
   vince la più recente. Le bottiglie eliminate restano segnate per 6 mesi, così non ricompaiono. */

const SYNC_PATH = 'sync/cantina.json';
const PK = ['c', 'f', 'r']; // foto: ritaglio, intera, retro-etichetta
let syncBusy = false, syncT = null, inSync = false, lastSyncTry = 0;
const syncOn = () => cloudOn() && getBk().sync !== false;

/* ---- Segno ogni modifica (senza toccare il resto dell'app) ---- */
async function getTomb() { return (await dbGet('kv', 'tomb')) || {}; }
async function getMeta() { return (await dbGet('kv', 'metaUpd')) || {}; }
async function markMeta(k) { if (inSync) return; const m = await getMeta(); m[k] = Date.now(); await dbPut('kv', m, 'metaUpd'); scheduleSync(); }
function scheduleSync() { if (inSync || !syncOn()) return; clearTimeout(syncT); syncT = setTimeout(() => syncNow().catch(() => {}), 12000); }
(function wrap() {
  const pb = persistBottle, rb = removeBottle, ps = persistShelves, sg = saveGlasses;
  persistBottle = async function (b, o) { if (!inSync && !(o && o.keepUpd)) { b.upd = Date.now(); scheduleSync(); } return pb(b); };
  removeBottle = async function (id) { if (!inSync) { const t = await getTomb(); t[id] = Date.now(); await dbPut('kv', t, 'tomb'); scheduleSync(); } return rb(id); };
  persistShelves = async function () { await markMeta('shelves'); return ps(); };
  saveGlasses = async function () { await markMeta('glasses'); return sg(); };
})();

/* ---- Sincronizza ---- */
const sameJ = (a, b) => JSON.stringify(a) === JSON.stringify(b);
async function syncNow(onStep, retry) {
  if (syncBusy || !syncOn()) return { skipped: true };
  syncBusy = true; inSync = true; lastSyncTry = Date.now();
  const step = onStep || (() => {});
  try {
    await ghCheck();
    step('Leggo i dati dell\'altro dispositivo…');
    let remote = null, sha = null;
    try { const meta = await gh(SYNC_PATH); sha = meta.sha; remote = await (await gh(SYNC_PATH, { raw: true })).json(); } catch (e) { if (e.status !== 404) throw e; }
    const rb = {}; ((remote && remote.bottles) || []).forEach((b) => { rb[b.id] = b; });
    const tomb = { ...((remote && remote.tomb) || {}) }, lt = await getTomb();
    Object.keys(lt).forEach((k) => { tomb[k] = Math.max(tomb[k] || 0, lt[k]); });
    const old = Date.now() - 180 * 86400000; Object.keys(tomb).forEach((k) => { if (tomb[k] < old) delete tomb[k]; });
    let pulled = 0, removed = 0, push = !remote;
    const merged = {};
    for (const id of new Set([...Object.keys(S.bottles), ...Object.keys(rb)])) {
      const L = S.bottles[id], R = rb[id], lu = L ? L.upd || 0 : -1, ru = R ? R.upd || 0 : -1;
      if (tomb[id] && tomb[id] >= Math.max(lu, ru)) {
        if (L) { delete S.bottles[id]; await dbDel('bottles', id); for (const k of PK) await dbDel('photos', id + ':' + k); removed++; }
        if (R) push = true;
        continue;
      }
      if (!R) { merged[id] = L; push = true; continue; }
      if (!L || ru > lu || (ru === lu && !sameJ(L, R))) { merged[id] = R; S.bottles[id] = R; await dbPut('bottles', R); pulled++; continue; }
      merged[id] = L;
      if (lu > ru) push = true;
    }
    // scaffali e calici: vince la modifica più recente
    const lm = await getMeta(), rm = (remote && remote.meta) || {}, meta = { ...rm };
    for (const k of ['shelves', 'glasses']) {
      const lv = lm[k] || 0, rv = rm[k] || 0, rData = remote && remote[k];
      if (Array.isArray(rData) && (rv > lv || (rv === lv && lv === 0 && !(k === 'shelves' ? S.shelves.length : GLASSES.length)))) {
        if (k === 'shelves') { S.shelves = rData; await dbPut('kv', S.shelves, 'shelves'); } else { GLASSES = rData; await dbPut('kv', GLASSES, 'glasses'); }
        meta[k] = rv; pulled++;
      } else { meta[k] = lv; if (lv > rv || !Array.isArray(rData)) push = true; }
    }
    await dbPut('kv', tomb, 'tomb'); await dbPut('kv', meta, 'metaUpd');
    if (!sameJ(tomb, (remote && remote.tomb) || {})) push = true;
    if (push) {
      step('Invio le tue modifiche…');
      const data = { app: 'cantina', sync: 1, at: Date.now(), bottles: Object.values(merged), shelves: S.shelves, glasses: GLASSES, tomb, meta };
      try { await gh(SYNC_PATH, { method: 'PUT', body: { message: 'Sincronizzazione cantina', content: b64Text(JSON.stringify(data)), ...(sha ? { sha } : {}) } }); }
      catch (e) { if ((e.status === 409 || e.status === 422) && !retry) { syncBusy = false; inSync = false; return syncNow(onStep, true); } throw e; }
    }
    // foto: carico le mie nuove, scarico quelle che mi mancano (un po' per volta)
    let list = [];
    try { list = await gh('foto'); } catch (e) { if (e.status !== 404) throw e; }
    const there = new Set((Array.isArray(list) ? list : []).map((x) => x.name));
    const sent = (await dbGet('kv', 'ghPhotos')) || {};
    let moves = 0;
    for (const b of Object.values(merged)) {
      if (moves >= 40) break;
      for (const k of PK) {
        const key = b.id + ':' + k, file = b.id + '-' + k + '.jpg', blob = await dbGet('photos', key);
        if (blob && (sent[key] !== blob.size || !there.has(file))) {
          step('Invio le foto…');
          await ghPut('foto/' + file, await b64Blob(blob), 'Foto ' + name(b)); sent[key] = blob.size; moves++;
        } else if (!blob && there.has(file)) {
          step('Scarico le foto…');
          try { const bl = await (await gh('foto/' + file, { raw: true })).blob(); await dbPut('photos', bl, key); sent[key] = bl.size; moves++; } catch (_) {}
        }
      }
    }
    await dbPut('kv', sent, 'ghPhotos');
    const at = Date.now();
    await dbPut('kv', at, 'syncLast');
    if (pulled || removed) render();
    return { pulled, removed, pushed: push, photos: moves, at, more: moves >= 40 };
  } finally { syncBusy = false; inSync = false; }
}
async function autoSync(quiet) {
  if (!syncOn() || !navigator.onLine) return;
  try {
    const r = await syncNow();
    if (r && !r.skipped && (r.pulled || r.removed) && !quiet) { msg('Sincronizzato con l\'altro dispositivo: ' + (r.pulled + r.removed) + ' modifiche.'); setTimeout(() => msg(''), 4000); }
    if (r && r.more) setTimeout(() => autoSync(true), 3000);
  } catch (e) { if (!quiet) { msg('Sincronizzazione non riuscita: ' + esc(e.message) + ' <button class="link" data-a="settings">Impostazioni</button>'); } }
}
setTimeout(() => { if (db) autoSync(); }, 2500);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && Date.now() - lastSyncTry > 60000) autoSync(); });

/* ---- Backup guidato ---- */
function cloudBanner() {
  if (cloudOn()) return '';
  try { if (+localStorage.getItem('cantina.bkLater') > Date.now()) return ''; } catch (_) {}
  if (!Object.keys(S.bottles).length) return '';
  return `<div class="note bkban"><b>Proteggi la tua cantina.</b> I dati sono solo su questo telefono: attiva il backup gratuito nel cloud (5 minuti, una volta sola). Servirà anche per usare l'app dal Mac.<div class="acts"><button class="btn pri" data-a="bkwizard">Attiva</button><button class="btn" data-a="bklater">Più tardi</button></div></div>`;
}
function openWizard() {
  const d = $('#dlg2');
  const c = getBk();
  const [u0, r0] = (c.repo || '').split('/');
  d.innerHTML = `<h2>Backup nel cloud</h2>
  <p class="info">Usiamo GitHub, gratuito: i dati vanno in un tuo archivio privato che vedi solo tu. Segui i passi in ordine; i link si aprono già compilati.</p>
  <ol class="wz">
    <li><b>Entra in GitHub</b> o crea un account gratuito.<div class="acts"><a class="btn" href="https://github.com/login" target="_blank" rel="noopener">Accedi</a><a class="btn" href="https://github.com/signup" target="_blank" rel="noopener">Crea account</a></div></li>
    <li><b>Crea l'archivio privato.</b> Si apre già con nome <i>cantina-backup</i> e impostato su Privato: premi <b>Create repository</b> in fondo.<div class="acts"><a class="btn" href="https://github.com/new?owner=lorenzomanzoni18-hub&amp;name=cantina-backup&amp;visibility=private&amp;description=Backup%20dell%27app%20Cantina" target="_blank" rel="noopener">Crea l'archivio</a></div></li>
    <li><b>Crea la chiave di accesso.</b> Si apre già compilata (nome, nessuna scadenza, permesso di scrivere). Devi solo scegliere, in <b>Repository access</b>, <b>Only select repositories</b> › <i>cantina-backup</i>, poi premere <b>Generate token</b> e copiarlo.<div class="acts"><a class="btn" href="https://github.com/settings/personal-access-tokens/new?name=App%20Cantina&amp;description=Backup%20e%20sincronizzazione%20dell%27app%20Cantina&amp;expires_in=none&amp;contents=write" target="_blank" rel="noopener">Crea la chiave</a></div></li>
    <li><b>Incolla qui</b> il tuo nome utente GitHub e la chiave.
      <label>Nome utente GitHub</label><input id="wz_u" autocomplete="off" autocapitalize="none" placeholder="es. lorenzomanzoni" value="${esc(u0 || 'lorenzomanzoni18-hub')}">
      <label>Nome dell'archivio</label><input id="wz_r" autocomplete="off" autocapitalize="none" value="${esc(r0 || 'cantina-backup')}">
      <label>Chiave (token)</label><input id="wz_t" type="password" autocomplete="off" placeholder="github_pat_…" value="${esc(c.token || '')}"></li>
  </ol>
  <div class="acts"><button class="btn pri" id="wz_ok">Attiva backup e sincronizzazione</button><button class="btn" id="wz_x">Chiudi</button></div>
  <p class="info" id="wz_m"></p>`;
  const m = (t) => { $('#wz_m').textContent = t; };
  $('#wz_x').onclick = () => d.close();
  $('#wz_ok').onclick = async () => {
    const u = $('#wz_u').value.trim().replace(/^@/, ''), r = $('#wz_r').value.trim() || 'cantina-backup', t = $('#wz_t').value.trim();
    if (!u || !t) { m('Scrivi il nome utente e incolla la chiave.'); return; }
    setBk({ ...getBk(), repo: u + '/' + r, token: t, every: getBk().every || 30, sync: true });
    $('#wz_ok').disabled = true;
    try {
      m('Controllo l\'accesso…');
      await syncNow(m);
      const b = await cloudBackup(m);
      m('Fatto: backup salvato (' + (b.bottles || 0) + ' bottiglie) e sincronizzazione attiva. Sul Mac apri lo stesso indirizzo dell\'app e ripeti solo il passo 4.');
      render();
    } catch (e) { m('Non riuscito: ' + e.message); }
    $('#wz_ok').disabled = false;
  };
  d.onclose = null;
  d.showModal();
}

/* ---- Valori di mercato aggiornati ogni mese ---- */
const valAutoOn = () => { try { return localStorage.getItem('cantina.valauto') !== '0'; } catch (_) { return true; } };
async function priceOnly(b) {
  const r = await aiSearch(`Cerca sul web il prezzo di mercato attuale in euro di UNA bottiglia di questo vino: produttore ${b.producer || 'non indicato'}, cuvée ${b.cuvee || 'non indicata'}, annata ${b.vintage || 'non indicata'}, formato ${sizeName(sizeMl(b))}. Usa Wine-Searcher, enoteche online e aste. Siamo nel ${new Date().getFullYear()}.
Rispondi SOLO con JSON: {"price_eur": number|null, "note": "fonte e fascia trovate, es. Wine-Searcher: 85-120 €, media 98 €"}. Se non trovi un prezzo per questa annata usa null: non stimare a memoria.`);
  return parseJsonLoose(r.text);
}
async function autoValues() {
  if (!aiReady() || !navigator.onLine || !valAutoOn()) return;
  const last = (await dbGet('kv', 'valRun')) || 0;
  if (Date.now() - last < 20 * 3600000) return; // al massimo una volta al giorno, pochi vini per volta
  await dbPut('kv', Date.now(), 'valRun');
  const done = (await dbGet('kv', 'valDone')) || {};
  const todo = uniqW(Object.values(S.bottles).filter(inCellar))
    .filter((b) => (b.producer || b.cuvee) && (b.value == null || b.value === '' || b.valueAuto) && Date.now() - (done[widOf(b)] || b.valAt || 0) > 30 * 86400000)
    .sort((a, c) => (done[widOf(a)] || a.valAt || 0) - (done[widOf(c)] || c.valAt || 0));
  let n = 0;
  for (const b of todo.slice(0, 6)) {
    try {
      const j = await priceOnly(b);
      const p = Number(j && j.price_eur);
      done[widOf(b)] = Date.now();
      if (Number.isFinite(p) && p > 0) {
        for (const x of groupOf(b)) if (x.value == null || x.value === '' || x.valueAuto) await persistBottle({ ...x, value: Math.round(p), valueAuto: true, valueNote: String((j && j.note) || ''), valAt: Date.now() });
        n++;
      }
    } catch (e) { if (e.quota || /quota|429|exhausted|rate/i.test(e.message)) break; }
    await dbPut('kv', done, 'valDone');
    await sleep(2500);
  }
  if (n) { msg('Valori di mercato aggiornati per ' + n + (n === 1 ? ' vino.' : ' vini.')); setTimeout(() => msg(''), 5000); try { await recordHist(); } catch (_) {} }
}
setTimeout(() => { if (db) autoValues().catch(() => {}); }, 15000);

/* ---- Sezione nelle Impostazioni ---- */
function syncSection() {
  const c = getBk();
  return `<h3 style="margin:16px 0 4px;font-size:16px">Sincronizzazione tra dispositivi</h3>
  ${cloudOn() ? `<label class="chk"><input type="checkbox" id="sy_on" ${c.sync !== false ? 'checked' : ''}> Tieni allineati iPhone, Mac e altri dispositivi</label>
  <p class="info">Le modifiche vanno sul tuo archivio GitHub e arrivano sugli altri dispositivi quando li apri. <span id="sy_st"></span></p>
  <div class="acts"><button class="btn" id="sy_now">Sincronizza ora</button></div><p class="info" id="sy_m"></p>`
  : `<p class="info">Per usare l'app anche dal Mac con gli stessi dati, attiva prima il backup nel cloud.</p><div class="acts"><button class="btn pri" data-a="bkwizard">Attiva backup e sincronizzazione</button></div>`}
  <h3 style="margin:16px 0 4px;font-size:16px">Valori di mercato</h3>
  <label class="chk"><input type="checkbox" id="va_on" ${valAutoOn() ? 'checked' : ''}> Aggiorna ogni mese i valori stimati</label>
  <p class="info">Ogni giorno l'app ricontrolla online il prezzo di qualche vino (pochi per volta, per i limiti gratuiti dell'IA). I valori che hai scritto tu non vengono toccati.</p>`;
}
function bindSyncSection() {
  if ($('#va_on')) $('#va_on').onchange = (e) => { try { localStorage.setItem('cantina.valauto', e.target.checked ? '1' : '0'); } catch (_) {} };
  if (!$('#sy_on')) return;
  const st = async () => { const t = await dbGet('kv', 'syncLast'); $('#sy_st').textContent = 'Ultima sincronizzazione: ' + fmtWhen(t) + '.'; };
  st();
  $('#sy_on').onchange = (e) => { setBk({ ...getBk(), sync: e.target.checked }); };
  $('#sy_now').onclick = async () => {
    const m = (t) => { $('#sy_m').textContent = t; };
    try { const r = await syncNow(m); m(r.skipped ? 'Sincronizzazione già in corso o spenta.' : 'Fatto: ' + (r.pulled + r.removed) + ' modifiche ricevute' + (r.pushed ? ', le tue modifiche sono state inviate' : '') + (r.photos ? ', ' + r.photos + ' foto' : '') + '.'); st(); }
    catch (e) { m('Non riuscita: ' + e.message); }
  };
}
