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
  ['angolare', 'Angolare (coppa a pareti spezzate)', 'Coppa con pareti a spigoli: più superficie di vino a contatto con l\'aria, si apre in fretta. Versatile per rossi e bianchi.'],
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
  const l = glassPrefs0(b), i = l.indexOf('universale');
  if (i >= 0) l.splice(i + 1, 0, 'angolare'); else l.push('angolare');
  return l;
}
function glassPrefs0(b) {
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
// Quanto un calice è adatto a un vino: 0 perfetto, 1-2 buono, oltre poco adatto.
// Se la ricerca sul modello dice per quali tipi di vino è pensato, gli altri tipi vengono penalizzati.
function glassFit(b, gl, prefs) {
  prefs = prefs || glassPrefs(b);
  let r = prefs.indexOf(gl.shape); if (r < 0) r = 99;
  const ty = gl.research && Array.isArray(gl.research.types) ? gl.research.types : [];
  if (ty.length && !ty.includes(b.type)) r += 3;
  return r;
}
function bestGlass(b) {
  const prefs = glassPrefs(b);
  const owned = GLASSES.filter((g) => g.shape);
  if (!owned.length) return { ideal: prefs[0], mine: null, rank: -1 };
  let best = null, br = 1e9;
  owned.forEach((g) => { const r = glassFit(b, g, prefs); if (r < br) { br = r; best = g; } });
  return { ideal: prefs[0], mine: best, rank: br > 6 ? 99 : br };
}
function serviceHtml(b) {
  const g = bestGlass(b);
  let glass;
  if (!g.mine) glass = `Calice ideale: <b>${esc(shapeName(g.ideal))}</b>. <button class="link" data-a="glasses" type="button">Inserisci i tuoi calici</button>`;
  else if (g.rank === 0) glass = `Usa il tuo <b>${esc(gName(g.mine))}</b>: è la forma ideale per questo vino.`;
  else if (g.rank < 99) glass = `Tra i tuoi, il migliore è <b>${esc(gName(g.mine))}</b>. L'ideale sarebbe un calice ${esc(shapeName(g.ideal).toLowerCase())}.`;
  else glass = `Nessuno dei tuoi calici è molto adatto: l'ideale sarebbe un calice ${esc(shapeName(g.ideal).toLowerCase())}.`;
  return `<div class="svc"><p><span class="svk">Calice</span>${glass}</p><p><span class="svk">Temperatura</span>${serviceTemp(b)}</p><p><span class="svk">Apertura</span>${esc(decantAdvice(b))}</p></div>`;
}
const gName = (g) => g.name || [g.brand, g.model].filter(Boolean).join(' ') || shapeName(g.shape);
const glassLine = (b) => { const g = bestGlass(b); return g.mine ? 'Calice: ' + (gName(g.mine)) + ' · ' + serviceTemp(b) : 'Calice ' + shapeName(g.ideal).toLowerCase() + ' · ' + serviceTemp(b); };
const glassesForAI = () => (GLASSES.length ? GLASSES.map((g) => gName(g) + ' (forma ' + shapeName(g.shape) + (g.qty ? ', ' + g.qty + ' pezzi' : '') + ')').join('; ') : 'non indicati');

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
  angolare: { p: 'M28 10 L23 42 L13 64 C14 82 28 92 40 92 C52 92 66 82 67 64 L57 42 L52 10', b: 92, lv: 68, w: 'rosso' },
  altro: { p: 'M27 12 C20 32 15 50 18 68 C21 84 31 91 40 91 C49 91 59 84 62 68 C65 50 60 32 53 12', b: 91, lv: 70, w: 'rosso' },
};
const LIQ = { rosso: '#7A1F35', bianco: '#D9C27A', bolle: '#E6D79E', dolce: '#C98A2E', porto: '#6B2A1A' };
let gsvgN = 0;
// Sagoma ricalcata dalla foto del calice: profilo di metà calice, specchiato.
function profileShape(pr, shape) {
  try {
    const pts = (pr.bowl || []).map((q) => [Math.max(0, Math.min(1, +q[0])), Math.max(0, Math.min(1, +q[1]))]).filter((q) => Number.isFinite(q[0]) && Number.isFinite(q[1])).sort((a, b) => a[0] - b[0]);
    if (pts.length < 3) return null;
    const end = Math.max(pts[pts.length - 1][0], Math.min(0.95, +pr.bowlEnd || pts[pts.length - 1][0]));
    const maxHW = Math.max(...pts.map((q) => q[1]), +pr.base || 0.1, 0.05);
    const k = Math.min(124, 36 / maxHW), top = 130 - k;
    const P = (y, hw, side) => [(40 + side * hw * k).toFixed(1), (top + y * k).toFixed(1)];
    const L = pts.map((q) => P(q[0], q[1], -1)), R = pts.slice().reverse().map((q) => P(q[0], q[1], 1));
    const yb = (top + end * k).toFixed(1);
    const p = 'M' + L.map((q) => q.join(' ')).join(' L') + ' L40 ' + yb + ' L' + R.map((q) => q.join(' ')).join(' L');
    const widest = pts.reduce((a, q) => (q[1] > a[1] ? q : a), pts[0]);
    const w = (GSHAPE[shape] || GSHAPE.universale).w;
    const lv = w === 'bolle' ? top + (pts[0][0] + (end - pts[0][0]) * 0.3) * k : top + widest[0] * k;
    return { p, b: +yb, lv: Math.max(top + 4, lv), w, base: Math.max(10, Math.min(30, (+pr.base || 0.17) * k)) };
  } catch (_) { return null; }
}
function glassSvg(shape, h, opts) {
  const traced = opts && opts.profile ? profileShape(opts.profile, shape) : null;
  const g = traced || GSHAPE[shape] || GSHAPE.universale, id = 'gc' + (++gsvgN);
  const liq = (opts && opts.liq) || LIQ[g.w], tk = g.p.match(/-?\d+(?:\.\d+)?/g);
  const bubbles = g.w === 'bolle' && !traced ? [[38, g.b - 6], [42, g.b - 16], [39, g.b - 27], [41, g.lv + 8]].filter((p) => p[1] > g.lv + 2).map((p) => `<circle cx="${p[0]}" cy="${p[1]}" r="1.4" fill="#FFF6D8" opacity=".85"/>`).join('') : '';
  return `<svg class="gsvg" viewBox="0 0 80 140" height="${h}" role="img" aria-label="Calice ${esc(shapeName(shape))}"><defs><clipPath id="${id}"><path d="${g.p} Z"/></clipPath></defs>
  <rect x="0" y="${g.lv}" width="80" height="${140 - g.lv}" fill="${liq}" clip-path="url(#${id})"/>${bubbles}
  <path d="${g.p}" fill="rgba(255,255,255,.04)" stroke="var(--gold)" stroke-width="2" stroke-linejoin="round"/>
  <path d="M${tk[0]} ${tk[1]} L${tk[tk.length - 2]} ${tk[tk.length - 1]}" fill="none" stroke="var(--gold)" stroke-width="1.2" opacity=".6"/>
  <path d="M40 ${g.b} L40 128" stroke="var(--gold)" stroke-width="2"/><ellipse cx="40" cy="130" rx="${g.base || 21}" ry="4.5" fill="none" stroke="var(--gold)" stroke-width="2"/></svg>`;
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
  angolare: { per: 'Le pareti spezzate allargano la superficie del vino e creano un vortice quando lo fai girare: il vino si ossigena in fretta e i profumi escono subito.', vini: 'Rossi giovani o chiusi che hanno bisogno d\'aria, bianchi strutturati; molti lo usano come calice universale.', serv: 'Fino al punto più largo, circa 100–120 ml.', cura: 'Spesso è sottilissimo e soffiato a bocca: lavalo a mano, asciugalo tenendolo dalla coppa, mai torcendo lo stelo.' },
  altro: { per: '', vini: '', serv: '', cura: '' },
};
async function ensureGlassIds() { let ch = false; GLASSES.forEach((g) => { if (!g.id) { g.id = gid(); ch = true; } }); if (ch) await saveGlasses(); }
// Vini della cantina per cui questo calice è il migliore tra quelli che hai
// Solo i vini per cui questo è il calice migliore che hai E che ci stanno davvero bene.
function winesForGlass(gl) {
  const wines = uniqW(Object.values(S.bottles).filter(inCellar));
  const ord = { 'st-now': 0, '': 1, 'st-past': 0, 'st-wait': 2 };
  return wines.map((b) => ({ b, g: bestGlass(b) })).filter((x) => x.g.mine && x.g.mine.id === gl.id && x.g.rank <= 2)
    .sort((x, y) => x.g.rank - y.g.rank || ord[status(x.b)] - ord[status(y.b)] || name(x.b).localeCompare(name(y.b), 'it'));
}
function winesIdealFor(shape) { return uniqW(Object.values(S.bottles).filter(inCellar)).filter((b) => glassPrefs(b)[0] === shape); }

