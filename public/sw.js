// Service Worker v3.1.0 - Next.js True Offline-First Engine
const CACHE_VERSION = 'v3.1.2';
const STATIC_CACHE = 'art-edu-static-' + CACHE_VERSION;
const DYNAMIC_CACHE = 'art-edu-dynamic-' + CACHE_VERSION;

const CORE_ASSETS = [
  '/',
  '/manifest.json',
  '/icon-192.png'
];

// Install: pre-cache core app shell
// LOW-6 FIX: Do NOT call skipWaiting() unconditionally here.
// Waiting for all open tabs to close prevents disrupting active users mid-session.
// skipWaiting() is called only in response to SKIP_WAITING message (below).
self.addEventListener('install', event => {
  console.log('[SW] Installing v2.1 (Offline-First Engine)...');
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => {
      return cache.addAll(CORE_ASSETS).catch(err => {
        console.warn('[SW] Pre-cache initial warning:', err);
      });
    })
  );
});

// Activate: delete old caches and claim all clients immediately
self.addEventListener('activate', event => {
  console.log('[SW] Activating v2.1, clearing all old caches...');
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(k => k !== STATIC_CACHE && k !== DYNAMIC_CACHE).map(k => {
          console.log('[SW] Deleting obsolete cache:', k);
          return caches.delete(k);
        })
      );
    }).then(() => self.clients.claim()).then(() => {
      return self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    }).then(clients => {
      console.log('[SW] Notifying', clients.length, 'clients of update');
      clients.forEach(c => c.postMessage({ type: 'SW_UPDATED', version: CACHE_VERSION }));
    })
  );
});

// Fetch event handler
self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  // Skip non-GET requests
  if (req.method !== 'GET') return;

  // Skip Supabase API and /api/ backend calls (they are handled client-side via syncEngine)
  if (url.pathname.startsWith('/api/') || url.hostname.includes('supabase.co')) {
    return;
  }

  // 1. Next.js Static Chunks & Build Artifacts (/_next/static/...)
  // These files have unique build hashes and NEVER change: Cache-First!
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async cache => {
        const cached = await cache.match(req);
        if (cached) return cached;
        try {
          const res = await fetch(req);
          if (res && res.status === 200) {
            cache.put(req, res.clone());
          }
          return res;
        } catch (err) {
          return cached || new Response('', { status: 404 });
        }
      })
    );
    return;
  }

  // 2. Navigation requests (HTML pages)
  // Network-First with fallback to exact cached page, then fallback to App Shell '/'
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then(async res => {
        if (res && res.status === 200) {
          const cache = await caches.open(DYNAMIC_CACHE);
          cache.put(req, res.clone());
          // Also save as root fallback if this is home
          if (url.pathname === '/') {
            const staticCache = await caches.open(STATIC_CACHE);
            staticCache.put('/', res.clone());
          }
        }
        return res;
      }).catch(async () => {
        // OFFLINE MODE:
        // A. Try exact requested URL in dynamic cache
        const cachedPage = await caches.match(req);
        if (cachedPage) return cachedPage;

        // B. Fallback to App Shell '/'
        const rootShell = await caches.match('/');
        if (rootShell) return rootShell;

        // C. Standalone beautiful offline fallback page
        return new Response(`
          <!DOCTYPE html>
          <html lang="ar" dir="rtl">
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <title>نظام التربية الفنية - وضع عدم الاتصال</title>
            <style>
              body { background: #121212; color: #fff; font-family: system-ui, -apple-system, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; padding: 20px; box-sizing: border-box; }
              .card { background: #1e1e1e; border: 1px solid #333; border-radius: 16px; padding: 30px 20px; max-width: 380px; width: 100%; box-shadow: 0 8px 30px rgba(0,0,0,0.5); }
              .icon { font-size: 50px; margin-bottom: 15px; }
              h2 { color: #4CAF50; margin: 0 0 10px 0; font-size: 20px; }
              p { color: #aaa; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0; }
              button { background: #2196F3; color: #fff; border: none; padding: 12px 25px; border-radius: 25px; font-size: 15px; font-weight: bold; cursor: pointer; width: 100%; }
            </style>
          </head>
          <body>
            <div class="card">
              <div class="icon">📶</div>
              <h2>أنت في وضع عدم الاتصال</h2>
              <p>التطبيق يعمل بدون إنترنت بكامل كفاءته. اضغط على الزر بالأسفل للعودة إلى الشاشة الرئيسية واستعراض مقرراتك.</p>
              <button onclick="window.location.href='/'">الذهاب للرئيسية</button>
            </div>
            <script>
              window.addEventListener('online', () => window.location.reload());
            </script>
          </body>
          </html>
        `, {
          headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });
      })
    );
    return;
  }

  // 3. Static Media Assets (Images, Icons, Fonts)
  if (url.pathname.match(/\.(png|jpg|jpeg|svg|ico|woff2?|webp)$/)) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async cache => {
        const cached = await cache.match(req);
        if (cached) return cached;
        try {
          const res = await fetch(req);
          if (res && res.status === 200) {
            cache.put(req, res.clone());
          }
          return res;
        } catch (e) {
          return cached || new Response('', { status: 404 });
        }
      })
    );
    return;
  }

  // 4. Other internal assets: Cache-Falling-Back-to-Network or Stale-While-Revalidate
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then(async cached => {
        const fetchPromise = fetch(req).then(async res => {
          if (res && res.status === 200) {
            const cache = await caches.open(DYNAMIC_CACHE);
            cache.put(req, res.clone());
          }
          return res;
        }).catch(() => cached);
        return cached || fetchPromise;
      })
    );
    return;
  }
});

// Messages
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
  if (event.data === 'CLEAR_CACHE') {
    caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))));
  }
});
