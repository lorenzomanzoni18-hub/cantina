/* Cantina in 3D: gli scaffali come sono davvero (cantina e casa), con i consigli per riordinarli.
   I consigli spostano le bottiglie solo dentro la cantina: il frigorifero di casa non si tocca. */

/* ---- come sono disposti gli scaffali ---- */
const isFridgeName = (n) => /frigo|cantinett|climatizz/i.test(n || '');
function shelfLoc(s) { return s.loc || (isFridgeName(s.name) ? 'casa' : 'cantina'); }
function shelfOrd(s, i) {
  if (Number.isFinite(s.ord)) return s.ord;
  const n = nrm(s.name);
  return /bollic|spumant|champ|bolle/.test(n) ? 0 : /bianc/.test(n) ? 1 : /rosat/.test(n) ? 2 : /ross/.test(n) ? 3 : 4 + i / 100;
}
// zone di temperatura: per un frigorifero senza impostazioni, metà alta a 12 °C e metà bassa a 14 °C
function shelfZones(s) {
  if (Array.isArray(s.zones)) return s.zones;
  if (shelfLoc(s) !== 'casa' || !isFridgeName(s.name)) return [];
  const h = Math.ceil(s.rows / 2);
  return [{ from: 0, to: h - 1, t: 12 }, { from: h, to: s.rows - 1, t: 14 }];
}
const zonesText = (s) => shelfZones(s).map((z) => (z.from === z.to ? 'riga ' + (z.from + 1) : 'righe ' + (z.from + 1) + '-' + (z.to + 1)) + ' a ' + z.t + ' °C').join(', ');
function orderedShelves() {
  const all = S.shelves.map((s, i) => ({ s, i, loc: shelfLoc(s), ord: shelfOrd(s, i) }));
  const by = (a, b) => a.ord - b.ord || a.i - b.i;
  return { cantina: all.filter((x) => x.loc === 'cantina').sort(by).map((x) => x.s), casa: all.filter((x) => x.loc === 'casa').sort(by).map((x) => x.s) };
}

/* ---- zona di provenienza, per raggruppare ---- */

// forma dello scaffale: "onda" = ripiani in legno sagomati, "moduli" = moduli a griglia da 3 posti, "griglia" = reticolo semplice
function shelfStyle(s) {
  if (s.style) return s.style;
  const n = nrm(s.name);
  if (/ross/.test(n) && s.cols % 3 === 0) return 'moduli';
  if (/bollic|bianc|bolle/.test(n)) return 'onda';
  return 'griglia';
}

/* ---- pagina ---- */
let v3 = null; // scena attiva
const shName = (id) => { const s = S.shelves.find((x) => x.id === id); return s ? s.name : '—'; };
const posLabel = (b) => shName(b.shelf) + ' · riga ' + (b.r + 1) + ', posto ' + (b.c + 1);
const in3d = () => Object.values(S.bottles).filter((b) => inCellar(b) && b.shelf && S.shelves.some((s) => s.id === b.shelf));

