# 11 — Push notifications

**What to build:** Workers receive push notifications when a new task is created (all workers on the farm) or when a task is assigned to them. Uses Push API + VAPID keys.

**Blocked by:** 05 — Worker invites and management, 06 — Create task with location

**Status:** ready-for-agent

- [ ] Client subscribes to push via Push API and stores subscription on server
- [ ] `POST /api/tasks` triggers a push to all farm workers
- [ ] `POST /api/tasks` with an assigned_worker_id triggers a push to that worker only
- [ ] Notification tap opens the relevant task
- [ ] Tests verify notification dispatch (mock push service)
