/* Flowstate service worker: offline app shell.
 * - Pages: network-first, cached per URL, falling back to the cached page (or "/") offline.
 * - /_next/static/*: cache-first (content-hashed, immutable).
 * - Other same-origin GETs: network-first with cache fallback.
 */
const CACHE_NAME = 'flowstate-v4'
const PAGES = ['/', '/tanks', '/plants', '/tanks/report', '/settings']
const ASSETS = [
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  // Living tank first paint: the CSS plate for each phase and the fish sprite.
  '/tank/plate-dawn-sm.webp',
  '/tank/plate-day-sm.webp',
  '/tank/plate-dusk-sm.webp',
  '/tank/plate-night-sm.webp',
  '/tank/betta-cruise.webp',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // Add individually so one missing URL doesn't abort the whole install
      Promise.all([...PAGES, ...ASSETS].map((url) => cache.add(url).catch(() => {}))),
    ),
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  )
})

function putInCache(req, res) {
  if (!res || !res.ok || res.type === 'opaque') return
  const copy = res.clone()
  caches
    .open(CACHE_NAME)
    .then((cache) => cache.put(req, copy))
    .catch(() => {})
}

async function networkFirst(req, fallbackUrl) {
  try {
    const res = await fetch(req)
    putInCache(req, res)
    return res
  } catch (err) {
    const cached = await caches.match(req, { ignoreSearch: req.mode === 'navigate' })
    if (cached) return cached
    if (fallbackUrl) {
      const fallback = await caches.match(fallbackUrl)
      if (fallback) return fallback
    }
    throw err
  }
}

async function cacheFirst(req) {
  const cached = await caches.match(req)
  if (cached) return cached
  const res = await fetch(req)
  putInCache(req, res)
  return res
}

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  if (req.mode === 'navigate') {
    event.respondWith(networkFirst(req, '/'))
  } else if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(req))
  } else {
    event.respondWith(networkFirst(req))
  }
})

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

// Focus (or open) the app when a reminder notification is tapped
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      const existing = wins.find((w) => 'focus' in w)
      return existing ? existing.focus() : self.clients.openWindow('/')
    }),
  )
})