function page3d() {
  const { cantina, casa } = orderedShelves();
  if (!S.shelves.length) return '<p class="empty">Crea prima uno scaffale dalla pagina Cantina.</p>';
  return `<div class="fchips v3chips">${cantina.length ? '<button class="fchip on" type="button" data-v3f="cantina">Cantina</button>' : ''}<button class="fchip${cantina.length ? '' : ' on'}" type="button" data-v3f="all">Tutto</button>${cantina.map((s) => `<button class="fchip" type="button" data-v3f="${esc(s.id)}">${esc(s.name)}</button>`).join('')}${casa.map((s) => `<button class="fchip" type="button" data-v3f="${esc(s.id)}">${esc(s.name)}</button>`).join('')}</div>
  <div class="v3find"><input id="v3q" type="search" placeholder="Trova una bottiglia: produttore, vino, annata" autocomplete="off"><div id="v3res" class="v3res"></div></div>
  <div class="v3stage" id="v3stage"><p class="v3load" id="v3load">Preparo la scena…</p>
    <div class="v3tools"><button type="button" class="v3tool" data-v3z="in" aria-label="Avvicina">+</button><button type="button" class="v3tool" data-v3z="out" aria-label="Allontana">−</button><button type="button" class="v3tool" data-v3z="reset" aria-label="Vista di fronte">⟲</button></div>
    <div class="v3hint">Un dito: gira · due dita: sposta e ingrandisci · tocca una bottiglia</div></div>
  <div class="v3card" id="v3card"><b>Tocca una bottiglia</b><small>Ti dico qual è e dove si trova. Puoi anche cercarla qui sopra.</small></div>
  <p class="info">In cantina, da sinistra: ${cantina.map((s) => esc(s.name)).join(' · ') || '—'}.${casa.length ? ' In casa: ' + casa.map((s) => esc(s.name) + (zonesText(s) ? ' (' + esc(zonesText(s)) + ')' : '')).join(', ') + '.' : ''} <button class="link" type="button" data-a="v3layout">Cambia disposizione</button></p>`;
}

function loadThree() {
  if (window.THREE) return Promise.resolve();
  return new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js'; s.onload = res; s.onerror = () => rej(new Error('Non riesco a caricare la grafica 3D: controlla la connessione.')); document.head.append(s); });
}
const T3 = { rosso: '#8A2A42', bianco: '#D6BE74', bollicine: '#7FA890', rosato: '#D98B8B', altro: '#8C948F' };
const GL3 = { rosso: 0x1d2a18, bianco: 0x3a4a2a, bollicine: 0x1f3322, rosato: 0x6b4a46, altro: 0x3a3a36 };
const isPando = (s) => shelfLoc(s) === 'casa';

