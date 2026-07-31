# 12 — PWA and offline support

**What to build:** The app is installable on the home screen and works during brief dropouts. The service worker caches the app shell and map tiles. Failed writes are retried when connectivity returns.

**Blocked by:** 02 — Authentication

**Status:** ready-for-agent

- [ ] Manifest.json with `display: standalone`, icons, and `start_url`
- [ ] Service worker caches all app shell assets on first load
- [ ] Map tiles are served from cache when offline (cache-first strategy for tiles)
- [ ] App loads and shows login page when offline (if shell is cached)
- [ ] Failed write requests are queued and retried when online
- [ ] Lighthouse PWA audit passes for installability criteria
- [ ] Test offline scenario: load app, go offline, see cached content
