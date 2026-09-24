const CACHE_VERSION="circuit-sim-0.1.0-beta.1";
const CORE=[
  "./","./index.html","./learn.html","./manifest.webmanifest","./product/release.json","./product/tiers.json",
  "./assets/learning/workspace.css","./assets/learning/learning-evidence.js","./assets/training-experiments-core.js",
  "./assets/learning/ti-learning-core.js","./assets/learning/ti-learning-ui.js",
  "./assets/learning/power-system-state-v1.js","./assets/learning/power-system-models-v1.js",
  "./assets/learning/control-engineering-v1.js","./assets/learning/topology-transfer-v1.js",
  "./assets/learning/board-evidence-v1.js","./assets/learning/physical-board-closure-v1.js","./assets/learning/control-validation-v1.js",
  "./assets/learning/ti-control-workbench-core.js","./assets/learning/ti-control-workbench.js",
  "./assets/learning/ti-timing-workbench-core.js","./assets/learning/ti-timing-workbench.js",
  "./assets/learning/ti-protection-workbench-core.js","./assets/learning/ti-protection-workbench.js",
  "./assets/learning/ti-topology-workbench-core.js","./assets/learning/ti-topology-workbench.js",
  "./assets/repair-training-core.js","./assets/learning/ti-diagnostic-workbench.js",
  "./assets/learning/ti-evidence-ladder-core.js","./assets/learning/ti-evidence-ladder.js",
  "./assets/learning/ti-tutor-core.js","./assets/learning/ti-tutor.js","./assets/learning/product-shell.js",
  "./learning/ti/concept-cards.json","./learning/ti/manifest.json"
];
const absolute=path=>new URL(path,self.registration.scope).href;

self.addEventListener("install",event=>{
  event.waitUntil(caches.open(CACHE_VERSION).then(cache=>cache.addAll(CORE.map(absolute))).then(()=>self.skipWaiting()));
});

self.addEventListener("activate",event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(key=>key.startsWith("circuit-sim-")&&key!==CACHE_VERSION).map(key=>caches.delete(key))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener("fetch",event=>{
  const request=event.request;
  if(request.method!=="GET")return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin)return;
  event.respondWith(
    fetch(request).then(response=>{
      if(response&&response.ok){
        const copy=response.clone();
        caches.open(CACHE_VERSION).then(cache=>cache.put(request,copy)).catch(()=>{});
      }
      return response;
    }).catch(async()=>{
      const cached=await caches.match(request);
      if(cached)return cached;
      if(request.mode==="navigate"){
        return caches.match(absolute("./learn.html"))||caches.match(absolute("./index.html"));
      }
      throw new Error("offline cache miss");
    })
  );
});

self.addEventListener("message",event=>{
  if(event.data?.type==="SKIP_WAITING")self.skipWaiting();
  if(event.data?.type==="CLEAR_PRODUCT_CACHE"){
    event.waitUntil(caches.delete(CACHE_VERSION));
  }
});
