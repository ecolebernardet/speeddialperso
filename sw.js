// sw.js — Service Worker pour Speed Dial Perso
const CACHE_NAME = 'speeddial-v1';

// Fichiers à mettre en cache au premier chargement
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './script.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// ─── INSTALLATION : mise en cache des assets de base ───
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// ─── ACTIVATION : nettoyage des anciens caches ───
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// ─── FETCH : stratégie Cache-First pour les assets locaux,
//             Network-First pour les favicons Google (externe) ───
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Favicons Google : réseau d'abord, cache en fallback
  if (url.hostname === 'www.google.com' && url.pathname.includes('favicon')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Tout le reste (assets locaux) : cache d'abord
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        // Ne pas mettre en cache les requêtes non-GET ou échouées
        if (!response || response.status !== 200 || event.request.method !== 'GET') {
          return response;
        }
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      });
    })
  );
});
