/* ============================================================================
   SIMPLICITY ERP - HIGH-PERFORMANCE OFFLINE-FIRST PWA SERVICE WORKER
   File: sw.js • Developed by Farhan Jawed
   Architecture: Cache-First with Network Revalidation | Safe Stream Fallbacks
   Scale: 1,000,000 - 2,000,000 Active Users | Offline Resilience (v5)
============================================================================ */

const CACHE_NAME = 'simplicity-cache-v5';

// Complete App Shell Manifest (Critical CSS, HTML, Icons & All Modular JS Scripts)
const ASSETS_TO_CACHE = [
  './',
  './index.html',
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

  // Calculation Modules (Math & Accounting)
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
  './backup/backup.js',
  './admin/admin.js'
];

/* ============================================================================
   1. INSTALL EVENT (FAULT-TOLERANT INDIVIDUAL PRE-CACHING)
   ----------------------------------------------------------------------------
   Standard `cache.addAll()` ek single file missing hone par fail ho jata hai.
   Yeh resilient loop har asset ko safely cache karta hai aur install fail hone
   se 100% bachata hai.
============================================================================ */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      console.log(`[ServiceWorker] Pre-caching App Shell (${CACHE_NAME})...`);
      
      for (const assetUrl of ASSETS_TO_CACHE) {
        try {
          // Fetch with 'reload' to bypass intermediate HTTP browser caches
          await cache.add(new Request(assetUrl, { cache: 'reload' }));
        } catch (err) {
          console.warn(`[ServiceWorker] Skipped non-critical asset: ${assetUrl}`, err);
        }
      }
    }).then(() => {
      // Force new Service Worker to activate immediately without waiting for browser restart
      return self.skipWaiting();
    })
  );
});

/* ============================================================================
   2. ACTIVATE EVENT (AGGRESSIVE PURGE OF V1-V4 STALE CACHES)
   ----------------------------------------------------------------------------
   Purani sabhi caches (v1, v2, v3, v4) ko disk se delete karke user ki mobile
   storage ko clean karta hai aur sabhi open tabs ka control le leta hai.
============================================================================ */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((existingCache) => {
          if (existingCache !== CACHE_NAME) {
            console.log(`[ServiceWorker] Purging legacy cache: ${existingCache}`);
            return caches.delete(existingCache);
          }
        })
      );
    }).then(() => {
      // Immediate control of all active client windows
      return self.clients.claim();
    })
  );
});

/* ============================================================================
   3. FETCH EVENT (CACHE-FIRST / STALE-WHILE-REVALIDATE WITH CLOUD BYPASS)
   ----------------------------------------------------------------------------
   - Non-GET requests aur Firebase RTDB WebSockets ko direct network par bhejta hai.
   - Local Static Assets: Cache se turant deliver karta hai aur background me update karta hai.
   - Offline Fail-Safe: Agar internet na ho, tab bhi index.html khol kar deta hai.
============================================================================ */
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // 1. Only process standard GET requests
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  // 2. Bypass Firebase Realtime Database & Google Cloud Auth APIs (Never cache live data)
  if (
    url.hostname.includes('firebaseio.com') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('gstatic.com') ||
    request.headers.get('Upgrade') === 'websocket'
  ) {
    return;
  }

  // 3. Stale-While-Revalidate Strategy for App Shell & Static Modules
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      // Asynchronous background revalidation fetch
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          // If valid response received, refresh the cache copy
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch((networkErr) => {
          // Network failed (device is completely offline)
          // Navigation fallback: if user navigates to a route, serve index.html
          if (request.mode === 'navigate') {
            return caches.match('./index.html');
          }
          // Quietly fail for non-navigation background resources
          return null;
        });

      // Return cached response instantly if available, otherwise wait for network
      return cachedResponse || fetchPromise;
    }).catch(() => {
      // Final emergency fallback if cache matching throws
      if (request.mode === 'navigate') {
        return caches.match('./index.html');
      }
    })
  );
});

/* ============================================================================
   4. CLIENT POSTMESSAGE INTERACTION
   ----------------------------------------------------------------------------
============================================================================ */
self.addEventListener('message', (event) => {
  if (event.data && event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});
