const TILE_CACHE = 'aw-tiles-v1'
const API_CACHE = 'aw-api-v1'
const TILE_PATTERN = /basemaps\.cartocdn\.com/

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== TILE_CACHE && k !== API_CACHE)
          .map((k) => caches.delete(k)),
      ),
    ),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (e) => {
  const { request } = e
  const url = new URL(request.url)

  // Cache-First for map tiles
  if (TILE_PATTERN.test(url.hostname)) {
    e.respondWith(
      caches.open(TILE_CACHE).then(async (cache) => {
        const cached = await cache.match(request)
        if (cached) return cached
        const res = await fetch(request)
        if (res.ok) cache.put(request, res.clone())
        return res
      }),
    )
    return
  }

  // Network-First for API routes — fall back to cache on failure
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(
      caches.open(API_CACHE).then(async (cache) => {
        try {
          const res = await fetch(request)
          if (res.ok) cache.put(request, res.clone())
          return res
        } catch {
          const cached = await cache.match(request)
          return cached ?? Response.error()
        }
      }),
    )
    return
  }
})
