# 05 — Worker invites and management

**What to build:** The manager generates one-time invite tokens, sends them via email, and workers accept to join the farm. The manager can see the worker list and remove workers.

**Blocked by:** 02 — Authentication, 03 — Farm setup with boundary

**Status:** ready-for-agent

- [ ] Manager can generate an invite token via the UI
- [ ] Invite email is sent (or logged to console in dev) with a link containing the token
- [ ] `POST /api/accept-invite/:token` creates the worker account and joins them to the farm
- [ ] Expired or used tokens return 410
- [ ] Manager can view all farm workers and remove a worker
- [ ] Tests cover the full invite/accept/remove flow
