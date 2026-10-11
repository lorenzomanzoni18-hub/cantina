// Salva i file dell'app per farla funzionare anche senza connessione.
const VERSION = 'cantina-v19';
const FILES = ['./', './index.html', './styles.css', './app.js', './extras.js', './backup.js', './tools.js', './calici.js', './more.js', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== FONTS).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

// Prima la copia salvata (veloce, offline), poi aggiorna in silenzio dalla rete.
const FONTS = 'cantina-fonts';
self.addEventListener('fetch', (e) => {
  const req = e.request;
  const host = new URL(req.url).hostname;
  // Caratteri, lettore di codici e mappa: salvati la prima volta, poi funzionano anche senza internet.
  if (req.method === 'GET' && ['fonts.googleapis.com', 'fonts.gstatic.com', 'cdn.jsdelivr.net', 'cdnjs.cloudflare.com'].includes(host)) {
    e.respondWith(caches.open(FONTS).then((c) => c.match(req).then((hit) => hit || fetch(req).then((res) => { if (res.ok || res.type === 'opaque') c.put(req, res.clone()); return res; }).catch(() => hit))));
    return;
  }
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    caches.match(req).then((hit) => {
      const net = fetch(req)
        .then((res) => {
          if (res.ok) caches.open(VERSION).then((c) => c.put(req, res.clone()));
          return res;
        })
        .catch(() => hit);
      return hit || net;
    })
  );
});
