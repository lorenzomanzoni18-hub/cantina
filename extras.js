/* Pagine aggiuntive: Luna, Stasera, Mappa, "Ho bevuto" e inventario PDF. */

/* ===== Luna ===== */
function moonChip() {
  const c = kind(Date.now()), good = isGood(c);
  return `<button class="moonchip ${good ? 'good' : 'bad'}" data-a="tab" data-t="luna">Luna: giorno ${c[2]} · ${good ? 'buon giorno per bere' : 'meglio aspettare'} ›</button>`;
}
function luna() { return today(); }

/* ===== Ho bevuto ===== */
function drinkDialog(nb, cb) {
  const d = $('#dlg2');
  const day = new Date().toLocaleDateString('sv-SE');
  d.innerHTML = `<h2>Ho bevuto questa</h2><p class="info">${esc(name(nb))} ${esc(nb.vintage || '')}</p>
  <label>Data</label><input id="dr_d" type="date" value="${day}">
  <label>Voto</label><select id="dr_r"><option value="0">Nessun voto</option>${[1, 2, 3, 4, 5].map((n) => `<option value="${n}">${'★'.repeat(n)} (${n})</option>`).join('')}</select>
  <label>Note di degustazione</label><textarea id="dr_n" rows="4" placeholder="Come l'hai trovata, con cosa l'hai bevuta…"></textarea>
  <p class="info">La bottiglia lascia lo scaffale e va nell'elenco «Bevute». Potrai rimetterla in cantina dalla sua scheda.</p>
  <div class="acts"><button class="btn pri" id="dr_ok">Salva</button><button class="btn" id="dr_x">Annulla</button></div>`;
  $('#dr_x').onclick = () => d.close();
  $('#dr_ok').onclick = () => {
    const date = $('#dr_d').value || day;
    d.close();
    cb({ ...nb, drunk: { date, rating: +$('#dr_r').value || 0, notes: $('#dr_n').value.trim() }, shelf: null, r: 0, c: 0 });
  };
  d.onclose = null;
  d.showModal();
}

/* ===== Cosa stappo stasera ===== */
let dishText = '', pairHtml = '';
document.addEventListener('input', (e) => { if (e.target && e.target.id === 'dish') dishText = e.target.value; });

function stasera() {
  const c = kind(Date.now()), good = isGood(c);
  const n = Object.values(S.bottles).filter((b) => !b.drunk).length;
  return keyBanner() + `<div class="note"><b>Stasera</b>: la Luna è in ${c[1]}, giorno ${c[2]}. ${good ? 'Buon momento per aprire un vino.' : 'Secondo il calendario biodinamico il vino è più chiuso: se puoi, aspetta.'}</div>
  <label for="dish">Cosa cucini, o con chi mangi?</label>
  <textarea id="dish" rows="3" placeholder="Es. risotto ai funghi, branzino al forno, cena tra amici con salumi…">${esc(dishText)}</textarea>
  <div class="acts"><button class="btn pri" data-a="pair">Consigliami una bottiglia</button></div>
  <p class="info">${n ? `Scelgo tra le ${n} bottiglie in cantina.` : 'Non hai ancora bottiglie in cantina.'}${aiReady() ? '' : ' Senza chiave dell\'IA uso un criterio semplice, basato sugli abbinamenti salvati.'}</p>
  <div id="pairout">${pairHtml}</div>`;
}

function pairCard(b, reason) {
  const st = { 'st-now': 'Pronta da bere', 'st-wait': 'Da aspettare', 'st-past': 'Oltre il picco' }[status(b)] || '';
  return `<button class="row pick" data-a="open" data-id="${esc(b.id)}"><span style="display:flex;gap:12px">${imgSrc(b) ? `<img class="th" src="${imgSrc(b)}" alt="">` : '<span class="th"></span>'}<span><b>${esc(name(b))} ${esc(b.vintage || '')}</b><small>${esc(posText(b))}${st ? ' · ' + st : ''}</small>${reason ? `<span class="why">${esc(reason)}</span>` : ''}</span></span></button>`;
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
  const cellar = Object.values(S.bottles).filter((b) => !b.drunk);
  if (!cellar.length) { pairHtml = '<p class="empty">Non hai ancora bottiglie in cantina.</p>'; out.innerHTML = pairHtml; return; }
  if (!dishText.trim()) { out.innerHTML = '<p class="info">Scrivi prima cosa cucini.</p>'; return; }
  const rank = { 'st-now': 0, '': 1, 'st-wait': 2, 'st-past': 2 };
  const cands = cellar.slice().sort((a, b) => rank[status(a)] - rank[status(b)]).slice(0, 80);
  const c = kind(Date.now()), good = isGood(c);
  let picks = null, note = '';
  if (aiReady()) {
    out.innerHTML = '<p class="info">Sto scegliendo…</p>';
    try {
      const lab = { 'st-now': 'pronta da bere', 'st-wait': 'da aspettare', 'st-past': 'oltre il picco' };
      const list = cands.map((b) => ({ id: b.id, nome: name(b), annata: b.vintage || null, tipo: b.type, zona: b.region || '', stato: lab[status(b)] || '', abbinamenti: (b.pairing || '').slice(0, 140), note: (b.winfo || '').slice(0, 120) }));
      const j = await aiJson(`Sei un sommelier. Devo mangiare questo: "${dishText.trim()}". Oggi la Luna è in ${c[1]} (giorno ${c[2]}, ${good ? 'favorevole' : 'poco favorevole'} per bere secondo il calendario biodinamico: puoi citarlo in una frase al massimo, senza dargli troppo peso).
Scegli da 1 a 3 bottiglie SOLO da questa lista, usando gli id esatti, preferendo quelle pronte da bere e con un abbinamento coerente. Per ognuna spiega in 1-2 frasi concrete perché va col piatto. Non inventare dati sul vino che non sono nella lista. Rispondi solo con JSON: {"picks":[{"id":string,"reason":string}],"note":string}.
Lista: ${JSON.stringify(list)}`);
      picks = (j.picks || []).filter((p) => S.bottles[p.id] && !S.bottles[p.id].drunk).slice(0, 3);
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
  Object.values(S.bottles).filter((b) => !b.drunk).forEach((b) => {
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
      col(36, cut(name(b), 38)); col(212, b.vintage || ''); col(244, cut(b.type, 9)); col(286, cut(b.region || '', 24)); col(396, shelfName(b).slice(0, 17)); col(470, drink(b));
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
    const bs = Object.values(S.bottles).filter((b) => !b.drunk).sort((a, b) => key(a).localeCompare(key(b), 'it') || (a.vintage || 0) - (b.vintage || 0));
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
