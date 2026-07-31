# 08 — List view with global reorder

**What to build:** A switchable flat list view shows all active tasks sorted by a global order index. Workers can drag to reorder tasks, and the new order is persisted and visible to all workers immediately.

**Blocked by:** 06 — Create task with location

**Status:** ready-for-agent

- [ ] Button toggles between map view and list view
- [ ] List shows tasks sorted by `order` field (title, priority, status, assignee)
- [ ] Dragging a task to a new position triggers a batch update of order indices
- [ ] `PATCH /api/tasks/reorder` accepts a new ordering and persists it in a transaction
- [ ] Reorder is reflected for all workers on next fetch
- [ ] Tests cover reorder endpoint and conflict handling
