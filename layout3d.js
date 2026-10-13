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
const ZONE_RX = [['Champagne', /champagne/], ['Jura', /\bjura\b|arbois|etoile|revermont|pupillin|chalon/], ['Borgogna', /bourgogne|borgogna|burgund|cote d.or|beaune|nuits|macon|chablis|dijon|meursault|puligny|chassagne|fuisse|vinzelles|pouilly/],
  ['Loira', /loira|loire|anjou|layon|saumur|touraine|vouvray|muscadet|sancerre|montlouis|savennieres|chinon|bourgueil|bonnezeaux|thouarce/], ['Sud-Ovest', /jurancon|bearn|gers|sud-ouest|sud ovest|pyrenees|pirenei|madiran|gaillac|cahors|irouleguy|courrensan/],
  ['Savoia', /savoi/], ['Alsazia', /alsace|alsazia/], ['Rodano', /rhone|rodano|cornas|hermitage|chateauneuf/], ['Beaujolais', /beaujolais|morgon|fleurie/], ['Linguadoca', /languedoc|roussillon|linguadoca/], ['Bordeaux', /bordeaux|medoc|pomerol|emilion|sauternes/],
  ['Piemonte', /piemonte|langhe|barolo|barbaresco|roero|alba\b|asti/], ['Toscana', /toscana|montalcino|chianti|bolgheri/], ['Abruzzo', /abruzzo/], ['Umbria', /umbria|torgiano|montefalco/], ['Veneto', /veneto|valpolicella|soave/],
  ['Friuli', /friuli|collio/], ['Alto Adige', /alto adige|sudtirol/], ['Sicilia', /sicilia|etna/], ['Campania', /campania|irpinia|taurasi/], ['Austria', /austria|steiermark|stiria|wachau/], ['Germania', /germania|mosel|rheingau|pfalz/],
  ['Spagna', /spagna|spain|balear|rioja|jerez/], ['Belgio', /belgio|bruxelles/]];
