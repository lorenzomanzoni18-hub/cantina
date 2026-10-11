/* I miei calici e il servizio: quale calice usare tra quelli che hai, a che temperatura, se decantare.
   Le regole sono quelle classiche della sommellerie; funzionano anche senza internet e senza IA. */

const SHAPES = [
  ['universale', 'Universale', 'Va bene con quasi tutto: il jolly se ne hai uno solo.'],
  ['borgogna', 'Borgogna (ballon)', 'Bocca ampia: Pinot Nero, Nebbiolo (Barolo, Barbaresco), rossi eleganti e aromatici, Chardonnay maturi.'],
  ['bordeaux', 'Bordeaux', 'Alto, bocca più stretta: Cabernet, Merlot, Sangiovese, Syrah, rossi strutturati e tannici.'],
  ['rosso', 'Rosso medio', 'Rossi giovani e di medio corpo.'],
  ['bianco', 'Bianco', 'Bianchi freschi e aromatici, rosati.'],
  ['bianco-ampio', 'Bianco strutturato (Chardonnay)', 'Bianchi importanti, affinati in legno, orange wine.'],
  ['tulipano', 'Tulipano', 'Champagne e metodo classico: fa sentire profumi e perlage meglio della flûte.'],
  ['flute', 'Flûte', 'Spumanti giovani e semplici (Prosecco, Charmat).'],
  ['coppa', 'Coppa', 'Spumanti dolci e cocktail; poco adatta agli Champagne importanti.'],
  ['dessert', 'Vino dolce / passito', 'Piccolo: passiti, Sauternes, vini dolci.'],
  ['fortificati', 'Porto e fortificati', 'Piccolo e stretto: Porto, Sherry, Marsala, Madeira.'],
  ['iso', 'Degustazione (ISO)', 'Calice da degustazione: va bene un po\' per tutto, ma è piccolo.'],
  ['altro', 'Altro', ''],
];
const shapeName = (k) => (SHAPES.find((s) => s[0] === k) || [k, k])[1];
let GLASSES = [];
async function loadGlasses() { try { GLASSES = (await dbGet('kv', 'glasses')) || []; } catch (_) { GLASSES = []; } }
async function saveGlasses() { await dbPut('kv', GLASSES, 'glasses'); }

