# PWA over native mobile app

The app is delivered as a Progressive Web App rather than a native iOS/Android app. PWA gives us install-on-home-screen, offline service-worker caching, and push notifications without app stores, build pipelines for two platforms, or native code. This keeps the project JS-only and the client extremely lightweight — a single Svelte build that fits in a few hundred KB.

The main loss is full offline map-tile persistence (the browser cache is less predictable than a native SQLite store) and background sync. For "brief dropouts" this is acceptable.
