# 09 — Complete task with audit trail

**What to build:** Workers can mark a task as done. The task is removed from active views (map and list), and a completion record is stored showing who completed it and when.

**Blocked by:** 06 — Create task with location

**Status:** ready-for-agent

- [ ] "Mark complete" button on task detail popup/sheet
- [ ] `PATCH /api/tasks/:id/complete` sets status to "done", records worker_id and completed_at
- [ ] Completed task no longer appears in `GET /api/tasks` (active)
- [ ] `GET /api/tasks/:id` still returns the task with completion data
- [ ] Completion log is queryable
- [ ] Tests cover completion and audit trail