function zoneOf(b, all) {
  const look = (x) => { const t = nrm(x.region); if (!t) return ''; const z = ZONE_RX.find(([, rx]) => rx.test(t)); return z ? z[0] : ''; };
  let z = look(b);
  if (!z && b.producer) { const o = all.find((x) => x !== b && x.producer && sameProd(x.producer, b.producer) && look(x)); if (o) z = look(o); }
  if (!z && b.region) z = String(b.region).split(/[,(:]/)[0].trim();
  return z || 'Altre zone';
}
const readyYear = (b) => b.drinkTo || (b.vintage ? +b.vintage + 8 : new Date().getFullYear() + 5);

/* ---- il riordino proposto ---- */
function shelfForType(t, list) {
  const rx = { bollicine: /bollic|spumant|champ|bolle/, bianco: /bianc/, rosso: /ross[oi]\b|rossi/, rosato: /rosat/ }[t];
  return rx ? list.find((s) => rx.test(nrm(s.name))) : null;
}
function computePlan() {
  const { cantina } = orderedShelves();
  const ids = new Set(cantina.map((s) => s.id));
  const inC = Object.values(S.bottles).filter((b) => inCellar(b) && ids.has(b.shelf));
  // 1. scaffale giusto per tipo (solo dentro la cantina)
  const dest = new Map();
  for (const b of inC) { const s = shelfForType(b.type, cantina); dest.set(b.id, s ? s.id : b.shelf); }
  for (const s of cantina) { // se uno scaffale non basta, lascio le bottiglie dove sono
    const n = inC.filter((b) => dest.get(b.id) === s.id).length;
    if (n > s.rows * s.cols) inC.forEach((b) => { if (dest.get(b.id) === s.id && b.shelf !== s.id) dest.set(b.id, b.shelf); });
  }
  const target = new Map(), why = new Map();
  for (const s of cantina) {
    const mine = inC.filter((b) => dest.get(b.id) === s.id);
    if (!mine.length) continue;
    const zones = new Map();
    mine.forEach((b) => { const z = zoneOf(b, inC); if (!zones.has(z)) zones.set(z, []); zones.get(z).push(b); });
    // Ogni zona riceve delle righe: prima le zone più grandi; ognuna resta nella riga dove ne ha già di più,
    // se ci sta tutta. Così si sposta il meno possibile e ogni riga ha una zona sola (o poche).
    const zl = [...zones.entries()].map(([z, bs]) => ({ z, bs })).sort((a, b) => b.bs.length - a.bs.length || a.z.localeCompare(b.z));
    const used = Array(s.rows).fill(0), quota = new Map(); // quota: zona -> {riga: posti}
    const here = (z, r) => z.bs.filter((b) => b.shelf === s.id && b.r === r).length;
    let ok = true;
    for (const z of zl) {
      const q = {}; let need = z.bs.length;
      const rows = [...Array(s.rows).keys()];
      const whole = rows.filter((r) => s.cols - used[r] >= need).sort((x, y) => here(z, y) - here(z, x) || x - y);
      if (whole.length) { q[whole[0]] = need; used[whole[0]] += need; need = 0; }
      else for (const r of rows.sort((x, y) => here(z, y) - here(z, x) || x - y)) { if (!need) break; const k = Math.min(need, s.cols - used[r]); if (k > 0) { q[r] = k; used[r] += k; need -= k; } }
      if (need) { ok = false; break; }
      quota.set(z.z, q);
    }
    if (!ok) { mine.forEach((b) => target.set(b.id, [b.shelf, b.r, b.c])); continue; }
    const taken = new Set(), pending = [];
    // chi è già in una riga della sua zona resta al suo posto
    for (const z of zl) {
      const q = quota.get(z.z), left = { ...q };
      for (const b of z.bs) {
        if (b.shelf === s.id && left[b.r] > 0 && !taken.has(b.r * s.cols + b.c)) { left[b.r]--; taken.add(b.r * s.cols + b.c); target.set(b.id, [s.id, b.r, b.c]); }
        else pending.push({ b, z });
      }
      z.left = left;
    }
    // gli altri vanno nel posto libero più vicino ai compagni di zona
    pending.sort((x, y) => nrm(x.b.producer).localeCompare(nrm(y.b.producer)) || (x.b.vintage || 0) - (y.b.vintage || 0));
    for (const { b, z } of pending) {
      const r = +Object.keys(z.left).find((k) => z.left[k] > 0);
      const mates = z.bs.filter((x) => target.has(x.id) && target.get(x.id)[1] === r).map((x) => target.get(x.id)[2]);
      const ref = mates.length ? mates.reduce((t, c) => t + c, 0) / mates.length : 0;
      let best = -1;
      for (let c = 0; c < s.cols; c++) if (!taken.has(r * s.cols + c) && (best < 0 || Math.abs(c - ref) < Math.abs(best - ref))) best = c;
      z.left[r]--; taken.add(r * s.cols + best); target.set(b.id, [s.id, r, best]);
    }
    for (const z of zl) {
      const rows = Object.keys(quota.get(z.z)).map((r) => +r + 1).sort((a, b) => a - b);
      z.bs.forEach((b) => why.set(b.id, z.z + ' tutta insieme: ' + (rows.length > 1 ? 'righe ' + rows.join(' e ') : 'riga ' + rows[0]) + ' di ' + s.name));
    }
  }
  const moves = inC.filter((b) => { const t = target.get(b.id); return t && (t[0] !== b.shelf || t[1] !== b.r || t[2] !== b.c); })
    .map((b) => ({ b, from: [b.shelf, b.r, b.c], to: target.get(b.id), why: why.get(b.id) || '' }));
  return { moves, target };
}

/* ---- pagina ---- */
let v3 = null; // stato della scena
let v3view = 'now';
const v3done = () => { try { return new Set(JSON.parse(localStorage.getItem('cantina.riordino') || '[]')); } catch (_) { return new Set(); } };
const v3saveDone = (s) => { try { localStorage.setItem('cantina.riordino', JSON.stringify([...s])); } catch (_) {} };
const shName = (id) => { const s = S.shelves.find((x) => x.id === id); return s ? s.name : '—'; };
const posLabel = (p) => shName(p[0]) + ' · riga ' + (p[1] + 1) + ', posto ' + (p[2] + 1);

function page3d() {
  const { cantina, casa } = orderedShelves();
  if (!S.shelves.length) return '<p class="empty">Crea prima uno scaffale.</p>';
  const plan = computePlan();
  const done = v3done();
  const groups = cantina.map((s) => ({ s, items: plan.moves.filter((m) => m.to[0] === s.id).sort((a, b) => a.to[1] - b.to[1] || a.to[2] - b.to[2]) })).filter((g) => g.items.length);
  const casaTxt = casa.map((s) => `<b>${esc(s.name)}</b>${zonesText(s) ? ' (' + esc(zonesText(s)) + ')' : ''}`).join(', ');
  return `<div class="v3bar"><div class="seg seg3 v3seg"><button type="button" data-v3="now" aria-pressed="${v3view === 'now'}">Adesso</button><button type="button" data-v3="new" aria-pressed="${v3view === 'new'}">Riordinata</button></div>
  <div class="fchips v3chips"><button class="fchip on" type="button" data-v3f="cantina">Cantina</button>${cantina.map((s) => `<button class="fchip" type="button" data-v3f="${esc(s.id)}">${esc(s.name)}</button>`).join('')}${casa.length ? `<button class="fchip" type="button" data-v3f="casa">In casa</button>` : ''}</div></div>
  <div class="v3stage" id="v3stage"><p class="v3load" id="v3load">Preparo la scena…</p><div class="v3hint">Trascina per girare · pizzica per avvicinarti · tocca una bottiglia</div></div>
  <div class="v3card" id="v3card"><b>Tocca una bottiglia</b><small>Le bottiglie con l'anello dorato sono quelle da spostare per mettere in ordine la cantina.</small></div>
  <p class="info">In cantina, da sinistra: ${cantina.map((s) => esc(s.name)).join(' · ')}.${casa.length ? ' In casa: ' + casaTxt + '.' : ''} I consigli riordinano solo la cantina: ${casa.length ? 'il frigorifero non si tocca e nessuna bottiglia ci viene spostata.' : 'nessuna bottiglia cambia ambiente.'} <button class="link" type="button" data-a="v3layout">Cambia disposizione</button></p>
  <h3 class="sub">Le mosse</h3>
  ${plan.moves.length ? `<p class="info">${plan.moves.length} ${plan.moves.length === 1 ? 'bottiglia da spostare' : 'bottiglie da spostare'}: ogni zona di produzione tutta insieme, nelle righe dove è già quasi tutta. Spunta le mosse man mano che le fai.</p>
  ${groups.map((g) => `<h3 class="letter">Verso ${esc(g.s.name)} · ${g.items.length}</h3>${g.items.map((m) => `<div class="v3mv${done.has(m.b.id) ? ' ok' : ''}" data-v3m="${esc(m.b.id)}"><button class="v3ck" type="button" data-v3ck="${esc(m.b.id)}" aria-label="Fatto" aria-pressed="${done.has(m.b.id)}">✓</button><span class="v3t"><b>${esc(name(m.b))}${m.b.vintage ? ' ' + esc(m.b.vintage) : ''}</b><span class="v3pos"><i>${esc(posLabel(m.from))}</i> → <i class="to">${esc(posLabel(m.to))}</i></span><small>${esc(m.why)}</small></span></div>`).join('')}`).join('')}
  <div class="acts" style="margin-top:14px"><button class="btn pri" type="button" id="v3apply">Ho finito: aggiorna le posizioni nell'app</button></div><p class="info" id="v3am"></p>` : '<p class="info">La cantina è già in ordine: ogni zona di produzione è raggruppata.</p>'}`;
}

function loadThree() {
  if (window.THREE) return Promise.resolve();
  return new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js'; s.onload = res; s.onerror = () => rej(new Error('Non riesco a caricare la grafica 3D: controlla la connessione.')); document.head.append(s); });
}
const T3 = { rosso: '#8A2A42', bianco: '#D6BE74', bollicine: '#7FA890', rosato: '#D98B8B', altro: '#8C948F' };
const GL3 = { rosso: 0x1d2a18, bianco: 0x3a4a2a, bollicine: 0x1f3322, rosato: 0x6b4a46, altro: 0x3a3a36 };

async function init3d() {
  const stage = document.getElementById('v3stage');
  if (!stage) return;
  if (v3) { v3.stop(); v3 = null; }
  try { await loadThree(); } catch (e) { const l = document.getElementById('v3load'); if (l) l.textContent = e.message; return; }
  if (!document.body.contains(stage)) return;
  const ld = document.getElementById('v3load'); if (ld) ld.remove();
  const { cantina, casa } = orderedShelves();
  const plan = computePlan();
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  stage.prepend(renderer.domElement);
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(38, 1, 0.1, 500);
  scene.add(new THREE.HemisphereLight(0xfff2e0, 0x201410, 0.75));
  const key = new THREE.DirectionalLight(0xffe7c4, 0.9); key.position.set(-10, 25, 30); scene.add(key);
  const rim = new THREE.DirectionalLight(0xd4af6a, 0.35); rim.position.set(20, 8, -10); scene.add(rim);
  // posizione degli scaffali: cantina da sinistra a destra, poi la casa più in là
  const GAP = 2.2, HOME = 7, RX = {};
  let x = 0;
  cantina.forEach((s) => { RX[s.id] = x; x += s.cols + GAP; });
  const cantW = Math.max(0, x - GAP);
  let hx = cantW + (cantina.length ? HOME : 0);
  casa.forEach((s) => { RX[s.id] = hx; hx += s.cols + GAP; });
  const totalW = Math.max(1, hx - GAP), shift = -cantW / 2;
  const SHB = Object.fromEntries(S.shelves.map((s) => [s.id, s]));
  const slotPos = (p) => { const s = SHB[p[0]]; return new THREE.Vector3(shift + RX[p[0]] + p[2] + 0.5, (s.rows - 1 - p[1]) + 0.75, 0); };
  const wood = new THREE.MeshStandardMaterial({ color: 0x5a3e28, roughness: 0.85 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x3b3a3a, roughness: 0.5, metalness: 0.6 });
  const back = new THREE.MeshStandardMaterial({ color: 0x0d0b0a, roughness: 1 });
  const sprite = (t, w, size, col) => {
    const c = document.createElement('canvas'); c.width = 512; c.height = 96; const g = c.getContext('2d');
    g.font = `700 ${size || 58}px "Cormorant Garamond", Georgia, serif`; g.fillStyle = col || '#F2EBE3'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(t, 256, 50);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true })); sp.scale.set(w || 5.2, (w || 5.2) * 96 / 512, 1); return sp;
  };
  S.shelves.forEach((s) => {
    if (RX[s.id] == null) return;
    const w = s.cols, h = s.rows, x0 = shift + RX[s.id], home = shelfLoc(s) === 'casa';
    const frame = home ? steel : wood;
    const bk = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.1), back); bk.position.set(x0 + w / 2, h / 2 + 0.25, -1.1); scene.add(bk);
    // zone di temperatura del frigorifero: fasce colorate sul fondo
    shelfZones(s).forEach((z) => {
      const zh = z.to - z.from + 1, col = z.t <= 12 ? 0x1f3a52 : 0x4a3418;
      const band = new THREE.Mesh(new THREE.BoxGeometry(w, zh, 0.05), new THREE.MeshBasicMaterial({ color: col }));
      band.position.set(x0 + w / 2, (h - z.from - zh / 2) + 0.25, -1.04); scene.add(band);
      const lb = sprite(z.t + ' °C', 2.4, 64, z.t <= 12 ? '#9CC7E8' : '#E6B95C'); lb.position.set(x0 - 1.3, (h - z.from - zh / 2) + 0.25, 0); scene.add(lb);
    });
    for (let r = 0; r <= h; r++) { const m = new THREE.Mesh(new THREE.BoxGeometry(w + 0.12, 0.07, 1.3), frame); m.position.set(x0 + w / 2, r + 0.25, -0.45); scene.add(m); }
    for (let c = 0; c <= w; c++) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.07, h, 1.3), frame); m.position.set(x0 + c, h / 2 + 0.25, -0.45); scene.add(m); }
    if (home) { const box = new THREE.Mesh(new THREE.BoxGeometry(w + 0.6, h + 0.6, 1.6), new THREE.MeshStandardMaterial({ color: 0x2a2a2c, roughness: 0.6, metalness: 0.4, transparent: true, opacity: 0.25 })); box.position.set(x0 + w / 2, h / 2 + 0.25, -0.4); scene.add(box); }
    const sp = sprite(s.name); sp.position.set(x0 + w / 2, h + 1.0, 0); scene.add(sp);
  });
  if (cantina.length) { const sp = sprite('Cantina', 4, 50, '#A39A92'); sp.position.set(0, -0.6, 1.5); scene.add(sp); }
  if (casa.length) { const cx = shift + RX[casa[0].id] + (hx - GAP - RX[casa[0].id]) / 2; const sp = sprite('In casa', 4, 50, '#A39A92'); sp.position.set(cx, -0.6, 1.5); scene.add(sp); }
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(totalW + 30, 30), new THREE.MeshStandardMaterial({ color: 0x1a1513, roughness: 1 }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(shift + totalW / 2, 0.2, 0); scene.add(floor);
  // bottiglie coricate, collo verso di noi
  const bodyG = new THREE.CylinderGeometry(0.34, 0.34, 1.0, 20); bodyG.rotateX(Math.PI / 2);
  const shG = new THREE.SphereGeometry(0.34, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2); shG.rotateX(Math.PI / 2);
  const neckG = new THREE.CylinderGeometry(0.12, 0.13, 0.45, 14); neckG.rotateX(Math.PI / 2);
  const capG = new THREE.CylinderGeometry(0.135, 0.135, 0.22, 14); capG.rotateX(Math.PI / 2);
  const ringG = new THREE.TorusGeometry(0.42, 0.045, 8, 32), ringM = new THREE.MeshBasicMaterial({ color: 0xd4af6a });
  const pick = [], items = [];
  const moveOf = new Map(plan.moves.map((m) => [m.b.id, m]));
  Object.values(S.bottles).filter((b) => inCellar(b) && b.shelf && RX[b.shelf] != null).forEach((b) => {
    const g = new THREE.Group();
    const glass = new THREE.MeshStandardMaterial({ color: GL3[b.type] || 0x333333, roughness: 0.25, metalness: 0.2 });
    const col = new THREE.Color(T3[b.type] || '#888');
    const foil = new THREE.MeshStandardMaterial({ color: col, roughness: 0.4, metalness: 0.35, emissive: col, emissiveIntensity: 0.18 });
    const parts = [[bodyG, glass, -0.75], [shG, glass, -0.25], [neckG, glass, 0.25], [capG, foil, 0.42]].map(([geo, mat, z]) => { const m = new THREE.Mesh(geo, mat); m.position.z = z; g.add(m); m.userData.id = b.id; pick.push(m); return m; });
    const mv = moveOf.get(b.id);
    if (mv) { const ring = new THREE.Mesh(ringG, ringM); ring.position.z = 0.05; g.add(ring); }
    const from = [b.shelf, b.r, b.c], to = mv ? mv.to : from;
    g.position.copy(slotPos(v3view === 'new' ? to : from));
    scene.add(g); items.push({ b, g, from, to, mv, parts });
  });
  // telecamera
  let yaw = -0.15, pitch = 0.12, dist = 40, target = new THREE.Vector3(0, 5, 0), goal = null, anim = null, raf = 0, alive = true;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fov2 = Math.tan(THREE.MathUtils.degToRad(19));
  const frame = (x0, x1, h) => { const a = stage.clientWidth / Math.max(1, stage.clientHeight); return { t: new THREE.Vector3(shift + (x0 + x1) / 2, h / 2 + 0.6, 0), d: Math.max((h / 2 + 1.8) / fov2, ((x1 - x0) / 2 + 1.5) / fov2 / a) + 1 }; };
  const maxH = (list) => Math.max(1, ...list.map((s) => s.rows));
  const focus = (k) => {
    document.querySelectorAll('[data-v3f]').forEach((c) => c.classList.toggle('on', c.dataset.v3f === k));
    if (k === 'cantina' && cantina.length) goal = frame(0, cantW, maxH(cantina));
    else if (k === 'casa' && casa.length) goal = frame(RX[casa[0].id], hx - GAP, maxH(casa));
    else if (SHB[k]) goal = frame(RX[k], RX[k] + SHB[k].cols, SHB[k].rows);
  };
  const resize = () => { const w = stage.clientWidth, h = stage.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / Math.max(1, h); camera.updateProjectionMatrix(); };
  resize();
  { const f = frame(0, cantina.length ? cantW : totalW, maxH(cantina.length ? cantina : casa)); target.copy(f.t); dist = f.d; }
  const cv = renderer.domElement, pts = new Map(); let moved = 0, pinch0 = null;
  cv.addEventListener('pointerdown', (e) => { cv.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); moved = 0; goal = null; if (pts.size === 2) { const [p, q] = [...pts.values()]; pinch0 = { d: Math.hypot(p.x - q.x, p.y - q.y), dist }; } });
  cv.addEventListener('pointermove', (e) => {
    const p = pts.get(e.pointerId); if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY; moved += Math.abs(dx) + Math.abs(dy);
    if (pts.size === 1) { yaw = Math.max(-1.1, Math.min(1.1, yaw - dx * 0.006)); pitch = Math.max(-0.15, Math.min(0.9, pitch + dy * 0.005)); }
    else if (pts.size === 2 && pinch0) { const [a, b] = [...pts.values()]; dist = Math.max(5, Math.min(120, pinch0.dist * pinch0.d / Math.max(10, Math.hypot(a.x - b.x, a.y - b.y)))); }
  });
  const ray = new THREE.Raycaster(), mv2 = new THREE.Vector2();
  cv.addEventListener('pointerup', (e) => {
    if (pts.size === 1 && moved < 8) {
      const r = cv.getBoundingClientRect(); mv2.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(mv2, camera); const hit = ray.intersectObjects(pick)[0]; select(hit ? hit.object.userData.id : null);
    }
    pts.delete(e.pointerId); if (pts.size < 2) pinch0 = null;
  });
  cv.addEventListener('pointercancel', (e) => { pts.delete(e.pointerId); pinch0 = null; });
  cv.addEventListener('wheel', (e) => { e.preventDefault(); goal = null; dist = Math.max(5, Math.min(120, dist * (1 + e.deltaY * 0.001))); }, { passive: false });
  let selRing = null;
  function select(id, fly) {
    if (selRing) { selRing.parent && selRing.parent.remove(selRing); selRing = null; }
    const it = items.find((x) => x.b.id === id), card = document.getElementById('v3card');
    if (!it) { card.innerHTML = '<b>Tocca una bottiglia</b><small>Le bottiglie con l\'anello dorato sono quelle da spostare per mettere in ordine la cantina.</small>'; return; }
    selRing = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.05, 8, 32), new THREE.MeshBasicMaterial({ color: 0xffffff })); selRing.position.z = 0.1; it.g.add(selRing);
    const b = it.b, z = shelfZones(SHB[b.shelf] || {}).find((q) => b.r >= q.from && b.r <= q.to);
    card.innerHTML = `<span class="v3row">${b.thumb ? `<img src="${b.thumb}" alt="">` : `<i class="vdot t-${esc(b.type)}">${esc(String(b.vintage || '').slice(-2))}</i>`}<span><b>${esc(name(b))}${b.vintage ? ' ' + esc(b.vintage) : ''}</b><small>${it.mv ? esc(it.mv.why) : 'Resta dov\'è' + (z ? ' (zona a ' + z.t + ' °C)' : '') + '.'}</small><span class="v3pos"><i>${esc(posLabel(it.from))}</i>${it.mv ? ` → <i class="to">${esc(posLabel(it.to))}</i>` : ''}</span></span></span><button class="link" type="button" data-v3open="${esc(b.id)}">Apri la scheda</button>`;
    if (fly) { const p = slotPos(v3view === 'new' ? it.to : it.from); goal = { t: new THREE.Vector3(p.x, p.y, 0), d: 13 }; }
  }
  function setView(v) {
    if (v === v3view) return; v3view = v;
    document.querySelectorAll('[data-v3]').forEach((x) => x.setAttribute('aria-pressed', x.dataset.v3 === v));
    const t0 = performance.now(), dur = reduce ? 1 : 1300, from = items.map((it) => it.g.position.clone());
    anim = (t) => {
      const k = Math.min(1, (t - t0) / dur), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      items.forEach((it, i) => { it.g.position.lerpVectors(from[i], slotPos(v === 'new' ? it.to : it.from), e); if (it.mv) it.g.position.z = Math.sin(Math.PI * e) * 1.6; });
      if (k >= 1) anim = null;
    };
  }
  function loop(t) {
    if (!alive) return;
    if (!document.body.contains(stage)) { stop(); return; }
    if (anim) anim(t);
    if (goal) { target.lerp(goal.t, 0.09); dist += (goal.d - dist) * 0.09; if (Math.abs(goal.d - dist) < 0.05 && target.distanceTo(goal.t) < 0.02) goal = null; }
    const pulse = 0.6 + 0.4 * Math.sin(t / 380); ringM.color.setRGB(0.83 * pulse + 0.17, 0.69 * pulse + 0.1, 0.42 * pulse + 0.05);
    camera.position.set(target.x + dist * Math.sin(yaw) * Math.cos(pitch), target.y + dist * Math.sin(pitch), target.z + dist * Math.cos(yaw) * Math.cos(pitch)); camera.lookAt(target);
    renderer.render(scene, camera); raf = requestAnimationFrame(loop);
  }
  function stop() { alive = false; cancelAnimationFrame(raf); window.removeEventListener('resize', resize); try { renderer.dispose(); } catch (_) {} }
  window.addEventListener('resize', resize);
  raf = requestAnimationFrame(loop);
  v3 = { stop, setView, focus, select };
}

