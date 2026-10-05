const CACHE='daylight-shell-v1'
const CORE=['/','/manifest.webmanifest','/icons/daylight-192.png','/icons/daylight-512.png']

self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE)
    await cache.addAll(CORE)
    const response=await fetch('/')
    const html=await response.clone().text()
    const assets=[...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map(match=>match[1])
    await cache.put('/',response)
    await Promise.allSettled(assets.map(asset=>cache.add(asset)))
    await self.skipWaiting()
  })())
})

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys()
    await Promise.all(keys.filter(key=>key.startsWith('daylight-shell-')&&key!==CACHE).map(key=>caches.delete(key)))
    await self.clients.claim()
  })())
})

self.addEventListener('fetch',event=>{
  const request=event.request
  if(request.method!=='GET')return
  const url=new URL(request.url)
  if(url.origin!==self.location.origin||url.pathname.startsWith('/api/')||url.pathname.startsWith('/.netlify/'))return
  if(request.mode==='navigate'){
    event.respondWith(fetch(request).then(response=>{
      const copy=response.clone();caches.open(CACHE).then(cache=>cache.put('/',copy));return response
    }).catch(()=>caches.match('/')))
    return
  }
  event.respondWith(caches.match(request).then(cached=>cached||fetch(request).then(response=>{
    if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(request,copy))}
    return response
  })))
})
