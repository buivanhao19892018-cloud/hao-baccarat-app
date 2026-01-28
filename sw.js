// ULTRA AI V3 - SW
const CACHE = "hao-baccarat-ultra-ai-v3-whitepro-" + "3.0.0";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css?v=3.0.0",
  "./app.js?v=3.0.0",
  "./manifest.webmanifest"
];

self.addEventListener("install", (e)=>{
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(c=>c.addAll(ASSETS)).catch(()=>{})
  );
});

self.addEventListener("activate", (e)=>{
  e.waitUntil((async ()=>{
    const keys = await caches.keys();
    await Promise.all(keys.map(k => k!==CACHE ? caches.delete(k) : Promise.resolve()));
    await self.clients.claim();
  })());
});

// Network-first for html, cache-first for others
self.addEventListener("fetch", (e)=>{
  const req = e.request;
  const url = new URL(req.url);

  if(req.method !== "GET") return;

  const isHTML = req.headers.get("accept")?.includes("text/html");

  if(isHTML){
    e.respondWith((async ()=>{
      try{
        const fresh = await fetch(req);
        const cache = await caches.open(CACHE);
        cache.put(req, fresh.clone());
        return fresh;
      }catch{
        const cached = await caches.match(req);
        return cached || caches.match("./index.html");
      }
    })());
    return;
  }

  e.respondWith((async ()=>{
    const cached = await caches.match(req);
    if(cached) return cached;
    try{
      const fresh = await fetch(req);
      const cache = await caches.open(CACHE);
      cache.put(req, fresh.clone());
      return fresh;
    }catch{
      return cached;
    }
  })());
});
