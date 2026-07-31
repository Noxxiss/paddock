# Paddock

A mobile-first, offline-capable farm task management app. Workers view and update map-based tasks on a single farm. Managers invite workers via email link.

## Language

**Farm**:
The single physical property that all work happens on.
_Avoid_: Ranch, property, land

**Paddock**:
A named sub-area within the farm that can be assigned to a task as a whole.
_Avoid_: Field, pen, zone, lot

**Worker**:
A person using the app to view, update, or complete tasks on the farm. Can create, modify, reorder, and complete any task.
_Avoid_: Employee, labourer, hand

**Manager**:
A person who manages the farm — delimits paddocks on the map, sets farm boundaries, invites/removes workers. Can also do everything a Worker can.
_Avoid_: Admin, owner, boss, supervisor

**Sync Model**:
The app syncs aggressively across workers on reconnect — brief offline tolerance, not days-long offline. Tasks are shared state visible to all workers.
_Avoid_: Offline-first, eventually-consistent

**Backend**:
Node.js API server with SQLite, deployed on a low-cost VPS.
_Avoid_: Postgres, BaaS, serverless

**Frontend**:
Svelte + Leaflet (with Leaflet.draw). Mobile-first PWA, compiled to minimal JS. Service worker caches map tiles and app shell for offline use. Server also caches tiles (from OpenStreetMap) to reduce upstream requests.
_Avoid_: React, Vue, MapLibre, TypeScript, native app

**Comment**:
A message attached to a Task, forming a threaded discussion. Replaces a free-text description field.
_Avoid_: Note, description, chat

**Map View**:
Shows all active (todo) tasks. If so many that the UI would be cluttered, low-priority tasks are hidden. Completed tasks are not shown on the map.

**List View**:
Flat list of tasks, globally reorderable. Switchable from the map view.

**Task**:
A unit of work on the farm with a title, status (todo or done), priority (high/medium/low), optional assigned worker, location (one or more drawn geometries — point, polygon, line — or a reference to a Paddock), and a comment thread for discussion. Any worker can create, modify, or reorder any task. Completed tasks record who finished them and when. Task order in the list view is global (shared across all workers). Push notifications are sent when a new task is created or a task is assigned to the recipient.
_Avoid_: Job, chore, work-item
