const CACHE = "hao-baccarat-c4-v1";
const ASSETS = ["./", "./index.html", "./styles.css", "./app.js", "./manifest.webmanifest"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => (k===CACHE?null:caches.delete(k)))))
  );
});

self.addEventListener("fetch", (e) => {
  e.respondWith(
    caches.match(e.request).then((hit) => hit || fetch(e.request).then((res)=>{
      const copy = res.clone();
      caches.open(CACHE).then((c)=>c.put(e.request, copy)).catch(()=>{});
      return res;
    }).catch(()=>hit))
  );
});
