/* ============================================================================
   SIMPLICITY ERP - HIGH-PERFORMANCE OFFLINE-FIRST PWA SERVICE WORKER
   File: sw.js • Developed by Farhan Jawed
   Architecture: Network-First for Fresh Updates | Offline Cache Fallback (v6)
============================================================================ */

const CACHE_NAME = 'simplicity-cache-v6';

const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './sancha.html',
  './landing.html',
  './style.css',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',

  // Core Engine Modules
  './core/utils.js',
  './core/storage.js',
  './core/database.js',
  './core/karkhana.js',

  // Access & Profile
  './auth/auth.js',
  './auth/profile.js',

  // Session & Closing
  './session/session.js',
  './session/session-closing.js',

  // Calculation Modules
  './kariger/kariger-calc.js',
  './bana/bana-calc.js',
  './zari/zari-calc.js',
  './sancha/sancha-calc.js',
  './saree/saree-calc.js',
  './cutting/cutting-calc.js',
  './calender/calender-calc.js',

  // UI Controllers & Views
  './kariger/kariger-ui.js',
  './bana/bana-ui.js',
  './zari/zari-ui.js',
  './sancha/sancha-ui.js',
  './saree/saree-ui.js',
  './cutting/cutting-ui.js',
  './calender/calender-ui.js',
  './dukan/dukan.js',
  './payment/payment.js',
  './jobwork.js',
  './daybook/daybook.js',
  './tani/tani-order.js',
  './tani/tani-express.js',
  './tani/sancha-portal-sync.js',
  './backup/backup.js',
  './admin/admin.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      for (const assetUrl of ASSETS_TO_CACHE) {
        try {
          await cache.add(new Request(assetUrl, { cache: 'reload' }));
        } catch (err) {
          console.warn(`[ServiceWorker] Skipped asset: ${assetUrl}`, err);
        }
      }
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((existingCache) => {
          if (existingCache !== CACHE_NAME) {
            return caches.delete(existingCache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Never cache Supabase, Firebase, Google APIs or WebSockets
  if (
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('firebaseio.com') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('gstatic.com') ||
    url.origin !== self.location.origin ||
    request.headers.get('Upgrade') === 'websocket'
  ) {
    return;
  }

  // Network-First with Offline Cache Fallback
  event.respondWith(
    fetch(request, { cache: 'no-cache' })
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(request).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          if (request.mode === 'navigate') {
            return caches.match('./index.html');
          }
          return null;
        });
      })
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});
