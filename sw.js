const CACHE = "hao-ultra-v4-" + "2026-01-27";
const ASSETS = [
  "./",
  "./index.html?v=4",
  "./styles.css?v=4",
  "./app.js?v=4",
  "./manifest.webmanifest?v=4"
];

self.addEventListener("install", (e)=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (e)=>{
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => k!==CACHE ? caches.delete(k) : null)))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e)=>{
  e.respondWith(
    caches.match(e.request).then(res => res || fetch(e.request))
  );
});