// Che cosa c'è nella bottiglia, dalle parole di produttore, cuvée, zona e informazioni.
function wineTraits(b) {
  const t = nrm([b.producer, b.cuvee, b.region, b.winfo, b.info].join(' '));
  const has = (re) => re.test(t);
  const age = b.vintage ? new Date().getFullYear() - b.vintage : null;
  return {
    t, age,
    pinot: has(/pinot nero|pinot noir|spatburgunder|borgogna|bourgogne|burgundy|cote d or|gevrey|chambolle|vosne|volnay|pommard|nuits|morey|clos de vougeot|beaune|oregon|central otago|etna|nerello/),
    nebbiolo: has(/nebbiolo|barolo|barbaresco|langhe|roero|gattinara|ghemme|valtellina|sforzato|sfursat|chiavennasca/),
    bigred: has(/cabernet|merlot|bordeaux|medoc|pauillac|margaux|saint emilion|pomerol|bolgheri|sassicaia|brunello|montalcino|chianti|sangiovese|nobile|syrah|shiraz|hermitage|cote rotie|cornas|amarone|aglianico|taurasi|sagrantino|primitivo|montepulciano|priorat|ribera|rioja|tempranillo|malbec|napa|rhone|chateauneuf|bandol|mourvedre|tannat|madiran|cannonau|grenache/),
    lightred: has(/beaujolais|gamay|dolcetto|freisa|grignolino|schiava|lambrusco|bardolino|valpolicella classico|frappato|poulsard|trousseau|cerasuolo/),
    bigwhite: has(/chardonnay|meursault|puligny|chassagne|corton|montrachet|batard|chablis grand|chablis premier|hermitage blanc|condrieu|viognier|fiano|vin jaune|savagnin|white burgundy|bianco riserva|barrique|legno|orange|macerat|ramato|ribolla gravner|gravner|radikon/),
    champ: has(/champagne|franciacorta|trento|trentodoc|metodo classico|cremant|cava|sekt|blanc de blancs|blanc de noirs|millesim|grande annee|cuvee prestige/),
    simpleSpark: has(/prosecco|charmat|martinotti|frizzante|asti|moscato d asti|lambrusco/),
    sweet: has(/passito|sauternes|barsac|tokaj|tokaji|recioto|vin santo|moscato|ice ?wine|eiswein|beerenauslese|trockenbeerenauslese|picolit|ramandolo|late harvest|vendemmia tardiva|zibibbo|malvasia delle lipari/),
    fortified: has(/porto|port|sherry|jerez|xeres|madeira|marsala|banyuls|maury|fino|oloroso|amontillado|pedro ximenez/),
  };
}
// Ordine di preferenza delle forme per questa bottiglia (la prima è la migliore).
function glassPrefs(b) {
  const w = wineTraits(b);
  if (w.fortified) return ['fortificati', 'dessert', 'iso', 'bianco', 'universale'];
  if (w.sweet || (b.type === 'altro' && !w.champ)) return ['dessert', 'fortificati', 'bianco', 'iso', 'universale'];
  if (b.type === 'bollicine' || w.champ || w.simpleSpark) {
    const serious = w.champ && (b.vintage || /grande|prestige|millesim|blanc de/.test(w.t));
    return w.simpleSpark && !w.champ ? ['flute', 'tulipano', 'bianco', 'universale', 'coppa'] : serious ? ['bianco-ampio', 'tulipano', 'universale', 'bianco', 'borgogna', 'flute'] : ['tulipano', 'bianco', 'universale', 'flute', 'bianco-ampio', 'coppa'];
  }
  if (b.type === 'bianco') return w.bigwhite || (w.age && w.age >= 6) ? ['bianco-ampio', 'borgogna', 'universale', 'bianco', 'iso'] : ['bianco', 'universale', 'bianco-ampio', 'iso'];
  if (b.type === 'rosato') return w.bigred || /tavel|bandol|cerasuolo d abruzzo/.test(w.t) ? ['bianco-ampio', 'bianco', 'universale', 'rosso'] : ['bianco', 'universale', 'bianco-ampio', 'rosso'];
  // rossi
  if (w.pinot || w.nebbiolo) return ['borgogna', 'universale', 'bordeaux', 'rosso', 'bianco-ampio', 'iso'];
  if (w.lightred) return ['rosso', 'borgogna', 'universale', 'bordeaux', 'bianco', 'iso'];
  return ['bordeaux', 'universale', 'rosso', 'borgogna', 'iso'];
}
function serviceTemp(b) {
  const w = wineTraits(b);
  if (w.fortified) return /fino|manzanilla/.test(w.t) ? '8–10 °C' : '14–16 °C';
  if (w.sweet || b.type === 'altro') return '8–12 °C';
  if (b.type === 'bollicine' || w.champ || w.simpleSpark) return w.champ && (b.vintage || /grande|prestige|millesim|blanc de/.test(w.t)) ? '8–10 °C' : '6–8 °C';
  if (b.type === 'bianco') return w.bigwhite ? '11–13 °C' : '8–10 °C';
  if (b.type === 'rosato') return '9–11 °C';
  if (w.lightred) return '14–15 °C';
  return '16–18 °C';
}
function decantAdvice(b) {
  const w = wineTraits(b);
  if (b.type !== 'rosso') return w.bigwhite && w.age != null && w.age <= 5 ? 'Puoi aprirla mezz\'ora prima: i bianchi importanti giovani si distendono con un po\' d\'aria.' : 'Non serve decantarla: aprila al momento.';
  if (w.age != null && w.age >= 20) return 'Vino maturo: aprila poco prima di servirla e decanta solo per separare il deposito, con delicatezza, senza lasciarla troppo all\'aria.';
  if ((w.nebbiolo || w.bigred) && w.age != null && w.age <= 10) return 'Giovane e strutturata: decantala 1–2 ore prima (o apri la bottiglia 3 ore prima).';
  if (w.nebbiolo || w.bigred) return 'Aprila un\'ora prima; se c\'è deposito, decantala con calma.';
  if (w.pinot) return 'Meglio non decantarla: aprila mezz\'ora prima e lascia che si apra nel calice.';
  return 'Aprila mezz\'ora prima; non serve decantarla.';
}
// Il calice migliore tra quelli che hai (null se non hai calici inseriti).
function bestGlass(b) {
  const prefs = glassPrefs(b);
  const owned = GLASSES.filter((g) => g.shape);
  if (!owned.length) return { ideal: prefs[0], mine: null, rank: -1 };
  for (let i = 0; i < prefs.length; i++) { const g = owned.find((x) => x.shape === prefs[i]); if (g) return { ideal: prefs[0], mine: g, rank: i }; }
  return { ideal: prefs[0], mine: owned[0], rank: 99 };
}
function serviceHtml(b) {
  const g = bestGlass(b);
  let glass;
  if (!g.mine) glass = `Calice ideale: <b>${esc(shapeName(g.ideal))}</b>. <button class="link" data-a="glasses" type="button">Inserisci i tuoi calici</button>`;
  else if (g.rank === 0) glass = `Usa il tuo <b>${esc(g.mine.name || shapeName(g.mine.shape))}</b>: è la forma ideale per questo vino.`;
  else if (g.rank < 99) glass = `Tra i tuoi, il migliore è <b>${esc(g.mine.name || shapeName(g.mine.shape))}</b>. L'ideale sarebbe un calice ${esc(shapeName(g.ideal).toLowerCase())}.`;
  else glass = `Nessuno dei tuoi calici è molto adatto: l'ideale sarebbe un calice ${esc(shapeName(g.ideal).toLowerCase())}.`;
  return `<div class="svc"><p><span class="svk">Calice</span>${glass}</p><p><span class="svk">Temperatura</span>${serviceTemp(b)}</p><p><span class="svk">Apertura</span>${esc(decantAdvice(b))}</p></div>`;
}
const glassLine = (b) => { const g = bestGlass(b); return g.mine ? 'Calice: ' + (g.mine.name || shapeName(g.mine.shape)) + ' · ' + serviceTemp(b) : 'Calice ' + shapeName(g.ideal).toLowerCase() + ' · ' + serviceTemp(b); };
const glassesForAI = () => (GLASSES.length ? GLASSES.map((g) => (g.name || shapeName(g.shape)) + ' (forma ' + shapeName(g.shape) + (g.qty ? ', ' + g.qty + ' pezzi' : '') + ')').join('; ') : 'non indicati');

