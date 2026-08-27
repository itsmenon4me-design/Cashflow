// Offline-first cache strategy:
// - Static assets (/_next/static/, icons, manifest): CACHE-FIRST with a
//   background refresh. Content-hashed URLs never change meaning, so serving
//   from cache is instant and safe; the background update keeps the copy fresh
//   for the next visit.
// - Navigations (HTML shell): NETWORK-FIRST with cache fallback so users get
//   the latest shell when online and the cached shell when offline.
// - API calls are NEVER intercepted here — data-level offline support lives in
//   IndexedDB + the sync queue (see src/lib/offline/*).
const VERSION = "cashflow-v4";
const SHELL_CACHE = `${VERSION}-shell`;
const STATIC_CACHE = `${VERSION}-static`;

const SHELL_PATHS = [
  "/manifest.webmanifest",
  "/icon.svg",
  "/favicon.ico",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png",
  "/icons/apple-touch-icon.png",
];

const isSameOrigin = (url) => url.origin === self.location.origin;

const isApi = (url) => url.pathname.startsWith("/api/");

const isStatic = (url) => url.pathname.startsWith("/_next/static/");

const isSafeAsset = (url) =>
  url.pathname.startsWith("/icons/") ||
  url.pathname === "/icon.svg" ||
  url.pathname === "/favicon.ico" ||
  url.pathname === "/manifest.webmanifest";

const putInCache = async (cacheName, request, response) => {
  if (!response || response.type !== "basic" || response.status !== 200) {
    return;
  }
  const cache = await caches.open(cacheName);
  await cache.put(request, response.clone());
};

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_PATHS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => !key.startsWith(VERSION))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== "GET") {
    return;
  }

  if (!isSameOrigin(url) || isApi(url)) {
    return;
  }

  // Navigations: network-first with cached-shell fallback (offline support).
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          void putInCache(SHELL_CACHE, request, response);
          return response;
        })
        .catch(() =>
          caches
            .match(request)
            .then((cached) => cached || caches.match("/")),
        ),
    );
    return;
  }

  // Static assets: cache-first with background revalidation.
  if (isStatic(url) || isSafeAsset(url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (!cached) {
          return fetch(request)
            .then((response) => {
              void putInCache(STATIC_CACHE, request, response);
              return response;
            })
            .catch(() => Response.error());
        }
        // Refresh in the background so the next load gets an updated copy.
        void fetch(request)
          .then((response) => putInCache(STATIC_CACHE, request, response))
          .catch(() => undefined);
        return cached;
      }),
    );
  }
});
