# Node.js + SQLite on a cheap VPS

The backend is a plain Node.js HTTP API backed by SQLite, deployed on a low-cost VPS. No BaaS, no Postgres, no serverless.

SQLite keeps the VPS requirements minimal (no dedicated DB process, no connection pool) and matches the "one farm" data volume. A cheap VPS avoids the complexity and cost of managed services while still giving us full control. Node.js keeps the stack uniform with the frontend (both JS).
