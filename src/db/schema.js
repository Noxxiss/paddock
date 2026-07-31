const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS farms (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  boundary_geojson TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  farm_id       INTEGER NOT NULL REFERENCES farms(id),
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name          TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('manager', 'worker')),
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS paddocks (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  farm_id         INTEGER NOT NULL REFERENCES farms(id),
  name            TEXT NOT NULL,
  geometry_geojson TEXT NOT NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tasks (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  farm_id         INTEGER NOT NULL REFERENCES farms(id),
  title           TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'done')),
  priority        TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  "order"         INTEGER NOT NULL DEFAULT 0,
  location_geojson TEXT,
  location_type   TEXT CHECK (location_type IN ('drawing', 'paddock')),
  paddock_id      INTEGER REFERENCES paddocks(id),
  assigned_to     INTEGER REFERENCES users(id),
  created_by      INTEGER NOT NULL REFERENCES users(id),
  completed_by    INTEGER REFERENCES users(id),
  completed_at    TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS comments (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id    INTEGER NOT NULL REFERENCES tasks(id),
  author_id  INTEGER NOT NULL REFERENCES users(id),
  body       TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS invite_tokens (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  farm_id    INTEGER NOT NULL REFERENCES farms(id),
  email      TEXT NOT NULL,
  token      TEXT NOT NULL UNIQUE,
  role       TEXT NOT NULL CHECK (role IN ('manager', 'worker')),
  used       INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id),
  endpoint   TEXT NOT NULL,
  keys       TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS completion_log (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id      INTEGER NOT NULL REFERENCES tasks(id),
  user_id      INTEGER NOT NULL REFERENCES users(id),
  completed_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

function applySchema(db) {
  db.exec(SCHEMA_SQL);
}

module.exports = { applySchema, SCHEMA_SQL };
