// Service worker: permite jogar offline na versão web/PWA.
const CACHE = 'desata-v3';
const ASSETS = [
  './', 'index.html', 'privacidade.html', 'manifest.webmanifest', 'css/style.css',
  'js/main.js', 'js/config.js', 'js/levels.js', 'js/core.js', 'js/rng.js',
  'js/game.js', 'js/render.js', 'js/storage.js', 'js/audio.js', 'js/ads.js',
  'js/i18n.js', 'js/themes.js', 'js/ropes.js',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return; // anúncios e afins: sempre rede
  e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request)));
});
