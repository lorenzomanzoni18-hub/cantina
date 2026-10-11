/* Pagina produttore e uscite dalla cantina (bevuta, regalata, portata a una cena, venduta, persa). */

/* ===== Uscite ===== */
const EXITS = [['bevuta', 'Bevuta'], ['regalata', 'Regalata'], ['cena', 'Portata a una cena'], ['venduta', 'Venduta'], ['persa', 'Rotta o andata a male']];
const exitHow = (b) => (b && b.drunk && b.drunk.how) || 'bevuta';
const isDrinkExit = (b) => !!(b && b.drunk) && exitHow(b) === 'bevuta';
function exitLabel(b) {
  const d = b.drunk || {}, to = d.to ? String(d.to) : '';
  return { bevuta: 'Bevuta', regalata: 'Regalata' + (to ? ' a ' + to : ''), cena: 'Portata a una cena' + (to ? ' (' + to + ')' : ''), venduta: 'Venduta' + (to ? ' a ' + to : ''), persa: 'Rotta o andata a male' }[exitHow(b)] || 'Uscita';
}

/* ===== Pagina produttore ===== */
const sameProd = (a, b) => nrm(a).replace(/[^a-z0-9]/g, '') === nrm(b).replace(/[^a-z0-9]/g, '');
function producerPage(prod) {
  const d = $('#dlg2');
  const all = Object.values(S.bottles).filter((b) => b.producer && sameProd(b.producer, prod));
  if (!all.length) return;
  const P = all[0].producer;
  const inC = all.filter(inCellar), drunk = all.filter((b) => b.drunk), pend = all.filter((b) => !b.drunk && b.pending), wish = all.filter((b) => !b.drunk && b.wish);
  const rated = all.flatMap((b) => tastingsOf(b)).filter((t) => t.rating);
  const avg = rated.length ? rated.reduce((s, t) => s + t.rating, 0) / rated.length : 0;
  const val = inC.reduce((s, b) => s + (b.value ?? b.price ?? 0), 0);
  const zones = [...new Set(all.map((b) => b.region).filter(Boolean))];
  const infoB = all.find((b) => b.info && b.info.trim());
  // vini raggruppati per cuvée, con le annate
  const cuv = new Map();
  all.forEach((b) => { const k = (b.cuvee || '—').trim(); if (!cuv.has(k)) cuv.set(k, []); cuv.get(k).push(b); });
  const st = { 'st-now': 'pronta', 'st-wait': 'da aspettare', 'st-past': 'da aprire presto' };
  const blocks = [...cuv.entries()].sort((a, b) => a[0].localeCompare(b[0], 'it')).map(([c, bs]) => {
    const byV = new Map();
    bs.forEach((b) => { const v = b.vintage || 'SA'; if (!byV.has(v)) byV.set(v, []); byV.get(v).push(b); });
    const rows = [...byV.entries()].sort((a, b) => String(b[0]).localeCompare(String(a[0]))).map(([v, g]) => {
      const n = g.filter(inCellar).length, dr = g.filter((x) => x.drunk).length, b0 = g.find(inCellar) || g[0];
      const sub = [n ? n + ' in cantina' : '', dr ? dr + (dr === 1 ? ' uscita' : ' uscite') : '', g.some((x) => !x.drunk && x.pending) ? 'in arrivo' : '', g.some((x) => !x.drunk && x.wish) ? 'nei desideri' : '', n && st[status(b0)] ? st[status(b0)] : ''].filter(Boolean).join(' · ');
      return `<button class="row" data-a="openp" data-id="${esc(b0.id)}"><span>${esc(v === 'SA' ? 'Senza annata' : v)}<small>${esc(sub)}</small></span><span>${n ? eur(b0.value ?? b0.price) : ''}</span></button>`;
    }).join('');
    return `<h3 class="letter">${esc(c)}</h3>${rows}`;
  }).join('');
  d.innerHTML = `<p class="eyebrow">Produttore</p><h2 class="dtitle">${esc(P)}</h2>
  ${zones.length ? `<div class="chips">${zones.map((z) => `<span>${esc(z)}</span>`).join('')}</div>` : ''}
  <div class="tiles">
    <div class="tile"><b>${inC.length}</b><span>in cantina</span></div>
    <div class="tile"><b>${eur(val)}</b><span>valore</span></div>
    <div class="tile"><b>${drunk.length}</b><span>uscite</span></div>
    <div class="tile"><b>${avg ? avg.toFixed(1).replace('.', ',') + ' ★' : '–'}</b><span>voto medio</span></div>
  </div>
  ${pend.length || wish.length ? `<p class="info">${[pend.length ? pend.length + ' in arrivo' : '', wish.length ? uniqW(wish).length + ' nei desideri' : ''].filter(Boolean).join(' · ')}</p>` : ''}
  <div class="svc"><p><span class="svk">Il produttore</span><span id="pr_info">${infoB ? esc(infoB.info) : 'Nessuna informazione ancora.'}</span></p></div>
  ${!infoB && aiReady() ? `<div class="acts"><button class="btn" id="pr_ai" type="button">Cerca informazioni sul produttore</button></div>` : ''}
  <p class="info" id="pr_m"></p>
  <h3 class="sub">I vini</h3>${blocks}
  <div class="acts" style="margin-top:14px"><button class="btn" id="pr_x" type="button">Chiudi</button></div>`;
  $('#pr_x').onclick = () => d.close();
  if ($('#pr_ai')) $('#pr_ai').onclick = async () => {
    const m = $('#pr_m'); m.textContent = 'Cerco informazioni…'; $('#pr_ai').disabled = true;
    aiWaitNote = (s) => { m.textContent = 'Gemini chiede una pausa: riprovo tra ' + s + ' secondi…'; };
    try {
      const j = await aiJson(`Scrivi in italiano 4-6 frasi sul produttore di vino "${P}"${zones.length ? ' (' + zones.join(', ') + ')' : ''}: dove si trova, storia, filosofia, stile dei vini, vini più noti. Non inventare: se non lo conosci con certezza, scrivi informazioni generali sulla zona e inizia con "Indicazione generica:". Rispondi solo con JSON {"producer_info": string}`);
      const txt = String(j.producer_info || '').trim();
      if (!txt) throw new Error('risposta vuota');
      for (const b of all) if (!b.info && !(b.touched || []).includes('info')) await persistBottle({ ...b, info: txt });
      $('#pr_info').textContent = txt; m.textContent = 'Informazioni salvate su tutte le bottiglie di ' + P + '. Sono stime dell\'IA: controllale.'; $('#pr_ai').remove();
    } catch (e) { m.textContent = 'Non riuscito: ' + errorHint(e.message); $('#pr_ai').disabled = false; }
    aiWaitNote = null;
  };
  d.onclose = null;
  if (!d.open) d.showModal();
}
