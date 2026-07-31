# 08 — List view with global reorder

**What to build:** A switchable flat list view shows all active tasks sorted by a global order index. Workers can drag to reorder tasks, and the new order is persisted and visible to all workers immediately.

**Blocked by:** 06 — Create task with location

**Status:** resolved

- [x] Button toggles between map view and list view
- [x] List shows tasks sorted by `order` field (title, priority, status, assignee)
- [x] Dragging a task to a new position triggers a batch update of order indices
- [x] `PATCH /api/tasks/reorder` accepts a new ordering and persists it in a transaction
- [x] Reorder is reflected for all workers on next fetch
- [x] Tests cover reorder endpoint and conflict handling

## Answer

Implemented in commit 5b9a2ac. Backend: `PATCH /api/tasks/reorder` accepts an ordered array of task IDs and updates all `order` values in a single transaction. Frontend: ListView.svelte with a toggle button to switch between map and list view; tasks displayed sorted by `order` field showing title, priority, status, and assignee; drag-to-reorder via HTML5 drag events triggers the reorder endpoint immediately. Tests cover reorder endpoint, order persistence, and conflict handling.
