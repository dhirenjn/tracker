// sw.js — cache-first for the app shell, so the app works fully offline
// after the first visit. All actual data lives in IndexedDB, not here.
const CACHE_NAME = 'everyday-tracker-v4';
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/css/style.css',
  '/js/main.js',
  '/js/db.js',
  '/js/model.js',
  '/js/state.js',
  '/js/components/ring.js',
  '/js/components/ui.js',
  '/js/components/nav.js',
  '/js/components/calendar.js',
  '/js/components/datePicker.js',
  '/js/views/today.js',
  '/js/views/grid.js',
  '/js/views/addEdit.js',
  '/js/views/monthTurnover.js',
  '/js/views/gallery.js',
  '/js/views/settings.js',
  '/js/views/day.js',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
  '/screenshots/desktop-wide.png',
  '/screenshots/mobile-narrow.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((res) => {
          // opportunistically cache same-origin GETs (e.g. fonts, new assets)
          if (res.ok && new URL(event.request.url).origin === self.location.origin) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return res;
        })
        .catch(() => cached);
    })
  );
});
