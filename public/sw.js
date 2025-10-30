// public/sw.js
const CACHE = 'sh4ner-v3.1.0'; // Bumped for full control + version sync

// BUMP THIS EVERY DEPLOY TO FORCE FULL CACHE CLEAR
const FORCE_VERSION = 'v3.1.0'; // ← CHANGE TO v3.1.1, v3.2.0, etc. on every deploy

// Expanded asset list with all critical resources (fonts, images, CSS, JS, sounds)
const ASSETS = [
  '/',
  '/index.html',
  '/home.css',
  '/giveaway.css',
  '/font/ACROTERIONJF-Regular.woff2',
  '/font/ACROTERIONJF-Regular.woff',
  '/img/Sh4ner_White 1.png',
  '/img/rightdice.png',
  '/img/leftdice.png',
  '/img/billi.webp',
  '/img/pngtree-the-gold-arrow-png-image-png-image_10276849-removebg-preview.png',
  '/img/bc-game-esports-logo-png_seeklogo-619973.png',
  '/sound/wheel-spin-click-slow-down-101152.mp3',
  '/sound/sonar-ping-95840.mp3',
  // CDN fallbacks (cached via fetch event, but pre-cache core)
  'https://cdn.tailwindcss.com',
  'https://cdn.jsdelivr.net/npm/feather-icons/dist/feather.min.js',
  'https://unpkg.com/aos@2.3.1/dist/aos.js',
  'https://unpkg.com/aos@2.3.1/dist/aos.css',
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/3.9.1/chart.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/chartjs-plugin-datalabels/2.1.0/chartjs-plugin-datalabels.min.js'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => {
      console.log(`SW: Installing ${CACHE} | Force: ${FORCE_VERSION} | Caching ${ASSETS.length} assets`);
      return cache.addAll(ASSETS.map(url => new Request(url, { credentials: 'omit' })))
        .catch(err => {
          console.error('SW: Cache addAll failed:', err);
          // Continue install even if some assets fail
          return cache.addAll(ASSETS.filter(a => a.startsWith('/')));
        });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.map(key => {
        if (key !== CACHE) {
          console.log(`SW: Deleting old cache: ${key}`);
          return caches.delete(key);
        }
      })
    )).then(() => {
      console.log(`SW: Activated ${CACHE} | Force: ${FORCE_VERSION}`);
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Bypass for API, POST, and non-GET
  if (e.request.method !== 'GET') return;
  if (url.pathname.startsWith('/api/')) return e.respondWith(fetch(e.request));
  if (url.origin !== self.location.origin) {
    // Allow CDN caching but don’t block
    return e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request).then(net => {
        if (net && net.status === 200 && net.type === 'basic' || url.origin.includes('cdn.')) {
          const clone = net.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return net;
      }).catch(() => caches.match('/index.html')))
    );
  }

  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) {
        // Background update
        fetch(e.request).then(net => {
          if (net && net.ok) {
            caches.open(CACHE).then(c => c.put(e.request, net.clone()));
          }
        }).catch(() => {});
        return cached;
      }

      return fetch(e.request).then(net => {
        if (!net || net.status !== 200 || net.type !== 'basic') return net;

        const clone = net.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone)).catch(() => {});
        return net;
      }).catch(() => {
        // Offline fallback
        return caches.match('/index.html') || new Response(
          `<html><body><h1>Offline</h1><p>Check your connection and try again.</p></body></html>`,
          { headers: { 'Content-Type': 'text/html' }, status: 503 }
        );
      });
    })
  );
});

self.addEventListener('message', event => {
  if (event.data === 'get-cache-version') {
    event.ports[0].postMessage({ version: CACHE, force: FORCE_VERSION });
  }

  if (event.data === 'clear-cache') {
    caches.keys().then(keys => Promise.all(keys.map(caches.delete)))
      .then(() => {
        console.log('SW: All caches cleared by user request');
        event.ports[0].postMessage({ cleared: true });
      })
      .catch(err => {
        console.error('SW: Cache clear failed:', err);
        event.ports[0].postMessage({ cleared: false, error: err.message });
      });
  }

  if (event.data === 'skip-waiting') {
    self.skipWaiting();
  }
});

// Optional: Auto-update on new version
self.addEventListener('controllerchange', () => {
  window.location.reload();
});