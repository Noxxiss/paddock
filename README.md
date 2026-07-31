# Paddock

Mobile-first, offline-capable farm task management app. Workers view and update map-based tasks

Built with **Svelte + Leaflet** on the frontend, **Node.js + SQLite** on the backend, deployed as a **PWA** on a cheap VPS.

## Quick start

```bash
npm install
npm run db:init
npm run dev         # backend on :3000
npm run dev:client  # Vite dev server with HMR
```

## Scripts

| Command | Description |
|---|---|
| `npm start` | Start production server |
| `npm run dev` | Start backend with file watching |
| `npm run dev:client` | Start Vite dev server with HMR |
| `npm run build:client` | Build client for production |
| `npm test` | Run tests |
| `npm run db:init` | Initialize the SQLite database |

## Deploy

```bash
./deploy.sh [user@host] [remote-path]
```

Or with Docker:

```bash
docker build -t paddock .
docker run -v /path/to/data:/app/data -p 3000:3000 paddock
```