async function init3d() {
  const stage = document.getElementById('v3stage');
  if (!stage) return;
  if (v3) { v3.stop(); v3 = null; }
  try { await loadThree(); } catch (e) { const l = document.getElementById('v3load'); if (l) l.textContent = e.message; return; }
  if (!document.body.contains(stage)) return;
  const ld = document.getElementById('v3load'); if (ld) ld.remove();
  const { cantina, casa } = orderedShelves();
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  stage.prepend(renderer.domElement);
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(38, 1, 0.1, 500);
  scene.add(new THREE.HemisphereLight(0xfff2e0, 0x201410, 0.8));
  const key = new THREE.DirectionalLight(0xffe7c4, 0.9); key.position.set(-10, 25, 30); scene.add(key);
  const rim = new THREE.DirectionalLight(0xd4af6a, 0.35); rim.position.set(20, 8, -10); scene.add(rim);
  // cantina da sinistra a destra, la cantinetta di casa più in là
  const GAP = 0.6, HOME = 8, RX = {};
  let x = 0;
  cantina.forEach((s) => { RX[s.id] = x; x += s.cols + GAP; });
  const cantW = Math.max(0, x - GAP);
  let hx = cantW + (cantina.length ? HOME : 0);
  casa.forEach((s) => { RX[s.id] = hx; hx += s.cols + GAP + 1.5; });
  const totalW = Math.max(1, hx - GAP), shift = -cantW / 2;
  const SHB = Object.fromEntries(S.shelves.map((s) => [s.id, s]));
  const slotPos = (sid, r, c) => { const s = SHB[sid]; return new THREE.Vector3(shift + RX[sid] + c + 0.5, (s.rows - 1 - r) + 0.75, 0); };
  const mat = (o) => new THREE.MeshStandardMaterial(o);
  const wood = mat({ color: 0x5a3e28, roughness: 0.85 });
  const back = mat({ color: 0x0d0b0a, roughness: 1 });
  const sprite = (t, w, size, col) => {
    const c = document.createElement('canvas'); c.width = 512; c.height = 96; const g = c.getContext('2d');
    g.font = `700 ${size || 58}px "Cormorant Garamond", Georgia, serif`; g.fillStyle = col || '#F2EBE3'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(t, 256, 50);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true })); sp.scale.set(w || 5.2, (w || 5.2) * 96 / 512, 1); return sp;
  };
  const box = (w, h, d, m, px, py, pz) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(px, py, pz); scene.add(o); return o; };
  S.shelves.forEach((s) => {
    if (RX[s.id] == null) return;
    const w = s.cols, h = s.rows, x0 = shift + RX[s.id], cx = x0 + w / 2, cy = h / 2 + 0.25;
    if (isPando(s)) {
      // cantinetta da incasso: mobile della cucina, cornice nera, vetro fumé, maniglia, luce LED
      const cab = mat({ color: 0xcfc6b8, roughness: 0.7 }), blk = mat({ color: 0x111111, roughness: 0.4, metalness: 0.5 }), inner = mat({ color: 0x1a2028, roughness: 0.9 });
      const W = w + 0.6, H = h + 0.8, F = 1.3; // vano interno
      // mobile della cucina intorno: quattro pannelli, non un blocco pieno
      box(F, H + 2 * F, 2.2, cab, cx - W / 2 - F / 2 - 0.25, cy, -0.9); box(F, H + 2 * F, 2.2, cab, cx + W / 2 + F / 2 + 0.25, cy, -0.9);
      box(W + 0.5, F, 2.2, cab, cx, cy + H / 2 + F / 2 + 0.25, -0.9); box(W + 0.5, F, 2.2, cab, cx, cy - H / 2 - F / 2 - 0.25, -0.9);
      // cornice nera della porta
      box(W + 0.5, 0.25, 0.2, blk, cx, cy + H / 2 + 0.12, 0.3); box(W + 0.5, 0.25, 0.2, blk, cx, cy - H / 2 - 0.12, 0.3);
      box(0.25, H + 0.5, 0.2, blk, cx - W / 2 - 0.12, cy, 0.3); box(0.25, H + 0.5, 0.2, blk, cx + W / 2 + 0.12, cy, 0.3);
      // vano: fondo, fianchi, cielo e base scuri
      box(W, H, 0.05, inner, cx, cy, -1.45); box(0.05, H, 1.9, inner, cx - W / 2, cy, -0.5); box(0.05, H, 1.9, inner, cx + W / 2, cy, -0.5);
      box(W, 0.05, 1.9, inner, cx, cy + H / 2, -0.5); box(W, 0.05, 1.9, inner, cx, cy - H / 2, -0.5);
      const glass = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.6, h + 0.8), new THREE.MeshStandardMaterial({ color: 0x223040, transparent: true, opacity: 0.18, roughness: 0.05, metalness: 0.6 }));
      glass.position.set(cx, cy, 0.62); scene.add(glass);
      box(0.12, h * 0.7, 0.18, mat({ color: 0x9a9a9a, metalness: 0.9, roughness: 0.25 }), cx + (w + 0.6) / 2 - 0.25, cy, 0.85);
      box(w + 0.4, 0.06, 0.06, new THREE.MeshBasicMaterial({ color: 0x9fd0ff }), cx, h + 0.55, 0.2);
      const glow = new THREE.PointLight(0xcfe6ff, 1.1, 12); glow.position.set(cx, h - 0.5, 1.5); scene.add(glow);
      // ripiani: profilo in legno chiaro sul davanti, guide in metallo
      for (let r = 0; r < h; r++) { box(w + 0.3, 0.05, 1.3, mat({ color: 0x777777, metalness: 0.7, roughness: 0.4 }), cx, r + 0.27, -0.45); box(w + 0.3, 0.16, 0.08, mat({ color: 0xc89b6a, roughness: 0.6 }), cx, r + 0.3, 0.2); }
      shelfZones(s).forEach((z) => {
        const zh = z.to - z.from + 1, col = z.t <= 12 ? 0x1f3a52 : 0x4a3418;
        box(w + 0.5, zh, 0.05, new THREE.MeshBasicMaterial({ color: col }), cx, (h - z.from - zh / 2) + 0.25, -1.4);
        const lb = sprite(z.t + ' °C', 2.4, 64, z.t <= 12 ? '#2F6FA0' : '#A0661C'); lb.position.set(x0 - 2.0, (h - z.from - zh / 2) + 0.25, 1.4); scene.add(lb);
      });
      const sp = sprite(s.name, 5.2, 58, '#2b2420'); sp.position.set(cx, h + 2.05, 1.2); scene.add(sp);
      return;
    }
    const st = shelfStyle(s);
    if (st === 'onda') {
      // pino: due fianchi pieni e, per ogni fila, due listelli sagomati (davanti e dietro) su cui poggiano le bottiglie
      const pine = mat({ color: 0xd9ad72, roughness: 0.75 }), pineD = mat({ color: 0xc89a5f, roughness: 0.8 });
      [x0 - 0.12, x0 + w + 0.12].forEach((px) => box(0.22, h + 0.55, 1.5, pine, px, (h + 0.55) / 2 + 0.2, -0.5));
      for (let r = 0; r < h; r++) {
        const y = r + 0.38;
        box(w + 0.02, 0.12, 0.12, pine, cx, y, 0.12); box(w + 0.02, 0.12, 0.12, pineD, cx, y, -1.0);
        for (let c = 0; c < w; c++) { const n = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.13, 12, 1, false, 0, Math.PI), mat({ color: 0x8a6a45 })); n.rotation.set(Math.PI / 2, 0, Math.PI / 2); n.position.set(x0 + c + 0.5, y + 0.07, 0.12); scene.add(n); }
      }
      box(w + 0.46, 0.08, 1.5, pine, cx, h + 0.45, -0.5);
    } else if (st === 'moduli') {
      // moduli affiancati da 3 posti, legno chiaro, montanti e tondini
      const lite = mat({ color: 0xe6c99c, roughness: 0.75 });
      for (let m = 0; m < w; m += 3) {
        const mx0 = x0 + m - 0.05, mw = Math.min(3, w - m) + 0.1;
        [mx0, mx0 + mw].forEach((px) => [0.2, -1.05].forEach((pz) => box(0.1, h + 0.4, 0.1, lite, px, (h + 0.4) / 2 + 0.2, pz)));
        for (let r = 0; r <= h; r++) {
          const y = r + 0.3;
          [0.2, -1.05].forEach((pz) => { const d = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, mw, 8), lite); d.rotation.z = Math.PI / 2; d.position.set(mx0 + mw / 2, y, pz); scene.add(d); });
          [mx0, mx0 + mw].forEach((px) => box(0.06, 0.06, 1.25, lite, px, y, -0.42));
        }
      }
    } else {
      box(w, h, 0.1, back, cx, cy, -1.1);
      for (let r = 0; r <= h; r++) box(w + 0.12, 0.07, 1.3, wood, cx, r + 0.25, -0.45);
      for (let c = 0; c <= w; c++) box(0.07, h, 1.3, wood, x0 + c, cy, -0.45);
    }
    const sp = sprite(s.name, 5.2, 58, '#2b2420'); sp.position.set(cx, h + 1.25, 0); scene.add(sp);
  });
  if (cantina.length) { const sp = sprite('Cantina', 4, 50, '#5a4636'); sp.position.set(0, -0.6, 1.5); scene.add(sp); }
  if (casa.length) { const s0 = casa[0]; const sp = sprite('In casa', 4, 50, '#5a4636'); sp.position.set(shift + RX[s0.id] + s0.cols / 2, -0.9, 1.5); scene.add(sp); }
  // pavimento in cotto e muro di cemento chiaro, come nella foto
  const tile = document.createElement('canvas'); tile.width = tile.height = 256; { const g = tile.getContext('2d'); g.fillStyle = '#b8603e'; g.fillRect(0, 0, 256, 256); g.fillStyle = 'rgba(0,0,0,.06)'; for (let i = 0; i < 40; i++) g.fillRect(Math.random() * 256, Math.random() * 256, 30, 30); g.strokeStyle = '#8c4a30'; g.lineWidth = 6; g.strokeRect(0, 0, 256, 256); }
  const ttx = new THREE.CanvasTexture(tile); ttx.wrapS = ttx.wrapT = THREE.RepeatWrapping; ttx.repeat.set((totalW + 40) / 2.2, 40 / 2.2);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(totalW + 40, 40), mat({ map: ttx, color: 0xb0a8a0, roughness: 0.9 }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(shift + totalW / 2, 0.2, 8); scene.add(floor);
  if (casa.length) { const s0 = casa[0], wx = shift + RX[s0.id] + s0.cols / 2; const kw = new THREE.Mesh(new THREE.PlaneGeometry(s0.cols + 12, 22), mat({ color: 0xb9b2a6, roughness: 1 })); kw.position.set(wx, 11, -2.05); scene.add(kw); }
  if (cantina.length) { const wall = new THREE.Mesh(new THREE.PlaneGeometry(cantW + 14, 22), mat({ color: 0xa7a39b, roughness: 1 })); wall.position.set(shift + cantW / 2, 11, -1.4); scene.add(wall); }
  // bottiglie coricate, collo verso di noi
  const bodyG = new THREE.CylinderGeometry(0.34, 0.34, 1.0, 20); bodyG.rotateX(Math.PI / 2);
  const shG = new THREE.SphereGeometry(0.34, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2); shG.rotateX(Math.PI / 2);
  const neckG = new THREE.CylinderGeometry(0.12, 0.13, 0.45, 14); neckG.rotateX(Math.PI / 2);
  const capG = new THREE.CylinderGeometry(0.135, 0.135, 0.22, 14); capG.rotateX(Math.PI / 2);
  const tagG = new THREE.BoxGeometry(0.26, 0.36, 0.01), tagM = mat({ color: 0xf4f1ea, roughness: 0.9 });
  const pick = [], items = [];
  in3d().forEach((b) => {
    if (RX[b.shelf] == null) return;
    const g = new THREE.Group();
    const glass = mat({ color: GL3[b.type] || 0x333333, roughness: 0.25, metalness: 0.2 });
    const col = new THREE.Color(T3[b.type] || '#888');
    const foil = mat({ color: col, roughness: 0.4, metalness: 0.35, emissive: col, emissiveIntensity: 0.18 });
    [[bodyG, glass, -0.75], [shG, glass, -0.25], [neckG, glass, 0.25], [capG, foil, 0.42]].forEach(([geo, m, z]) => { const o = new THREE.Mesh(geo, m); o.position.z = z; o.userData.id = b.id; g.add(o); pick.push(o); });
    if (shelfLoc(SHB[b.shelf]) === 'cantina') { const tag = new THREE.Mesh(tagG, tagM); tag.position.set(0, -0.28, 0.42); g.add(tag); }
    g.position.copy(slotPos(b.shelf, b.r, b.c));
    scene.add(g); items.push({ b, g, foil });
  });
  // telecamera: girare, spostare, ingrandire
  let yaw = -0.12, pitch = 0.1, dist = 40, target = new THREE.Vector3(0, 5, 0), goal = null, raf = 0, alive = true, home = null;
  const fov2 = Math.tan(THREE.MathUtils.degToRad(19));
  const frame = (x0, x1, y0, y1) => { const a = stage.clientWidth / Math.max(1, stage.clientHeight); return { t: new THREE.Vector3(shift + (x0 + x1) / 2, (y0 + y1) / 2, 0), d: Math.max(((y1 - y0) / 2 + 1.2) / fov2, ((x1 - x0) / 2 + 1.2) / fov2 / a) + 1.5 }; };
  const frameShelf = (s) => isPando(s) ? frame(RX[s.id] - 2.5, RX[s.id] + s.cols + 1.8, -1, s.rows + 3) : frame(RX[s.id] - 0.3, RX[s.id] + s.cols + 0.3, 0, s.rows + 1.6);
  const frameAll = () => frame(-0.5, totalW + 0.5, 0, Math.max(...S.shelves.map((s) => s.rows)) + 2);
  const focus = (k) => {
    document.querySelectorAll('[data-v3f]').forEach((c) => c.classList.toggle('on', c.dataset.v3f === k));
    goal = k === 'all' ? frameAll() : k === 'cantina' ? frame(-0.5, cantW + 0.5, 0, Math.max(1, ...cantina.map((s) => s.rows)) + 2) : SHB[k] ? frameShelf(SHB[k]) : null;
    if (goal) { home = goal; goal.yaw = -0.12; goal.pitch = 0.08; }
  };
  const resize = () => { const w = stage.clientWidth, h = stage.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / Math.max(1, h); camera.updateProjectionMatrix(); };
  resize();
  home = cantina.length ? frame(-0.5, cantW + 0.5, 0, Math.max(...cantina.map((s) => s.rows)) + 2) : frameAll(); target.copy(home.t); dist = home.d;
  const cv = renderer.domElement, pts = new Map(); let moved = 0, two = null, lastTap = 0;
  const right = new THREE.Vector3(), up = new THREE.Vector3();
  const panBy = (dx, dy) => {
    const k = dist * 2 * fov2 / stage.clientHeight;
    right.setFromMatrixColumn(camera.matrix, 0); up.setFromMatrixColumn(camera.matrix, 1);
    target.addScaledVector(right, -dx * k).addScaledVector(up, dy * k);
  };
  cv.addEventListener('pointerdown', (e) => {
    cv.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); moved = 0; goal = null;
    if (pts.size === 2) { const [p, q] = [...pts.values()]; two = { d: Math.hypot(p.x - q.x, p.y - q.y), dist, mx: (p.x + q.x) / 2, my: (p.y + q.y) / 2 }; }
  });
  cv.addEventListener('pointermove', (e) => {
    const p = pts.get(e.pointerId); if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY; moved += Math.abs(dx) + Math.abs(dy);
    if (pts.size === 1 && !two) {
      if (e.pointerType === 'mouse' && (e.shiftKey || e.buttons === 2)) panBy(dx, dy);
      else { yaw = Math.max(-1.2, Math.min(1.2, yaw - dx * 0.006)); pitch = Math.max(-0.2, Math.min(1.0, pitch + dy * 0.005)); }
    } else if (pts.size === 2 && two) {
      const [a, b] = [...pts.values()], mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      dist = Math.max(3, Math.min(140, two.dist * two.d / Math.max(10, Math.hypot(a.x - b.x, a.y - b.y))));
      panBy(mx - two.mx, my - two.my); two.mx = mx; two.my = my;
    }
  });
  const ray = new THREE.Raycaster(), mv2 = new THREE.Vector2();
  cv.addEventListener('pointerup', (e) => {
    if (pts.size === 1 && !two && moved < 8) {
      const r = cv.getBoundingClientRect(); mv2.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(mv2, camera); const hit = ray.intersectObjects(pick)[0];
      if (hit) select(hit.object.userData.id, true);
      else if (Date.now() - lastTap < 350) { goal = { ...home, yaw: -0.12, pitch: 0.08 }; select(null); }
      lastTap = Date.now();
    }
    pts.delete(e.pointerId); if (pts.size === 0) two = null;
  });
  cv.addEventListener('pointercancel', (e) => { pts.delete(e.pointerId); if (!pts.size) two = null; });
  cv.addEventListener('contextmenu', (e) => e.preventDefault());
  cv.addEventListener('wheel', (e) => { e.preventDefault(); goal = null; dist = Math.max(3, Math.min(140, dist * (1 + e.deltaY * 0.001))); }, { passive: false });
  // selezione: anello bianco, le altre bottiglie un po' spente
  let selRing = null, selId = null;
  function select(id, fly) {
    if (selRing) { selRing.parent && selRing.parent.remove(selRing); selRing = null; }
    selId = id;
    items.forEach((it) => { it.foil.emissiveIntensity = id && it.b.id !== id ? 0.04 : id ? 0.6 : 0.18; });
    const it = items.find((x) => x.b.id === id), card = document.getElementById('v3card');
    if (!card) return;
    if (!it) { card.innerHTML = '<b>Tocca una bottiglia</b><small>Ti dico qual è e dove si trova. Puoi anche cercarla qui sopra.</small>'; return; }
    selRing = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.05, 8, 32), new THREE.MeshBasicMaterial({ color: 0xffffff })); selRing.position.z = 0.1; it.g.add(selRing);
    const b = it.b, z = shelfZones(SHB[b.shelf] || {}).find((q) => b.r >= q.from && b.r <= q.to);
    const sub = [b.region ? String(b.region).split(/[,(]/)[0].trim() : '', b.grapes || '', b.value ? eur(b.value) : ''].filter(Boolean).join(' · ');
    card.innerHTML = `<span class="v3row">${b.thumb ? `<img src="${b.thumb}" alt="">` : `<i class="vdot t-${esc(b.type)}">${esc(String(b.vintage || '').slice(-2))}</i>`}<span><b>${esc(name(b))}${b.vintage ? ' ' + esc(b.vintage) : ''}</b><small>${esc(sub)}</small><span class="v3pos"><i>${esc(posLabel(b))}${z ? ' · ' + z.t + ' °C' : ''}</i></span></span></span><button class="link" type="button" data-v3open="${esc(b.id)}">Apri la scheda</button>`;
    if (fly) { const p = it.g.position; goal = { t: new THREE.Vector3(p.x, p.y, 0), d: 9, yaw: -0.1, pitch: 0.06 }; }
  }
  function zoom(k) { goal = null; if (k === 'reset') { goal = { ...home, yaw: -0.12, pitch: 0.08 }; return; } dist = Math.max(3, Math.min(140, dist * (k === 'in' ? 0.7 : 1.4))); }
  function loop() {
    if (!alive) return;
    if (!document.body.contains(stage)) { stop(); return; }
    if (goal) {
      target.lerp(goal.t, 0.1); dist += (goal.d - dist) * 0.1;
      if (goal.yaw != null) { yaw += (goal.yaw - yaw) * 0.1; pitch += (goal.pitch - pitch) * 0.1; }
      if (Math.abs(goal.d - dist) < 0.05 && target.distanceTo(goal.t) < 0.02) goal = null;
    }
    camera.position.set(target.x + dist * Math.sin(yaw) * Math.cos(pitch), target.y + dist * Math.sin(pitch), target.z + dist * Math.cos(yaw) * Math.cos(pitch)); camera.lookAt(target);
    renderer.render(scene, camera); raf = requestAnimationFrame(loop);
  }
  function stop() { alive = false; cancelAnimationFrame(raf); window.removeEventListener('resize', resize); try { renderer.dispose(); } catch (_) {} }
  window.addEventListener('resize', resize);
  raf = requestAnimationFrame(loop);
  v3 = { stop, focus, select, zoom, ids: () => items.map((x) => x.b.id) };
}

