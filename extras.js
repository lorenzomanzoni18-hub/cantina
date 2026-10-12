/* Pagine aggiuntive: Luna, Sommelier (ex Stasera), Mappa, "Ho bevuto" e inventario PDF. */

/* ===== Luna ===== */
function moonChip() {
  const now = Date.now(), c = kind(now), good = isGood(c);
  let until = '';
  for (let i = 1; i <= 480; i++) { const t = now + i * 900000; if (isGood(kind(t)) !== good) { const d = new Date(t), same = d.toDateString() === new Date().toDateString(); until = 'fino ' + (same ? 'alle ' : d.toLocaleDateString('it-IT', { weekday: 'long' }) + ' alle ') + d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }); break; } }
  const y = new Date().getFullYear();
  const soon = Object.values(S.bottles).filter((b) => inCellar(b) && ((b.drinkTo && b.drinkTo <= y) || status(b) === 'st-past')).length;
  const moon = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/></svg>';
  const clock = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9 2h6"/></svg>';
  return `<div class="quick"><button class="qc" data-a="tab" data-t="luna"><span class="qi ${good ? 'ok' : 'no'}">${moon}</span><span><b>Giorno ${c[2]}</b><small>${good ? 'buono per bere' : 'meglio aspettare'}${until ? ', ' + until : ''}</small></span></button>`
    + `<button class="qc" data-a="soon"><span class="qi wait">${clock}</span><span><b>${soon} da bere</b><small>entro quest\'anno</small></span></button></div>`;
}
/* Calendario a mese e anno, sfogliabile come il calendario dell'iPhone. */
let calY = null, calM = null, calMode = 'month';
const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
const qCache = new Map();
function syncCal() { const d = new Date(dayStart(dayOff)); calY = d.getFullYear(); calM = d.getMonth(); }
function offOf(y, m, d) { return Math.round((new Date(y, m, d).getTime() - dayStart(0)) / 86400000); }
// Quota della giornata favorevole (frutto o fiore), campionata ogni 20 minuti.
function dayQ(y, m, d) {
  const k = y + '-' + m + '-' + d;
  if (qCache.has(k)) return qCache.get(k);
  const t0 = new Date(y, m, d).getTime(); let g = 0;
  for (let i = 0; i < 72; i++) if (isGood(kind(t0 + (i * 20 + 10) * 60000))) g++;
  const f = g / 72;
  if (qCache.size > 6000) qCache.clear();
  qCache.set(k, f);
  return f;
}
const qCol = (f) => (f >= 0.6 ? '#4C9A6A' : f > 0 ? '#D9A441' : '#B85C5C');
// Fasi lunari: differenza tra la longitudine della Luna e quella del Sole.
function sunLon(t) { const T = (t / 86400000 + 2440587.5 - 2451545) / 36525, r = Math.PI / 180, M = 357.52911 + 35999.05029 * T; return ((280.46646 + 36000.76983 * T + 1.914602 * Math.sin(M * r) + 0.019993 * Math.sin(2 * M * r)) % 360 + 360) % 360; }
const elong = (t) => ((moonLon(t) - sunLon(t)) % 360 + 360) % 360;
function phaseOf(y, m, d) {
  const a = elong(new Date(y, m, d).getTime()), b = elong(new Date(y, m, d + 1).getTime());
  if (b < a) return 'new';               // passa per 0°: luna nuova
  if (a < 180 && b >= 180) return 'full'; // passa per 180°: luna piena
  return '';
}
function calShift(n) {
  if (calY === null) syncCal();
  if (calMode === 'year') calY += n;
  else { calM += n; while (calM < 0) { calM += 12; calY--; } while (calM > 11) { calM -= 12; calY++; } }
  render();
}
function monthGrid(y, m, mini) {
  const first = (new Date(y, m, 1).getDay() + 6) % 7, n = new Date(y, m + 1, 0).getDate();
  const t = new Date(), sel = new Date(dayStart(dayOff));
  let h = '';
  for (let i = 0; i < first; i++) h += '<span></span>';
  for (let d = 1; d <= n; d++) {
    const f = dayQ(y, m, d), isT = t.getFullYear() === y && t.getMonth() === m && t.getDate() === d;
    if (mini) { h += `<i class="${isT ? 't' : ''}" style="background:${qCol(f)}"></i>`; continue; }
    const isS = sel.getFullYear() === y && sel.getMonth() === m && sel.getDate() === d, ph = phaseOf(y, m, d);
    const lab = new Date(y, m, d).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' }) + ': ' + (f >= 0.6 ? 'giorno buono' : f > 0 ? 'buono solo in certi orari' : 'da evitare') + (ph === 'full' ? ', luna piena' : ph === 'new' ? ', luna nuova' : '');
    h += `<button class="cd${isT ? ' t' : ''}${isS ? ' s' : ''}" data-a="calday" data-o="${offOf(y, m, d)}" aria-label="${lab}"><b>${d}</b><i style="background:${qCol(f)}"></i>${ph ? `<em class="ph ${ph}"></em>` : ''}</button>`;
  }
  return h;
}
function calendar() {
  if (calY === null) syncCal();
  const now = new Date(), onToday = calY === now.getFullYear() && (calMode === 'year' || calM === now.getMonth()) && dayOff === 0;
  const jump = `<label class="caljump">Vai a…<input type="date" id="caljump" value="${new Date(dayStart(dayOff)).toLocaleDateString('sv-SE')}"></label>`;
  const tbtn = onToday ? '' : '<button class="link" data-a="caltoday">Oggi</button>';
  if (calMode === 'year') {
    let ms = '';
    for (let m = 0; m < 12; m++) ms += `<button class="ym${calY === now.getFullYear() && m === now.getMonth() ? ' cur' : ''}" data-a="calmonth" data-m="${m}"><b>${MESI[m].slice(0, 3)}</b><span class="mg">${monthGrid(calY, m, true)}</span></button>`;
    return `<div class="cal calwrap"><div class="calbar"><span></span><span class="calbar-r">${tbtn}${jump}</span></div>
      <div class="calhead"><h2>${calY}</h2><span><button class="link" data-a="cal" data-d="-1" aria-label="Anno precedente">‹</button><button class="link" data-a="cal" data-d="1" aria-label="Anno successivo">›</button></span></div>
      <div class="yg">${ms}</div></div>`;
  }
  return `<div class="cal calwrap"><div class="calbar"><button class="link" data-a="calyear">‹ ${calY}</button><span class="calbar-r">${tbtn}${jump}</span></div>
    <div class="calhead"><h2>${MESI[calM]} <small>${calY}</small></h2><span><button class="link" data-a="cal" data-d="-1" aria-label="Mese precedente">‹</button><button class="link" data-a="cal" data-d="1" aria-label="Mese successivo">›</button></span></div>
    <div class="wd">${['L', 'M', 'M', 'G', 'V', 'S', 'D'].map((x) => `<span>${x}</span>`).join('')}</div>
    <div class="mgrid">${monthGrid(calY, calM, false)}</div>
    <p class="info calleg"><span><i style="background:#4C9A6A"></i>buono</span><span><i style="background:#D9A441"></i>solo certi orari</span><span><i style="background:#B85C5C"></i>da evitare</span><span><em class="ph full"></em>luna piena</span><span><em class="ph new"></em>luna nuova</span></p>
    </div>`;
}
function luna() { return calendar() + '<div id="lunaday">' + today() + '</div>'; }

