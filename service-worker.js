const CACHE_NAME="survey-cache-v1";

self.addEventListener("install",e=>{
e.waitUntil(
caches.open(CACHE_NAME).then(cache=>{
return cache.addAll([
"/",
"/index.html",
"/css/style.css",
"/js/app.js"
]);
})
);
});

self.addEventListener("fetch",e=>{
e.respondWith(
caches.match(e.request).then(res=>{
return res||fetch(e.request);
})
);
});