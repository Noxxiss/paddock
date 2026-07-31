const assert = require('node:assert');
const { test, before, after } = require('node:test');
const supertest = require('supertest');
const path = require('path');
const fs = require('fs');
const app = require('../src/app');
const { initialize, close, getDb } = require('../src/db');

const TEST_DB_PATH = path.join(__dirname, '..', 'paddock-test.db');

before(() => {
  if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  process.env.DB_PATH = TEST_DB_PATH;
  initialize(TEST_DB_PATH);
});

after(() => {
  close();
  if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
});

test('GET /api/health returns 200 with db connected', async () => {
  const res = await supertest(app).get('/api/health');
  assert.strictEqual(res.status, 200);
  assert.deepStrictEqual(res.body, { status: 'ok', db: 'connected' });
});

test('all expected tables exist after initialization', () => {
  const db = getDb();
  const tables = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
  ).all().map(r => r.name);

  const expected = [
    'comments',
    'completion_log',
    'farms',
    'invite_tokens',
    'paddocks',
    'push_subscriptions',
    'tasks',
    'users',
  ];

  assert.deepStrictEqual(tables, expected);
});
