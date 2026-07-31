# 03 — Farm setup with boundary

**What to build:** The first manager creates the farm, setting its boundary by drawing a polygon on a Leaflet map. The farm is persisted and becomes the context for all subsequent work.

**Blocked by:** 02 — Authentication

**Status:** ready-for-agent

- [ ] Manager sees a "create farm" flow after first login
- [ ] Manager draws a polygon on a Leaflet map to set the farm boundary
- [ ] `POST /api/farms` creates the farm and returns it
- [ ] `GET /api/farms/:id` returns the farm with boundary geometry
- [ ] Farm settings page shows the boundary and allows editing
- [ ] Tests cover farm CRUD