// ricerca di una bottiglia nella scena
function v3search(q) {
  const box = document.getElementById('v3res'); if (!box) return;
  const t = nrm(q).trim();
  if (t.length < 2) { box.innerHTML = ''; return; }
  const words = t.split(/\s+/);
  const hits = in3d().filter((b) => { const h = nrm([b.producer, b.cuvee, b.vintage, b.region].join(' ')); return words.every((w) => h.includes(w)); }).slice(0, 8);
  box.innerHTML = hits.length ? hits.map((b) => `<button type="button" class="fchip" data-v3go="${esc(b.id)}">${esc(name(b))}${b.vintage ? ' ' + esc(b.vintage) : ''}</button>`).join('') : '<small class="info">Nessuna bottiglia trovata negli scaffali.</small>';
}

function layoutDialog() {
  const d = $('#dlg2');
  const { cantina, casa } = orderedShelves();
  const list = [...cantina, ...casa];
  d.innerHTML = `<p class="eyebrow">Cantina in 3D</p><h2>Disposizione</h2><p class="info">Dove si trova ogni scaffale, com'è fatto e in che ordine lo vedi da sinistra. Le zone di temperatura le cambi da «Modifica» sullo scaffale.</p>
  <div class="grp">${list.map((s, i) => `<div class="fr"><label>${esc(s.name)}</label><span><select data-loc="${esc(s.id)}"><option value="cantina" ${shelfLoc(s) === 'cantina' ? 'selected' : ''}>Cantina</option><option value="casa" ${shelfLoc(s) === 'casa' ? 'selected' : ''}>In casa</option></select><select data-sty="${esc(s.id)}" ${shelfLoc(s) === 'casa' ? 'hidden' : ''}><option value="onda" ${shelfStyle(s) === 'onda' ? 'selected' : ''}>Ripiani sagomati</option><option value="moduli" ${shelfStyle(s) === 'moduli' ? 'selected' : ''}>Moduli da 3</option><option value="griglia" ${shelfStyle(s) === 'griglia' ? 'selected' : ''}>Griglia</option></select><button class="link" type="button" data-up="${esc(s.id)}" aria-label="Più a sinistra">‹</button><button class="link" type="button" data-dn="${esc(s.id)}" aria-label="Più a destra">›</button></span></div>`).join('')}</div>
  <div class="acts" style="margin-top:12px"><button class="btn pri" type="button" id="ly_ok">Fatto</button></div>`;
  const save = async () => { await persistShelves(); };
  d.querySelectorAll('[data-loc]').forEach((el) => { el.onchange = async () => { const s = S.shelves.find((x) => x.id === el.dataset.loc); s.loc = el.value; await save(); }; });
  d.querySelectorAll('[data-sty]').forEach((el) => { el.onchange = async () => { const s = S.shelves.find((x) => x.id === el.dataset.sty); s.style = el.value; await save(); }; });
  const shiftBy = async (id, k) => {
    const { cantina: c, casa: h } = orderedShelves(); const arr = shelfLoc(S.shelves.find((x) => x.id === id)) === 'casa' ? h : c;
    arr.forEach((s, i) => { s.ord = i; });
    const i = arr.findIndex((s) => s.id === id), j = i + k; if (j < 0 || j >= arr.length) return;
    arr[i].ord = j; arr[j].ord = i; await save(); layoutDialog();
  };
  d.querySelectorAll('[data-up]').forEach((el) => { el.onclick = () => shiftBy(el.dataset.up, -1); });
  d.querySelectorAll('[data-dn]').forEach((el) => { el.onclick = () => shiftBy(el.dataset.dn, 1); });
  $('#ly_ok').onclick = () => { d.close(); render(); };
  d.onclose = () => render();
  if (!d.open) d.showModal();
}


document.addEventListener('click', (e) => {
  const t = e.target.closest && e.target.closest('[data-v3f],[data-v3open],[data-v3z],[data-v3go],[data-a="v3layout"]');
  if (!t) return;
  if (t.dataset.v3f) { if (v3) v3.focus(t.dataset.v3f); return; }
  if (t.dataset.v3open) { openBottle(t.dataset.v3open); return; }
  if (t.dataset.v3z) { if (v3) v3.zoom(t.dataset.v3z); return; }
  if (t.dataset.v3go) { if (v3) v3.select(t.dataset.v3go, true); const st = document.getElementById('v3stage'); if (st) st.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
  if (t.dataset.a === 'v3layout') layoutDialog();
});
document.addEventListener('input', (e) => { if (e.target && e.target.id === 'v3q') v3search(e.target.value); });