/* ---- Finestra "I miei calici" ---- */
function openGlasses() {
  const d = $('#dlg2');
  let list = GLASSES.map((g) => ({ ...g }));
  const draw = () => {
    d.innerHTML = `<h2>I miei calici</h2><p class="info">Inserisci i calici che hai: per ogni bottiglia ti dirò quale usare, a che temperatura servirla e se decantarla. Il nome è libero (es. «Zalto Bordeaux», «Riedel Veritas Champagne»), la forma serve per scegliere.</p>
    <div id="gl_rows">${list.length ? list.map((g, i) => `<div class="glrow"><input data-gi="${i}" data-gk="name" placeholder="Nome o marca" value="${esc(g.name || '')}"><select data-gi="${i}" data-gk="shape">${SHAPES.map((s) => `<option value="${s[0]}" ${g.shape === s[0] ? 'selected' : ''}>${esc(s[1])}</option>`).join('')}</select><label class="glq">Quanti<input data-gi="${i}" data-gk="qty" type="number" min="0" inputmode="numeric" placeholder="–" value="${g.qty || ''}"></label><button class="link" data-gdel="${i}" type="button" aria-label="Togli questo calice">Togli</button></div>`).join('') : '<p class="empty" style="padding:8px 0">Nessun calice inserito.</p>'}</div>
    <div class="acts"><button class="btn" id="gl_add" type="button">Aggiungi un calice</button></div>
    <details class="more"><summary>Guida alle forme</summary>${SHAPES.filter((s) => s[2]).map((s) => `<p style="font-size:14px;margin:8px 0"><b>${esc(s[1])}</b>: ${esc(s[2])}</p>`).join('')}</details>
    <div class="acts"><button class="btn pri" id="gl_ok">Salva</button><button class="btn" id="gl_x">Annulla</button></div>`;
    d.querySelectorAll('[data-gi]').forEach((x) => x.oninput = x.onchange = () => { const g = list[+x.dataset.gi]; g[x.dataset.gk] = x.dataset.gk === 'qty' ? (+x.value || null) : x.value; });
    d.querySelectorAll('[data-gdel]').forEach((x) => x.onclick = () => { list.splice(+x.dataset.gdel, 1); draw(); });
    $('#gl_add').onclick = () => { list.push({ id: gid(), name: '', shape: 'universale', qty: null }); draw(); const ins = d.querySelectorAll('[data-gk="name"]'); if (ins.length) ins[ins.length - 1].focus(); };
    $('#gl_x').onclick = () => d.close();
    $('#gl_ok').onclick = async () => { GLASSES = list.filter((g) => g.shape).map((g) => ({ ...g, name: (g.name || '').trim() })); await saveGlasses(); d.close(); render(); };
  };
  draw();
  d.onclose = null;
  if (!d.open) d.showModal();
}

