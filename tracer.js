/* Ricalco del calice: sagoma trovata dai pixel della foto + ritocco a mano trascinando i punti.
   Il profilo è metà calice, specchiato: bowl = [[y, mezza_larghezza], ...] in frazioni dell'altezza totale
   (bocca y=0, piede y=1), bowlEnd = dove inizia lo stelo, base = mezza larghezza del piede. */

const imgFrom = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('immagine non leggibile')); i.src = src; });

// Semplifica una linea tenendo gli spigoli (Ramer-Douglas-Peucker).
function rdp(pts, eps) {
  if (pts.length < 3) return pts.slice();
  const [a, b] = [pts[0], pts[pts.length - 1]];
  let idx = -1, dmax = 0;
  const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = Math.abs(dy * pts[i][0] - dx * pts[i][1] + b[0] * a[1] - b[1] * a[0]) / L;
    if (d > dmax) { dmax = d; idx = i; }
  }
  if (dmax <= eps) return [a, b];
  return rdp(pts.slice(0, idx + 1), eps).slice(0, -1).concat(rdp(pts.slice(idx), eps));
}
function simplifyProfile(line) {
  let eps = 0.007, out = rdp(line, eps);
  while (out.length > 12 && eps < 0.05) { eps *= 1.3; out = rdp(line, eps); }
  // niente punti ammucchiati: almeno il 3% dell'altezza tra uno e l'altro (tengo sempre il primo e l'ultimo)
  const kept = [out[0]];
  for (let i = 1; i < out.length - 1; i++) if (out[i][0] - kept[kept.length - 1][0] >= 0.03) kept.push(out[i]);
  const last = out[out.length - 1];
  if (kept.length > 1 && last[0] - kept[kept.length - 1][0] < 0.03) kept.pop();
  kept.push(last);
  return kept.map((q) => [+q[0].toFixed(4), +q[1].toFixed(4)]);
}

// Profilo di partenza dal disegno standard di una forma.
function shapeProfile(shape) {
  const g = GSHAPE[shape] || GSHAPE.universale;
  const ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg'), p = document.createElementNS(ns, 'path');
  p.setAttribute('d', g.p); svg.appendChild(p);
  svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden'; document.body.appendChild(svg);
  const len = p.getTotalLength(), pts = [];
  for (let i = 0; i <= 240; i++) { const q = p.getPointAtLength((len * i) / 240); if (q.x >= 40) pts.push([q.y, q.x - 40]); }
  svg.remove();
  const top = Math.min(...pts.map((q) => q[0])), H = 130 - top;
  pts.sort((a, b) => a[0] - b[0]);
  const line = pts.map((q) => [(q[0] - top) / H, q[1] / H]);
  const end = (g.b - top) / H;
  line.push([end, 0.012]);
  return { bowl: simplifyProfile(line.filter((q) => q[0] <= end)), bowlEnd: +end.toFixed(4), base: +((g.base || 21) / H).toFixed(4) };
}

