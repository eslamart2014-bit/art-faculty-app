// Service Worker v3.7.0 - Next.js offline shell (authenticated routes are network-only)
const CACHE_VERSION = 'v3.7.0';
const STATIC_CACHE = 'art-edu-static-' + CACHE_VERSION;
const DYNAMIC_CACHE = 'art-edu-dynamic-' + CACHE_VERSION;

// Only the public login shell and static PWA assets are pre-cached.
const CORE_ASSETS = [
  '/',
  '/manifest.json',
  '/manifest-student.json',
  '/icon-192.png'
];

// Personal or staff-only areas: never cache their HTML/RSC payloads.
const AUTH_ROUTE_PREFIXES = [
  '/system',
  '/student-portal',
  '/coordinator',
  '/instructor',
  '/admin-portal',
  '/camera',
  '/course',
  '/bot'
];

function isAuthenticatedRoute(pathname) {
  return AUTH_ROUTE_PREFIXES.some(
    prefix => pathname === prefix || pathname.startsWith(prefix + '/')
  );
}

const OFFLINE_HTML = `
  <!DOCTYPE html>
  <html lang="ar" dir="rtl">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>نظام التربية الفنية — جامعة قنا • كلية التربية النوعية</title>
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
      <p>تعذر الوصول إلى الإنترنت. أعد الاتصال ثم حاول فتح الصفحة مرة أخرى.</p>
      <button onclick="window.location.href='/'">الذهاب للرئيسية</button>
    </div>
    <script>
      window.addEventListener('online', () => window.location.reload());
    </script>
  </body>
  </html>
`;

function offlineHtmlResponse() {
  return new Response(OFFLINE_HTML, {
    status: 503,
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
}

// Install: pre-cache core app shell and immediately activate
self.addEventListener('install', event => {
  console.log('[SW] Installing ' + CACHE_VERSION + '...');
  self.skipWaiting();
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
  console.log('[SW] Activating ' + CACHE_VERSION + ', clearing all old caches...');
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

  // Never cache media or API responses: they are user-specific and require cookies.
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

  // 2. Navigation requests & Next.js Client-Side Transitions (HTML & RSC)
  const isNavigation = req.mode === 'navigate';
  const isRSC = url.searchParams.has('_rsc') || req.headers.get('RSC') === '1';

  if (isNavigation || isRSC) {
    // Personal/staff areas must never be stored or served from a shared cache.
    if (isAuthenticatedRoute(url.pathname)) {
      event.respondWith((async () => {
        try {
          return await fetch(req);
        } catch (err) {
          if (isRSC) {
            return new Response('[]', { headers: { 'Content-Type': 'application/json' } });
          }
          return offlineHtmlResponse();
        }
      })());
      return;
    }

    // Public login shell: fast network with offline fallback.
    event.respondWith((async () => {
      // 1. Try to fetch with a fast 1500ms timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1500);

      try {
        const res = await fetch(req, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (res && res.status === 200) {
          const cache = await caches.open(DYNAMIC_CACHE);
          cache.put(req, res.clone());
          // Also save clean pathname for offline matching
          if (url.pathname) {
            cache.put(url.pathname, res.clone());
          }
          if (url.pathname === '/') {
            const staticCache = await caches.open(STATIC_CACHE);
            staticCache.put('/', res.clone());
          }
        }
        return res;
      } catch (err) {
        clearTimeout(timeoutId);

        // OFFLINE / SLOW NETWORK MODE:
        // A. Try exact requested URL in cache
        const cachedPage = await caches.match(req);
        if (cachedPage) return cachedPage;

        // B. Try matching without query params
        const cachedClean = await caches.match(url.pathname);
        if (cachedClean) return cachedClean;

        // C. Fallback to the public app shell
        const rootShell = await caches.match('/');
        if (rootShell) return rootShell;

        if (isRSC) {
          return new Response('[]', { headers: { 'Content-Type': 'application/json' } });
        }

        return offlineHtmlResponse();
      }
    })());
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
