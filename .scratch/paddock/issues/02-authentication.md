# 02 — Authentication

**What to build:** Workers and managers can register an account and log in. The app displays login/register pages. Authenticated requests carry a JWT token. Unauthenticated requests are rejected.

**Blocked by:** 01 — Project scaffold and database

**Status:** resolved

- [x] `POST /api/auth/register` creates a user and returns a token
- [x] `POST /api/auth/login` with valid credentials returns a token
- [x] `POST /api/auth/login` with invalid credentials returns 401
- [x] Protected routes (e.g., `GET /api/farms`) return 401 without a token
- [x] Login and register pages render in the Svelte app and complete the full flow
- [x] E2E test: register → login → see protected content

## Answer

Implemented in commit 73f3fa3 (with code review fixes in d3ad21a). Backend: `POST /api/auth/register`, `POST /api/auth/login`, JWT-based auth middleware, protected routes. Frontend: Login and Register pages in Svelte. Tests cover register, login, invalid credentials, and protected route rejection.
