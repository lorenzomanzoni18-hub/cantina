/* Trascina in giù dall'alto per aggiornare: sincronizza con l'altro dispositivo e ridisegna la pagina. */
(function pullToRefresh() {
  const TH = 70, MAX = 110;
  const ind = document.createElement('div');
  ind.className = 'ptr';
  ind.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 11a8 8 0 0 0-14.6-4.5M4 4v3h3M4 13a8 8 0 0 0 14.6 4.5M20 20v-3h-3"/></svg>';
  document.body.appendChild(ind);
  let y0 = null, x0 = 0, dy = 0, busy = false, armed = false;
  const show = (d) => {
    const p = Math.min(d / TH, 1);
    ind.style.transform = `translate(-50%, ${Math.min(d, MAX) - 50}px) rotate(${d * 3}deg)`;
    ind.style.opacity = p;
    ind.classList.toggle('ready', d >= TH);
  };
  const hide = () => { ind.style.transition = 'transform .25s, opacity .25s'; ind.style.transform = 'translate(-50%, -50px)'; ind.style.opacity = 0; setTimeout(() => { ind.style.transition = ''; }, 260); };
  const blocked = (t) => document.querySelector('dialog[open]') || (t.closest && t.closest('.cell[data-a="slot"], input, textarea, select, .ghost'));
  document.addEventListener('touchstart', (e) => {
    if (busy || e.touches.length !== 1 || window.scrollY > 0 || blocked(e.target)) { y0 = null; return; }
    y0 = e.touches[0].clientY; x0 = e.touches[0].clientX; dy = 0; armed = false;
  }, { passive: true });
  document.addEventListener('touchmove', (e) => {
    if (y0 == null) return;
    const t = e.touches[0], d = t.clientY - y0;
    if (!armed) {
      if (Math.abs(t.clientX - x0) > Math.abs(d) || d < 6 || window.scrollY > 0 || document.querySelector('.ghost')) { if (Math.abs(t.clientX - x0) > 10 || d < -6) y0 = null; return; }
      armed = true;
    }
    dy = d * 0.55;
    if (e.cancelable) e.preventDefault();
    show(dy);
  }, { passive: false });
  const end = async () => {
    if (y0 == null) return;
    y0 = null;
    if (!armed) return;
    armed = false;
    if (dy < TH) { hide(); return; }
    busy = true;
    try { typeof haptic === 'function' && haptic(); } catch (_) {}
    ind.classList.add('spin'); ind.style.transform = 'translate(-50%, 20px)'; ind.style.opacity = 1;
    try {
      if (typeof syncOn === 'function' && syncOn() && navigator.onLine) {
        const r = await syncNow();
        const n = r && !r.skipped ? (r.pulled || 0) + (r.removed || 0) : 0;
        msg(r && r.skipped ? 'Aggiornamento già in corso.' : n ? 'Aggiornato: ' + n + (n === 1 ? ' modifica ricevuta.' : ' modifiche ricevute.') : 'Tutto aggiornato.');
      } else if (!navigator.onLine) msg('Sei offline: mostro i dati salvati sul telefono.');
      render();
    } catch (err) { msg('Aggiornamento non riuscito: ' + esc(err.message || String(err))); }
    setTimeout(() => msg(''), 3000);
    ind.classList.remove('spin'); hide(); busy = false;
  };
  document.addEventListener('touchend', end, { passive: true });
  document.addEventListener('touchcancel', () => { y0 = null; armed = false; hide(); }, { passive: true });
})();
