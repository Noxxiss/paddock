const Database = require('better-sqlite3');
const path = require('path');
const { applySchema } = require('./schema');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', '..', 'paddock.db');

let _db = null;

function getDb() {
  if (!_db) {
    throw new Error('Database not initialized. Call initialize() first.');
  }
  return _db;
}

function initialize(dbPath) {
  if (_db) return _db;

  const finalPath = dbPath || DB_PATH;
  _db = new Database(finalPath);

  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');

  applySchema(_db);

  return _db;
}

function close() {
  if (_db) {
    _db.close();
    _db = null;
  }
}

module.exports = { getDb, initialize, close };
