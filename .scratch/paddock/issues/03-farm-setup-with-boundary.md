# 03 — Farm setup with boundary

**What to build:** The first manager creates the farm, setting its boundary by drawing a polygon on a Leaflet map. The farm is persisted and becomes the context for all subsequent work.

**Blocked by:** 02 — Authentication

**Status:** resolved

- [x] Manager sees a "create farm" flow after first login
- [x] Manager draws a polygon on a Leaflet map to set the farm boundary
- [x] `POST /api/farms` creates the farm and returns it
- [x] `GET /api/farms/:id` returns the farm with boundary geometry
- [x] Farm settings page shows the boundary and allows editing
- [x] Tests cover farm CRUD

## Answer

Implemented in commit a9c22f7. Backend: `POST /api/farms` creates farm with boundary and reassigns user role, `GET /api/farms/:id`, `PATCH /api/farms/:id` — all scoped to the authenticated user's farm with manager-role guard on writes. Frontend: FarmSetup.svelte with Leaflet boundary drawing flow, FarmSettings.svelte for editing name and boundary, FarmMap.svelte shared component (polygon-only), auto-redirect when no boundary exists. 15 tests covering POST, GET/:id, PATCH auth/ownership/role/validation.
