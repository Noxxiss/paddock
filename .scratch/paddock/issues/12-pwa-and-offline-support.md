# 12 — PWA and offline support

**What to build:** The app is installable on the home screen and works during brief dropouts. The service worker caches the app shell and map tiles. Failed writes are retried when connectivity returns.

**Blocked by:** 02 — Authentication

**Status:** resolved

- [x] Manifest.json with `display: standalone`, icons, and `start_url`
- [x] Service worker caches all app shell assets on first load
- [x] Map tiles are served from cache when offline (cache-first strategy for tiles)
- [x] App loads and shows login page when offline (if shell is cached)
- [x] Failed write requests are queued and retried when online
- [x] Lighthouse PWA audit passes for installability criteria
- [x] Test offline scenario: load app, go offline, see cached content

## Answer

Implemented in commit aab7d65.

### Manifest
- `src/client/manifest.json` — includes `display: standalone`, `start_url`, `orientation`, `categories`, `prefer_related_applications`, and two maskable icons (192×192 and 512×512)
- Icons served from `src/client/public/` (copied by Vite to output root): `/icon-192.png`, `/icon-512.png`, `/badge-72.png`

### Service Worker (`src/client/public/sw.js`)
- **Install:** pre-caches shell assets (/, index.html, manifest, icons) with `skipWaiting()`
- **Activate:** cleans old caches, claims clients
- **Fetch strategy:**
  - `/api/` write methods (POST/PUT/PATCH/DELETE) → network, queues on failure in IndexedDB (`paddock-offline-queue`)
  - `/api/` read methods → network-first, falling back to cache
  - Map tiles (`tile.openstreetmap.org`) → cache-first
  - Static assets (JS/CSS/images) → cache-first in shell cache
  - Everything else → network-first in dynamic cache
- **Offline write queue:** failed writes stored with full headers/body in IndexedDB, retried with exponential backoff (max 5 retries). Triggers on `online` event, `sync` event, and `RETRY_QUEUE` message from client
- **Push notifications:** preserved from previous implementation — handles `task.created` and `task.assigned` events
- **Notification click:** opens/closes task detail view

### Client Library (`src/client/lib/offline.js`)
- `registerServiceWorker()` — registers `/sw.js`
- `initOfflineQueue()` — sets up message listeners for QUEUE_UPDATED/QUEUE_SIZE/RETRY_RESULT, listens for online/offline events, triggers retry on reconnect
- `retryQueue()` / `getQueueSize()` / `getIsOnline()` — public API for UI components
- Wired up in `src/client/main.js`

### Tests (`test/pwa.test.js`)
- 9 tests covering: HTML manifest link, manifest endpoint retrieval (content validated), SW file served, all three icons served, SW caching logic, offline queue presence, push notification handling
