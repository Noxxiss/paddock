const assert = require('node:assert');
const { test, before, after, describe } = require('node:test');
const supertest = require('supertest');
const path = require('path');
const fs = require('fs');
const app = require('../src/app');
const { initialize, close, getDb } = require('../src/db');
const { generateToken } = require('../src/middleware/auth');

const TEST_DB_PATH = path.join(__dirname, '..', 'paddock-test-paddocks.db');

let request;

before(() => {
  if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  process.env.DB_PATH = TEST_DB_PATH;
  initialize(TEST_DB_PATH);
  request = supertest(app);
});

after(() => {
  close();
  if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
});

let managerToken;
let managerUser;
let farmId;
let paddockId;

test('setup: register a manager and create a farm', async () => {
  const res = await request
    .post('/api/auth/register')
    .send({ email: 'paddock-manager@test.com', password: 'secret123', name: 'Paddock Manager' });

  assert.strictEqual(res.status, 201);
  managerToken = res.body.token;
  managerUser = res.body.user;
  farmId = res.body.user.farm_id;
  assert.ok(farmId);

  // Create a proper farm with boundary
  const boundary = {
    type: 'Polygon',
    coordinates: [[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]],
  };
  const farmRes = await request
    .post('/api/farms')
    .set('Authorization', `Bearer ${managerToken}`)
    .send({ name: 'Paddock Farm', boundary_geojson: boundary });

  assert.strictEqual(farmRes.status, 201);
  farmId = farmRes.body.farm.id;
  managerToken = farmRes.body.token;
});

describe('POST /api/paddocks', () => {
  test('creates a paddock with a polygon geometry', async () => {
    const geometry = {
      type: 'Polygon',
      coordinates: [[[1, 1], [2, 1], [2, 2], [1, 2], [1, 1]]],
    };

    const res = await request
      .post('/api/paddocks')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ name: 'North Paddock', geometry_geojson: geometry });

    assert.strictEqual(res.status, 201);
    assert.ok(res.body.paddock.id);
    assert.strictEqual(res.body.paddock.name, 'North Paddock');
    assert.strictEqual(res.body.paddock.farm_id, farmId);
    assert.deepStrictEqual(JSON.parse(res.body.paddock.geometry_geojson), geometry);
    assert.ok(res.body.paddock.created_at);

    paddockId = res.body.paddock.id;
  });

  test('returns 400 without name', async () => {
    const res = await request
      .post('/api/paddocks')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ geometry_geojson: { type: 'Polygon', coordinates: [] } });

    assert.strictEqual(res.status, 400);
  });

  test('returns 400 without geometry', async () => {
    const res = await request
      .post('/api/paddocks')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ name: 'No Geo' });

    assert.strictEqual(res.status, 400);
  });

  test('returns 401 without auth', async () => {
    const res = await request
      .post('/api/paddocks')
      .send({ name: 'Unauth', geometry_geojson: { type: 'Polygon', coordinates: [[[0,0],[1,0],[1,1],[0,1],[0,0]]] } });

    assert.strictEqual(res.status, 401);
  });

  test('returns 403 for non-manager', async () => {
    const workerToken = generateToken({ id: 99999, email: 'worker@test.com', role: 'worker', farm_id: farmId });

    const res = await request
      .post('/api/paddocks')
      .set('Authorization', `Bearer ${workerToken}`)
      .send({ name: 'Worker Paddock', geometry_geojson: { type: 'Polygon', coordinates: [[[0,0],[1,0],[1,1],[0,1],[0,0]]] } });

    assert.strictEqual(res.status, 403);
  });
});

describe('GET /api/paddocks', () => {
  test('lists all paddocks for the farm', async () => {
    const res = await request
      .get('/api/paddocks')
      .set('Authorization', `Bearer ${managerToken}`);

    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.paddocks));
    assert.strictEqual(res.body.paddocks.length, 1);
    assert.strictEqual(res.body.paddocks[0].name, 'North Paddock');
  });

  test('returns 401 without auth', async () => {
    const res = await request.get('/api/paddocks');
    assert.strictEqual(res.status, 401);
  });
});

