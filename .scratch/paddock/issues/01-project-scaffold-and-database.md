# 01 — Project scaffold and database

**What to build:** The foundational project is set up — Node.js/Express server, SQLite database with all tables created, test harness configured, and deployment skeleton ready. No user-facing behaviour yet, but every subsequent ticket depends on this structure.

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

- [ ] `npm start` boots the server on the configured port
- [ ] All DB tables exist after first run (users, farms, paddocks, tasks, comments, invite_tokens, push_subscriptions, completion_log)
- [ ] Server responds 200 at `GET /api/health`
- [ ] Test suite runs with `npm test` against an in-memory SQLite database
- [ ] Deployment scripts or config (Dockerfile or deploy.sh) exist for VPS
