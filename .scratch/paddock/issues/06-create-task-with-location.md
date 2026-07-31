# 06 — Create task with location

**What to build:** A worker can create a task with a title, priority (high/medium/low), and location — either by drawing points/lines/polygons on the map or by selecting a named paddock. Optional assignment to another worker. The task appears immediately for all workers.

**Blocked by:** 02 — Authentication, 04 — Paddock management

**Status:** resolved

- [x] Task creation form with title, priority dropdown, location type selector (draw or paddock)
- [x] Drawing mode: worker draws point/line/polygon using Leaflet.draw
- [x] Paddock mode: worker selects from a list of named paddocks
- [x] Optional worker assignment dropdown
- [x] `POST /api/tasks` creates and returns the task with GeoJSON location
- [x] `GET /api/tasks` returns active tasks with full location data
- [x] Tests cover task creation with both location types and assignment

## Answer

Implemented in commit c14a780. Backend: `POST /api/tasks` creates tasks with title, priority, GeoJSON location, location type (drawing or paddock), optional assignment, and auto-assigns next order index; `GET /api/tasks` returns active tasks with full location and paddock details. Frontend: TaskCreate.svelte with title input, priority dropdown, Leaflet.draw tools (point/line/polygon), paddock selector, and worker assignment dropdown. Tests cover creation with both location types and assignment.
