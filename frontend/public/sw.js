/**
 * sw.js — Service Worker ICT Trading Dashboard PWA
 * Déposer dans : frontend/public/sw.js
 *
 * Fonctionnalités :
 *   ✅ Cache statique (App Shell)
 *   ✅ Stratégie réseau-d'abord pour l'API
 *   ✅ Mode hors-ligne (page de fallback)
 *   ✅ Web Push Notifications
 *   ✅ Badge sur l'icône (signal count)
 */

const CACHE_NAME    = 'ict-dashboard-v1'
const SHELL_ASSETS  = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
]

// ── Installation : mise en cache des assets statiques ─────────────
self.addEventListener('install', (event) => {
  console.log('[SW] Install')
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
  )
})

// ── Activation : nettoyage des anciens caches ─────────────────────
self.addEventListener('activate', (event) => {
  console.log('[SW] Activate')
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  )
})

// ── Fetch : stratégie selon le type de requête ─────────────────────
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // API & WebSocket → toujours réseau, jamais de cache
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/ws')) {
    return
  }

  // Webhook → bypass
  if (url.pathname.startsWith('/webhook')) {
    return
  }

  // Assets statiques → Cache first, puis réseau
  event.respondWith(
    caches.match(event.request)
      .then(cached => {
        if (cached) return cached
        return fetch(event.request)
          .then(response => {
            // Mettre en cache les nouvelles réponses valides
            if (response.status === 200 && event.request.method === 'GET') {
              const clone = response.clone()
              caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone))
            }
            return response
          })
          .catch(() => {
            // Hors-ligne : retourner le shell si HTML demandé
            if (event.request.headers.get('accept')?.includes('text/html')) {
              return caches.match('/index.html')
            }
          })
      })
  )
})

// ══════════════════════════════════════════════════════════════════
// PUSH NOTIFICATIONS
// ══════════════════════════════════════════════════════════════════

self.addEventListener('push', (event) => {
  if (!event.data) return

  let data
  try { data = event.data.json() }
  catch { data = { title: 'ICT Trading', body: event.data.text() } }

  const { title, body, icon, badge, tag, data: extras } = data

  const options = {
    body       : body || '',
    icon       : icon  || '/icons/icon-192.png',
    badge      : badge || '/icons/icon-96.png',
    tag        : tag   || 'ict-notif',
    renotify   : true,
    vibrate    : [200, 100, 200],
    requireInteraction: extras?.requireInteraction || false,
    data       : extras || {},
    actions    : extras?.actions || [],
    timestamp  : Date.now(),
  }

  // Couleur de fond selon le type
  if (extras?.type === 'order_executed') {
    options.icon  = '/icons/icon-192.png'
    options.badge = '/icons/icon-96.png'
  }

  event.waitUntil(
    self.registration.showNotification(title, options)
  )
})

// ── Clic sur la notification ──────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const data   = event.notification.data || {}
  const tab    = data.tab || 'dashboard'
  const url    = `/?tab=${tab}`

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clients => {
        // Si l'app est déjà ouverte, focus + navigation
        for (const client of clients) {
          if (client.url.includes(self.location.origin)) {
            client.focus()
            client.postMessage({ type: 'navigate', tab })
            return
          }
        }
        // Sinon ouvrir un nouvel onglet
        return self.clients.openWindow(url)
      })
  )
})

// ── Action sur notification (boutons) ────────────────────────────
self.addEventListener('notificationclose', () => {
  // Métriques / analytics si besoin
})

// ── Background Sync (pour les actions offline) ────────────────────
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-journal') {
    event.waitUntil(syncJournal())
  }
})

async function syncJournal() {
  // Envoyer les données en attente si connexion retrouvée
  const cache = await caches.open('ict-pending')
  const keys  = await cache.keys()
  for (const req of keys) {
    try {
      const cached  = await cache.match(req)
      const body    = await cached.json()
      await fetch(req, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      await cache.delete(req)
    } catch {}
  }
}

// ── Messages depuis le client ─────────────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
  if (event.data?.type === 'SET_BADGE') {
    if (navigator.setAppBadge) navigator.setAppBadge(event.data.count).catch(() => {})
  }
  if (event.data?.type === 'CLEAR_BADGE') {
    if (navigator.clearAppBadge) navigator.clearAppBadge().catch(() => {})
  }
})
