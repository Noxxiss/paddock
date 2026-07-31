# 06 — Create task with location

**What to build:** A worker can create a task with a title, priority (high/medium/low), and location — either by drawing points/lines/polygons on the map or by selecting a named paddock. Optional assignment to another worker. The task appears immediately for all workers.

**Blocked by:** 02 — Authentication, 04 — Paddock management

**Status:** ready-for-agent

- [ ] Task creation form with title, priority dropdown, location type selector (draw or paddock)
- [ ] Drawing mode: worker draws point/line/polygon using Leaflet.draw
- [ ] Paddock mode: worker selects from a list of named paddocks
- [ ] Optional worker assignment dropdown
- [ ] `POST /api/tasks` creates and returns the task with GeoJSON location
- [ ] `GET /api/tasks` returns active tasks with full location data
- [ ] Tests cover task creation with both location types and assignment
