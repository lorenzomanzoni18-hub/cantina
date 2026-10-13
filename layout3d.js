/* Cantina in 3D: gli scaffali come sono davvero. Due zone separate: la cantina e la cantinetta di casa. */

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
let v3zone = 'cantina', v3pending = null; // cantina o frigorifero di casa; bottiglia da mostrare appena pronta
const shName = (id) => { const s = S.shelves.find((x) => x.id === id); return s ? s.name : '—'; };
const posLabel = (b) => shName(b.shelf) + ' · riga ' + (b.r + 1) + ', posto ' + (b.c + 1);
const in3d = () => Object.values(S.bottles).filter((b) => inCellar(b) && b.shelf && S.shelves.some((s) => s.id === b.shelf));

function page3d() {
  const { cantina, casa } = orderedShelves();
  if (!S.shelves.length) return '<p class="empty">Crea prima uno scaffale dalla pagina Cantina.</p>';
  if (v3zone === 'casa' && !casa.length) v3zone = 'cantina';
  if (v3zone === 'cantina' && !cantina.length) v3zone = 'casa';
  const list = v3zone === 'casa' ? casa : cantina;
  const nIn = (l) => in3d().filter((b) => l.some((x) => x.id === b.shelf)).length;
  const sw = cantina.length && casa.length ? `<div class="v3switch" role="tablist" aria-label="Zona">
    <button type="button" role="tab" data-v3zone="cantina" aria-selected="${v3zone === 'cantina'}"><b>Cantina</b><small>${nIn(cantina)} bottiglie · ${cantina.length} scaffali</small></button>
    <button type="button" role="tab" data-v3zone="casa" aria-selected="${v3zone === 'casa'}"><b>${esc(casa.length === 1 ? casa[0].name : 'In casa')}</b><small>${nIn(casa)} bottiglie${casa.length === 1 && zonesText(casa[0]) ? ' · ' + shelfZones(casa[0]).map((z) => z.t + '°').join(' / ') : ''}</small></button></div>` : '';
  const chips = list.length > 1 ? `<div class="fchips v3chips"><button class="fchip on" type="button" data-v3f="all">Tutti</button>${list.map((s) => `<button class="fchip" type="button" data-v3f="${esc(s.id)}">${esc(s.name)}</button>`).join('')}</div>` : '';
  const info = v3zone === 'casa'
    ? list.map((s) => `${esc(s.name)}: cantinetta da incasso in cucina${zonesText(s) ? ', ' + esc(zonesText(s)) : ''}.`).join(' ')
    : `In cantina, da sinistra: ${list.map((s) => esc(s.name)).join(' · ')}.`;
  return `${sw}${chips}
  <div class="v3find"><input id="v3q" type="search" placeholder="Trova una bottiglia: produttore, vino, annata" autocomplete="off"><div id="v3res" class="v3res"></div></div>
  <div class="v3stage v3-${v3zone}" id="v3stage"><p class="v3load" id="v3load">Preparo la scena…</p>
    <div class="v3tools"><button type="button" class="v3tool" data-v3z="in" aria-label="Avvicina">+</button><button type="button" class="v3tool" data-v3z="out" aria-label="Allontana">−</button><button type="button" class="v3tool" data-v3z="reset" aria-label="Vista di fronte">⟲</button></div>
    <div class="v3hint">Un dito gira · due dita spostano e ingrandiscono</div></div>
  <div class="v3card" id="v3card"><b>Tocca una bottiglia</b><small>Ti dico qual è e dove si trova. Puoi anche cercarla qui sopra.</small></div>
  <p class="info">${info} <button class="link" type="button" data-a="v3layout">Cambia disposizione</button></p>`;
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
  const home3 = v3zone === 'casa';
  const list = home3 ? casa : cantina;
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.outputEncoding = THREE.sRGBEncoding; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = home3 ? 0.95 : 1.0;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  stage.prepend(renderer.domElement);
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(36, 1, 0.1, 500);
  const BG = home3 ? 0x1c1a19 : 0x15100d;
  scene.background = new THREE.Color(BG); scene.fog = new THREE.Fog(BG, 38, 95);
  const GAP = home3 ? 2.5 : 0.6, RX = {};
  let x = 0;
  list.forEach((s) => { RX[s.id] = x; x += s.cols + GAP; });
  const totalW = Math.max(1, x - GAP), cantW = totalW, shift = -totalW / 2;
  const maxRows = Math.max(1, ...list.map((s) => s.rows));
  // luci: in cantina una lampada calda dall'alto con ombre morbide; in cucina luce diffusa e il LED della cantinetta
  scene.add(new THREE.HemisphereLight(home3 ? 0xf3efe8 : 0xffe4c4, home3 ? 0x3a3532 : 0x2a1a10, home3 ? 0.6 : 0.42));
  const spot = new THREE.SpotLight(home3 ? 0xfff6ea : 0xffcf94, home3 ? 0.8 : 1.25, 0, 0.62, 0.8, 1);
  spot.position.set(-2, maxRows + 14, 16); spot.target.position.set(0, maxRows / 2, 0); scene.add(spot, spot.target);
  spot.castShadow = true; spot.shadow.mapSize.set(1024, 1024); spot.shadow.bias = -0.0005; spot.shadow.radius = 4;
  const fill = new THREE.DirectionalLight(home3 ? 0xdfe8ff : 0xb07a50, home3 ? 0.35 : 0.25); fill.position.set(14, 6, 10); scene.add(fill);
  const SHB = Object.fromEntries(S.shelves.map((s) => [s.id, s]));
  const slotPos = (sid, r, c) => { const s = SHB[sid]; return new THREE.Vector3(shift + RX[sid] + c + 0.5, (s.rows - 1 - r) + 0.75, 0); };
  const lin = (c) => new THREE.Color(c).convertSRGBToLinear();
  const mat = (o) => new THREE.MeshStandardMaterial(o.color != null ? { ...o, color: lin(o.color) } : o);
  const wood = mat({ color: 0x5a3e28, roughness: 0.85 });
  const back = mat({ color: 0x0d0b0a, roughness: 1 });
  const sprite = (t, w, size, col) => {
    const c = document.createElement('canvas'); c.width = 512; c.height = 96; const g = c.getContext('2d');
    g.font = `700 ${size || 58}px "Cormorant Garamond", Georgia, serif`; g.fillStyle = col || '#F2EBE3'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(t, 256, 50);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true })); sp.scale.set(w || 5.2, (w || 5.2) * 96 / 512, 1); return sp;
  };
  const box = (w, h, d, m, px, py, pz) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(px, py, pz); o.castShadow = o.receiveShadow = true; scene.add(o); return o; };
  list.forEach((s) => {
    if (RX[s.id] == null) return;
    const w = s.cols, h = s.rows, x0 = shift + RX[s.id], cx = x0 + w / 2, cy = h / 2 + 0.25;
    if (isPando(s)) {
      // cantinetta da incasso: mobile della cucina, cornice nera, vetro fumé, maniglia, luce LED
      const cab = mat({ color: 0xe9e3d8, roughness: 0.45 }), blk = mat({ color: 0x141414, roughness: 0.3, metalness: 0.6 }), inner = mat({ color: 0x20262e, roughness: 0.85 });
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
      // piano di lavoro sopra il mobile e display delle due zone
      box(W + 2 * F + 1.6, 0.35, 2.6, mat({ color: 0x3b3936, roughness: 0.35, metalness: 0.1 }), cx, cy + H / 2 + F + 0.42, -0.7);
      { const c = document.createElement('canvas'); c.width = 512; c.height = 64; const g = c.getContext('2d'); g.fillStyle = '#0b0b0b'; g.fillRect(0, 0, 512, 64); g.font = '600 38px "Plus Jakarta Sans", system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
        const zz = shelfZones(s); g.fillStyle = '#9fd0ff'; g.fillText(zz.length ? zz.map((z) => z.t + '°').join('    ') : '', 256, 34);
        const disp = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.55, 0.22), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c) })); disp.position.set(cx, cy + H / 2 + 0.12, 0.41); scene.add(disp); }
      const glass = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.6, h + 0.8), new THREE.MeshPhysicalMaterial({ color: lin(0x2a3644), transparent: true, opacity: 0.16, roughness: 0.02, metalness: 0.3, clearcoat: 1 }));
      glass.position.set(cx, cy, 0.62); scene.add(glass);
      box(0.12, h * 0.7, 0.18, mat({ color: 0x9a9a9a, metalness: 0.9, roughness: 0.25 }), cx + (w + 0.6) / 2 - 0.25, cy, 0.85);
      box(w + 0.4, 0.06, 0.06, new THREE.MeshBasicMaterial({ color: lin(0x9fd0ff) }), cx, h + 0.55, 0.2);
      const glow = new THREE.PointLight(0xcfe6ff, 1.1, 12); glow.position.set(cx, h - 0.5, 1.5); scene.add(glow);
      // ripiani: profilo in legno chiaro sul davanti, guide in metallo
      for (let r = 0; r < h; r++) { box(w + 0.3, 0.05, 1.3, mat({ color: 0x777777, metalness: 0.7, roughness: 0.4 }), cx, r + 0.27, -0.45); box(w + 0.3, 0.16, 0.08, mat({ color: 0xc89b6a, roughness: 0.6 }), cx, r + 0.3, 0.2); }
      shelfZones(s).forEach((z) => {
        const zh = z.to - z.from + 1, col = z.t <= 12 ? 0x1f3a52 : 0x4a3418;
        box(w + 0.5, zh, 0.05, new THREE.MeshBasicMaterial({ color: lin(col) }), cx, (h - z.from - zh / 2) + 0.25, -1.4);
        const lb = sprite(z.t + ' °C', 2.2, 64, z.t <= 12 ? '#2F6FA0' : '#9A5F18'); lb.position.set(x0 - 2.3, (h - z.from - zh / 2) + 0.25, 1.4); scene.add(lb);
      });
      return;
    }
    const st = shelfStyle(s);
    if (st === 'onda') {
      // pino: due fianchi pieni e, per ogni fila, due listelli sagomati (davanti e dietro) su cui poggiano le bottiglie
      const pine = mat({ color: 0xd2a066, roughness: 0.62 }), pineD = mat({ color: 0xb98a52, roughness: 0.7 });
      [x0 - 0.12, x0 + w + 0.12].forEach((px) => box(0.22, h + 0.55, 1.5, pine, px, (h + 0.55) / 2 + 0.2, -0.5));
      for (let r = 0; r < h; r++) {
        const y = r + 0.38;
        box(w + 0.02, 0.12, 0.12, pine, cx, y, 0.12); box(w + 0.02, 0.12, 0.12, pineD, cx, y, -1.0);
        for (let c = 0; c < w; c++) { const n = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.13, 12, 1, false, 0, Math.PI), mat({ color: 0x8a6a45 })); n.rotation.set(Math.PI / 2, 0, Math.PI / 2); n.position.set(x0 + c + 0.5, y + 0.07, 0.12); scene.add(n); }
      }
      box(w + 0.46, 0.08, 1.5, pine, cx, h + 0.45, -0.5);
    } else if (st === 'moduli') {
      // moduli affiancati da 3 posti, legno chiaro, montanti e tondini
      const lite = mat({ color: 0xe0c08f, roughness: 0.6 });
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
    const sp = sprite(s.name, 4.4, 60, '#3a2a1f'); sp.position.set(cx, h + 1.15, 0.4); scene.add(sp);
  });
  const noise = (base, dots, holes) => { const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'); g.fillStyle = base; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 1400; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,255,255'},${Math.random() * 0.05})`; g.fillRect(Math.random() * 256, Math.random() * 256, 2 + Math.random() * 4, 2 + Math.random() * 4); }
    if (holes) { g.fillStyle = 'rgba(40,36,32,.55)'; for (let i = 0; i < dots; i++) { g.beginPath(); g.arc(Math.random() * 256, Math.random() * 256, 1.4, 0, 7); g.fill(); } }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.encoding = THREE.sRGBEncoding; return t; };
  let floorMat;
  if (home3) {
    // cucina: parquet chiaro e parete calda
    const c = document.createElement('canvas'); c.width = 256; c.height = 256; const g = c.getContext('2d');
    for (let i = 0; i < 8; i++) { g.fillStyle = ['#b08b62', '#a7825a', '#b8946a', '#a07b54'][i % 4]; g.fillRect(0, i * 32, 256, 32); g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, i * 32, 256, 1.5); g.fillRect((i * 97) % 256, i * 32, 1.5, 32); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(10, 10); t.encoding = THREE.sRGBEncoding;
    floorMat = mat({ map: t, roughness: 0.55 });
    const wt = noise('#c9bfb1', 0, false); wt.repeat.set(4, 3);
    const kw = new THREE.Mesh(new THREE.PlaneGeometry(totalW + 30, 24), mat({ map: wt, roughness: 0.95 })); kw.position.set(0, 12, -2.05); kw.receiveShadow = true; scene.add(kw);
  } else {
    // cantina: cotto e muro di cemento con i fori dei casseri, come nella foto
    const tile = document.createElement('canvas'); tile.width = tile.height = 256; { const g = tile.getContext('2d'); g.fillStyle = '#b35f3f'; g.fillRect(0, 0, 256, 256); for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '90,30,15' : '230,150,110'},${Math.random() * 0.12})`; g.beginPath(); g.arc(Math.random() * 256, Math.random() * 256, 10 + Math.random() * 40, 0, 7); g.fill(); } g.strokeStyle = '#7d4430'; g.lineWidth = 5; g.strokeRect(0, 0, 256, 256); }
    const ttx = new THREE.CanvasTexture(tile); ttx.wrapS = ttx.wrapT = THREE.RepeatWrapping; ttx.repeat.set((totalW + 40) / 2.2, 40 / 2.2); ttx.encoding = THREE.sRGBEncoding;
    floorMat = mat({ map: ttx, roughness: 0.8 });
    const wt = noise('#b7b1a8', 18, true); wt.repeat.set((totalW + 14) / 6, 22 / 6);
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(totalW + 14, 22), mat({ map: wt, roughness: 1 })); wall.position.set(0, 11, -1.4); wall.receiveShadow = true; scene.add(wall);
  }
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(totalW + 40, 40), floorMat);
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0.2, 8); floor.receiveShadow = true; scene.add(floor);
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
    const glass = new THREE.MeshPhysicalMaterial({ color: lin(GL3[b.type] || 0x333333), roughness: 0.12, metalness: 0.15, clearcoat: 1, clearcoatRoughness: 0.08 });
    const col = lin(T3[b.type] || '#888');
    const foil = mat({ color: col, roughness: 0.4, metalness: 0.35, emissive: col, emissiveIntensity: 0.18 });
    [[bodyG, glass, -0.75], [shG, glass, -0.25], [neckG, glass, 0.25], [capG, foil, 0.42]].forEach(([geo, m, z]) => { const o = new THREE.Mesh(geo, m); o.position.z = z; o.userData.id = b.id; o.castShadow = true; g.add(o); pick.push(o); });
    if (shelfLoc(SHB[b.shelf]) === 'cantina') { const tag = new THREE.Mesh(tagG, tagM); tag.position.set(0, -0.28, 0.42); g.add(tag); }
    g.position.copy(slotPos(b.shelf, b.r, b.c));
    scene.add(g); items.push({ b, g, foil });
  });
  // telecamera: girare, spostare, ingrandire
  let yaw = -0.12, pitch = 0.1, dist = 40, target = new THREE.Vector3(0, 5, 0), goal = null, raf = 0, alive = true, home = null;
  const fov2 = Math.tan(THREE.MathUtils.degToRad(19));
  const frame = (x0, x1, y0, y1) => { const a = stage.clientWidth / Math.max(1, stage.clientHeight); return { t: new THREE.Vector3(shift + (x0 + x1) / 2, (y0 + y1) / 2, 0), d: Math.max(((y1 - y0) / 2 + 1.2) / fov2, ((x1 - x0) / 2 + 1.2) / fov2 / a) + 1.5 }; };
  const frameShelf = (s) => isPando(s) ? frame(RX[s.id] - 2.5, RX[s.id] + s.cols + 1.8, -1, s.rows + 3) : frame(RX[s.id] - 0.3, RX[s.id] + s.cols + 0.3, 0, s.rows + 1.6);
  const frameAll = () => home3 && list.length === 1 ? frameShelf(list[0]) : frame(-0.5, totalW + 0.5, 0, maxRows + 2);
  const focus = (k) => {
    document.querySelectorAll('[data-v3f]').forEach((c) => c.classList.toggle('on', c.dataset.v3f === k));
    goal = k === 'all' ? frameAll() : SHB[k] ? frameShelf(SHB[k]) : null;
    if (goal) { home = goal; goal.yaw = -0.12; goal.pitch = 0.08; }
  };
  const resize = () => { const w = stage.clientWidth, h = stage.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / Math.max(1, h); camera.updateProjectionMatrix(); };
  resize();
  home = frameAll(); scene.fog.near = home.d * 1.4; scene.fog.far = home.d * 3.2; target.copy(home.t); dist = home.d * 1.35; goal = { ...home, yaw: -0.12, pitch: 0.08 }; // piccola entrata in scena
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
    selRing = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.05, 8, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xd4af6a).convertSRGBToLinear() })); selRing.position.z = 0.1; it.g.add(selRing);
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
  if (v3pending) { const id = v3pending; v3pending = null; setTimeout(() => select(id, true), 400); }
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
  const t = e.target.closest && e.target.closest('[data-v3f],[data-v3open],[data-v3z],[data-v3go],[data-v3zone],[data-a="v3layout"]');
  if (!t) return;
  if (t.dataset.v3zone) { if (t.dataset.v3zone !== v3zone) { v3zone = t.dataset.v3zone; render(); } return; }
  if (t.dataset.v3f) { if (v3) v3.focus(t.dataset.v3f); return; }
  if (t.dataset.v3open) { openBottle(t.dataset.v3open); return; }
  if (t.dataset.v3z) { if (v3) v3.zoom(t.dataset.v3z); return; }
  if (t.dataset.v3go) {
    const b = S.bottles[t.dataset.v3go], sh = b && S.shelves.find((x) => x.id === b.shelf), z = sh && shelfLoc(sh) === 'casa' ? 'casa' : 'cantina';
    if (z !== v3zone) { v3zone = z; v3pending = b.id; render(); return; }
    if (v3) v3.select(t.dataset.v3go, true); const st = document.getElementById('v3stage'); if (st) st.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
  if (t.dataset.a === 'v3layout') layoutDialog();
});
document.addEventListener('input', (e) => { if (e.target && e.target.id === 'v3q') v3search(e.target.value); });