describe('GET /api/paddocks/:id', () => {
  test('returns a single paddock', async () => {
    const res = await request
      .get(`/api/paddocks/${paddockId}`)
      .set('Authorization', `Bearer ${managerToken}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.paddock.name, 'North Paddock');
    assert.strictEqual(res.body.paddock.farm_id, farmId);
  });

  test('returns 404 for non-existent paddock', async () => {
    const res = await request
      .get('/api/paddocks/99999')
      .set('Authorization', `Bearer ${managerToken}`);

    assert.strictEqual(res.status, 404);
  });

  test('returns 401 without auth', async () => {
    const res = await request.get(`/api/paddocks/${paddockId}`);
    assert.strictEqual(res.status, 401);
  });
});

describe('PATCH /api/paddocks/:id', () => {
  test('renames a paddock', async () => {
    const res = await request
      .patch(`/api/paddocks/${paddockId}`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ name: 'South Paddock' });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.paddock.name, 'South Paddock');
  });

  test('updates paddock geometry', async () => {
    const newGeometry = {
      type: 'Polygon',
      coordinates: [[[3, 3], [5, 3], [5, 5], [3, 5], [3, 3]]],
    };

    const res = await request
      .patch(`/api/paddocks/${paddockId}`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ geometry_geojson: newGeometry });

    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(JSON.parse(res.body.paddock.geometry_geojson), newGeometry);
  });

  test('returns 404 for non-existent paddock', async () => {
    const res = await request
      .patch('/api/paddocks/99999')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ name: 'Nowhere' });

    assert.strictEqual(res.status, 404);
  });

  test('returns 401 without auth', async () => {
    const res = await request
      .patch(`/api/paddocks/${paddockId}`)
      .send({ name: 'Hacked' });

    assert.strictEqual(res.status, 401);
  });

  test('returns 403 for non-manager', async () => {
    const workerToken = generateToken({ id: 99998, email: 'worker2@test.com', role: 'worker', farm_id: farmId });

    const res = await request
      .patch(`/api/paddocks/${paddockId}`)
      .set('Authorization', `Bearer ${workerToken}`)
      .send({ name: 'Worker Edit' });

    assert.strictEqual(res.status, 403);
  });
});

describe('DELETE /api/paddocks/:id', () => {
  let deletePaddockId;

  test('setup: create a paddock to delete', async () => {
    const geometry = {
      type: 'Polygon',
      coordinates: [[[7, 7], [8, 7], [8, 8], [7, 8], [7, 7]]],
    };

    const res = await request
      .post('/api/paddocks')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ name: 'Delete Me', geometry_geojson: geometry });

    assert.strictEqual(res.status, 201);
    deletePaddockId = res.body.paddock.id;
  });

  test('deletes a paddock', async () => {
    const res = await request
      .delete(`/api/paddocks/${deletePaddockId}`)
      .set('Authorization', `Bearer ${managerToken}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.message, 'Paddock deleted');

    // Verify it's gone
    const getRes = await request
      .get(`/api/paddocks/${deletePaddockId}`)
      .set('Authorization', `Bearer ${managerToken}`);

    assert.strictEqual(getRes.status, 404);
  });

  test('returns 404 for non-existent paddock', async () => {
    const res = await request
      .delete('/api/paddocks/99999')
      .set('Authorization', `Bearer ${managerToken}`);

    assert.strictEqual(res.status, 404);
  });

  test('returns 401 without auth', async () => {
    const res = await request.delete(`/api/paddocks/${paddockId}`);
    assert.strictEqual(res.status, 401);
  });

  test('returns 403 for non-manager', async () => {
    const workerToken = generateToken({ id: 99997, email: 'worker3@test.com', role: 'worker', farm_id: farmId });

    const res = await request
      .delete(`/api/paddocks/${paddockId}`)
      .set('Authorization', `Bearer ${workerToken}`);

    assert.strictEqual(res.status, 403);
  });

  test('prevents deletion of paddock referenced by a task', async () => {
    // Create a paddock
    const geo = { type: 'Polygon', coordinates: [[[0,0],[1,0],[1,1],[0,1],[0,0]]] };
    const createRes = await request
      .post('/api/paddocks')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ name: 'Referenced Paddock', geometry_geojson: geo });

    assert.strictEqual(createRes.status, 201);
    const refPaddockId = createRes.body.paddock.id;

    // Create a task referencing it (direct DB insert since no task route yet)
    const db = getDb();
    const user = db.prepare('SELECT id FROM users WHERE email = ?').get('paddock-manager@test.com');
    db.prepare(
      'INSERT INTO tasks (farm_id, title, status, priority, "order", location_type, paddock_id, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(farmId, 'Task in paddock', 'todo', 'medium', 0, 'paddock', refPaddockId, user.id);

    // Try to delete
    const res = await request
      .delete(`/api/paddocks/${refPaddockId}`)
      .set('Authorization', `Bearer ${managerToken}`);

    assert.strictEqual(res.status, 409);
    assert.ok(res.body.error);
  });
});
