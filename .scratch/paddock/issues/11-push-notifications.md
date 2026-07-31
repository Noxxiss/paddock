# 11 — Push notifications

**What to build:** Workers receive push notifications when a new task is created (all workers on the farm) or when a task is assigned to them. Uses Push API + VAPID keys.

**Blocked by:** 05 — Worker invites and management, 06 — Create task with location

**Status:** resolved

- [x] Client subscribes to push via Push API and stores subscription on server
- [x] `POST /api/tasks` triggers a push to all farm workers
- [x] `POST /api/tasks` with an assigned_worker_id triggers a push to that worker only
- [x] Notification tap opens the relevant task
- [x] Tests verify notification dispatch (mock push service)

## Answer

Implemented in commit f46c425. Backend: web-push helper module (`src/push.js`) with VAPID key management, subscription endpoints (`POST /api/push/subscribe`, `POST /api/push/unsubscribe`), and push dispatch from `POST /api/tasks`. Frontend: service worker (`sw.js`) for push events and notification clicks, client-side subscription helper (`lib/push.js`), web app manifest (`manifest.json`), and push subscription lifecycle in `App.svelte` (subscribe on login, unsubscribe on logout, deep-link from notification tap). Tests in `test/push.test.js` (16 tests).
