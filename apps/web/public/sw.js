// Makes the site work offline after the first visit. Pages come from the network when there is one, so
// they are never stale; files with a version in their name come from the cache, as they cannot change.
const CACHE = "zimanyar-1";
const FIRST_VISIT = ["check/", "learn/"];

self.addEventListener("install", (event) => {
  const scope = new URL(self.registration.scope);
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(FIRST_VISIT.map((path) => new URL(path, scope).href)))
      .catch(() => {})
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((name) => name !== CACHE).map((name) => caches.delete(name))))
      .then(() => self.clients.claim()),
  );
});

const lasts = (url) => /\/_astro\/|\/pagefind\/|\/lexicons\//.test(url.pathname);

async function fromCache(request) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}

async function fromNetwork(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch (error) {
    const hit = await cache.match(request);
    if (hit) return hit;
    throw error;
  }
}

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;
  event.respondWith(lasts(url) ? fromCache(event.request) : fromNetwork(event.request));
});
