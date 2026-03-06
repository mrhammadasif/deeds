const CACHE_NAME = 'deeds-tracker-v1';
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/styles.css',
    '/script.js',
    '/manifest.json',
    '/icon.svg'
];

// Install Event - Cache assets
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Precaching App Shell');
                return cache.addAll(ASSETS_TO_CACHE);
            })
    );
    self.skipWaiting(); // Force the waiting service worker to become the active service worker.
});

// Activate Event - Clean old caches
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(keys
                .filter(key => key !== CACHE_NAME)
                .map(key => caches.delete(key))
            );
        })
    );
    self.clients.claim();
});

// Fetch Event - Serve from Cache if available, fallback to network
self.addEventListener('fetch', event => {
    // We only want to cache our app assets, not the Google APIs or OAuth requests
    if (event.request.url.includes('googleapis.com') || event.request.url.includes('googleusercontent')) {
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then(cachedResponse => {
                // Return cached response if found, else fetch from network
                return cachedResponse || fetch(event.request);
            })
            .catch(() => {
                // If both cache and network fail (offline), you could serve a fallback here
            })
    );
});
