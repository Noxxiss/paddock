# 02 — Authentication

**What to build:** Workers and managers can register an account and log in. The app displays login/register pages. Authenticated requests carry a JWT token. Unauthenticated requests are rejected.

**Blocked by:** 01 — Project scaffold and database

**Status:** ready-for-agent

- [ ] `POST /api/auth/register` creates a user and returns a token
- [ ] `POST /api/auth/login` with valid credentials returns a token
- [ ] `POST /api/auth/login` with invalid credentials returns 401
- [ ] Protected routes (e.g., `GET /api/farms`) return 401 without a token
- [ ] Login and register pages render in the Svelte app and complete the full flow
- [ ] E2E test: register → login → see protected content
