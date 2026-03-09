const CACHE_NAME = 'deeds-tracker-v7'; // Forced bump

// Install Event - skip waiting immediately
self.addEventListener('install', event => {
    self.skipWaiting();
});

// Activate Event - Clean ALL old caches unconditionally
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(keys.map(key => caches.delete(key)));
        })
    );
    self.clients.claim();
});

// Fetch Event - always go to network (nuke offline mode)
self.addEventListener('fetch', event => {
    event.respondWith(fetch(event.request));
});
