/* ============================================================================
   SIMPLICITY ERP - HIGH-PERFORMANCE OFFLINE-FIRST PWA SERVICE WORKER
   File: sw.js • Developed by Farhan Jawed
   Architecture: Network-First for Fresh Updates | Safe Offline Fallback (v15)
============================================================================ */

const CACHE_NAME = 'simplicity-cache-v15';

const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './sancha.html',
  './landing.html',
  './style.css?v=3.5',
  './manifest.json?v=3.3',
  './icon-192.png?v=3.3',
  './icon-512.png?v=3.3',

  // Core Engine Modules
  './core/utils.js?v=3.2',
  './core/storage.js?v=3.2',
  './core/database.js?v=3.2',
  './core/karkhana.js?v=3.2',
  './core/tally-master.js?v=3.7',
  './core/central-master.js?v=1.0',

  // Access & Profile
  './auth/auth.js?v=3.2',
  './auth/profile.js?v=3.2',

  // Session & Closing
  './session/session.js?v=3.2',
  './session/session-closing.js?v=3.2',

  // Calculation Modules
  './kariger/kariger-calc.js?v=3.2',
  './bana/bana-calc.js?v=3.2',
  './zari/zari-calc.js?v=3.2',
  './sancha/sancha-calc.js?v=3.2',
  './saree/saree-calc.js?v=3.3',
  './cutting/cutting-calc.js?v=3.2',
  './embroidery/embroidery-calc.js?v=3.2',
  './calender/calender-calc.js?v=3.2',

  // UI Controllers & Views
  './kariger/kariger-ui.js?v=3.2',
  './bana/bana-ui.js?v=3.2',
  './zari/zari-ui.js?v=3.2',
  './sancha/sancha-ui.js?v=3.2',
  './saree/saree-ui.js?v=3.3',
  './cutting/cutting-ui.js?v=3.2',
  './embroidery/embroidery-ui.js?v=3.2',
  './calender/calender-ui.js?v=3.2',
  './dukan/dukan.js?v=3.2',
  './payment/payment.js?v=3.2',
  './jobwork-ui/jobwork-forms.js?v=3.2',
  './jobwork.js?v=3.2',
  './jobwork-express/jobwork-express.js?v=3.3',
  './daybook/daybook.js?v=3.2',
  './info/info-ledger.js?v=3.2',
  './tani/tani-order.js?v=3.2',
  './tani/tani-express.js?v=3.2',
  './tani/sancha-portal-sync.js',
  './backup/backup.js?v=3.2',
  './admin/admin.js?v=3.2',

  // JobWork Trail Modules
  './jobwork-trail/jwt-core.js?v=1.2',
  './jobwork-trail/jwt-engine.js?v=1.2',
  './jobwork-trail/jwt-print.js?v=1.2',
  './jobwork-trail/jwt-screens-1.js?v=1.3',
  './jobwork-trail/jwt-screens-2.js?v=1.2',
  './jobwork-trail/jwt-controllers.js?v=1.2',

  // Dukan ERP Modules
  './dukan-erp/dukan-core.js?v=1.1',
  './dukan-erp/dukan-master.js?v=1.1',
  './dukan-erp/dukan-party-reg.js?v=1.0',
  './dukan-erp/dukan-barcode.js?v=1.0',
  './dukan-erp/dukan-order.js?v=1.0',
  './dukan-erp/dukan-challan.js?v=1.0'
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
      .catch(async () => {
        const cachedResponse = await caches.match(request, { ignoreSearch: true });
        if (cachedResponse) return cachedResponse;

        if (request.mode === 'navigate') {
          const isSubPortal =
            url.pathname.includes('/kariger-portal/') ||
            url.pathname.includes('/sancha-portal/') ||
            url.pathname.includes('/rangai-portal/');

          if (!isSubPortal) {
            const indexFallback = await caches.match('./index.html');
            if (indexFallback) return indexFallback;
          }
        }

        return new Response('Offline - Internet connection check karein.', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
      })
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});