/* ===== Degustazioni e "Ho bevuto" ===== */
function tastingDialog(title, drinking, cb) {
  const d = $('#dlg2');
  const day = new Date().toLocaleDateString('sv-SE');
  d.innerHTML = `<h2>${drinking ? 'Esce dalla cantina' : 'Nuova degustazione'}</h2><p class="info">${esc(title)}</p>
  ${drinking ? `<div class="seg howseg">${EXITS.map(([k, l], i) => `<button type="button" data-how="${k}" aria-pressed="${i === 0}">${esc(l.replace('Rotta o andata a male', 'Persa').replace('Portata a una cena', 'A una cena'))}</button>`).join('')}</div>
  <div id="dr_tow" hidden><label id="dr_tol">A chi</label><input id="dr_to" autocomplete="off" placeholder="Nome, occasione o ristorante"></div>` : ''}
  <label>Data</label><input id="dr_d" type="date" value="${day}">
  <div id="dr_rw">
  <label>Voto</label><div class="rate" role="radiogroup" aria-label="Voto">${[1, 2, 3, 4, 5].map((n) => `<button type="button" data-r="${n}" aria-label="${n} stelle">☆</button>`).join('')}</div>
  <label>Note di degustazione</label><textarea id="dr_n" rows="4" placeholder="Come l'hai trovato, se è pronto, con cosa l'hai bevuto…"></textarea></div>
  <p class="info" id="dr_i">${drinking ? 'La bottiglia lascia lo scaffale e va tra le «Bevute». La degustazione resta nella scheda di tutte le bottiglie uguali.' : 'La degustazione resta nella scheda del vino; nessuna bottiglia viene tolta dalla cantina.'}</p>
  <div class="acts"><button class="btn pri" id="dr_ok">Salva</button><button class="btn" id="dr_x">Annulla</button></div>`;
  let rating = 0;
  const paint = () => d.querySelectorAll('[data-r]').forEach((x) => { x.textContent = +x.dataset.r <= rating ? '★' : '☆'; x.setAttribute('aria-pressed', +x.dataset.r <= rating); });
  d.querySelectorAll('[data-r]').forEach((x) => x.onclick = () => { rating = rating === +x.dataset.r ? 0 : +x.dataset.r; paint(); });
  let how = 'bevuta';
  d.querySelectorAll('[data-how]').forEach((x) => x.onclick = () => {
    how = x.dataset.how;
    d.querySelectorAll('[data-how]').forEach((y) => y.setAttribute('aria-pressed', y === x));
    $('#dr_tow').hidden = !['regalata', 'cena', 'venduta'].includes(how);
    $('#dr_tol').textContent = how === 'cena' ? 'Dove o da chi' : how === 'venduta' ? 'A chi (facoltativo)' : 'A chi';
    $('#dr_rw').hidden = how !== 'bevuta' && how !== 'cena';
    $('#dr_i').textContent = how === 'bevuta' ? 'La bottiglia lascia lo scaffale e va tra le «Bevute». La degustazione resta nella scheda di tutte le bottiglie uguali.' : how === 'cena' ? 'La bottiglia lascia lo scaffale. Se l\'hai assaggiata, il voto e le note restano nella scheda del vino.' : 'La bottiglia lascia lo scaffale e va tra le uscite, con il motivo.';
  });
  $('#dr_x').onclick = () => d.close();
  $('#dr_ok').onclick = () => {
    const t = { date: $('#dr_d').value || day, rating, notes: $('#dr_n').value.trim() };
    if (drinking) { t.how = how; const to = $('#dr_to') ? $('#dr_to').value.trim() : ''; if (to) t.to = to; }
    d.close();
    cb(t);
  };
  d.onclose = null;
  d.showModal();
}

/* ===== Cosa stappo stasera ===== */
let dishText = '', pairHtml = '', pairMode = 'dish', menuText = '', guests = 4, menuHtml = '';
document.addEventListener('input', (e) => {
  if (!e.target) return;
  if (e.target.id === 'dish') dishText = e.target.value;
  if (e.target.id === 'menu') menuText = e.target.value;
  if (e.target.id === 'guests') guests = Math.max(1, Math.min(60, +e.target.value || 1));
});

// Il momento della giornata: i consigli valgono per pranzo, aperitivo o cena.
function mealNow() { const h = new Date().getHours(); return h < 5 ? 'cena' : h < 11 ? 'colazione' : h < 16 ? 'pranzo' : h < 19 ? 'aperitivo' : 'cena'; }
function mealLabel() { return { colazione: 'Oggi', pranzo: 'A pranzo', aperitivo: 'All\'aperitivo', cena: 'Stasera' }[mealNow()]; }
function stasera() {
  const c = kind(Date.now()), good = isGood(c);
  const n = Object.values(S.bottles).filter((b) => inCellar(b)).length;
  const seg = `<div class="seg seg3"><button data-a="pmode" data-m="dish" aria-pressed="${pairMode === 'dish'}">Un piatto</button><button data-a="pmode" data-m="menu" aria-pressed="${pairMode === 'menu'}">Un menu</button><button data-a="pmode" data-m="ask" aria-pressed="${pairMode === 'ask'}">Chiedi</button></div>`;
  const head = seg;
  if (pairMode === 'ask') return head + askView();
  if (pairMode === 'menu') return head + `<label for="menu">Il menu, una portata per riga</label>
  <textarea id="menu" rows="6" placeholder="Aperitivo: crudo di gamberi e ostriche&#10;Primo: risotto ai funghi porcini&#10;Secondo: guancia di manzo brasata&#10;Formaggi: pecorino stagionato&#10;Dolce: tarte tatin">${esc(menuText)}</textarea>
  <div class="two"><div><label for="guests">Persone a tavola</label><input id="guests" type="number" min="1" max="60" inputmode="numeric" value="${guests}"></div><div></div></div>
  <div class="acts"><button class="btn pri" data-a="pairmenu">Componi la sequenza dei vini</button></div>
  <p class="info">${n ? `Scelgo tra le ${n} bottiglie in cantina, tenendo conto del formato e di quante ne servono.` : 'Non hai ancora bottiglie in cantina.'}${aiReady() ? '' : ' Senza chiave dell\'IA uso un criterio semplice, portata per portata.'}</p>
  <div id="menuout">${menuHtml}</div>`;
  return head + `
  <label for="dish">Cosa cucini, o con chi mangi?</label>
  <textarea id="dish" rows="3" placeholder="Es. risotto ai funghi, branzino al forno, cena tra amici con salumi…">${esc(dishText)}</textarea>
  <div class="acts"><button class="btn pri" data-a="pair">Consigliami una bottiglia</button></div>
  <p class="info">${n ? `Scelgo tra le ${n} bottiglie in cantina.` : 'Non hai ancora bottiglie in cantina.'}${aiReady() ? '' : ' Senza chiave dell\'IA uso un criterio semplice, basato sugli abbinamenti salvati.'}</p>
  <div id="pairout">${pairHtml}</div>`;
}

function pairCard(b, reason) {
  const st = { 'st-now': 'Pronta da bere', 'st-wait': 'Da aspettare', 'st-past': 'Oltre il picco' }[status(b)] || '';
  return `<button class="row pick" data-a="open" data-id="${esc(b.id)}"><span style="display:flex;gap:12px">${imgSrc(b) ? `<img class="th" src="${imgSrc(b)}" alt="">` : '<span class="th"></span>'}<span><b>${esc(name(b))} ${esc(b.vintage || '')}</b><small>${isStd(b) ? '' : esc(sizeName(sizeMl(b))) + ' · '}${esc(posText(b))}${st ? ' · ' + st : ''}</small>${reason ? `<span class="why">${esc(reason)}</span>` : ''}<span class="why glass">${esc(glassLine(b))}</span></span></span></button>`;
}

function localPairScore(b, dish) {
  const d = nrm(dish), pr = nrm(b.pairing);
  let sc = 0;
  d.split(/[^a-z]+/).filter((w) => w.length > 3).forEach((w) => { if (pr.includes(w.slice(0, Math.max(4, w.length - 2)))) sc += 2; });
  const has = (re) => re.test(d);
  const t = b.type;
  if (has(/pesce|branzin|orata|crostace|frutti di mare|sushi|crudo|ostric|vongol|gamber|baccal|tonno|salmon|calamar|polpo/)) sc += (t === 'bianco' || t === 'bollicine') ? 3 : t === 'rosato' ? 1 : -1;
  if (has(/carne|manzo|brasato|bistecca|agnello|cinghiale|selvaggina|arrosto|ragu|stagionat|fiorentina|costata/)) sc += t === 'rosso' ? 3 : -1;
  if (has(/maiale|pollo|coniglio|funghi|risotto|pasta|tartufo/)) sc += (t === 'rosso' || t === 'bianco') ? 1 : 0;
  if (has(/dolce|torta|dessert|tiramis|pasticc/)) sc += (t === 'altro' || t === 'bollicine') ? 2 : -1;
  if (has(/aperitiv|antipast|salumi|fritt|pizza|tapas/)) sc += (t === 'bollicine' || t === 'rosato') ? 2 : 0;
  const s = status(b);
  sc += s === 'st-now' ? 2 : (s === 'st-wait' || s === 'st-past') ? -1 : 0;
  return sc;
}