// Ricalco automatico dai pixel. src: immagine già ritagliata attorno al calice.
async function autoTrace(src) {
  const im = await imgFrom(src);
  const W = im.naturalWidth, H = im.naturalHeight;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(im, 0, 0);
  const D = x.getImageData(0, 0, W, H).data, N = W * H;
  const gray = new Float32Array(N);
  for (let i = 0; i < N; i++) gray[i] = 0.299 * D[i * 4] + 0.587 * D[i * 4 + 1] + 0.114 * D[i * 4 + 2];
  // sfondo: colore mediano dei bordi
  const border = [];
  for (let xx = 0; xx < W; xx += 3) { border.push(xx, (H - 1) * W + xx, 2 * W + xx); }
  for (let yy = 0; yy < H; yy += 3) { border.push(yy * W, yy * W + W - 1, yy * W + 2, yy * W + W - 3); }
  const ch = (k) => border.map((i) => D[i * 4 + k]).sort((a, b) => a - b)[border.length >> 1];
  const bg = [ch(0), ch(1), ch(2)];
  const devs = border.map((i) => Math.hypot(D[i * 4] - bg[0], D[i * 4 + 1] - bg[1], D[i * 4 + 2] - bg[2])).sort((a, b) => a - b);
  const bgNoise = devs[Math.floor(devs.length * 0.9)];
  // bordi (Sobel)
  const sob = new Float32Array(N);
  for (let yy = 1; yy < H - 1; yy++) for (let xx = 1; xx < W - 1; xx++) {
    const i = yy * W + xx;
    const gx = gray[i - W + 1] + 2 * gray[i + 1] + gray[i + W + 1] - gray[i - W - 1] - 2 * gray[i - 1] - gray[i + W - 1];
    const gy = gray[i + W - 1] + 2 * gray[i + W] + gray[i + W + 1] - gray[i - W - 1] - 2 * gray[i - W] - gray[i - W + 1];
    sob[i] = Math.hypot(gx, gy);
  }
  const sb = Array.from(sob.filter((_, i) => i % 7 === 0)).sort((a, b) => a - b);
  const edgeThr = Math.max(60, sb[Math.floor(sb.length * 0.9)] * 1.1);
  const colThr = Math.max(26, bgNoise * 1.6);
  const fg = (i) => sob[i] > edgeThr || Math.hypot(D[i * 4] - bg[0], D[i * 4 + 1] - bg[1], D[i * 4 + 2] - bg[2]) > colThr;
  // per ogni riga, estremi sinistro e destro del calice
  const m = 4, L = new Int32Array(H).fill(-1), R = new Int32Array(H).fill(-1);
  for (let yy = m; yy < H - m; yy++) {
    const xs = [];
    for (let xx = m; xx < W - m; xx++) if (fg(yy * W + xx)) xs.push(xx);
    if (xs.length < 2) continue;
    L[yy] = xs[Math.floor(xs.length * 0.03)]; R[yy] = xs[Math.ceil(xs.length * 0.97) - 1];
  }
  const rows = [];
  for (let yy = 0; yy < H; yy++) if (L[yy] >= 0) rows.push(yy);
  if (rows.length < H * 0.3) throw new Error('sagoma non trovata');
  // asse: centro mediano nella metà bassa (stelo e piede sono i più affidabili)
  const lower = rows.filter((yy) => yy > rows[0] + (rows[rows.length - 1] - rows[0]) * 0.55);
  const cs = (lower.length ? lower : rows).map((yy) => (L[yy] + R[yy]) / 2).sort((a, b) => a - b);
  const axis = cs[cs.length >> 1];
  const hwRaw = new Float32Array(H).fill(NaN);
  rows.forEach((yy) => {
    const a = axis - L[yy], b = R[yy] - axis;
    hwRaw[yy] = a > 0 && b > 0 ? (Math.abs(a - b) / Math.max(a, b) < 0.22 ? (a + b) / 2 : Math.min(a, b)) : Math.max(a, b, 1);
  });
  // primo e ultimo tratto continuo
  let top = -1, bottom = -1;
  for (let yy = 0; yy < H - 3; yy++) if (!isNaN(hwRaw[yy]) && !isNaN(hwRaw[yy + 1]) && !isNaN(hwRaw[yy + 2])) { top = yy; break; }
  for (let yy = H - 1; yy > 3; yy--) if (!isNaN(hwRaw[yy]) && !isNaN(hwRaw[yy - 1]) && !isNaN(hwRaw[yy - 2])) { bottom = yy; break; }
  const Hp = bottom - top;
  if (top < 0 || Hp < H * 0.35) throw new Error('sagoma non trovata');
  // mediana mobile per togliere i riflessi
  const hw = [];
  for (let yy = top; yy <= bottom; yy++) {
    const win = [];
    for (let k = -4; k <= 4; k++) { const v = hwRaw[yy + k]; if (!isNaN(v)) win.push(v); }
    win.sort((a, b) => a - b);
    hw.push(win.length ? win[win.length >> 1] : 0);
  }
  const at = (yy) => hw[yy - top];
  let maxHW = 0, maxY = top;
  for (let yy = top; yy < top + Hp * 0.75; yy++) if (at(yy) > maxHW) { maxHW = at(yy); maxY = yy; }
  // inizio dello stelo: sotto la parte più larga, la sagoma diventa sottilissima
  let stem = -1;
  for (let yy = maxY; yy < bottom - 5; yy++) {
    let ok = true;
    for (let k = 0; k < 6; k++) if (at(yy + k) > maxHW * 0.16) { ok = false; break; }
    if (ok) { stem = yy; break; }
  }
  if (stem < 0) throw new Error('stelo non trovato');
  let base = 0;
  for (let yy = bottom - Math.round(Hp * 0.06); yy <= bottom; yy++) base = Math.max(base, at(yy));
  const line = [];
  for (let yy = top; yy <= stem; yy++) line.push([(yy - top) / Hp, at(yy) / Hp]);
  line[line.length - 1][1] = Math.min(line[line.length - 1][1], 0.015);
  const prof = { bowl: simplifyProfile(line), bowlEnd: +((stem - top) / Hp).toFixed(4), base: +(base / Hp).toFixed(4), px: { top, bottom, axis, W, H } };
  const mw = maxHW / Hp;
  if (mw < 0.08 || mw > 0.7 || prof.bowlEnd < 0.18 || prof.bowlEnd > 0.85) throw new Error('sagoma poco chiara');
  return prof;
}

