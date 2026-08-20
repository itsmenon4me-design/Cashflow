// Keep the service worker in network-first mode so the browser always gets the
// latest shell and static assets instead of reusing stale cached versions.
const VERSION = "cashflow-v3";
const SHELL_CACHE = `${VERSION}-shell`;
const STATIC_CACHE = `${VERSION}-static`;

const SHELL_PATHS = [
  "/",
  "/manifest.webmanifest",
  "/icon.svg",
  "/favicon.ico",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png",
  "/icons/apple-touch-icon.png",
];

const isSameOrigin = (url) =>
  url.origin === self.location.origin;

const isApi = (url) => url.pathname.startsWith("/api/");

const isStatic = (url) => url.pathname.startsWith("/_next/static/");

const isSafeAsset = (url) =>
  url.pathname.startsWith("/icons/") ||
  url.pathname === "/icon.svg" ||
  url.pathname === "/favicon.ico" ||
  url.pathname === "/manifest.webmanifest";

const putInCache = async (cacheName, request, response) => {
  if (!response || response.type !== "basic" || response.status !== 200) {
    return response;
  }

  const cache = await caches.open(cacheName);
  await cache.put(request, response.clone());
  return response;
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

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => putInCache(SHELL_CACHE, "/", response))
        .catch(() => caches.match("/")),
    );
    return;
  }

  if (isStatic(url) || isSafeAsset(url)) {
    event.respondWith(
      fetch(request)
        .then((response) => putInCache(STATIC_CACHE, request, response))
        .catch(() => caches.match(request).then((cached) => cached || caches.match("/"))),
    );
  }
});