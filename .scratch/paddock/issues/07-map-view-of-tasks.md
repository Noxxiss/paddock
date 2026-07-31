# 07 — Map view of tasks

**What to build:** The main map screen shows all active tasks as interactive markers/overlays at their locations. When too many tasks are visible, low-priority ones are hidden to declutter. Tapping a task shows its details.

**Blocked by:** 06 — Create task with location

**Status:** resolved

- [x] Active tasks render as coloured markers/shapes on the map based on their GeoJSON location
- [x] Low-priority tasks are hidden when the visible task count exceeds a threshold
- [x] Tapping a task marker opens a detail popup (title, priority, assignee, status)
- [x] Map updates when tasks are created/completed (poll or refetch)
- [x] Tasks outside the current map view are not loaded (or are loaded but not rendered)
- [x] E2E test: log in, see tasks on map, tap to see details (backend API integration test at test/tasks.test.js:373)

## Answer

Implemented in commit bd754e8. A full map screen (`MapView.svelte`) built with Leaflet that renders all active tasks as priority-coloured markers or shapes (high=red, medium=orange, low=gray) on an OpenStreetMap basemap. The farm boundary is drawn as a dashed overlay. Tasks outside the current viewport are excluded from rendering. When more than 20 tasks are visible, low-priority tasks are hidden to declutter — a banner notifies the user. Tapping a task opens a popup with title, priority, status, assignee, and paddock name. The map polls `GET /api/tasks` every 10 seconds for updates. The backend join was extended to include `assigned_to_name` in task responses. Tests verify all geometry types (Point, Polygon, LineString) render correctly and that the map data shape is complete.