/* ===================== Pagina «Calici» ===================== */
// Disegno stilizzato di ogni forma: profilo della coppa, livello del vino, stelo e piede.
const GSHAPE = {
  borgogna: { p: 'M28 8 C18 30 6 50 10 70 C14 90 30 97 40 97 C50 97 66 90 70 70 C74 50 62 30 52 8', b: 97, lv: 74, w: 'rosso' },
  bordeaux: { p: 'M27 6 C22 30 15 48 17 66 C19 84 30 93 40 93 C50 93 61 84 63 66 C65 48 58 30 53 6', b: 93, lv: 70, w: 'rosso' },
  universale: { p: 'M27 12 C20 32 15 50 18 68 C21 84 31 91 40 91 C49 91 59 84 62 68 C65 50 60 32 53 12', b: 91, lv: 70, w: 'rosso' },
  rosso: { p: 'M28 22 C21 40 17 54 20 70 C23 84 32 90 40 90 C48 90 57 84 60 70 C63 54 59 40 52 22', b: 90, lv: 72, w: 'rosso' },
  bianco: { p: 'M31 22 C26 40 23 54 25 68 C27 80 33 87 40 87 C47 87 53 80 55 68 C57 54 54 40 49 22', b: 87, lv: 70, w: 'bianco' },
  'bianco-ampio': { p: 'M25 22 C16 40 13 56 17 70 C21 83 31 89 40 89 C49 89 59 83 63 70 C67 56 64 40 55 22', b: 89, lv: 72, w: 'bianco' },
  tulipano: { p: 'M31 6 C28 24 25 44 27 62 C29 79 35 88 40 88 C45 88 51 79 53 62 C55 44 52 24 49 6', b: 88, lv: 40, w: 'bolle' },
  flute: { p: 'M33 6 C32 30 32 54 34 72 C35 83 38 89 40 89 C42 89 45 83 46 72 C48 54 48 30 47 6', b: 89, lv: 30, w: 'bolle' },
  coppa: { p: 'M11 46 C13 62 27 70 40 70 C53 70 67 62 69 46', b: 70, lv: 52, w: 'bolle' },
  dessert: { p: 'M31 42 C27 55 26 67 29 76 C32 84 36 87 40 87 C44 87 48 84 51 76 C54 67 53 55 49 42', b: 87, lv: 70, w: 'dolce' },
  fortificati: { p: 'M34 36 C31 50 30 63 32 74 C34 83 37 87 40 87 C43 87 46 83 48 74 C50 63 49 50 46 36', b: 87, lv: 66, w: 'porto' },
  iso: { p: 'M32 32 C26 48 25 62 28 72 C31 81 36 85 40 85 C44 85 49 81 52 72 C55 62 54 48 48 32', b: 85, lv: 70, w: 'rosso' },
  altro: { p: 'M27 12 C20 32 15 50 18 68 C21 84 31 91 40 91 C49 91 59 84 62 68 C65 50 60 32 53 12', b: 91, lv: 70, w: 'rosso' },
};
const LIQ = { rosso: '#7A1F35', bianco: '#D9C27A', bolle: '#E6D79E', dolce: '#C98A2E', porto: '#6B2A1A' };
let gsvgN = 0;
function glassSvg(shape, h, opts) {
  const g = GSHAPE[shape] || GSHAPE.universale, id = 'gc' + (++gsvgN);
  const liq = (opts && opts.liq) || LIQ[g.w], tk = g.p.split(' ');
  const bubbles = g.w === 'bolle' ? [[38, g.b - 6], [42, g.b - 16], [39, g.b - 27], [41, g.lv + 8]].filter((p) => p[1] > g.lv + 2).map((p) => `<circle cx="${p[0]}" cy="${p[1]}" r="1.4" fill="#FFF6D8" opacity=".85"/>`).join('') : '';
  return `<svg class="gsvg" viewBox="0 0 80 140" height="${h}" role="img" aria-label="Calice ${esc(shapeName(shape))}"><defs><clipPath id="${id}"><path d="${g.p} Z"/></clipPath></defs>
  <rect x="0" y="${g.lv}" width="80" height="${140 - g.lv}" fill="${liq}" clip-path="url(#${id})"/>${bubbles}
  <path d="${g.p}" fill="rgba(255,255,255,.04)" stroke="var(--gold)" stroke-width="2" stroke-linejoin="round"/>
  <path d="M${tk[0].slice(1)} ${tk[1]} L${tk[tk.length - 2]} ${tk[tk.length - 1]}" fill="none" stroke="var(--gold)" stroke-width="1.2" opacity=".6"/>
  <path d="M40 ${g.b} L40 128" stroke="var(--gold)" stroke-width="2"/><ellipse cx="40" cy="130" rx="21" ry="4.5" fill="none" stroke="var(--gold)" stroke-width="2"/></svg>`;
}
// Informazioni in più per ogni forma
const GINFO = {
  universale: { per: 'Rossi, bianchi e bollicine: il calice per tutto quando non vuoi cambiarlo a ogni bottiglia.', vini: 'Quasi tutti i vini fermi; ottimo anche per Champagne importanti.', serv: 'Versa fino al punto più largo della coppa, circa 100–120 ml.', cura: 'Lavalo a mano con acqua calda e poco detersivo, asciuga con un panno in microfibra.' },
  borgogna: { per: 'La coppa larga raccoglie i profumi delicati e li porta al naso; il vino si allarga sulla punta della lingua e l\'acidità sembra più morbida.', vini: 'Pinot Nero, Barolo, Barbaresco, Nebbiolo, Etna rosso, Chardonnay maturi e Champagne vecchi.', serv: 'Non riempirlo più di un terzo: serve spazio per far respirare il vino, 100–120 ml.', cura: 'È fragile sulla coppa ampia: lavalo a mano e tienilo dallo stelo.' },
  bordeaux: { per: 'Alto e con la bocca più stretta: concentra i profumi e porta il vino al centro della bocca, ammorbidendo il tannino.', vini: 'Cabernet, Merlot, Bordeaux, Bolgheri, Brunello, Chianti, Syrah, Amarone, Aglianico.', serv: 'Circa 120 ml, fino al punto più largo; ideale con vini decantati.', cura: 'Lavalo a mano; per le macchie di tannino un po\' di bicarbonato.' },
  rosso: { per: 'Il calice da rosso di tutti i giorni: equilibrato per vini giovani e di medio corpo.', vini: 'Rossi giovani, Barbera, Dolcetto, Valpolicella, Beaujolais, Chianti d\'annata.', serv: 'Circa 120 ml.', cura: 'Va bene anche in lavastoviglie, programma delicato.' },
  bianco: { per: 'Più piccolo: tiene il vino fresco più a lungo e concentra i profumi agrumati e floreali.', vini: 'Bianchi freschi e aromatici, Sauvignon, Riesling, Vermentino, rosati, anche spumanti.', serv: 'Porzioni più piccole, 80–100 ml, così il vino non si scalda.', cura: 'Lavalo a mano o in lavastoviglie delicata.' },
  'bianco-ampio': { per: 'Coppa larga per bianchi di struttura: fa uscire i profumi di legno, burro e frutta matura.', vini: 'Chardonnay e Borgogna bianchi (Meursault, Puligny), bianchi affinati, orange wine, Champagne millesimati.', serv: '100 ml; servi i bianchi importanti a 11–13 °C, non troppo freddi.', cura: 'Lavalo a mano.' },
  tulipano: { per: 'Si stringe in alto: tiene le bollicine fini e concentra i profumi meglio della flûte.', vini: 'Champagne, Franciacorta, Trentodoc, metodo classico e spumanti di qualità.', serv: 'Versa piano lungo la parete, in due tempi, fino a metà calice.', cura: 'Niente detersivo profumato: rovina il perlage. Sciacqua bene con acqua calda.' },
  flute: { per: 'Stretta e alta: fa salire le bollicine in colonna, ma chiude i profumi.', vini: 'Spumanti giovani e semplici: Prosecco, Charmat, aperitivi.', serv: 'Fino a due terzi.', cura: 'Sciacquala bene: i residui di detersivo spengono le bollicine.' },
  coppa: { per: 'Larga e bassa: elegante ma disperde in fretta bollicine e profumi.', vini: 'Spumanti dolci, Moscato, cocktail con bollicine.', serv: 'Poco vino per volta.', cura: 'Lavala a mano.' },
  dessert: { per: 'Piccolo: concentra gli aromi intensi dei vini dolci, che si bevono in porzioni ridotte.', vini: 'Passiti, Sauternes, Tokaji, Vin Santo, Recioto, vendemmie tardive.', serv: '50–70 ml.', cura: 'Lavalo a mano: i vini dolci lasciano residui zuccherini.' },
  fortificati: { per: 'Piccolo e stretto: tiene a bada l\'alcol e concentra gli aromi.', vini: 'Porto, Sherry, Madeira, Marsala, Banyuls.', serv: '50–60 ml.', cura: 'Lavalo a mano.' },
  iso: { per: 'Il calice da degustazione dei sommelier: neutro, uguale per tutti i vini.', vini: 'Ogni vino in degustazione; un po\' piccolo per i rossi importanti.', serv: '40–50 ml in degustazione.', cura: 'Robusto, va in lavastoviglie.' },
  altro: { per: '', vini: '', serv: '', cura: '' },
};
async function ensureGlassIds() { let ch = false; GLASSES.forEach((g) => { if (!g.id) { g.id = gid(); ch = true; } }); if (ch) await saveGlasses(); }
// Vini della cantina per cui questo calice è il migliore tra quelli che hai
function winesForGlass(gl) {
  const wines = uniqW(Object.values(S.bottles).filter(inCellar));
  const ord = { 'st-now': 0, '': 1, 'st-past': 0, 'st-wait': 2 };
  return wines.map((b) => ({ b, g: bestGlass(b) })).filter((x) => x.g.mine && x.g.mine.id === gl.id)
    .sort((x, y) => x.g.rank - y.g.rank || ord[status(x.b)] - ord[status(y.b)] || name(x.b).localeCompare(name(y.b), 'it'));
}
function winesIdealFor(shape) { return uniqW(Object.values(S.bottles).filter(inCellar)).filter((b) => glassPrefs(b)[0] === shape); }

