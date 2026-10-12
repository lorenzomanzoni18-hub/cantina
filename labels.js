/* Etichette di qualità da internet: galleria di tutti i vini e scelta dell'etichetta migliore. */

// Le immagini di altri siti passano da wsrv.nl, che le ridimensiona e le rende utilizzabili dall'app
const viaProxy = (u, w, h) => 'https://wsrv.nl/?url=' + encodeURIComponent(String(u).replace(/^https?:\/\//, '')) + '&w=' + (w || 1600) + (h ? '&h=' + h + '&fit=inside' : '') + '&output=jpg&q=90';
async function fetchImg(u) {
  for (const src of [viaProxy(u, 1600, 1600), u]) {
    try { const r = await fetch(src, { mode: 'cors' }); if (r.ok) { const bl = await r.blob(); if (bl.type.startsWith('image/') && bl.size > 3000) return bl; } } catch (_) {}
  }
  return null;
}
// controlla che l'immagine esista davvero e non sia minuscola
const probeImg = (u) => new Promise((res) => {
  const im = new Image(); let done = false;
  const end = (ok) => { if (!done) { done = true; res(ok ? { u, w: im.naturalWidth, h: im.naturalHeight } : null); } };
  im.onload = () => end(im.naturalWidth >= 150 && im.naturalHeight >= 200);
  im.onerror = () => end(false);
  setTimeout(() => end(false), 9000);
  im.src = viaProxy(u, 400);
});

async function findLabelImages(b) {
  const wine = [b.producer, b.cuvee].filter(Boolean).join(' ');
  const r = await aiSearch(`Trova sul web 4-8 immagini ad alta risoluzione della bottiglia o dell'etichetta frontale di questo vino: ${wine}${b.region ? ' (' + b.region + ')' : ''}. Va bene anche un'annata diversa${b.vintage ? ' (ideale ' + b.vintage + ')' : ''}: conta che si veda bene l'etichetta. Preferisci foto da catalogo su fondo chiaro: sito del produttore, Vivino, Wine-Searcher, enoteche online, importatori.
Rispondi SOLO con JSON: {"images":[{"url":"URL diretto del file immagine (.jpg .png .webp)","source":"nome del sito"}]}
Metti solo indirizzi di immagini che compaiono davvero nelle pagine che hai visto: niente indirizzi inventati.`, 3);
  const j = parseJsonLoose(r.text) || {};
  let urls = (j.images || []).map((x) => x && x.url).filter(Boolean);
  urls = urls.concat((r.text.match(/https?:\/\/[^\s"'<>)]+\.(?:jpe?g|png|webp)(?:\?[^\s"'<>)]*)?/gi) || []));
  urls = [...new Set(urls.map((u) => u.trim()))].slice(0, 12);
  const ok = (await Promise.all(urls.map(probeImg))).filter(Boolean);
  return { found: ok, pages: r.links || [] };
}

// trova il riquadro dell'etichetta in una foto da catalogo (costa una frazione di centesimo)
async function labelBoxOf(blob) {
  if (!aiReady()) return null;
  try {
    const j = await aiJson('Questa è la foto di una bottiglia di vino o di un\'etichetta. Rispondi solo con JSON {"label_box_2d":[ymin,xmin,ymax,xmax]} con numeri interi da 0 a 1000: il rettangolo stretto dell\'etichetta frontale principale. null se non si vede.', await toB64(blob, 1000));
    return normBox(j.label_box_2d) ? j.label_box_2d : null;
  } catch (_) { return null; }
}

// salva l'immagine come foto ed etichetta di tutto il gruppo di bottiglie uguali
async function saveLabelFor(b, blob) {
  const full = await canvasBlob(await drawCrop(blob, null, 1600), 0.9);
  const box = await labelBoxOf(full);
  const thumb = await makeLabelThumb(full, box);
  await dbPut('photos', full, b.id + ':c'); await dbDel('photos', b.id + ':f');
  for (const x of siblings(b)) { await dbDel('photos', x.id + ':c'); await dbDel('photos', x.id + ':f'); }
  const nb = { ...S.bottles[b.id], thumb, useFull: false, labelWeb: true };
  await persistBottle(nb); await syncGroup(nb);
  return nb;
}

function labelPicker(b0, after, onBlob) {
  let d = document.getElementById('dlg5');
  if (!d) { d = document.createElement('dialog'); d.id = 'dlg5'; document.body.append(d); }
  const b = S.bottles[b0.id] || b0;
  const q = encodeURIComponent([b.producer, b.cuvee, 'bottiglia etichetta'].filter(Boolean).join(' '));
  d.innerHTML = `<p class="eyebrow">Etichetta</p><h2 class="dtitle">${esc(name(b))}${b.vintage ? ' ' + esc(b.vintage) : ''}</h2>
  <div class="lp-cur">${b.thumb ? `<img src="${b.thumb}" alt="Etichetta attuale">` : '<span class="lp-none">Nessuna etichetta</span>'}</div>
  <div class="acts"><button class="btn pri" id="lp_ai" type="button">Cerca etichette online con l'IA</button></div>
  <p class="info" id="lp_m">Va bene anche un'annata diversa: l'importante è che sia bella e leggibile.</p>
  <div class="lp-grid" id="lp_g"></div>
  <details class="more"><summary>Cercala tu su Google Immagini</summary>
    <ol class="lp-how"><li>Apri Google Immagini, tocca l'immagine più bella e tienila premuta › <b>Copia</b>.</li><li>Torna qui e premi <b>Incolla l'immagine</b>.</li></ol>
    <div class="acts"><a class="btn" target="_blank" rel="noopener" href="https://www.google.com/search?tbm=isch&tbs=isz:l&q=${q}">Apri Google Immagini</a><button class="btn" id="lp_paste" type="button">Incolla l'immagine</button><label class="btn">Dalla galleria<input type="file" accept="image/*" hidden id="lp_file"></label></div>
  </details>`;
  const m = (t) => { $('#lp_m').textContent = t; };
  const use = async (getBlob) => {
    m('Preparo l\'etichetta…');
    try {
      const bl = await getBlob();
      if (!bl) { m('Questa immagine non si riesce a scaricare: scegline un\'altra, oppure copiala da Google Immagini e incollala.'); return; }
      if (onBlob) { await onBlob(bl); d.close(); return; }
      await saveLabelFor(b, bl);
      d.close(); render(); if (after) after();
      msg('Etichetta aggiornata: ' + esc(name(b)) + '.'); setTimeout(() => msg(''), 4000);
    } catch (e) { m('Non riuscito: ' + e.message); }
  };
  $('#lp_ai').onclick = async () => {
    if (!aiReady()) { m('Serve la chiave dell\'IA: aprila dalle Impostazioni, oppure cercala tu su Google Immagini qui sotto.'); return; }
    $('#lp_ai').disabled = true; m('Cerco le etichette online… può volerci mezzo minuto.');
    try {
      const r = await findLabelImages(b);
      if (!r.found.length) { m('Non ho trovato immagini utilizzabili. Prova con Google Immagini qui sotto: ci vuole un attimo.'); d.querySelector('details.more').open = true; }
      else {
        m('Tocca quella che preferisci.');
        $('#lp_g').innerHTML = r.found.map((x, i) => `<button class="lp-it" type="button" data-i="${i}"><img src="${viaProxy(x.u, 400)}" alt="" loading="lazy"><small>${x.w}×${x.h}</small></button>`).join('');
        $('#lp_g').querySelectorAll('.lp-it').forEach((el) => { el.onclick = () => use(() => fetchImg(r.found[+el.dataset.i].u)); });
      }
    } catch (e) { m('Ricerca non riuscita: ' + errorHint(e.message)); }
    $('#lp_ai').disabled = false;
  };
  $('#lp_paste').onclick = () => use(async () => {
    for (const it of await navigator.clipboard.read()) { const ty = it.types.find((t) => t.startsWith('image/')); if (ty) return await it.getType(ty); }
    throw new Error('negli appunti non c\'è nessuna immagine: in Google Immagini tieni premuta l\'immagine e scegli Copia.');
  });
  $('#lp_file').onchange = (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) use(async () => f); };
  d.onclose = null;
  if (!d.open) d.showModal();
}

// Galleria di tutte le etichette: tocchi un vino e la cambi
function labelGallery() {
  const d = $('#dlg2');
  const draw = () => {
    const ws = uniqW(Object.values(S.bottles).filter((b) => (b.producer || b.cuvee) && !b.drunk))
      .sort((a, b) => (!!a.labelWeb - !!b.labelWeb) || name(a).localeCompare(name(b), 'it'));
    const todo = ws.filter((b) => !b.labelWeb).length;
    d.innerHTML = `<p class="eyebrow">Le tue etichette</p><h2>Etichette</h2>
    <p class="info">${ws.length} vini${todo ? ' · ' + todo + ' con foto tua o senza etichetta, in cima' : ''}. Tocca un vino per mettere un'etichetta più bella presa da internet.</p>
    <div class="lg-grid">${ws.map((b) => `<button class="lg-it" type="button" data-id="${esc(b.id)}">${b.thumb ? `<img src="${b.thumb}" alt="" loading="lazy">` : `<span class="vdot t-${esc(b.type)}">${esc(String(b.vintage || '').slice(-2))}</span>`}<b>${esc(b.producer || name(b))}</b><small>${esc([b.cuvee, b.vintage].filter(Boolean).join(' '))}</small>${b.labelWeb ? '<i class="lg-ok">da internet</i>' : ''}</button>`).join('')}</div>`;
    d.querySelectorAll('.lg-it').forEach((el) => { el.onclick = () => labelPicker(S.bottles[el.dataset.id], draw); });
  };
  draw();
  d.onclose = null;
  if (!d.open) d.showModal();
}
document.addEventListener('click', (e) => { const t = e.target.closest && e.target.closest('[data-a="labels"]'); if (t) { e.preventDefault(); labelGallery(); } });
