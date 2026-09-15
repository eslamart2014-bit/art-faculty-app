// Service Worker v2.0 - FORCE PWA UPDATE
const CACHE_VERSION = 'v2.0';
const CACHE_NAME = 'art-edu-cache-' + CACHE_VERSION;

// INSTALL: skip waiting immediately so we take control ASAP
self.addEventListener('install', event => {
  console.log('[SW] Installing v2.0, skipWaiting...');
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      cache.addAll(['/', '/manifest.json'])
    ).catch(() => {})
  );
});

// ACTIVATE: delete ALL old caches, claim all clients, then force reload
self.addEventListener('activate', event => {
  console.log('[SW] Activating v2.0, clearing old caches...');
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => {
        console.log('[SW] Deleting old cache:', k);
        return caches.delete(k);
      })))
      .then(() => self.clients.claim())
      .then(() => {
        return self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      })
      .then(clients => {
        console.log('[SW] Telling', clients.length, 'clients to reload...');
        clients.forEach(client => {
          client.postMessage({ type: 'SW_UPDATED', version: CACHE_VERSION });
        });
      })
  );
});

// FETCH: network-first for everything to avoid stale content
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Skip non-GET
  if (event.request.method !== 'GET') return;

  // Always network-first for navigation, API, and version checks
  if (event.request.mode === 'navigate' ||
      url.pathname.startsWith('/api/') ||
      url.pathname === '/version.json') {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' }).catch(() => caches.match(event.request))
    );
    return;
  }

  // Cache-first for static media assets
  if (url.pathname.match(/\.(png|jpg|jpeg|svg|ico|woff2?)$/)) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(res => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
          return res;
        }).catch(() => cached);
      })
    );
    return;
  }

  // Network-first for JS/CSS/HTML
  event.respondWith(
    fetch(event.request, { cache: 'no-store' }).catch(() => caches.match(event.request))
  );
});

// Handle messages from the page
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
  if (event.data === 'CLEAR_CACHE') {
    caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))));
  }
});
