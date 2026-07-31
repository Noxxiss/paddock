# 04 — Paddock management

**What to build:** The manager delimits named paddocks within the farm boundary by drawing polygons on the map. Paddocks can be created, renamed, moved, and deleted from a paddock list in settings.

**Blocked by:** 03 — Farm setup with boundary

**Status:** resolved

- [x] Manager can draw a polygon on the map and name it to create a paddock
- [x] Paddocks appear as labelled overlays on the farm map
- [x] CRUD API for paddocks (create, read, update, delete)
- [x] Paddock list in settings shows all paddocks with edit/delete actions
- [x] Tests cover paddock CRUD

## Answer

Implemented in commit c466d4f. Backend: CRUD API for paddocks (create, read, update, delete) with manager-only write operations and task-reference guard on delete. Frontend: paddocks rendered as labelled overlays on the farm map, paddock list in settings with rename/delete actions. Tests cover all paddock CRUD operations.