function caliciPage() {
  const mine = GLASSES;
  const owned = new Set(mine.map((g) => g.shape));
  const nW = uniqW(Object.values(S.bottles).filter(inCellar)).length;
  const missing = (() => { const m = new Map(); uniqW(Object.values(S.bottles).filter(inCellar)).forEach((b) => { const g = bestGlass(b); if (!g.mine || g.rank > 0) m.set(g.ideal, (m.get(g.ideal) || 0) + 1); }); return [...m.entries()].sort((a, b) => b[1] - a[1]); })();
  const card = (g) => `<button class="gcard" data-a="glass" data-id="${esc(g.id)}">${g.img ? `<img class="gph" src="${g.img}" alt="">` : ''}${glassSvg(g.shape, 104)}<b>${esc(g.name || shapeName(g.shape))}</b><small>${esc(shapeName(g.shape))}${g.qty ? ' · ' + g.qty + ' pezzi' : ''}</small><span class="gcount">${((n) => n + (n === 1 ? ' vino' : ' vini'))(winesForGlass(g).length)}</span></button>`;
  return `<div class="cal-head"><h2 class="ptitle">I miei calici</h2><p class="info">Tocca un calice per sapere a cosa serve e quali vini della tua cantina servirci. ${nW ? 'Ogni vino viene abbinato al calice migliore che hai.' : ''}</p>
  <div class="acts"><label class="btn pri">Riconosci da foto<input type="file" accept="image/*" capture="environment" hidden id="g_photo"></label><button class="btn" data-a="glassnew">Aggiungi a mano</button></div><p class="info" id="g_msg"></p></div>
  ${mine.length ? `<div class="ggrid">${mine.map(card).join('')}</div>` : '<p class="empty">Non hai ancora inserito calici: fotografane uno e lo riconosco io, oppure aggiungilo a mano.</p>'}
  ${missing.length && mine.length ? `<div class="note"><b>Cosa ti manca</b><br>${missing.slice(0, 3).map(([s, n]) => `${n} ${n === 1 ? 'vino' : 'vini'} della tua cantina starebbero meglio in un calice <b>${esc(shapeName(s).toLowerCase())}</b>`).join('<br>')}.</div>` : ''}
  <h3 class="letter">Tutte le forme</h3><p class="info">Guida rapida: tocca una forma per scoprire a cosa serve.</p>
  <div class="ggrid small">${SHAPES.filter((s) => s[0] !== 'altro').map((s) => `<button class="gcard${owned.has(s[0]) ? ' own' : ''}" data-a="gshape" data-s="${s[0]}">${glassSvg(s[0], 76)}<b>${esc(s[1])}</b>${owned.has(s[0]) ? '<small>ce l\'hai</small>' : ''}</button>`).join('')}</div>`;
}
function glassDetail(gl, shape) {
  const d = $('#dlg');
  const sh = gl ? gl.shape : shape, inf = GINFO[sh] || GINFO.altro, desc = (SHAPES.find((s) => s[0] === sh) || [])[2] || '';
  const list = gl ? winesForGlass(gl) : winesIdealFor(sh).map((b) => ({ b, g: { rank: 0 } }));
  const row = (x) => `<button class="row" data-a="open" data-id="${esc(x.b.id)}"><span style="display:flex;gap:12px">${imgSrc(x.b) ? `<img class="th" src="${imgSrc(x.b)}" alt="">` : '<span class="th"></span>'}<span>${esc(name(x.b))} ${esc(x.b.vintage || '')}<small>${x.g.rank === 0 ? 'Forma ideale' : 'Il migliore che hai per questo vino'} · ${serviceTemp(x.b)}${status(x.b) === 'st-now' ? ' · pronta da bere' : status(x.b) === 'st-past' ? ' · da aprire presto' : status(x.b) === 'st-wait' ? ' · da aspettare' : ''}</small></span></span></button>`;
  d.innerHTML = `<div class="ghero">${gl && gl.img ? `<img class="gph big" src="${gl.img}" alt="Foto del calice">` : ''}${glassSvg(sh, 190)}</div>
  <p class="eyebrow">${gl ? 'Il tuo calice' : 'Forma di calice'}</p><h2 class="dtitle">${esc(gl ? gl.name || shapeName(sh) : shapeName(sh))}</h2>
  <div class="chips"><span>${esc(shapeName(sh))}</span>${gl && gl.qty ? `<span>${gl.qty} pezzi</span>` : ''}${gl && gl.conf ? `<span>riconosciuto da foto · certezza ${esc(gl.conf)}</span>` : ''}</div>
  ${desc ? `<p>${esc(desc)}</p>` : ''}
  <div class="svc">${inf.per ? `<p><span class="svk">Perché questa forma</span>${esc(inf.per)}</p>` : ''}${inf.vini ? `<p><span class="svk">Vini ideali</span>${esc(inf.vini)}</p>` : ''}${inf.serv ? `<p><span class="svk">Quanto versare</span>${esc(inf.serv)}</p>` : ''}${inf.cura ? `<p><span class="svk">Cura</span>${esc(inf.cura)}</p>` : ''}${gl && gl.note ? `<p><span class="svk">Note</span>${esc(gl.note)}</p>` : ''}</div>
  <h3 class="sub">${gl ? 'Da servire in questo calice' : 'I tuoi vini ideali per questa forma'} <small class="free">${list.length}</small></h3>
  ${list.length ? list.slice(0, 60).map(row).join('') : `<p class="info">${gl ? 'Nessun vino della tua cantina: per ognuno hai un calice più adatto.' : 'Nessun vino della tua cantina ha questa come forma ideale.'}</p>`}
  <div class="acts" style="margin-top:14px">${gl ? `<button class="btn" id="gd_e">Modifica</button><button class="btn" id="gd_d">Elimina</button>` : `<button class="btn pri" id="gd_add">Aggiungi ai miei calici</button>`}<button class="btn" id="gd_x">Chiudi</button></div>`;
  $('#gd_x').onclick = () => d.close();
  if (gl) {
    $('#gd_e').onclick = () => glassEdit(gl);
    let armed = false;
    $('#gd_d').onclick = async (e) => { if (!armed) { armed = true; e.target.textContent = 'Conferma eliminazione'; return; } GLASSES = GLASSES.filter((x) => x.id !== gl.id); await saveGlasses(); d.close(); render(); };
  } else $('#gd_add').onclick = () => glassEdit({ id: gid(), shape: sh, name: '', qty: null }, true);
  d.onclose = null;
  if (!d.open) d.showModal();
}
function glassEdit(gl, isNew) {
  const d = $('#dlg2');
  const g = { ...gl };
  d.innerHTML = `<h2>${isNew ? 'Nuovo calice' : 'Modifica calice'}</h2>
  <div class="ghero sm">${g.img ? `<img class="gph big" src="${g.img}" alt="">` : ''}<span id="ge_svg">${glassSvg(g.shape, 120)}</span></div>
  ${g.why ? `<p class="info">${esc(g.why)}</p>` : ''}
  <label>Nome o modello</label><input id="ge_n" placeholder="Es. Zalto Bordeaux, Riedel Veritas" value="${esc(g.name || '')}">
  <label>Forma</label><select id="ge_s">${SHAPES.map((s) => `<option value="${s[0]}" ${g.shape === s[0] ? 'selected' : ''}>${esc(s[1])}</option>`).join('')}</select>
  <div class="two"><div><label>Quanti ne hai</label><input id="ge_q" type="number" min="0" inputmode="numeric" value="${g.qty || ''}"></div><div></div></div>
  <label>Note</label><input id="ge_o" placeholder="Es. cristallo soffiato, regalo, solo per le occasioni" value="${esc(g.note || '')}">
  <div class="acts"><button class="btn pri" id="ge_ok">Salva</button><button class="btn" id="ge_x">Annulla</button></div>`;
  $('#ge_s').onchange = () => { $('#ge_svg').innerHTML = glassSvg($('#ge_s').value, 120); };
  $('#ge_x').onclick = () => d.close();
  $('#ge_ok').onclick = async () => {
    const ng = { ...g, name: $('#ge_n').value.trim(), shape: $('#ge_s').value, qty: +$('#ge_q').value || null, note: $('#ge_o').value.trim() };
    delete ng.why;
    const i = GLASSES.findIndex((x) => x.id === ng.id);
    if (i >= 0) GLASSES[i] = ng; else GLASSES.push(ng);
    await saveGlasses(); haptic(); d.close();
    const d1 = $('#dlg'); if (d1.open) d1.close();
    render();
  };
  d.onclose = null;
  d.showModal();
}
async function glassFromPhoto(e) {
  const file = e.target.files[0]; e.target.value = '';
  if (!file) return;
  const m = $('#g_msg');
  let img = null;
  try { img = await makeLabelThumb(file, null); } catch (_) {}
  if (!aiReady()) { glassEdit({ id: gid(), shape: 'universale', img, why: 'Per riconoscere il calice in automatico serve la chiave dell\'IA: scegli tu la forma.' }, true); return; }
  if (m) m.textContent = 'Riconosco il calice…';
  aiWaitNote = (s) => { if (m) m.textContent = 'Gemini chiede una pausa: riprovo tra ' + s + ' secondi…'; };
  try {
    const j = await aiJson(`Questa è la foto di un calice (bicchiere da vino). Riconosci la forma scegliendo UNA di queste chiavi: ${SHAPES.map((s) => s[0] + ' (' + s[1] + ')').join(', ')}.
Se riconosci con buona certezza la marca e il modello (per esempio Zalto Denk'Art Bordeaux, Riedel Veritas Old World Pinot Noir, Gabriel-Glas StandArt, Schott Zwiesel, Spiegelau, Riedel Performance), scrivili; altrimenti dai un nome descrittivo breve in italiano (es. «Calice da Borgogna in cristallo»). Non inventare il marchio se non è leggibile o inconfondibile.
Rispondi solo con JSON: {"shape": chiave, "name": string, "confidence": "alta"|"media"|"bassa", "why": "una frase su cosa ti ha fatto scegliere la forma"}`, await toB64(file, 1200));
    const shape = SHAPES.some((s) => s[0] === j.shape) ? j.shape : 'universale';
    if (m) m.textContent = '';
    glassEdit({ id: gid(), shape, name: typeof j.name === 'string' ? j.name : '', img, conf: j.confidence, why: (j.why ? 'Riconosciuto: ' + j.why + ' ' : '') + 'Controlla e correggi se serve.' }, true);
  } catch (err) {
    if (m) m.textContent = 'Riconoscimento non riuscito (' + err.message + '): scegli tu la forma.';
    glassEdit({ id: gid(), shape: 'universale', img }, true);
  } finally { aiWaitNote = null; }
}
document.addEventListener('change', (e) => { if (e.target && e.target.id === 'g_photo') glassFromPhoto(e); });
