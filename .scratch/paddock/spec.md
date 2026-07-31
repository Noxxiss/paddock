# Paddock — Farm Task Management App

Status: ready-for-agent

## Problem Statement

Farm workers in areas with very little connectivity need a shared, map-based view of jobs to do across the farm. Existing tools require reliable internet or are too heavy for low-end mobile devices on slow connections. Tasks need to be connected to specific locations on the farm — a paddock, a fenceline, a set of pickup points — and visible to all workers in real time.

## Solution

A mobile-first PWA (Svelte + Leaflet) backed by a lightweight Node.js + SQLite API on a cheap VPS. Workers see active tasks on an interactive map or a globally-ordered list. They can draw points, lines, or polygons on the map when creating a task, or select a named paddock. Tasks have a comment thread instead of a free-text description. Push notifications fire for new tasks and assignments. The app aggressively caches map tiles and app shell via service worker for intermittent connectivity.

## User Stories

1. As a manager, I want to create named paddocks on the map so that tasks can reference entire areas.
2. As a manager, I want to invite workers via an email link so they can create accounts and join the farm.
3. As a manager, I want to set the farm boundary on the map so the app knows the working area.
4. As a manager, I want to remove workers from the farm so former staff lose access.
5. As a worker, I want to log in with my email and password so I can access the farm tasks.
6. As a worker, I want to see all active tasks on an interactive map so I know where work is needed.
7. As a worker, I want the map to declutter itself by hiding low-priority tasks when too many are visible.
8. As a worker, I want to switch to a list view so I can scan tasks by priority and global order.
9. As a worker, I want to create a task with a title, priority, and location (drawing or paddock selection) so I can record new work.
10. As a worker, I want to draw any combination of points, lines, and polygons on the map as a task's location so I can describe complex areas.
11. As a worker, I want to select an existing paddock by name as a task's location so I don't need to draw boundaries that already exist.
12. As a worker, I want to assign a task to another worker so they know it's their responsibility.
13. As a worker, I want to reorder tasks globally in the list view so the team agrees on priority.
14. As a worker, I want to mark a task as done so the team knows it's complete.
15. As a worker, I want to see who completed a task and when so I have an audit trail.
16. As a worker, I want to comment on a task so the team can discuss details without switching to another app.
17. As a worker, I want to receive a push notification when a new task is created so I don't miss new work.
18. As a worker, I want to receive a push notification when a task is assigned to me so I know what I'm responsible for.
19. As a worker, I want the app to work offline during brief dropouts so I can still view and complete tasks in areas with no signal.
20. As a worker, I want the app to sync my changes when connectivity returns so the team sees the latest state.
21. As any user, I want the app to be installable on my phone's home screen so I can launch it like a native app.

## Implementation Decisions

- **Backend stack:** Node.js HTTP API (no framework mandated, but Express or a minimal router is expected) with better-sqlite3 for synchronous SQLite access. Deployed on a $5–10/mo VPS.
- **Frontend stack:** Svelte (compiled, no runtime), Leaflet + Leaflet.draw for maps. Plain JavaScript throughout — no TypeScript.
- **Map tiles:** OpenStreetMap raster tiles, cached server-side (a simple HTTP proxy cache like node-fetch-cache or a local tile proxy) to reduce upstream requests, and cached client-side via service worker.
- **PWA:** Service worker caches app shell and map tiles. Push notifications via the Push API + VAPID keys. Manifest includes `display: standalone` for home-screen install.
- **Auth:** Email + password. Managers generate invite tokens (one-time use) sent via email. No OAuth providers.
- **Database:** SQLite with better-sqlite3. Schema includes tables for users (workers/managers), farms, paddocks (geometry stored as GeoJSON), tasks (with GeoJSON location, status, priority, global order index), comments (with author and timestamp), completion audit log, and invite tokens.
- **Global task ordering:** Tasks have an integer `order` column. Reordering updates all affected rows within a transaction. Conflicts are last-write-wins — acceptable for a small team.
- **Sync strategy:** The API is the source of truth. The client caches aggressively (service worker cache-first for tiles, network-first for data) and retries failed writes on reconnect. No conflict resolution needed for the brief-dropout model — the last saved version wins.
- **Notifications:** Server sends push notifications via web-push library. Subscriptions stored per user. Notifications sent only for `task.created` and `task.assigned` events, scoped to the relevant user for assignments.
- **Completed tasks:** Archived (kept in DB, excluded from active views) with a record of who completed them and when.

## Testing Decisions

- Good tests verify external behaviour through the public API, not internal implementation details.
- **Backend seam:** The HTTP API layer. Use `supertest` against a dedicated test SQLite database (in-memory or temp file). Cover: auth flows (register, login, invite), CRUD for tasks/paddocks, global reorder, comment creation, completion audit trail, and push notification dispatch.
- **Frontend seam:** E2E tests with Playwright covering critical paths: login, view map with tasks, create a task with drawing, switch to list view, reorder, comment, mark done. No component-level tests — the frontend logic is thin.
- **No unit tests on Svelte components** unless a non-trivial pure function emerges (e.g., geometry validation or priority-deciding logic).

## Out of Scope

- Native mobile apps (iOS/Android). PWA covers all mobile use cases.
- Due dates or calendar features.
- Task categories or lists (flat list only).
- Attachments or file uploads.
- Real-time WebSocket connection. Polling or simple sync on reconnect is sufficient for the brief-dropout model.
- Multi-farm support. One farm per server instance.
- Third-party integrations (Slack, email notifications beyond invites).
- Offline-first for extended periods (days without connectivity). The model is brief dropouts only.
- Role-based permissions beyond Manager vs Worker. No custom roles.
- Data export or backup tools (standard SQLite backup is sufficient).

## Further Notes

- The project name "Paddock" comes from the domain — a paddock is a named sub-area within a farm. This should be the app name and DB name.
- The server can be set up with a simple SQLite backup cron job.
- Map tile caching on the server is essential to keep OSM tile usage within free-tier limits.
- Since there is no due date, the priority (high/medium/low) and global order are the primary sorting dimensions.