async function pairNow() {
  const out = $('#pairout');
  const ta = $('#dish'); if (ta) dishText = ta.value;
  const cellar = Object.values(S.bottles).filter((b) => inCellar(b));
  if (!cellar.length) { pairHtml = '<p class="empty">Non hai ancora bottiglie in cantina.</p>'; out.innerHTML = pairHtml; return; }
  if (!dishText.trim()) { out.innerHTML = '<p class="info">Scrivi prima cosa cucini.</p>'; return; }
  const rank = { 'st-now': 0, '': 1, 'st-wait': 2, 'st-past': 2 };
  const cands = uniqW(cellar.slice().sort((a, b) => rank[status(a)] - rank[status(b)])).slice(0, 80);
  const c = kind(Date.now()), good = isGood(c);
  let picks = null, note = '';
  if (aiReady()) {
    out.innerHTML = '<p class="info">Sto scegliendo…</p>';
    try {
      const lab = { 'st-now': 'pronta da bere', 'st-wait': 'da aspettare', 'st-past': 'oltre il picco' };
      const list = cands.map((b) => ({ id: b.id, nome: name(b), annata: b.vintage || null, tipo: b.type, formato: sizeName(sizeMl(b)), zona: b.region || '', stato: lab[status(b)] || '', abbinamenti: (b.pairing || '').slice(0, 140), note: (b.winfo || '').slice(0, 120) }));
      const j = await aiJson(`Sei un sommelier. È il momento ${{ colazione: 'della mattina', pranzo: 'del pranzo', aperitivo: 'dell\'aperitivo', cena: 'della cena' }[mealNow()]}: tienine conto (a pranzo e all'aperitivo preferisci vini più leggeri e freschi, salvo richieste diverse). Devo mangiare questo: "${dishText.trim()}". Oggi la Luna è in ${c[1]} (giorno ${c[2]}, ${good ? 'favorevole' : 'poco favorevole'} per bere secondo il calendario biodinamico: puoi citarlo in una frase al massimo, senza dargli troppo peso).
Scegli da 1 a 3 bottiglie SOLO da questa lista, usando gli id esatti, preferendo quelle pronte da bere e con un abbinamento coerente. Per ognuna spiega in 1-2 frasi concrete perché va col piatto. Non inventare dati sul vino che non sono nella lista. Rispondi solo con JSON: {"picks":[{"id":string,"reason":string}],"note":string}.
Lista: ${JSON.stringify(list)}`);
      picks = (j.picks || []).filter((p) => S.bottles[p.id] && inCellar(S.bottles[p.id])).slice(0, 3);
      note = typeof j.note === 'string' ? j.note : '';
    } catch (e) { note = 'L\'IA non è disponibile adesso (' + e.message + '): ecco un suggerimento senza IA.'; }
  }
  if (!picks || !picks.length) {
    picks = cands.map((b) => ({ b, s: localPairScore(b, dishText) })).sort((a, b) => b.s - a.s).slice(0, 3).map((x) => ({ id: x.b.id, reason: '' }));
    if (!note && !aiReady()) note = 'Suggerimento senza IA, basato su tipo di vino, abbinamenti salvati e stato di maturità.';
  }
  pairHtml = (note ? `<p class="info">${esc(note)}</p>` : '') + picks.map((p) => pairCard(S.bottles[p.id], p.reason)).join('');
  out.innerHTML = pairHtml;
}

async function pairMenu() {
  const out = $('#menuout');
  const ta = $('#menu'); if (ta) menuText = ta.value;
  const courses = menuText.split('\n').map((x) => x.trim()).filter(Boolean).slice(0, 10);
  const cellar = Object.values(S.bottles).filter((b) => inCellar(b));
  if (!cellar.length) { menuHtml = '<p class="empty">Non hai ancora bottiglie in cantina.</p>'; out.innerHTML = menuHtml; return; }
  if (!courses.length) { out.innerHTML = '<p class="info">Scrivi prima le portate, una per riga.</p>'; return; }
  const rank = { 'st-now': 0, '': 1, 'st-wait': 2, 'st-past': 2 };
  const cands = uniqW(cellar.slice().sort((a, b) => rank[status(a)] - rank[status(b)])).slice(0, 100);
  // un calice da circa 120 ml a persona per portata: una 75 cl fa circa 6 calici
  const glasses = (ml) => Math.max(1, Math.floor(ml / 120));
  let seq = null, note = '';
  if (aiReady()) {
    out.innerHTML = '<p class="info">Compongo la sequenza…</p>';
    const lab = { 'st-now': 'pronta da bere', 'st-wait': 'da aspettare', 'st-past': 'oltre il picco' };
    const list = cands.map((b) => ({ id: b.id, nome: name(b), annata: b.vintage || null, tipo: b.type, formato: sizeName(sizeMl(b)), calici: glasses(sizeMl(b)), zona: b.region || '', stato: lab[status(b)] || '', abbinamenti: (b.pairing || '').slice(0, 120), note: (b.winfo || '').slice(0, 100) }));
    aiWaitNote = (sec) => { out.innerHTML = '<p class="info">Gemini chiede una pausa: riprovo tra ' + sec + ' secondi…</p>'; };
    try {
      const j = await aiJson(`Sei il sommelier di un ristorante e lavori con uno chef. C'è questo menu per ${guests} persone, una portata per riga:
${courses.map((c, i) => (i + 1) + '. ' + c).join('\n')}
Componi la sequenza dei vini scegliendo SOLO dalla lista qui sotto (usa gli id esatti). Regole: segui una progressione sensata (dal più leggero al più strutturato, bollicine all'inizio, vini dolci o passiti col dolce), preferisci bottiglie pronte da bere, puoi usare lo stesso vino per due portate vicine se è l'abbinamento migliore. Considera che ogni persona beve circa un calice da 120 ml a portata: indica quante bottiglie aprire di ciascun vino (un magnum vale due bottiglie). Per ogni portata spiega in 1-2 frasi concrete perché quel vino va col piatto, e dai un consiglio di servizio (temperatura, se decantare e quanto prima aprirla). Indica anche quale calice usare scegliendo tra quelli che ha: ${glassesForAI()}. Se non ne ha uno adatto, suggerisci la forma ideale. Tieni conto di quanti pezzi ha di ciascun calice rispetto alle persone. Se per una portata nessun vino della lista è adatto, metti id null e suggerisci in "reason" che tipo di vino servirebbe. Non inventare dati che non sono nella lista.
Rispondi solo con JSON: {"seq":[{"course":string,"id":string|null,"bottles":number,"reason":string,"service":string,"glass":string}],"note":string}
Lista: ${JSON.stringify(list)}`);
      seq = (j.seq || []).slice(0, courses.length).map((x, i) => ({ course: x.course || courses[i], id: x.id && S.bottles[x.id] && inCellar(S.bottles[x.id]) ? x.id : null, bottles: Math.max(1, Math.round(+x.bottles || 1)), reason: typeof x.reason === 'string' ? x.reason : '', service: typeof x.service === 'string' ? x.service : '', glass: typeof x.glass === 'string' ? x.glass : '' }));
      note = typeof j.note === 'string' ? j.note : '';
    } catch (e) { note = 'L\'IA non è disponibile adesso (' + e.message + '): ecco una proposta senza IA.'; }
    aiWaitNote = null;
  }
  if (!seq || !seq.length) {
    const used = new Set();
    seq = courses.map((c) => {
      const best = cands.filter((b) => !used.has(b.id)).map((b) => ({ b, s: localPairScore(b, c) })).sort((a, b) => b.s - a.s)[0];
      if (best) used.add(best.b.id);
      return { course: c, id: best ? best.b.id : null, bottles: best ? Math.max(1, Math.ceil(guests / glasses(sizeMl(best.b)))) : 1, reason: '', service: '' };
    });
    if (!note) note = 'Proposta senza IA, basata su tipo di vino, abbinamenti salvati e maturità: controllala tu.';
  }
  menuHtml = (note ? `<p class="info">${esc(note)}</p>` : '') + '<ol class="menuseq">' + seq.map((x) => {
    const b = x.id && S.bottles[x.id];
    return `<li><p class="course">${esc(x.course)}</p>${b ? pairCard(b, x.reason) + `<p class="info" style="margin:4px 0 0">${x.bottles > 1 ? 'Apri ' + x.bottles + ' bottiglie' : 'Basta una bottiglia'}${x.service ? ' · ' + esc(x.service) : ''}${x.glass ? ' · Calice: ' + esc(x.glass) : ''}</p>` : `<p class="info">${esc(x.reason || 'Nessuna bottiglia adatta in cantina.')}</p>`}</li>`;
  }).join('') + '</ol>';
  out.innerHTML = menuHtml;
}

