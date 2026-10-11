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
