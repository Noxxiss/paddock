# 01 — Project scaffold and database

**What to build:** The foundational project is set up — Node.js/Express server, SQLite database with all tables created, test harness configured, and deployment skeleton ready. No user-facing behaviour yet, but every subsequent ticket depends on this structure.

**Blocked by:** None — can start immediately

**Status:** resolved

- [x] `npm start` boots the server on the configured port
- [x] All DB tables exist after first run (users, farms, paddocks, tasks, comments, invite_tokens, push_subscriptions, completion_log)
- [x] Server responds 200 at `GET /api/health`
- [x] Test suite runs with `npm test` against an in-memory SQLite database
- [x] Deployment scripts or config (Dockerfile or deploy.sh) exist for VPS

## Answer

Implemented in commit 888f951. Project scaffold with Node.js/Express server, SQLite database with all tables (farms, users, paddocks, tasks, comments, invite_tokens, push_subscriptions, completion_log), health check endpoint, test harness with in-memory SQLite, Dockerfile, and deploy.sh.
