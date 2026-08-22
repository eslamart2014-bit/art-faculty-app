// Service Worker v1.3 - Force update on new version
const CACHE_VERSION = 'v1.3';
const CACHE_NAME = 'art-edu-cache-' + CACHE_VERSION;

// On install - skip waiting immediately to take control
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(['/', '/manifest.json', '/icon-192.png', '/version.json']);
    })
  );
});

// On activate - delete ALL old caches immediately
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch - Network first for HTML/JS/CSS, cache for images
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // Always fetch fresh for API and HTML pages
  if (event.request.mode === 'navigate' || 
      url.pathname.startsWith('/api/') ||
      url.pathname === '/version.json') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  // For static assets: cache first, then network
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => cached);
    })
  );
});

// Listen for message to force refresh
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data === 'CLEAR_CACHE') {
    caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))));
  }
});