/* ===== Ritocco a mano ===== */
function openTracer(profile, img, onDone) {
  let d = document.getElementById('dlg3');
  if (!d) { d = document.createElement('dialog'); d.id = 'dlg3'; document.body.appendChild(d); }
  const VW = 450, VH = 600;
  const start = profile && Array.isArray(profile.bowl) && profile.bowl.length >= 2 ? profile : shapeProfile('universale');
  const px = start.px && img ? start.px : null;
  let top = px ? px.top * (VW / px.W) : 60, bottom = px ? px.bottom * (VW / px.W) : 560, axis = px ? px.axis * (VW / px.W) : VW / 2;
  const Hp0 = bottom - top;
  let pts = start.bowl.map((q) => ({ y: top + q[0] * Hp0, x: Math.max(1, q[1] * Hp0) }));
  let base = (start.base || 0.17) * Hp0, sel = -1;
  d.innerHTML = `<h2>Ricalca il calice</h2>
  <p class="info">${img ? 'Trascina i punti dorati sul bordo del calice nella foto: il lato sinistro si sposta da solo. Il punto in basso regola il piede.' : 'Trascina i punti dorati per dare la forma al calice: il lato sinistro si sposta da solo.'}</p>
  <div class="trbox"><svg id="tr_svg" viewBox="0 0 ${VW} ${VH}" role="img" aria-label="Sagoma del calice da ritoccare"></svg></div>
  <div class="acts"><button class="btn" id="tr_add" type="button">Aggiungi punto</button><button class="btn" id="tr_del" type="button" disabled>Togli punto</button>${img ? '<button class="btn" id="tr_auto" type="button">Rifai automatico</button>' : ''}</div>
  <p class="info" id="tr_m"></p>
  <div class="acts"><button class="btn pri" id="tr_ok" type="button">Fatto</button><button class="btn" id="tr_x" type="button">Annulla</button></div>`;
  const svg = $('#tr_svg');
  const draw = () => {
    const stemY = pts[pts.length - 1].y;
    const Lp = pts.map((p) => `${(axis - p.x).toFixed(1)} ${p.y.toFixed(1)}`), Rp = pts.slice().reverse().map((p) => `${(axis + p.x).toFixed(1)} ${p.y.toFixed(1)}`);
    const path = 'M' + Lp.join(' L') + ` L${axis} ${stemY} L` + Rp.join(' L');
    svg.innerHTML = `${img ? `<image href="${img}" x="0" y="0" width="${VW}" height="${VH}" opacity=".55" preserveAspectRatio="xMidYMid slice"/>` : `<rect width="${VW}" height="${VH}" fill="#151211"/>`}
      <line x1="${axis}" y1="0" x2="${axis}" y2="${VH}" stroke="#E3E9EE" stroke-dasharray="4 6" opacity=".35"/>
      <path d="${path}" fill="rgba(255,255,255,.08)" stroke="#F4F7FA" stroke-width="3" stroke-linejoin="round"/>
      <line x1="${axis}" y1="${stemY}" x2="${axis}" y2="${bottom}" stroke="#E3E9EE" stroke-width="3"/>
      <ellipse cx="${axis}" cy="${bottom}" rx="${base}" ry="7" fill="none" stroke="#E3E9EE" stroke-width="3"/>
      ${pts.map((p, i) => `<g class="h${i === sel ? ' sel' : ''}" data-i="${i}"><circle cx="${axis + p.x}" cy="${p.y}" r="22" fill="transparent"/><circle cx="${axis + p.x}" cy="${p.y}" r="${i === sel ? 10 : 8}" fill="var(--gold)" stroke="#121010" stroke-width="2.5"/></g>`).join('')}
      <g class="h" data-i="foot"><circle cx="${axis + base}" cy="${bottom}" r="22" fill="transparent"/><rect x="${axis + base - 8}" y="${bottom - 8}" width="16" height="16" rx="3" fill="var(--gold)" stroke="#121010" stroke-width="2.5"/></g>
      <g class="h" data-i="axis"><circle cx="${axis}" cy="${bottom + 22}" r="20" fill="transparent"/><path d="M${axis - 12} ${bottom + 22} h24 M${axis - 12} ${bottom + 22} l6 -5 M${axis - 12} ${bottom + 22} l6 5 M${axis + 12} ${bottom + 22} l-6 -5 M${axis + 12} ${bottom + 22} l-6 5" stroke="var(--gold)" stroke-width="2.5" fill="none"/></g>`;
    $('#tr_del').disabled = !(sel > 0 && sel < pts.length - 1 && pts.length > 3);
  };
  const toSvg = (e) => { const p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY; return p.matrixTransform(svg.getScreenCTM().inverse()); };
  let drag = null;
  svg.addEventListener('pointerdown', (e) => {
    const h = e.target.closest('.h'); if (!h) return;
    e.preventDefault();
    drag = h.dataset.i;
    if (drag !== 'foot' && drag !== 'axis') { sel = +drag; draw(); }
    svg.setPointerCapture(e.pointerId);
  });
  svg.addEventListener('pointermove', (e) => {
    if (drag === null) return;
    const q = toSvg(e);
    if (drag === 'foot') { base = Math.max(6, Math.abs(q.x - axis)); bottom = Math.min(VH - 30, Math.max(pts[pts.length - 1].y + 20, q.y)); }
    else if (drag === 'axis') axis = Math.max(40, Math.min(VW - 40, q.x));
    else {
      const i = +drag, p = pts[i];
      p.x = Math.max(1, Math.min(VW / 2, q.x - axis));
      const lo = i > 0 ? pts[i - 1].y + 2 : 4, hi = i < pts.length - 1 ? pts[i + 1].y - 2 : bottom - 20;
      p.y = Math.max(lo, Math.min(hi, q.y));
    }
    draw();
  });
  const end = () => { if (drag !== null) haptic(); drag = null; };
  svg.addEventListener('pointerup', end); svg.addEventListener('pointercancel', end);
  svg.style.touchAction = 'none';
  $('#tr_add').onclick = () => {
    let gi = 0, gap = 0;
    for (let i = 0; i < pts.length - 1; i++) { const g = pts[i + 1].y - pts[i].y; if (g > gap) { gap = g; gi = i; } }
    pts.splice(gi + 1, 0, { y: (pts[gi].y + pts[gi + 1].y) / 2, x: (pts[gi].x + pts[gi + 1].x) / 2 });
    sel = gi + 1; draw();
  };
  $('#tr_del').onclick = () => { if (sel > 0 && sel < pts.length - 1 && pts.length > 3) { pts.splice(sel, 1); sel = -1; draw(); } };
  if ($('#tr_auto')) $('#tr_auto').onclick = async () => {
    $('#tr_m').textContent = 'Ricalco…';
    try {
      const p2 = await autoTrace(img), k = VW / p2.px.W;
      top = p2.px.top * k; bottom = p2.px.bottom * k; axis = p2.px.axis * k;
      const Hh = bottom - top;
      pts = p2.bowl.map((q) => ({ y: top + q[0] * Hh, x: Math.max(1, q[1] * Hh) })); base = p2.base * Hh; sel = -1;
      draw(); $('#tr_m').textContent = 'Fatto: ritocca i punti se serve.';
    } catch (e) { $('#tr_m').textContent = 'Non riesco a trovare i bordi in questa foto (' + e.message + '): sistemali a mano, oppure rifai la foto su sfondo scuro e uniforme.'; }
  };
  $('#tr_x').onclick = () => d.close();
  $('#tr_ok').onclick = () => {
    const Hh = bottom - pts[0].y, t0 = pts[0].y;
    const prof = { bowl: pts.map((p) => [+((p.y - t0) / Hh).toFixed(4), +(p.x / Hh).toFixed(4)]), bowlEnd: +((pts[pts.length - 1].y - t0) / Hh).toFixed(4), base: +(base / Hh).toFixed(4) };
    d.close(); haptic(); onDone(prof);
  };
  d.onclose = null;
  draw();
  d.showModal();
}
