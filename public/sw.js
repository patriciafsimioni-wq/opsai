// Keeps the installed app (home-screen PWA) fast without ever serving one
// user's pages to another: only versioned build assets and icons are cached.
// Pages and API calls always go to the network.
const CACHE_NAME = "livefleet-v2";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

// Immutable build output and icons — safe to cache and reuse.
function isCacheable(url) {
  if (url.pathname.startsWith("/api/")) return false; // includes uploaded documents
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname === "/icon" ||
    url.pathname === "/apple-icon" ||
    url.pathname === "/favicon.ico" ||
    /\.(png|jpg|jpeg|svg|webp|woff2?)$/i.test(url.pathname)
  );
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || !isCacheable(url)) return;

  event.respondWith(
    caches.match(event.request).then(
      (hit) =>
        hit ||
        fetch(event.request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        }),
    ),
  );
});
