# 10 — Comments on tasks

**What to build:** Workers can add comments to any task, forming a threaded discussion. Each comment shows the author and timestamp. The comment thread replaces a free-text description field.

**Blocked by:** 06 — Create task with location

**Status:** resolved

- [x] Comment input at the bottom of the task detail view
- [x] `POST /api/tasks/:id/comments` creates a comment with author and body
- [x] `GET /api/tasks/:id/comments` returns comments in chronological order
- [x] Each comment displays author name and relative timestamp
- [x] Tests cover comment creation and retrieval
