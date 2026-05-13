/**
 * Service Worker pro PWA 552
 * Cachuje aplikaci pro offline použití
 */

const CACHE_VERSION = 'v1.0.0';
const CACHE_NAME = `552-cache-${CACHE_VERSION}`;

// Soubory, které chceme cachovat pro offline použití
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-32.png',
  './icons/icon-96.png',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-1024.png',
  './icons/favicon.ico',
  // External CDN resources
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js',
  'https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800;900&family=Russo+One&family=Orbitron:wght@600;700;800;900&display=swap'
];

// Install event: cache assets
self.addEventListener('install', (event) => {
  console.log('[SW] Install');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching assets');
      // Cache local assets; ignore failures for external ones
      return Promise.all(
        ASSETS_TO_CACHE.map(url =>
          cache.add(url).catch(err => console.log('[SW] Failed to cache:', url, err))
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// Activate event: clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activate');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter(name => name.startsWith('552-cache-') && name !== CACHE_NAME)
          .map(name => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event: serve from cache, fall back to network
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Skip chrome-extension and other non-http(s) requests
  const url = new URL(event.request.url);
  if (!url.protocol.startsWith('http')) return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Found in cache - return it, but also fetch fresh version in background
        const fetchPromise = fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const responseClone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, responseClone);
              });
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);
        
        // Return cached immediately, update happens in background
        return cachedResponse;
      }

      // Not in cache - fetch from network and cache
      return fetch(event.request)
        .then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type === 'error') {
            return networkResponse;
          }
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
          return networkResponse;
        })
        .catch((err) => {
          console.log('[SW] Fetch failed:', err);
          // For navigation requests, return the cached app shell
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
          throw err;
        });
    })
  );
});
