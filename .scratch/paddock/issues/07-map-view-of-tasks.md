# 07 — Map view of tasks

**What to build:** The main map screen shows all active tasks as interactive markers/overlays at their locations. When too many tasks are visible, low-priority ones are hidden to declutter. Tapping a task shows its details.

**Blocked by:** 06 — Create task with location

**Status:** ready-for-agent

- [ ] Active tasks render as coloured markers/shapes on the map based on their GeoJSON location
- [ ] Low-priority tasks are hidden when the visible task count exceeds a threshold
- [ ] Tapping a task marker opens a detail popup (title, priority, assignee, status)
- [ ] Map updates when tasks are created/completed (poll or refetch)
- [ ] Tasks outside the current map view are not loaded (or are loaded but not rendered)
- [ ] E2E test: log in, see tasks on map, tap to see details
