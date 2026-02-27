const CACHE_NAME='focus-reflect-cache-v1';const CORE_ASSETS=['./','./index.html','./style.css','./app.js','./manifest.json','./apple-touch-icon.png','./icon-192.png','./icon-512.png','./favicon-32.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(CORE_ASSETS)));self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)))));self.clients.claim();});
self.addEventListener('fetch',e=>{const r=e.request;if(r.method!=='GET')return;const u=new URL(r.url);if(u.origin!==self.location.origin)return;
if(r.mode==='navigate'){e.respondWith(fetch(r).catch(()=>caches.match('./index.html')));return;}
e.respondWith(caches.match(r).then(cached=>cached||fetch(r).then(res=>{const copy=res.clone();caches.open(CACHE_NAME).then(c=>c.put(r,copy)).catch(()=>{});return res;})));});