// Salva i file dell'app per farla funzionare anche senza connessione.
const VERSION = 'cantina-v32';
const FILES = ['./', './index.html', './styles.css', './app.js', './extras.js', './backup.js', './tools.js', './calici.js', './more.js', './tracer.js', './producer.js', './sync.js', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];

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
  // Prima la rete (così vedi subito l'ultima versione); se in 4 secondi non risponde o sei offline, la copia salvata.
  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    try {
      const res = await Promise.race([fetch(req, { cache: 'no-cache' }), new Promise((_, rej) => setTimeout(() => rej(new Error('lento')), 4000))]);
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    } catch (_) {
      const hit = await cache.match(req, { ignoreSearch: true });
      return hit || fetch(req);
    }
  })());
});
