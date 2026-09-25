"use strict";
const CACHE_NAME="circuit-learning-shell-v1";
const APP_SHELL=["./","./index.html","./learn.html","./assets/learning/workspace.css"];
self.addEventListener("install",event=>{event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(APP_SHELL)));});
self.addEventListener("activate",event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith("circuit-learning-shell-")&&key!==CACHE_NAME).map(key=>caches.delete(key)))));});
function cacheable(request,response){if(request.method!=="GET"||!response||!response.ok)return false;const url=new URL(request.url);return url.origin===self.location.origin;}
self.addEventListener("fetch",event=>{if(event.request.method!=="GET")return;event.respondWith(fetch(event.request).then(response=>{if(cacheable(event.request,response)){const copy=response.clone();event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.put(event.request,copy)));}return response;}).catch(()=>caches.match(event.request).then(hit=>hit||caches.match("./learn.html"))));});
