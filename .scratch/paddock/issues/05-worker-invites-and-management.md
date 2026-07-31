# 05 — Worker invites and management

**What to build:** The manager generates one-time invite tokens, sends them via email, and workers accept to join the farm. The manager can see the worker list and remove workers.

**Blocked by:** 02 — Authentication, 03 — Farm setup with boundary

**Status:** resolved

- [x] Manager can generate an invite token via the UI
- [x] Invite email is sent (or logged to console in dev) with a link containing the token
- [x] `POST /api/accept-invite/:token` creates the worker account and joins them to the farm
- [x] Expired or used tokens return 410
- [x] Manager can view all farm workers and remove a worker
- [x] Tests cover the full invite/accept/remove flow

## Answer

Implemented in commit 4c006db. Backend: `POST /api/invites` (manager-only, generates one-time token, logs link to console), `POST /api/accept-invite/:token` (creates worker account, returns JWT, marks token used), `GET /api/farms/:id/workers` (lists workers, manager-only), `DELETE /api/farms/:id/workers/:userId` (removes worker, manager-only). Expired/used tokens return 410. Frontend: WorkerManagement page with invite form, invite link display, worker list, and remove. FarmSettings has a 'Manage workers' link. 25 backend tests covering full invite/accept/remove/expired flow.
