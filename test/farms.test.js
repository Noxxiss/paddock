const assert = require('node:assert');
const { test, before, after, describe } = require('node:test');
const supertest = require('supertest');
const path = require('path');
const fs = require('fs');
const app = require('../src/app');
const { initialize, close, getDb } = require('../src/db');
const { generateToken } = require('../src/middleware/auth');

const TEST_DB_PATH = path.join(__dirname, '..', 'paddock-test-farms.db');

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

test('setup: register a manager and get the initial farm', async () => {
  const res = await request
    .post('/api/auth/register')
    .send({ email: 'farm-manager@test.com', password: 'secret123', name: 'Farm Manager' });

  assert.strictEqual(res.status, 201);
  managerToken = res.body.token;
  managerUser = res.body.user;
  farmId = res.body.user.farm_id;
  assert.ok(farmId);
});

describe('POST /api/farms', () => {
  test('creates a farm and reassigns the user', async () => {
    const boundary = {
      type: 'Polygon',
      coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]],
    };

    const res = await request
      .post('/api/farms')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ name: 'Green Acres', boundary_geojson: boundary });

    assert.strictEqual(res.status, 201);
    assert.ok(res.body.farm.id);
    assert.strictEqual(res.body.farm.name, 'Green Acres');
    assert.deepStrictEqual(JSON.parse(res.body.farm.boundary_geojson), boundary);
    assert.ok(res.body.farm.created_at);

    // User's farm_id should now point to the new farm
    assert.strictEqual(res.body.farm.id, res.body.user.farm_id);

    // Update farmId for subsequent tests
    farmId = res.body.farm.id;
    managerToken = res.body.token; // token includes updated farm_id
  });

  test('returns 401 without auth', async () => {
    const res = await request
      .post('/api/farms')
      .send({ name: 'No Auth Farm', boundary_geojson: { type: 'Polygon', coordinates: [] } });

    assert.strictEqual(res.status, 401);
  });

  test('returns 403 for non-manager', async () => {
    const db = getDb();
    const workerToken = generateToken({ id: 99999, email: 'worker@test.com', role: 'worker', farm_id: 0 });

    const res = await request
      .post('/api/farms')
      .set('Authorization', `Bearer ${workerToken}`)
      .send({ name: 'Worker Farm', boundary_geojson: { type: 'Polygon', coordinates: [[[0,0],[1,0],[1,1],[0,1],[0,0]]] } });

    assert.strictEqual(res.status, 403);
  });

  test('returns 400 without name', async () => {
    const res = await request
      .post('/api/farms')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ boundary_geojson: { type: 'Polygon', coordinates: [] } });

    assert.strictEqual(res.status, 400);
  });
});

describe('GET /api/farms/:id', () => {
  test('returns the farm with boundary geometry', async () => {
    const res = await request
      .get(`/api/farms/${farmId}`)
      .set('Authorization', `Bearer ${managerToken}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.farm.name, 'Green Acres');
    assert.ok(res.body.farm.boundary_geojson);
    assert.ok(res.body.farm.created_at);
  });

  test('returns 401 without auth', async () => {
    const res = await request.get(`/api/farms/${farmId}`);
    assert.strictEqual(res.status, 401);
  });

  test('returns 404 for non-existent farm', async () => {
    const res = await request
      .get('/api/farms/99999')
      .set('Authorization', `Bearer ${managerToken}`);

    assert.strictEqual(res.status, 404);
  });

  test('returns 404 for farm not belonging to user', async () => {
    // Register a second user (gets a different farm)
    const otherRes = await request
      .post('/api/auth/register')
      .send({ email: 'other@test.com', password: 'secret123', name: 'Other User' });

    const otherToken = otherRes.body.token;

    const res = await request
      .get(`/api/farms/${farmId}`)
      .set('Authorization', `Bearer ${otherToken}`);

    assert.strictEqual(res.status, 404);
  });
});

describe('PATCH /api/farms/:id', () => {
  test('updates farm name', async () => {
    const res = await request
      .patch(`/api/farms/${farmId}`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ name: 'Green Acres Expanded' });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.farm.name, 'Green Acres Expanded');
  });

  test('updates farm boundary', async () => {
    const newBoundary = {
      type: 'Polygon',
      coordinates: [[[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]]],
    };

    const res = await request
      .patch(`/api/farms/${farmId}`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ boundary_geojson: newBoundary });

    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(JSON.parse(res.body.farm.boundary_geojson), newBoundary);
  });

  test('returns 401 without auth', async () => {
    const res = await request
      .patch(`/api/farms/${farmId}`)
      .send({ name: 'Hacked Farm' });

    assert.strictEqual(res.status, 401);
  });

  test('returns 404 for non-existent farm', async () => {
    const res = await request
      .patch('/api/farms/99999')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ name: 'Nowhere' });

    assert.strictEqual(res.status, 404);
  });

  test('only managers can update a farm', async () => {
    // Use the other user (who is also a manager of their own farm, but not of this farm)
    const otherRes = await request
      .post('/api/auth/register')
      .send({ email: 'worker@test.com', password: 'secret123', name: 'Worker' });

    const otherToken = otherRes.body.token;

    const res = await request
      .patch(`/api/farms/${farmId}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ name: 'Worker Takeover' });

    // Other user doesn't belong to this farm, so 404
    assert.strictEqual(res.status, 404);
  });
});

describe('GET /api/farms (existing)', () => {
  test('returns the user\'s current farm', async () => {
    const res = await request
      .get('/api/farms')
      .set('Authorization', `Bearer ${managerToken}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.farm.name, 'Green Acres Expanded');
    assert.ok(res.body.user);
  });
});