async function applyPlan() {
  const plan = computePlan();
  // tutte insieme e un solo ridisegno alla fine
  const now = Date.now();
  if (v3) { v3.stop(); v3 = null; }
  const list = plan.moves.map((m) => { const nb = { ...S.bottles[m.b.id], shelf: m.to[0], r: m.to[1], c: m.to[2], upd: now }; S.bottles[nb.id] = nb; return nb; });
  await Promise.all(list.map((nb) => dbPut('bottles', nb).catch(() => {})));
  if (typeof scheduleSync === 'function') scheduleSync();
  v3saveDone(new Set());
  return plan.moves.length;
}

// Disposizione: dove si trova ogni scaffale e in che ordine
function layoutDialog() {
  const d = $('#dlg2');
  const { cantina, casa } = orderedShelves();
  const list = [...cantina, ...casa];
  d.innerHTML = `<p class="eyebrow">Cantina in 3D</p><h2>Disposizione</h2><p class="info">Dove si trova ogni scaffale e in che ordine lo vedi da sinistra. Le zone di temperatura le cambi da «Modifica» sullo scaffale.</p>
  <div class="grp">${list.map((s, i) => `<div class="fr"><label>${esc(s.name)}</label><span><select data-loc="${esc(s.id)}"><option value="cantina" ${shelfLoc(s) === 'cantina' ? 'selected' : ''}>Cantina</option><option value="casa" ${shelfLoc(s) === 'casa' ? 'selected' : ''}>In casa</option></select><button class="link" type="button" data-up="${esc(s.id)}" aria-label="Più a sinistra">‹</button><button class="link" type="button" data-dn="${esc(s.id)}" aria-label="Più a destra">›</button></span></div>`).join('')}</div>
  <div class="acts" style="margin-top:12px"><button class="btn pri" type="button" id="ly_ok">Fatto</button></div>`;
  const save = async () => { await persistShelves(); };
  d.querySelectorAll('[data-loc]').forEach((el) => { el.onchange = async () => { const s = S.shelves.find((x) => x.id === el.dataset.loc); s.loc = el.value; await save(); }; });
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

document.addEventListener('click', async (e) => {
  const t = e.target.closest && e.target.closest('[data-v3],[data-v3f],[data-v3ck],[data-v3m],[data-v3open],#v3apply,[data-a="v3layout"]');
  if (!t) return;
  if (t.dataset.v3) { if (v3) v3.setView(t.dataset.v3); else v3view = t.dataset.v3; return; }
  if (t.dataset.v3f) { if (v3) v3.focus(t.dataset.v3f); return; }
  if (t.dataset.v3open) { openBottle(t.dataset.v3open); return; }
  if (t.dataset.a === 'v3layout') { layoutDialog(); return; }
  if (t.dataset.v3ck) {
    const s = v3done(), id = t.dataset.v3ck; if (s.has(id)) s.delete(id); else s.add(id); v3saveDone(s);
    t.setAttribute('aria-pressed', s.has(id)); t.closest('.v3mv').classList.toggle('ok', s.has(id)); return;
  }
  if (t.id === 'v3apply') {
    if (!t.dataset.armed) { t.dataset.armed = '1'; t.textContent = 'Conferma: sposto ' + computePlan().moves.length + ' bottiglie nell\'app'; $('#v3am').textContent = 'Fallo quando hai spostato davvero le bottiglie negli scaffali.'; return; }
    t.disabled = true; t.textContent = 'Aggiorno…'; const n = await applyPlan(); v3view = 'now'; render(); msg('Posizioni aggiornate: ' + n + (n === 1 ? ' bottiglia.' : ' bottiglie.')); setTimeout(() => msg(''), 5000); return;
  }
  if (t.dataset.v3m && v3) { v3.select(t.dataset.v3m, true); const st = document.getElementById('v3stage'); if (st) st.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
});
