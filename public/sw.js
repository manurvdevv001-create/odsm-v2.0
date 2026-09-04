// Service Worker for ODSM PWA
const CACHE_NAME = 'odsm-v1';

self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    const { request } = event;

    // Only handle same-origin GET requests
    if (request.method !== 'GET') return;

    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return;

    // Never intercept dev-server / Next.js internal or API requests
    if (url.pathname.startsWith('/_next/')) return;
    if (url.pathname.startsWith('/api/')) return;
    if (url.pathname.endsWith('.hot-update.json') || url.pathname.endsWith('.hot-update.js')) return;

    // Network-first for navigations, with a safe fallback (never respond with undefined)
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request).catch(() =>
                caches.match(request).then((cached) => cached || Response.error())
            )
        );
        return;
    }

    // Stale-while-revalidate for same-origin static assets
    event.respondWith(
        caches.match(request).then((cached) => {
            const network = fetch(request)
                .then((response) => {
                    if (response && response.ok) {
                        const copy = response.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
                    }
                    return response;
                })
                .catch(() => cached || Response.error());
            return cached || network;
        })
    );
});