/* ===== Il sommelier: domande libere sulla cantina ===== */
let askLog = [], askBusy = false, askDraft = '';
document.addEventListener('input', (e) => { if (e.target && e.target.id === 'ask') askDraft = e.target.value; });
const ASK_EX = ['Quali bottiglie dovrei aprire per prime?', 'Cosa porto a cena da un amico che ama la Borgogna?', 'Cosa apro per un aperitivo con salumi e formaggi?', 'Che cosa manca nella mia cantina?'];
function askView() {
  const n = uniqW(Object.values(S.bottles).filter(inCellar)).length;
  const log = askLog.map((x) => `<div class="qa"><p class="q">${esc(x.q)}</p>${x.err ? `<p class="info">${esc(x.err)}</p>` : `<div class="a">${esc(x.a).replace(/\n/g, '<br>')}</div>${(x.ids || []).filter((id) => S.bottles[id]).map((id) => pairCard(S.bottles[id], '')).join('')}`}</div>`).join('');
  return `<div id="asklog">${log || `<p class="info">Fai una domanda libera sulla tua cantina (${n} vini): il sommelier risponde guardando solo le tue bottiglie, le note e le finestre di beva.</p><div class="acts">${ASK_EX.map((t) => `<button class="link" data-a="askex" data-q="${esc(t)}">${esc(t)}</button>`).join('')}</div>`}</div>
  ${askBusy ? '<p class="info">Il sommelier sta pensando…</p>' : ''}
  <label for="ask">La tua domanda</label><textarea id="ask" rows="3" placeholder="Es. quali rossi sono pronti da bere quest'inverno?">${esc(askDraft)}</textarea>
  <div class="acts"><button class="btn pri" data-a="asksend" ${askBusy ? 'disabled' : ''}>Chiedi al sommelier</button>${askLog.length ? '<button class="btn" data-a="askclear">Nuova conversazione</button>' : ''}</div>
  ${aiReady() ? '' : '<p class="info">Serve la chiave dell\'IA nelle Impostazioni.</p>'}`;
}
async function askSend(text) {
  const qx = String(text || askDraft || '').trim();
  if (!qx || askBusy) return;
  if (!aiReady()) { notice('Manca la chiave dell\'IA', 'Per il sommelier serve la chiave del servizio di IA.', [{ t: 'Apri le impostazioni', pri: true, fn: openSettings }, { t: 'Chiudi' }]); return; }
  askBusy = true; askDraft = ''; render();
  const lab = { 'st-now': 'pronta', 'st-wait': 'da aspettare', 'st-past': 'oltre il picco' };
  const all = Object.values(S.bottles);
  const wines = uniqW(all.filter((b) => inCellar(b) || (!b.drunk && (b.pending || b.wish))));
  const list = wines.slice(0, 250).map((b) => {
    const g = groupOf(b), t = tastingsOf(b).sort((a, c) => String(c.date).localeCompare(String(a.date)))[0];
    return { id: b.id, vino: name(b), annata: b.vintage || null, tipo: b.type, formato: isStd(b) ? undefined : sizeName(sizeMl(b)), zona: b.region || undefined,
      stato: b.wish ? 'nei desideri' : b.pending ? 'in arrivo' : lab[status(b)] || undefined, bottiglie: g.filter(inCellar).length || undefined,
      finestra: b.drinkFrom && b.drinkTo ? b.drinkFrom + '-' + b.drinkTo : undefined, valore: b.value ?? b.price ?? undefined, liste: tagsOf(b).length ? tagsOf(b) : undefined,
      abbinamenti: b.pairing ? b.pairing.slice(0, 90) : undefined, ultima_degustazione: t ? (t.date + (t.rating ? ' ' + t.rating + '/5' : '') + (t.notes ? ' ' + t.notes.slice(0, 80) : '')) : undefined };
  });
  const drunk = all.filter((b) => b.drunk).sort((a, c) => String(c.drunk.date).localeCompare(String(a.drunk.date))).slice(0, 15).map((b) => name(b) + ' ' + (b.vintage || '') + (b.drunk.rating ? ' (' + b.drunk.rating + '/5)' : ''));
  const hist = askLog.slice(-3).map((x) => 'Domanda: ' + x.q + '\nRisposta: ' + (x.a || '')).join('\n\n');
  const c = kind(Date.now());
  const entry = { q: qx };
  askLog.push(entry);
  aiWaitNote = (sec) => { entry.err = 'Gemini chiede una pausa: riprovo tra ' + sec + ' secondi…'; render(); };
  try {
    const j = await aiJson(`Sei il sommelier personale del proprietario di questa cantina. Rispondi in italiano, in modo concreto e cordiale, in 3-8 frasi, senza Markdown. Usa solo i vini della sua cantina qui sotto quando consigli bottiglie (puoi citare quelli in arrivo o nei desideri dicendolo). Se la domanda riguarda vini che non ha, puoi dare consigli generali, chiarendo che non sono in cantina. Non inventare dati che non sono nella lista. I suoi calici: ${glassesForAI()}. Se chiede del servizio o dei calici, consiglia tra questi (o la forma ideale se manca). Oggi è ${new Date().toLocaleDateString('it-IT')} e la Luna è in giorno ${c[2]} (calendario biodinamico: citalo solo se pertinente).
${hist ? 'Conversazione precedente:\n' + hist + '\n' : ''}Domanda: ${qx}
Rispondi solo con JSON: {"answer": string, "ids": [id dei vini della lista che consigli o citi, al massimo 4]}.
Cantina: ${JSON.stringify(list)}
Bevute di recente: ${JSON.stringify(drunk)}`);
    entry.a = typeof j.answer === 'string' ? j.answer : '';
    entry.ids = (Array.isArray(j.ids) ? j.ids : []).filter((id) => S.bottles[id]).slice(0, 4);
    delete entry.err;
    if (!entry.a) entry.err = 'Risposta vuota: riprova.';
  } catch (e) { entry.err = 'Non sono riuscito a rispondere: ' + errorHint(e.message) + ' (' + e.message + ')'; }
  aiWaitNote = null; askBusy = false;
  if (tab === 'stasera') { render(); const l = document.querySelectorAll('.qa'); if (l.length) l[l.length - 1].scrollIntoView({ behavior: 'smooth', block: 'start' }); }
}

