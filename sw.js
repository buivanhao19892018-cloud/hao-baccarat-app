// Simple SW cache for GitHub Pages
// bump CACHE version when release
const CACHE = "bh-baccarat-v3-1-0";

const ASSETS = [
  "./",
  "./index.html",
  "./styles.css?v=3.1.0",
  "./app.js?v=3.1.0",
  "./manifest.webmanifest"
];

self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then((c)=>c.addAll(ASSETS)).catch(()=>{})
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => (k!==CACHE ? caches.delete(k) : null)))
    ).then(()=>self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  e.respondWith(
    caches.match(req).then(res => res || fetch(req).then(net => {
      // runtime cache
      const copy = net.clone();
      caches.open(CACHE).then(c => c.put(req, copy)).catch(()=>{});
      return net;
    }).catch(()=>res))
  );
});
