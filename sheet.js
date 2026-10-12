/* Finestre a tendina: si chiudono trascinando verso il basso, con la ✕ in alto o toccando fuori. */
(function () {
  const closeDlg = (d) => { const cl = d.querySelector('#cl'); if (cl && d.id === 'dlg') cl.click(); else d.close(); };
  const ensureX = (d) => {
    if (!d.open || d.querySelector('.shtop') || d.querySelector(':scope > .xclose')) return;
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'xclose'; b.setAttribute('aria-label', 'Chiudi');
    b.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
    b.onclick = () => closeDlg(d);
    d.prepend(b);
  };
  const noDrag = (t) => t.closest && t.closest('canvas, input, textarea, select, .lcw, [contenteditable="true"], .grid, .tr-wrap');
  function wire(d) {
    if (d._sheet) return; d._sheet = true;
    new MutationObserver(() => ensureX(d)).observe(d, { attributes: true, attributeFilter: ['open'], childList: true });
    // tocco sullo sfondo scuro fuori dalla finestra
    d.addEventListener('click', (e) => {
      if (e.target !== d) return;
      const r = d.getBoundingClientRect();
      if (e.clientY < r.top || e.clientY > r.bottom || e.clientX < r.left || e.clientX > r.right) closeDlg(d);
    });
    // trascinamento verso il basso
    let y0 = null, dy = 0, t0 = 0, active = false;
    d.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1) return;
      const r = d.getBoundingClientRect(), y = e.touches[0].clientY;
      const onHandle = y - r.top < 64;
      if (!onHandle && (d.scrollTop > 0 || noDrag(e.target))) return;
      y0 = y; dy = 0; t0 = Date.now(); active = false;
    }, { passive: true });
    d.addEventListener('touchmove', (e) => {
      if (y0 == null) return;
      dy = e.touches[0].clientY - y0;
      if (!active && dy > 8 && d.scrollTop <= 0) { active = true; d.style.transition = 'none'; }
      if (!active) { if (dy < -4) y0 = null; return; }
      if (e.cancelable) e.preventDefault();
      d.style.transform = 'translateY(' + Math.max(0, dy) + 'px)';
    }, { passive: false });
    const end = () => {
      if (y0 == null) return;
      const fast = dy > 60 && Date.now() - t0 < 250;
      y0 = null;
      if (!active) return;
      active = false;
      d.style.transition = 'transform .2s ease';
      if (dy > 120 || fast) {
        d.style.transform = 'translateY(100%)';
        setTimeout(() => { d.style.transition = ''; d.style.transform = ''; closeDlg(d); }, 180);
      } else {
        d.style.transform = '';
        setTimeout(() => { d.style.transition = ''; }, 220);
      }
    };
    d.addEventListener('touchend', end); d.addEventListener('touchcancel', end);
  }
  const scan = () => document.querySelectorAll('dialog').forEach(wire);
  scan();
  new MutationObserver(scan).observe(document.body, { childList: true });
})();
