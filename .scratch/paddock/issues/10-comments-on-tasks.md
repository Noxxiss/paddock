# 10 — Comments on tasks

**What to build:** Workers can add comments to any task, forming a threaded discussion. Each comment shows the author and timestamp. The comment thread replaces a free-text description field.

**Blocked by:** 06 — Create task with location

**Status:** ready-for-agent

- [ ] Comment input at the bottom of the task detail view
- [ ] `POST /api/tasks/:id/comments` creates a comment with author and body
- [ ] `GET /api/tasks/:id/comments` returns comments in chronological order
- [ ] Each comment displays author name and relative timestamp
- [ ] Tests cover comment creation and retrieval
