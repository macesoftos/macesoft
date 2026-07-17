const CACHE_NAME = "macesoft-shell-v2";
const OFFLINE_URL = "/offline.html";
const APP_SHELL_ASSETS = [
  "/",
  "/index.html",
  "/offline.html",
  "/manifest.webmanifest",
  "/fonts/Geist-Variable.woff2",
  "/fonts/Geist-Italic-Variable.woff2",
  "/brand/favicon.png",
  "/brand/mace-logo.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL_ASSETS)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match(OFFLINE_URL)),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request)),
  );
});
