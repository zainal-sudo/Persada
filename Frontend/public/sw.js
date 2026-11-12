/* Service worker minimal PWA krm ERP.
   Passthrough: tidak meng-cache apa pun (hindari data basi di API / laporan).
   Hanya memenuhi syarat installability Chrome dan menyamakan scope root. */
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});