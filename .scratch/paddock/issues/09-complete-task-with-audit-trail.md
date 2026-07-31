# 09 — Complete task with audit trail

**What to build:** Workers can mark a task as done. The task is removed from active views (map and list), and a completion record is stored showing who completed it and when.

**Blocked by:** 06 — Create task with location

**Status:** resolved

- [x] "Mark complete" button on task detail popup/sheet
- [x] `PATCH /api/tasks/:id/complete` sets status to "done", records worker_id and completed_at
- [x] Completed task no longer appears in `GET /api/tasks` (active)
- [x] `GET /api/tasks/:id` still returns the task with completion data
- [x] Completion log is queryable
- [x] Tests cover completion and audit trail

## Answer

Implemented in commit fe69995. Backend: `PATCH /api/tasks/:id/complete`, `GET /api/tasks/:id`, `GET /api/completion-log`. Frontend: "Mark Complete" button on map popup and "Done" button on list view rows.