/* ===== Mappa delle zone ===== */
const REGIONS = [
  // Italia
  { n: 'Barolo', p: 'Italia', la: 44.61, lo: 7.94, k: ['barolo'], i: 'Langhe, Piemonte. Nebbiolo in purezza: rossi strutturati e tannici, di lunga vita, con profumi di rosa e catrame.' },
  { n: 'Barbaresco', p: 'Italia', la: 44.73, lo: 8.08, k: ['barbaresco'], i: 'Langhe, Piemonte. Nebbiolo in purezza, di solito un po\' più elegante e più pronto del Barolo.' },
  { n: 'Langhe e Roero', p: 'Italia', la: 44.7, lo: 8.03, k: ['langhe', 'roero', 'dolcetto', 'barbera d alba', 'nebbiolo d alba', 'arneis'], i: 'Colline del Piemonte meridionale: Nebbiolo, Barbera, Dolcetto e, per i bianchi, Arneis.' },
  { n: 'Gavi', p: 'Italia', la: 44.68, lo: 8.81, k: ['gavi', 'cortese'], i: 'Piemonte. Cortese di Gavi: bianco fresco e sapido.' },
  { n: 'Asti e Monferrato', p: 'Italia', la: 44.9, lo: 8.2, k: ['asti', 'monferrato', 'barbera d asti', 'moscato', 'grignolino'], i: 'Piemonte. Barbera, Grignolino, Moscato e spumanti dolci.' },
  { n: 'Piemonte', p: 'Italia', la: 45.0, lo: 7.9, k: ['piemonte'], i: 'Regione del Nebbiolo, della Barbera e del Moscato.' },
  { n: 'Franciacorta', p: 'Italia', la: 45.6, lo: 9.97, k: ['franciacorta'], i: 'Lombardia. Spumanti metodo classico da Chardonnay, Pinot Nero e Pinot Bianco.' },
  { n: 'Valtellina', p: 'Italia', la: 46.17, lo: 9.87, k: ['valtellina', 'sforzato', 'sfursat'], i: 'Lombardia. Nebbiolo (Chiavennasca) su terrazzamenti alpini.' },
  { n: 'Oltrepò Pavese', p: 'Italia', la: 44.98, lo: 9.15, k: ['oltrepo'], i: 'Lombardia. Pinot Nero (anche spumantizzato), Bonarda, Riesling.' },
  { n: 'Lombardia', p: 'Italia', la: 45.6, lo: 9.5, k: ['lombardia'], i: 'Spumanti metodo classico, vini alpini della Valtellina e colline dell\'Oltrepò.' },
  { n: 'Valpolicella', p: 'Italia', la: 45.53, lo: 10.87, k: ['valpolicella', 'amarone', 'ripasso', 'recioto'], i: 'Veneto. Corvina, Rondinella e Molinara; l\'Amarone nasce da uve appassite.' },
  { n: 'Soave', p: 'Italia', la: 45.42, lo: 11.25, k: ['soave'], i: 'Veneto. Garganega: bianchi di solito minerali, su suoli vulcanici e calcarei.' },
  { n: 'Conegliano Valdobbiadene', p: 'Italia', la: 45.9, lo: 12.0, k: ['prosecco', 'valdobbiadene', 'conegliano'], i: 'Veneto. Glera; spumanti prodotti con metodo Martinotti (charmat).' },
  { n: 'Veneto', p: 'Italia', la: 45.6, lo: 11.9, k: ['veneto'], i: 'Dal Prosecco all\'Amarone: spumanti, bianchi e grandi rossi.' },
  { n: 'Friuli Venezia Giulia', p: 'Italia', la: 46.0, lo: 13.4, k: ['friuli', 'collio', 'colli orientali', 'venezia giulia', 'isonzo'], i: 'Bianchi di carattere: Friulano, Ribolla Gialla, Malvasia, Pinot Grigio, spesso con macerazione.' },
  { n: 'Trentino', p: 'Italia', la: 46.07, lo: 11.12, k: ['trentino', 'trento', 'trentodoc', 'teroldego'], i: 'Trentodoc (metodo classico da Chardonnay e Pinot Nero), Teroldego, Marzemino.' },
  { n: 'Alto Adige', p: 'Italia', la: 46.5, lo: 11.3, k: ['alto adige', 'sudtirol', 'sudtirolo', 'bolzano'], i: 'Bianchi alpini (Gewürztraminer, Pinot Bianco, Sauvignon) e rossi come Lagrein e Schiava.' },
  { n: 'Chianti Classico', p: 'Italia', la: 43.47, lo: 11.25, k: ['chianti'], i: 'Toscana, tra Firenze e Siena. Sangiovese, con le categorie Annata, Riserva e Gran Selezione.' },
  { n: 'Montalcino', p: 'Italia', la: 43.06, lo: 11.49, k: ['montalcino', 'brunello'], i: 'Toscana. Brunello: Sangiovese (detto Brunello) in purezza, con affinamento lungo.' },
  { n: 'Montepulciano', p: 'Italia', la: 43.1, lo: 11.78, k: ['vino nobile', 'nobile di montepulciano'], i: 'Toscana. Vino Nobile di Montepulciano, da Sangiovese (Prugnolo Gentile).' },
  { n: 'Bolgheri e Maremma', p: 'Italia', la: 43.23, lo: 10.6, k: ['bolgheri', 'sassicaia', 'maremma'], i: 'Costa toscana. Blend bordolesi (Cabernet, Merlot) e Vermentino.' },
  { n: 'Toscana', p: 'Italia', la: 43.4, lo: 11.1, k: ['toscana'], i: 'Terra del Sangiovese, dal Chianti al Brunello, con la costa dei supertuscan.' },
  { n: 'Umbria', p: 'Italia', la: 42.9, lo: 12.6, k: ['umbria', 'montefalco', 'sagrantino', 'orvieto'], i: 'Sagrantino di Montefalco (rosso molto tannico) e Orvieto (bianco).' },
  { n: 'Marche', p: 'Italia', la: 43.5, lo: 13.2, k: ['marche', 'verdicchio', 'conero', 'lacrima'], i: 'Verdicchio (bianco longevo), Rosso Conero e Lacrima di Morro d\'Alba.' },
  { n: 'Abruzzo', p: 'Italia', la: 42.35, lo: 13.9, k: ['abruzzo', 'montepulciano d abruzzo', 'trebbiano d abruzzo', 'cerasuolo d abruzzo'], i: 'Montepulciano d\'Abruzzo (rosso), Trebbiano d\'Abruzzo e Cerasuolo (rosato).' },
  { n: 'Lazio', p: 'Italia', la: 41.9, lo: 12.8, k: ['lazio', 'frascati'], i: 'Frascati e vini dei Castelli Romani, da Malvasia e Trebbiano.' },
  { n: 'Campania', p: 'Italia', la: 40.9, lo: 14.9, k: ['campania', 'taurasi', 'fiano', 'greco di tufo', 'falanghina'], i: 'Aglianico (Taurasi), Fiano di Avellino, Greco di Tufo e Falanghina.' },
  { n: 'Basilicata', p: 'Italia', la: 40.6, lo: 15.8, k: ['basilicata', 'vulture'], i: 'Aglianico del Vulture, su suoli vulcanici.' },
  { n: 'Puglia', p: 'Italia', la: 40.9, lo: 17.0, k: ['puglia', 'primitivo', 'salice salentino', 'negroamaro', 'manduria'], i: 'Primitivo, Negroamaro e Nero di Troia: rossi caldi e generosi.' },
  { n: 'Calabria', p: 'Italia', la: 39.2, lo: 16.6, k: ['calabria', 'ciro'], i: 'Gaglioppo (Cirò) e vitigni autoctoni della costa ionica.' },
  { n: 'Etna', p: 'Italia', la: 37.75, lo: 15.0, k: ['etna'], i: 'Sicilia. Nerello Mascalese e Carricante su suoli vulcanici, a quote alte.' },
  { n: 'Sicilia', p: 'Italia', la: 37.6, lo: 14.0, k: ['sicilia', 'marsala', 'nero d avola', 'cerasuolo di vittoria'], i: 'Nero d\'Avola, Grillo, Marsala e vini dell\'Etna.' },
  { n: 'Sardegna', p: 'Italia', la: 40.1, lo: 9.0, k: ['sardegna', 'cannonau', 'vermentino di gallura', 'carignano'], i: 'Cannonau (Grenache), Vermentino di Gallura, Carignano del Sulcis.' },
  { n: 'Emilia-Romagna', p: 'Italia', la: 44.5, lo: 11.3, k: ['emilia', 'romagna', 'lambrusco'], i: 'Lambrusco, Sangiovese di Romagna e Albana.' },
  { n: 'Liguria', p: 'Italia', la: 44.3, lo: 8.7, k: ['liguria', 'cinque terre', 'pigato', 'rossese'], i: 'Pigato, Rossese di Dolceacqua e i bianchi delle Cinque Terre.' },
  { n: 'Valle d\'Aosta', p: 'Italia', la: 45.7, lo: 7.4, k: ['valle d aosta', 'aosta'], i: 'Viticoltura di montagna: Petit Rouge, Fumin, Prié Blanc.' },
  { n: 'Molise', p: 'Italia', la: 41.6, lo: 14.6, k: ['molise'], i: 'Tintilia e altri vitigni autoctoni.' },
  { n: 'Italia', p: 'Italia', la: 42.5, lo: 12.5, k: ['italia', 'italy'], i: 'Zona non indicata con precisione: segnata al centro del Paese.' },
  // Francia
  { n: 'Bordeaux', p: 'Francia', la: 44.84, lo: -0.58, k: ['bordeaux', 'medoc', 'pauillac', 'margaux', 'saint emilion', 'pomerol', 'sauternes', 'graves', 'saint julien', 'saint estephe'], i: 'Blend di Cabernet Sauvignon e Merlot (riva sinistra e destra); Sauternes è il vino dolce da muffa nobile.' },
  { n: 'Chablis', p: 'Francia', la: 47.81, lo: 3.8, k: ['chablis'], i: 'Nord della Borgogna. Chardonnay teso e minerale.' },
  { n: 'Borgogna', p: 'Francia', la: 47.0, lo: 4.85, k: ['bourgogne', 'borgogna', 'burgundy', 'cote d or', 'gevrey', 'chambolle', 'pommard', 'meursault', 'puligny', 'chassagne', 'nuits', 'volnay', 'beaune', 'mercurey', 'macon'], i: 'Pinot Nero e Chardonnay; il vino è definito dalla parcella (climat).' },
  { n: 'Champagne', p: 'Francia', la: 49.05, lo: 3.95, k: ['champagne'], i: 'Metodo classico da Chardonnay, Pinot Nero e Meunier.' },
  { n: 'Beaujolais', p: 'Francia', la: 46.1, lo: 4.6, k: ['beaujolais', 'morgon', 'fleurie', 'brouilly', 'moulin a vent'], i: 'Gamay, in stili che vanno dal fresco e fruttato al più strutturato dei cru.' },
  { n: 'Rodano settentrionale', p: 'Francia', la: 45.47, lo: 4.85, k: ['cote rotie', 'hermitage', 'crozes', 'condrieu', 'saint joseph', 'cornas'], i: 'Syrah (e Viognier a Condrieu) su pendii ripidi lungo il fiume.' },
  { n: 'Rodano meridionale', p: 'Francia', la: 44.05, lo: 4.83, k: ['chateauneuf', 'gigondas', 'vacqueyras', 'cotes du rhone', 'rhone', 'rodano', 'tavel'], i: 'Grenache, Syrah, Mourvèdre in blend.' },
  { n: 'Loira', p: 'Francia', la: 47.4, lo: 0.5, k: ['loire', 'loira', 'sancerre', 'vouvray', 'muscadet', 'chinon', 'saumur', 'pouilly fume', 'anjou'], i: 'Sauvignon, Chenin Blanc e Cabernet Franc: bianchi vivaci e rossi fini.' },
  { n: 'Alsazia', p: 'Francia', la: 48.2, lo: 7.4, k: ['alsace', 'alsazia'], i: 'Riesling, Gewürztraminer, Pinot Gris, Muscat.' },
  { n: 'Jura', p: 'Francia', la: 46.75, lo: 5.7, k: ['jura', 'savagnin', 'arbois'], i: 'Savagnin, Chardonnay, Poulsard, Trousseau; famoso per il vin jaune e gli stili ossidativi.' },
  { n: 'Savoia', p: 'Francia', la: 45.6, lo: 6.1, k: ['savoie', 'savoia', 'bugey'], i: 'Vini alpini: Jacquère, Altesse, Mondeuse.' },
  { n: 'Languedoc-Roussillon', p: 'Francia', la: 43.6, lo: 3.0, k: ['languedoc', 'roussillon', 'minervois', 'corbieres', 'faugeres', 'pic saint loup'], i: 'Grande zona del sud: Syrah, Grenache, Carignan.' },
  { n: 'Provenza', p: 'Francia', la: 43.5, lo: 6.2, k: ['provence', 'provenza', 'bandol', 'cassis'], i: 'Rosati celebri e, a Bandol, rossi di Mourvèdre.' },
  { n: 'Sud-Ovest', p: 'Francia', la: 43.8, lo: 0.5, k: ['sud ouest', 'cahors', 'madiran', 'jurancon', 'bergerac'], i: 'Malbec a Cahors, Tannat a Madiran, vini dolci a Jurançon.' },
  { n: 'Corsica', p: 'Francia', la: 42.1, lo: 9.1, k: ['corsica', 'corse'], i: 'Nielluccio, Sciacarello, Vermentino.' },
  { n: 'Francia', p: 'Francia', la: 46.6, lo: 2.4, k: ['francia', 'france'], i: 'Zona non indicata con precisione: segnata al centro del Paese.' },
  // Spagna e Portogallo
  { n: 'Rioja', p: 'Spagna', la: 42.45, lo: -2.45, k: ['rioja'], i: 'Tempranillo; le categorie dipendono dall\'affinamento (Crianza, Reserva, Gran Reserva).' },
  { n: 'Ribera del Duero', p: 'Spagna', la: 41.65, lo: -3.7, k: ['ribera del duero'], i: 'Tempranillo (Tinto Fino) d\'altitudine: rossi potenti.' },
  { n: 'Priorat', p: 'Spagna', la: 41.2, lo: 0.8, k: ['priorat', 'priorato'], i: 'Garnacha e Cariñena su suoli di llicorella (ardesia).' },
  { n: 'Penedès', p: 'Spagna', la: 41.4, lo: 1.7, k: ['penedes', 'cava'], i: 'Terra del Cava, spumante metodo classico.' },
  { n: 'Rías Baixas', p: 'Spagna', la: 42.4, lo: -8.7, k: ['rias baixas', 'albarino'], i: 'Galizia atlantica: Albariño, bianco fresco e salino.' },
  { n: 'Jerez', p: 'Spagna', la: 36.7, lo: -6.1, k: ['jerez', 'sherry', 'xeres'], i: 'Vini fortificati: Fino, Manzanilla, Amontillado, Oloroso.' },
  { n: 'Spagna', p: 'Spagna', la: 40.0, lo: -3.7, k: ['spagna', 'espana', 'spain'], i: 'Zona non indicata con precisione: segnata al centro del Paese.' },
  { n: 'Douro', p: 'Portogallo', la: 41.15, lo: -7.6, k: ['douro', 'porto', 'port'], i: 'Valle del fiume Douro: vini da tavola e Porto.' },
  { n: 'Vinho Verde', p: 'Portogallo', la: 41.6, lo: -8.4, k: ['vinho verde', 'minho'], i: 'Nord atlantico: bianchi leggeri e freschi.' },
  { n: 'Alentejo', p: 'Portogallo', la: 38.5, lo: -7.9, k: ['alentejo'], i: 'Sud caldo: rossi morbidi e fruttati.' },
  { n: 'Portogallo', p: 'Portogallo', la: 39.6, lo: -8.0, k: ['portogallo', 'portugal'], i: 'Zona non indicata con precisione: segnata al centro del Paese.' },
  // Europa centrale e altri
  { n: 'Mosella', p: 'Germania', la: 49.95, lo: 6.95, k: ['mosel', 'mosella'], i: 'Riesling su ardesia, spesso con un po\' di zucchero residuo e acidità vivace.' },
  { n: 'Reno', p: 'Germania', la: 50.0, lo: 8.0, k: ['rheingau', 'rheinhessen', 'pfalz', 'palatinato', 'reno'], i: 'Riesling e Pinot (Spätburgunder) lungo il Reno.' },
  { n: 'Germania', p: 'Germania', la: 51.0, lo: 10.0, k: ['germania', 'deutschland', 'germany'], i: 'Zona non indicata con precisione: segnata al centro del Paese.' },
  { n: 'Wachau', p: 'Austria', la: 48.37, lo: 15.4, k: ['wachau', 'kamptal', 'kremstal'], i: 'Grüner Veltliner e Riesling su terrazze lungo il Danubio.' },
  { n: 'Austria', p: 'Austria', la: 47.6, lo: 14.5, k: ['austria', 'osterreich', 'burgenland'], i: 'Grüner Veltliner, Riesling, Zweigelt, Blaufränkisch.' },
  { n: 'Tokaj', p: 'Ungheria', la: 48.12, lo: 21.4, k: ['tokaj', 'tokaji', 'ungheria'], i: 'Furmint: vini dolci da muffa nobile e secchi minerali.' },
  { n: 'Slovenia', p: 'Slovenia', la: 45.9, lo: 13.6, k: ['slovenia', 'brda'], i: 'Brda e Carso: Ribolla (Rebula), Malvasia, vini macerati.' },
  { n: 'Grecia', p: 'Grecia', la: 38.0, lo: 23.7, k: ['grecia', 'santorini', 'greece'], i: 'Assyrtiko, Xinomavro, Agiorgitiko.' },
  { n: 'Georgia', p: 'Georgia', la: 41.9, lo: 45.5, k: ['georgia', 'kakheti'], i: 'Culla del vino: Saperavi e Rkatsiteli, anche in anfora (qvevri).' },
  { n: 'Napa Valley', p: 'Stati Uniti', la: 38.5, lo: -122.3, k: ['napa'], i: 'California. Cabernet Sauvignon di grande struttura.' },
  { n: 'Sonoma', p: 'Stati Uniti', la: 38.5, lo: -122.9, k: ['sonoma'], i: 'California. Pinot Nero, Chardonnay, Zinfandel.' },
  { n: 'Oregon', p: 'Stati Uniti', la: 45.2, lo: -123.1, k: ['oregon', 'willamette'], i: 'Willamette Valley: Pinot Nero di clima fresco.' },
  { n: 'California', p: 'Stati Uniti', la: 37.0, lo: -120.0, k: ['california'], i: 'Zone calde e fresche per Cabernet, Chardonnay, Pinot Nero.' },
  { n: 'Stati Uniti', p: 'Stati Uniti', la: 39.5, lo: -98.0, k: ['stati uniti', 'usa', 'united states'], i: 'Zona non indicata con precisione.' },
  { n: 'Mendoza', p: 'Argentina', la: -33.0, lo: -68.8, k: ['mendoza', 'argentina'], i: 'Malbec d\'altitudine ai piedi delle Ande.' },
  { n: 'Cile', p: 'Cile', la: -34.6, lo: -71.0, k: ['cile', 'chile', 'maipo', 'colchagua'], i: 'Cabernet Sauvignon, Carmenère, Sauvignon Blanc.' },
  { n: 'Barossa', p: 'Australia', la: -34.55, lo: 138.95, k: ['barossa', 'mclaren vale', 'australia'], i: 'Shiraz potente e vigne molto vecchie.' },
  { n: 'Marlborough', p: 'Nuova Zelanda', la: -41.5, lo: 173.9, k: ['marlborough', 'nuova zelanda', 'new zealand', 'central otago'], i: 'Sauvignon Blanc aromatico; Pinot Nero a Central Otago.' },
  { n: 'Sudafrica', p: 'Sudafrica', la: -33.9, lo: 18.9, k: ['sudafrica', 'stellenbosch', 'south africa', 'swartland', 'franschhoek'], i: 'Chenin Blanc, Pinotage, Cabernet.' },
];
const REG_RX = REGIONS.map((r) => r.k.map((k) => ({ k, rx: new RegExp('(^|[^a-z])' + k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '($|[^a-z])') })));
const UMBRELLA = new Set(['Piemonte', 'Lombardia', 'Veneto', 'Toscana', 'Sicilia', 'California', 'Campania', 'Puglia', 'Sardegna', 'Marche', 'Umbria', 'Lazio', 'Abruzzo', 'Basilicata', 'Calabria', 'Liguria', 'Molise', 'Emilia-Romagna', 'Valle d\'Aosta', 'Friuli Venezia Giulia', 'Trentino', 'Alto Adige']);
const regLevel = (r) => (r.n === r.p ? 0 : UMBRELLA.has(r.n) ? 1 : 2);
function matchRegion(text) {
  const t = nrm(text).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!t) return -1;
  let best = -1, lvl = -1, len = 0;
  REG_RX.forEach((ks, i) => ks.forEach((x) => {
    if (!x.rx.test(t)) return;
    const l = regLevel(REGIONS[i]);
    if (l > lvl || (l === lvl && x.k.length > len)) { best = i; lvl = l; len = x.k.length; }
  }));
  return best;
}
function regionGroups() {
  const g = new Map(), un = [];
  Object.values(S.bottles).filter((b) => inCellar(b)).forEach((b) => {
    const i = matchRegion(b.region);
    if (i < 0) un.push(b); else { if (!g.has(i)) g.set(i, []); g.get(i).push(b); }
  });
  return { g, un };
}
let selRegion = null, mapObj = null;
function regionPanel(i) {
  if (i === null || i === undefined) return '<p class="info">Tocca un punto della mappa o una zona dell\'elenco per vedere le bottiglie e qualche nota.</p>';
  const r = REGIONS[i], bs = (regionGroups().g.get(i) || []).slice().sort((a, b) => name(a).localeCompare(name(b), 'it'));
  return `<h3 style="margin:0 0 4px">${esc(r.n)} <small style="color:var(--mute);font-weight:400">· ${esc(r.p)}</small></h3><p>${esc(r.i)}</p><p class="info">${bs.length} ${bs.length === 1 ? 'bottiglia' : 'bottiglie'} in cantina</p>`
    + bs.map((b) => `<button class="row" data-a="open" data-id="${esc(b.id)}"><span style="display:flex;gap:12px">${imgSrc(b) ? `<img class="th" src="${imgSrc(b)}" alt="">` : '<span class="th"></span>'}<span>${esc(name(b))} ${esc(b.vintage || '')}<small>${esc(b.region || '')}</small></span></span><span>${eur(b.value ?? b.price)}</span></button>`).join('');
}
function mappa() {
  const { g, un } = regionGroups();
  const items = [...g.entries()].sort((a, b) => REGIONS[a[0]].p.localeCompare(REGIONS[b[0]].p, 'it') || REGIONS[a[0]].n.localeCompare(REGIONS[b[0]].n, 'it'));
  let list = '', last = '';
  items.forEach(([i, bs]) => {
    const r = REGIONS[i];
    if (r.p !== last) { list += `<h3 class="letter">${esc(r.p)}</h3>`; last = r.p; }
    list += `<button class="row" data-a="mreg" data-i="${i}"><span>${esc(r.n)}</span><span>${bs.length}</span></button>`;
  });
  if (un.length) list += `<h3 class="letter">Zona non riconosciuta</h3><p class="info">${un.length} ${un.length === 1 ? 'bottiglia' : 'bottiglie'} senza una zona che conosco: ${un.slice(0, 6).map((b) => esc(name(b))).join(', ')}${un.length > 6 ? '…' : ''}. Scrivi la zona nella scheda (per esempio «Toscana» o «Borgogna») e comparirà qui.</p>`;
  if (!items.length && !un.length) return '<p class="empty">Aggiungi qualche bottiglia con la zona e la vedrai sulla mappa.</p>';
  return `<div id="map" class="map"><p class="info" style="padding:16px">Carico la mappa…</p></div><div id="mpanel" class="mpanel">${regionPanel(selRegion)}</div>${list}`;
}
function loadLeaflet() {
  if (window.L) return Promise.resolve();
  return new Promise((res, rej) => {
    const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css'; document.head.appendChild(css);
    const sc = document.createElement('script'); sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
    sc.onload = () => res(); sc.onerror = () => rej(new Error('offline'));
    document.head.appendChild(sc);
  });
}
function killMap() { if (mapObj) { try { mapObj.remove(); } catch (_) {} mapObj = null; } }
async function initMap() {
  const el = document.getElementById('map');
  if (!el) return;
  try { await loadLeaflet(); } catch (_) { el.innerHTML = '<p class="info" style="padding:16px">La mappa serve internet. L\'elenco delle zone qui sotto funziona anche senza.</p>'; return; }
  const el2 = document.getElementById('map');
  if (!el2 || tab !== 'mappa') return;
  killMap();
  el2.innerHTML = '';
  const { g } = regionGroups();
  mapObj = L.map(el2, { scrollWheelZoom: false }).setView([44, 8], 4);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 12, attribution: '&copy; OpenStreetMap' }).addTo(mapObj);
  const pts = [];
  g.forEach((bs, i) => {
    const r = REGIONS[i];
    L.circleMarker([r.la, r.lo], { radius: 8 + Math.min(14, bs.length * 2), color: '#6E1F35', weight: 2, fillColor: '#C2506F', fillOpacity: 0.75 })
      .addTo(mapObj).bindTooltip(`${r.n} (${bs.length})`).on('click', () => pickRegion(i, false));
    pts.push([r.la, r.lo]);
  });
  if (pts.length) mapObj.fitBounds(pts, { padding: [30, 30], maxZoom: 6 });
}
function pickRegion(i, fly) {
  selRegion = i;
  const p = document.getElementById('mpanel');
  if (p) p.innerHTML = regionPanel(i);
  if (fly && mapObj) mapObj.flyTo([REGIONS[i].la, REGIONS[i].lo], 7);
  const m = document.getElementById('map');
  if (m && fly) m.scrollIntoView({ behavior: 'smooth', block: 'start' });
  else if (p) p.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/* ===== Inventario in PDF ===== */
function buildPdf(bs) {
  const L = (t) => String(t == null ? '' : t).replace(/€/g, '\x80').replace(/[–—]/g, '-').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[^\x20-\x7e\x80\xa0-\xff]/g, '?');
  const E = (t) => L(t).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  const cut = (t, n) => { t = L(t); return t.length > n ? t.slice(0, n - 1) + '.' : t; };
  const T = (x, y, t, f, sz) => `BT /${f} ${sz} Tf ${x.toFixed(1)} ${y.toFixed(1)} Td (${E(t)}) Tj ET\n`;
  const ROWS = 60, per = [];
  for (let i = 0; i < bs.length; i += ROWS) per.push(bs.slice(i, i + ROWS));
  if (!per.length) per.push([]);
  const spent = bs.reduce((a, b) => a + (b.price || 0), 0), val = bs.reduce((a, b) => a + (b.value ?? b.price ?? 0), 0);
  const shelfName = (b) => { const s = S.shelves.find((x) => x.id === b.shelf); return s ? cut(s.name, 11) + ' r' + (b.r + 1) + ' p' + (b.c + 1) : 'Da posizionare'; };
  const drink = (b) => (b.drinkFrom && b.drinkTo ? b.drinkFrom + '-' + b.drinkTo : '');
  const pages = per.map((rows, pi) => {
    let c = '';
    let y = 800;
    if (pi === 0) {
      c += T(36, y, 'Inventario della cantina', 'F2', 16); y -= 16;
      c += T(36, y, new Date().toLocaleDateString('it-IT') + '  -  ' + bs.length + ' bottiglie  -  speso ' + eur(spent) + '  -  valore stimato ' + eur(val) + ' (stime non verificate)', 'F1', 8.5); y -= 22;
    } else y -= 4;
    const col = (x, t, f) => { c += T(x, y, t, f || 'F1', 8); };
    col(36, 'Vino', 'F2'); col(212, 'Annata', 'F2'); col(244, 'Tipo', 'F2'); col(286, 'Zona', 'F2'); col(396, 'Posizione', 'F2'); col(470, 'Da bere', 'F2'); c += T(515, y, 'Valore', 'F2', 8);
    y -= 4; c += `0.5 w 36 ${y} m 559 ${y} l S\n`; y -= 11;
    rows.forEach((b) => {
      col(36, cut(name(b) + (isStd(b) ? '' : ' (' + sizeShort(sizeMl(b)) + ')'), 38)); col(212, b.vintage || ''); col(244, cut(b.type, 9)); col(286, cut(b.region || '', 24)); col(396, shelfName(b).slice(0, 17)); col(470, drink(b));
      const v = L(eur(b.value ?? b.price)); c += T(559 - v.length * 4.2, y, v, 'F1', 8);
      y -= 12;
    });
    c += T(36, 28, 'Pagina ' + (pi + 1) + ' di ' + per.length, 'F1', 8);
    return c;
  });
  const objs = [];
  objs[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  const kids = pages.map((_, i) => `${5 + i * 2} 0 R`).join(' ');
  objs[2] = `<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`;
  objs[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
  objs[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
  pages.forEach((c, i) => {
    objs[5 + i * 2] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${6 + i * 2} 0 R >>`;
    objs[6 + i * 2] = `<< /Length ${c.length} >>\nstream\n${c}endstream`;
  });
  let out = '%PDF-1.4\n';
  const off = [];
  for (let i = 1; i < objs.length; i++) { off[i] = out.length; out += `${i} 0 obj\n${objs[i]}\nendobj\n`; }
  const xr = out.length;
  out += `xref\n0 ${objs.length}\n0000000000 65535 f \n` + off.slice(1).map((o) => String(o).padStart(10, '0') + ' 00000 n \n').join('');
  out += `trailer\n<< /Size ${objs.length} /Root 1 0 R >>\nstartxref\n${xr}\n%%EOF\n`;
  const u = new Uint8Array(out.length);
  for (let i = 0; i < out.length; i++) u[i] = out.charCodeAt(i) & 255;
  return u;
}
async function exportPdf() {
  const m = $('#pdfmsg');
  try {
    const key = (b) => nrm(b.producer || b.cuvee || '');
    const bs = Object.values(S.bottles).filter((b) => inCellar(b)).sort((a, b) => key(a).localeCompare(key(b), 'it') || (a.vintage || 0) - (b.vintage || 0));
    if (m) m.textContent = 'Preparo il PDF…';
    const fname = 'inventario-cantina-' + new Date().toLocaleDateString('sv-SE') + '.pdf';
    const file = new File([buildPdf(bs)], fname, { type: 'application/pdf' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: 'Inventario cantina' }); if (m) m.textContent = 'PDF pronto.'; return; }
      catch (e) { if (e.name === 'AbortError') { if (m) m.textContent = ''; return; } }
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file); a.download = fname;
    document.body.appendChild(a); a.click(); a.remove();
    if (m) m.textContent = 'PDF scaricato.';
  } catch (e) { if (m) m.textContent = 'PDF non riuscito: ' + e.message; }
}

/* ===== Statistiche ===== */
function bars(rows, fmt, opts) {
  // rows: [{l: etichetta, v: numero, c: colore facoltativo, s: sottotitolo}]
  if (!rows.length) return '<p class="info">Nessun dato ancora.</p>';
  const max = Math.max(...rows.map((r) => r.v), 1);
  return '<div class="bars">' + rows.map((r) => `<div class="bar"><span class="bl">${esc(r.l)}${r.s ? `<small>${esc(r.s)}</small>` : ''}</span><span class="bt"><i style="width:${r.v ? Math.max(2, (r.v / max) * 100).toFixed(1) : 0}%;${r.c ? 'background:' + r.c : ''}"></i></span><span class="bv">${esc(fmt ? fmt(r.v) : r.v)}</span></div>`).join('') + '</div>';
}
function stats() {
  const all = Object.values(S.bottles), inC = all.filter((b) => inCellar(b)), drunk = all.filter(isDrinkExit), gone = all.filter((b) => b.drunk && !isDrinkExit(b));
  if (!all.length) return '<p class="empty">Aggiungi qualche bottiglia e qui vedrai le statistiche della cantina.</p>';
  const sum = (a, f) => a.reduce((t, b) => t + (f(b) || 0), 0);
  const spent = sum(inC, (b) => b.price), val = sum(inC, (b) => b.value ?? b.price);
  const both = inC.filter((b) => b.price && b.value != null);
  const gain = sum(both, (b) => b.value - b.price), gainPct = sum(both, (b) => b.price) ? gain / sum(both, (b) => b.price) * 100 : 0;
  const litres = sum(inC, (b) => sizeMl(b)) / 1000;
  const group = (arr, key) => { const m = new Map(); arr.forEach((b) => { const k = key(b); if (k == null || k === '') return; m.set(k, (m.get(k) || 0) + 1); }); return [...m.entries()]; };
  const TCOL = { rosso: 'var(--rosso)', bianco: 'var(--bianco)', bollicine: 'var(--bollicine)', rosato: 'var(--rosato)', altro: 'var(--altro)' };
  const byType = group(inC, (b) => b.type).sort((a, b) => b[1] - a[1]).map(([l, v]) => ({ l, v, c: TCOL[l] }));
  const zones = group(inC, (b) => { const i = matchRegion(b.region); return i >= 0 ? REGIONS[i].n : (b.region || null); }).sort((a, b) => b[1] - a[1]);
  const topZ = zones.slice(0, 8).map(([l, v]) => ({ l, v }));
  if (zones.length > 8) topZ.push({ l: 'Altre zone', v: zones.slice(8).reduce((t, z) => t + z[1], 0) });
  const dec = group(inC, (b) => (b.vintage ? Math.floor(b.vintage / 10) * 10 : null)).sort((a, b) => a[0] - b[0]).map(([l, v]) => ({ l: "Anni '" + String(l).slice(2), v, s: String(l) + '–' + (l + 9) }));
  const st = { 'st-now': 'Pronte da bere', 'st-wait': 'Da aspettare', 'st-past': 'Oltre il picco', '': 'Senza indicazione' };
  const SC = { 'st-now': '#4C9A6A', 'st-wait': '#D9A441', 'st-past': '#B85C5C', '': 'var(--altro)' };
  const mat = ['st-now', 'st-wait', 'st-past', ''].map((k) => ({ l: st[k], v: inC.filter((b) => status(b) === k).length, c: SC[k] })).filter((r) => r.v);
  const yearOf = (b) => (b.buyDate ? +String(b.buyDate).slice(0, 4) : null);
  const spendY = new Map();
  all.forEach((b) => { const y = yearOf(b); if (y && b.price) spendY.set(y, (spendY.get(y) || 0) + b.price); });
  const spendRows = [...spendY.entries()].sort((a, b) => a[0] - b[0]).slice(-8).map(([l, v]) => ({ l: String(l), v, s: ((n) => n + (n === 1 ? ' bottiglia' : ' bottiglie'))(all.filter((b) => yearOf(b) === l).length) }));
  const noDate = all.filter((b) => b.price && !b.buyDate).length;
  const shops = group(all, (b) => b.buyWhere).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([l, v]) => ({ l, v }));
  const top = inC.filter((b) => (b.value ?? b.price) > 0).sort((a, b) => (b.value ?? b.price) - (a.value ?? a.price)).slice(0, 5);
  const now = new Date(), months = [];
  for (let i = 11; i >= 0; i--) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); months.push({ k: d.toISOString().slice(0, 7), l: d.toLocaleDateString('it-IT', { month: 'short', year: '2-digit' }) }); }
  const drunkM = months.map((m) => ({ l: m.l, v: drunk.filter((b) => String(b.drunk.date || '').slice(0, 7) === m.k).length }));
  const rated = drunk.filter((b) => b.drunk.rating);
  const avgR = rated.length ? (sum(rated, (b) => b.drunk.rating) / rated.length) : 0;
  const tile = (v, l, cls) => `<div class="tile"><b class="${cls || ''}">${v}</b><span>${l}</span></div>`;
  const sec = (t, body, note) => `<section class="stat"><h3>${t}</h3>${body}${note ? `<p class="info" style="margin:6px 0 0">${note}</p>` : ''}</section>`;
  return `<button class="maplink" data-a="tab" data-t="mappa"><span><b>Mappa delle zone</b><small>Dove nascono i tuoi vini</small></span><span>›</span></button><div class="tiles">${tile(inC.length, 'bottiglie in cantina')}${tile(String(+litres.toFixed(1)).replace('.', ',') + ' L', 'di vino')}${tile(eur(val), 'valore stimato')}${tile(eur(spent), 'speso')}${tile((gain >= 0 ? '+' : '') + eur(gain), both.length ? 'differenza valore − prezzo (' + (gainPct >= 0 ? '+' : '') + Math.round(gainPct) + '%)' : 'serve prezzo e valore', gain >= 0 ? 'up' : 'down')}${(() => { const pe = all.filter((b) => !b.drunk && b.pending).length; return pe ? tile(pe, 'in arrivo') : ''; })()}${gone.length ? tile(gone.length, 'regalate o uscite in altro modo') : ''}${tile(drunk.length, 'bevute' + (avgR ? ' · voto medio ' + avgR.toFixed(1).replace('.', ',') + '★' : ''))}</div>`
    + (() => { const ks = Object.keys(HIST).sort().slice(-12); return ks.length > 1 ? sec('Valore della cantina nel tempo', bars(ks.map((k) => ({ l: new Date(k + '-15').toLocaleDateString('it-IT', { month: 'short', year: '2-digit' }), v: HIST[k].v || 0, s: HIST[k].n + ' bottiglie' })), eur), 'Un valore al mese, registrato quando apri l\'app.') : ''; })()
    + sec('Maturità', bars(mat))
    + sec('Per tipo', bars(byType))
    + sec('Per zona', bars(topZ))
    + sec('Per annata', bars(dec))
    + sec('Spesa per anno d\'acquisto', bars(spendRows, eur), noDate ? (noDate === 1 ? '1 bottiglia con prezzo ma senza data d\'acquisto non è contata.' : noDate + ' bottiglie con prezzo ma senza data d\'acquisto non sono contate.') : '')
    + (shops.length ? sec('Dove compri', bars(shops)) : '')
    + sec('Bevute negli ultimi 12 mesi', bars(drunkM))
    + sec('Le più preziose', top.map((b) => `<button class="row" data-a="open" data-id="${esc(b.id)}"><span>${esc(name(b))} ${esc(b.vintage || '')}<small>${isStd(b) ? '' : esc(sizeName(sizeMl(b))) + ' · '}${esc(posText(b))}</small></span><span>${eur(b.value ?? b.price)}</span></button>`).join('') || '<p class="info">Nessun valore inserito.</p>', 'Valori stimati, non verificati.');
}