function caliciPage() {
  const mine = GLASSES;
  const owned = new Set(mine.map((g) => g.shape));
  const nW = uniqW(Object.values(S.bottles).filter(inCellar)).length;
  const missing = (() => { const m = new Map(); uniqW(Object.values(S.bottles).filter(inCellar)).forEach((b) => { const g = bestGlass(b); if (!g.mine || g.rank > 0) m.set(g.ideal, (m.get(g.ideal) || 0) + 1); }); return [...m.entries()].sort((a, b) => b[1] - a[1]); })();
  const card = (g) => `<button class="gcard" data-a="glass" data-id="${esc(g.id)}">${glassSvg(g.shape, 112, { profile: g.profile })}${g.profile ? '<span class="traced">ricalcato</span>' : ''}${g.brand ? `<span class="brand">${esc(g.brand)}</span>` : ''}<b>${esc(g.model || gName(g))}</b><small>${esc(shapeName(g.shape).replace(/ \(.*\)/, ''))}${g.qty ? ' · ' + g.qty + ' pezzi' : ''}</small><span class="gcount">${((n) => n + (n === 1 ? ' vino' : ' vini'))(winesForGlass(g).length)}</span></button>`;
  return `<div class="cal-head"><h2 class="ptitle">I miei calici</h2><p class="info">Tocca un calice per sapere a cosa serve e quali vini della tua cantina servirci. ${nW ? 'Ogni vino viene abbinato al calice migliore che hai.' : ''}</p>
  <div class="acts"><label class="btn pri">Scatta foto<input type="file" accept="image/*" capture="environment" hidden class="g_photo"></label><label class="btn">Dalla galleria<input type="file" accept="image/*" hidden class="g_photo"></label><button class="btn" data-a="glasspaste" type="button">Incolla immagine</button><button class="btn" data-a="glassnew">Aggiungi a mano</button></div><p class="info" id="g_msg"></p></div>
  ${mine.length ? `<div class="ggrid">${mine.map(card).join('')}</div>` : '<p class="empty">Non hai ancora inserito calici: fotografane uno e lo riconosco io, oppure aggiungilo a mano.</p>'}
  ${missing.length && mine.length ? `<div class="note"><b>Cosa ti manca</b><br>${missing.slice(0, 3).map(([s, n]) => `${n} ${n === 1 ? 'vino' : 'vini'} della tua cantina starebbero meglio in un calice <b>${esc(shapeName(s).toLowerCase())}</b>`).join('<br>')}.</div>` : ''}
  <h3 class="letter">Tutte le forme</h3><p class="info">Guida rapida: tocca una forma per scoprire a cosa serve.</p>
  <div class="ggrid small">${SHAPES.filter((s) => s[0] !== 'altro').map((s) => `<button class="gcard${owned.has(s[0]) ? ' own' : ''}" data-a="gshape" data-s="${s[0]}">${glassSvg(s[0], 76)}<b>${esc(s[1])}</b>${owned.has(s[0]) ? '<small>ce l\'hai</small>' : ''}</button>`).join('')}</div>`;
}
function glassDetail(gl, shape) {
  const d = $('#dlg');
  const sh = gl ? gl.shape : shape, inf = GINFO[sh] || GINFO.altro, desc = (SHAPES.find((s) => s[0] === sh) || [])[2] || '';
  const all = gl ? winesForGlass(gl) : winesIdealFor(sh).map((b) => ({ b, g: { rank: 0 } }));
  const ideal = all.filter((x) => x.g.rank === 0), good = all.filter((x) => x.g.rank > 0);
  const rs = gl && gl.research;
  const st = (b) => (status(b) === 'st-now' ? ' · pronta da bere' : status(b) === 'st-past' ? ' · da aprire presto' : status(b) === 'st-wait' ? ' · da aspettare' : '');
  const row = (b, why) => `<button class="row" data-a="open" data-id="${esc(b.id)}"><span style="display:flex;gap:12px">${imgSrc(b) ? `<img class="th" src="${imgSrc(b)}" alt="">` : '<span class="th"></span>'}<span>${esc(name(b))} ${esc(b.vintage || '')}<small>${serviceTemp(b)}${st(b)}</small>${why ? `<span class="why">${esc(why)}</span>` : ''}</span></span></button>`;
  const picks = rs && Array.isArray(rs.picks) ? rs.picks.filter((x) => S.bottles[x.id] && inCellar(S.bottles[x.id])) : [];
  const more = (arr, n) => arr.length > n ? `<details class="more"><summary>Altri ${arr.length - n}</summary>${arr.slice(n).map((x) => row(x.b)).join('')}</details>` : '';
  d.innerHTML = `<div class="ghero">${glassSvg(sh, 200, { profile: gl && gl.profile })}</div>
  ${gl && gl.brand ? `<span class="brand lg">${esc(gl.brand)}</span>` : `<p class="eyebrow">${gl ? 'Il tuo calice' : 'Forma di calice'}</p>`}<h2 class="dtitle">${esc(gl ? gl.model || gName(gl) : shapeName(sh))}</h2>
  <div class="chips"><span>Forma: ${esc(shapeName(sh))}</span>${gl && gl.qty ? `<span>${gl.qty} pezzi</span>` : ''}${gl && gl.profile ? '<span>sagoma ricalcata dalla tua foto</span>' : ''}</div>
  ${gl ? `<section class="research">${rs ? `<p class="svk">Dalla ricerca su questo modello</p>${rs.designed ? `<p>${esc(rs.designed)}</p>` : ''}${rs.specs ? `<p class="info">${esc(rs.specs)}</p>` : ''}${rs.avoid ? `<p class="info"><b>Meno adatto a:</b> ${esc(rs.avoid)}</p>` : ''}${(rs.links || []).length ? `<p class="info">Fonti: ${rs.links.slice(0, 4).map((l) => `<a class="link" target="_blank" rel="noopener" href="${esc(l.u)}">${esc(l.t)}</a>`).join(' ')}</p>` : ''}` : `<p class="svk">Ricerca approfondita</p><p class="info">Cerco online per quali vini è stato progettato ${esc(gName(gl))} e scelgo dalla tua cantina solo le bottiglie che lo valorizzano davvero.</p>`}
  <div class="acts"><button class="btn${rs ? '' : ' pri'}" id="gd_r">${rs ? 'Rifai la ricerca' : 'Fai la ricerca'}</button></div><p class="info" id="gd_rm"></p></section>` : ''}
  ${picks.length ? `<h3 class="sub">Le scelte del sommelier <small class="free">${picks.length}</small></h3>${picks.map((x) => row(S.bottles[x.id], x.why)).join('')}` : ''}
  <h3 class="sub">${gl ? 'Perfetti in questo calice' : 'I tuoi vini ideali per questa forma'} <small class="free">${ideal.length}</small></h3>
  ${ideal.length ? ideal.slice(0, 8).map((x) => row(x.b)).join('') + more(ideal, 8) : `<p class="info">${gl ? 'Nessun vino della tua cantina ha questo come calice ideale.' : 'Nessun vino della tua cantina ha questa come forma ideale.'}</p>`}
  ${gl && good.length ? `<h3 class="sub">Vanno bene anche <small class="free">${good.length}</small></h3><p class="info">Non è la loro forma ideale, ma è il calice migliore che hai per loro.</p>${good.slice(0, 5).map((x) => row(x.b)).join('')}${more(good, 5)}` : ''}
  <details class="more"><summary>Tutto su questa forma</summary>${desc ? `<p>${esc(desc)}</p>` : ''}<div class="svc">${inf.per ? `<p><span class="svk">Perché questa forma</span>${esc(inf.per)}</p>` : ''}${inf.vini ? `<p><span class="svk">Vini ideali</span>${esc(inf.vini)}</p>` : ''}${inf.serv ? `<p><span class="svk">Quanto versare</span>${esc(inf.serv)}</p>` : ''}${inf.cura ? `<p><span class="svk">Cura</span>${esc(inf.cura)}</p>` : ''}${gl && gl.note ? `<p><span class="svk">Note</span>${esc(gl.note)}</p>` : ''}</div></details>
  <div class="acts" style="margin-top:14px">${gl ? `<button class="btn" id="gd_e">Modifica</button><button class="btn" id="gd_d">Elimina</button>` : `<button class="btn pri" id="gd_add">Aggiungi ai miei calici</button>`}<button class="btn" id="gd_x">Chiudi</button></div>`;
  $('#gd_x').onclick = () => d.close();
  if (gl) {
    $('#gd_e').onclick = () => glassEdit(gl);
    $('#gd_r').onclick = async () => {
      const m = $('#gd_rm'); $('#gd_r').disabled = true;
      try { await researchGlass(gl, (t) => { m.textContent = t; }); glassDetail(GLASSES.find((x) => x.id === gl.id) || gl); }
      catch (e) { m.textContent = 'Ricerca non riuscita: ' + errorHint(e.message) + ' (' + e.message + ')'; $('#gd_r').disabled = false; }
    };
    let armed = false;
    $('#gd_d').onclick = async (e) => { if (!armed) { armed = true; e.target.textContent = 'Conferma eliminazione'; return; } GLASSES = GLASSES.filter((x) => x.id !== gl.id); await saveGlasses(); d.close(); render(); };
  } else $('#gd_add').onclick = () => glassEdit({ id: gid(), shape: sh, name: '', qty: null }, true);
  d.onclose = null;
  if (!d.open) d.showModal();
}
// Ricerca approfondita: per cosa è progettato il modello (dal produttore e da chi lo recensisce) e scelta dalla cantina.
async function researchGlass(gl, onMsg) {
  if (!aiReady()) throw new Error('serve la chiave dell\'IA (api key) nelle Impostazioni');
  const lab = { 'st-now': 'pronta', 'st-wait': 'da aspettare', 'st-past': 'oltre il picco' };
  const others = GLASSES.filter((x) => x.id !== gl.id).map((x) => gName(x) + ' (' + shapeName(x.shape) + ')').join('; ') || 'nessuno';
  const list = uniqW(Object.values(S.bottles).filter(inCellar)).slice(0, 200).map((b) => ({ id: b.id, vino: name(b), annata: b.vintage || undefined, tipo: b.type, zona: b.region || undefined, stato: lab[status(b)] || undefined, note: b.winfo ? b.winfo.slice(0, 90) : undefined }));
  const ask = `Calice: ${gName(gl)}${gl.brand ? ' (marca ' + gl.brand + (gl.model ? ', modello ' + gl.model : '') + ')' : ''}, famiglia di forma: ${shapeName(gl.shape)}.
1) Cerca sul web (sito del produttore, schede tecniche, recensioni di sommelier) per quali vini è stato progettato questo modello preciso, le sue caratteristiche (capacità, altezza, forma della coppa e della bocca) e per quali vini è meno adatto. Se il nome del modello indica già l'uso (per esempio «Red», «White», «Champagne»), tienine conto.
2) Tra i vini della cantina qui sotto scegli SOLO quelli che questo calice valorizza davvero, al massimo 8, preferendo quelli pronti da bere. Considera che l'utente ha anche questi altri calici: ${others}; se per un vino un altro suo calice è chiaramente migliore, non sceglierlo qui. Meglio pochi e giusti che tanti.
Rispondi solo con JSON: {"designed": "2-3 frasi su per cosa è pensato e perché", "specs": "caratteristiche tecniche in una frase, solo se trovate", "types": [i tipi di vino adatti tra "rosso","bianco","bollicine","rosato","altro"], "avoid": "per cosa è meno adatto, breve", "picks": [{"id": string, "why": "una frase concreta"}]}
Non inventare dati tecnici: se non li trovi lascia la stringa vuota.
Cantina: ${JSON.stringify(list)}`;
  aiWaitNote = (s) => onMsg && onMsg('Gemini chiede una pausa: riprovo tra ' + s + ' secondi…');
  onMsg && onMsg('Cerco informazioni sul calice e scelgo i vini… può volerci fino a un minuto.');
  let j = null, links = [];
  try {
    try { const r = await aiSearch(ask); j = parseJsonLoose(r.text); links = r.links; } catch (e) { if (/api key|api_key|permission|failed to fetch/i.test(e.message)) throw e; }
    if (!j) j = await aiJson(ask.replace('1) Cerca sul web (sito del produttore, schede tecniche, recensioni di sommelier)', '1) In base a quello che sai'));
  } finally { aiWaitNote = null; }
  const TY = ['rosso', 'bianco', 'bollicine', 'rosato', 'altro'];
  const research = { designed: String(j.designed || ''), specs: String(j.specs || ''), avoid: String(j.avoid || ''), types: (Array.isArray(j.types) ? j.types : []).filter((t) => TY.includes(t)), picks: (Array.isArray(j.picks) ? j.picks : []).filter((x) => x && S.bottles[x.id]).slice(0, 8).map((x) => ({ id: x.id, why: String(x.why || '') })), links, at: Date.now() };
  const i = GLASSES.findIndex((x) => x.id === gl.id);
  if (i >= 0) { GLASSES[i] = { ...GLASSES[i], research }; await saveGlasses(); }
  if (tab === 'calici') render();
  return research;
}
function glassEdit(gl, isNew) {
  const d = $('#dlg2');
  const g = { ...gl };
  if (!g.brand && !g.model && g.name) g.model = g.name; // calici inseriti prima: il nome diventa il modello
  d.innerHTML = `<h2>${isNew ? 'Nuovo calice' : 'Modifica calice'}</h2>
  <div class="ghero sm"><span id="ge_svg">${glassSvg(g.shape, 140, { profile: g.profile })}</span></div>
  <div class="acts" style="justify-content:center;margin:-4px 0 10px"><label class="btn">${g.profile ? 'Nuova foto' : 'Ricalca da foto'}<input type="file" accept="image/*" capture="environment" hidden class="ge_f"></label><label class="btn">Dalla galleria<input type="file" accept="image/*" hidden class="ge_f"></label><button class="btn" id="ge_p" type="button">Incolla</button>${g.profile ? '<button class="btn" id="ge_np" type="button">Usa il disegno standard</button>' : ''}</div>
  <p class="info" id="ge_w">${g.why ? esc(g.why) : ''}</p>
  <div class="two"><div><label>Marca</label><input id="ge_b" placeholder="Es. Zalto, Riedel" value="${esc(g.brand || '')}"></div><div><label>Modello</label><input id="ge_m" placeholder="Es. Bordeaux, Veritas" value="${esc(g.model || '')}"></div></div>
  <label>Forma</label><select id="ge_s">${SHAPES.map((s) => `<option value="${s[0]}" ${g.shape === s[0] ? 'selected' : ''}>${esc(s[1])}</option>`).join('')}</select>
  <div class="two"><div><label>Quanti ne hai</label><input id="ge_q" type="number" min="0" inputmode="numeric" value="${g.qty || ''}"></div><div></div></div>
  <label>Note</label><input id="ge_o" placeholder="Es. cristallo soffiato, regalo, solo per le occasioni" value="${esc(g.note || '')}">
  <div class="acts"><button class="btn pri" id="ge_ok">Salva</button><button class="btn" id="ge_x">Annulla</button></div>`;
  const redraw = () => { $('#ge_svg').innerHTML = glassSvg(g.shape, 140, { profile: g.profile }); };
  $('#ge_s').onchange = () => { g.shape = $('#ge_s').value; redraw(); };
  if ($('#ge_np')) $('#ge_np').onclick = () => { delete g.profile; redraw(); $('#ge_np').remove(); };
  const fromFile = async (file) => {
    if (!file) return;
    $('#ge_w').textContent = aiReady() ? 'Ritaglio la foto e riconosco il calice…' : 'Ritaglio la foto…';
    const r = await analyzeGlassPhoto(file, (t) => { $('#ge_w').textContent = t; });
    if (r.j && r.j.profile) g.profile = r.j.profile;
    redraw();
    if (r.j) {
      if (r.j.brand && !$('#ge_b').value.trim()) $('#ge_b').value = r.j.brand;
      if (r.j.model && !$('#ge_m').value.trim()) $('#ge_m').value = r.j.model;
      if (SHAPES.some((x) => x[0] === r.j.shape) && isNew) { $('#ge_s').value = r.j.shape; g.shape = r.j.shape; redraw(); }
      g.conf = r.j.confidence;
    }
    $('#ge_w').textContent = r.msg || '';
  };
  d.querySelectorAll('.ge_f').forEach((inp) => { inp.onchange = (e) => { const f = e.target.files[0]; e.target.value = ''; fromFile(f); }; });
  $('#ge_p').onclick = () => pasteGlassImage(fromFile, (t) => { $('#ge_w').textContent = t; });
  $('#ge_x').onclick = () => d.close();
  $('#ge_ok').onclick = async () => {
    const brand = $('#ge_b').value.trim(), model = $('#ge_m').value.trim();
    const ng = { ...g, brand, model, name: [brand, model].filter(Boolean).join(' '), shape: $('#ge_s').value, qty: +$('#ge_q').value || null, note: $('#ge_o').value.trim() };
    delete ng.why; delete ng.img; // la foto serve solo per il ricalco: non la conservo
    const old = GLASSES.find((x) => x.id === ng.id);
    if (old && (old.brand !== ng.brand || old.model !== ng.model || old.shape !== ng.shape)) delete ng.research;
    const i = GLASSES.findIndex((x) => x.id === ng.id);
    if (i >= 0) GLASSES[i] = ng; else GLASSES.push(ng);
    await saveGlasses(); haptic(); d.close();
    const d1 = $('#dlg'); if (d1.open) d1.close();
    render();
    if (!ng.research && aiReady() && (ng.brand || ng.model)) researchGlass(ng, (t) => { const m = $('#g_msg'); if (m) m.textContent = t; }).then(() => { const m = $('#g_msg'); if (m) m.textContent = 'Ricerca completata per ' + gName(ng) + '.'; }).catch(() => {});
  };
  d.onclose = null;
  d.showModal();
}
// Ritaglio verticale attorno al calice, su fondo scuro, come una foto di catalogo.
async function cropGlass(file, box) {
  const im = await loadImg(file), W = im.naturalWidth, H = im.naturalHeight;
  box = normBox(box) || { left: 0.15, top: 0.05, right: 0.85, bottom: 0.95 };
  const bw = (box.right - box.left) * W, bh = (box.bottom - box.top) * H, cx = (box.left + box.right) / 2 * W, cy = (box.top + box.bottom) / 2 * H;
  let h = Math.max(bh * 1.12, bw * 1.12 * 4 / 3), w = h * 3 / 4;
  const c = document.createElement('canvas'); c.width = 360; c.height = 480;
  const x = c.getContext('2d'); x.fillStyle = '#121010'; x.fillRect(0, 0, 360, 480);
  x.drawImage(im, cx - w / 2, cy - h / 2, w, h, 0, 0, 360, 480);
  return c.toDataURL('image/jpeg', 0.86);
}
async function analyzeGlassPhoto(file, onMsg) {
  if (!aiReady()) { let img = null; try { img = await cropGlass(file, null); } catch (_) {} return { img, j: null, msg: 'Per riconoscere marca e forma in automatico serve la chiave dell\'IA: compila tu i campi.' }; }
  aiWaitNote = (s) => onMsg && onMsg('Gemini chiede una pausa: riprovo tra ' + s + ' secondi…');
  try {
    const j = await aiJson(`Questa è la foto di un calice (bicchiere da vino) di proprietà dell'utente. Rispondi solo con JSON:
{"brand": string|null, "model": string|null, "shape": chiave, "confidence": "alta"|"media"|"bassa", "why": string, "box": {"left":0-1,"top":0-1,"right":0-1,"bottom":0-1}, "profile": {...}}
- "brand" e "model": marca e modello se li riconosci con buona certezza dalla forma o da scritte/incisioni (per esempio Zalto Denk'Art Bordeaux, Riedel Veritas, Gabriel-Glas StandArt, Mark Thomas Double Bend Red, Schott Zwiesel, Spiegelau, Lehmann, Italesse, Rona). Se non sei sicuro usa null: non inventare.
- "shape": UNA di queste chiavi per la famiglia di forma: ${SHAPES.map((s) => s[0] + ' (' + s[1] + ')').join(', ')}.
- "why": una frase su cosa ti ha fatto riconoscere forma e modello.
- "box": il rettangolo che contiene il calice intero (dalla bocca al piede), in frazioni di larghezza e altezza dell'immagine.
- "profile": la sagoma del calice per disegnarlo, misurata sulla foto: {"bowl": [[y, mezza_larghezza], ...], "bowlEnd": y, "base": mezza_larghezza_del_piede}. Tutte le misure sono frazioni dell'ALTEZZA TOTALE del calice (dalla bocca, y=0, al piede, y=1). "bowl" sono 10-16 punti del bordo esterno della coppa dalla bocca (y=0) fino al punto dove la coppa si chiude sullo stelo; per ognuno la metà della larghezza della coppa a quell'altezza. Se la coppa ha spigoli o pieghe, metti un punto esattamente su ogni spigolo. "bowlEnd" è dove inizia lo stelo.`, await toB64(file, 1200));
    let img = null; try { img = await cropGlass(file, j.box); } catch (_) {}
    return { img, j, msg: (j.why ? 'Riconosciuto: ' + String(j.why).replace(/[.\s]+$/, '') + '. ' : '') + 'Controlla e correggi se serve.' };
  } catch (err) {
    let img = null; try { img = await cropGlass(file, null); } catch (_) {}
    return { img, j: null, msg: 'Riconoscimento non riuscito (' + err.message + '): compila tu i campi.' };
  } finally { aiWaitNote = null; }
}
// Immagine copiata (per esempio da una pagina web: tieni premuto sulla foto e scegli Copia).
async function pasteGlassImage(fn, onMsg) {
  try {
    for (const it of await navigator.clipboard.read()) {
      const ty = it.types.find((t) => t.startsWith('image/'));
      if (ty) { const b = await it.getType(ty); await fn(new File([b], 'calice.' + (ty.split('/')[1] || 'png'), { type: ty })); return; }
    }
    onMsg('Negli appunti non c\'è nessuna immagine: su Safari tieni premuto sulla foto e scegli «Copia».');
  } catch (_) { onMsg('Non riesco a leggere gli appunti: salva l\'immagine in Foto e usa «Dalla galleria».'); }
}
async function glassFromPhoto(file) {
  if (!file) return;
  const m = $('#g_msg');
  if (m) m.textContent = aiReady() ? 'Riconosco il calice…' : '';
  const r = await analyzeGlassPhoto(file, (t) => { if (m) m.textContent = t; });
  if (m) m.textContent = '';
  const j = r.j || {};
  glassEdit({ id: gid(), shape: SHAPES.some((s) => s[0] === j.shape) ? j.shape : 'universale', brand: j.brand || '', model: j.model || '', profile: j.profile && Array.isArray(j.profile.bowl) ? j.profile : undefined, conf: j.confidence, why: r.msg }, true);
}
document.addEventListener('change', (e) => { if (e.target && e.target.classList && e.target.classList.contains('g_photo')) { const f = e.target.files[0]; e.target.value = ''; glassFromPhoto(f); } });
document.addEventListener('click', (e) => { const t = e.target && e.target.closest && e.target.closest('[data-a="glasspaste"]'); if (!t) return; e.stopPropagation(); pasteGlassImage(glassFromPhoto, (m) => { const el = $('#g_msg'); if (el) el.textContent = m; }); }, true);
