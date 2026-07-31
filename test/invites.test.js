const assert = require('node:assert');
const { test, before, after, describe } = require('node:test');
const supertest = require('supertest');
const path = require('path');
const fs = require('fs');
const app = require('../src/app');
const { initialize, close, getDb } = require('../src/db');
const { generateToken } = require('../src/middleware/auth');

const TEST_DB_PATH = path.join(__dirname, '..', 'paddock-test-invites.db');

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
let workerToken;

test('setup: register a manager and create a farm', async () => {
  const reg = await request
    .post('/api/auth/register')
    .send({ email: 'boss@farm.com', password: 'secret123', name: 'The Boss' });

  assert.strictEqual(reg.status, 201);
  managerToken = reg.body.token;
  managerUser = reg.body.user;
  farmId = reg.body.user.farm_id;

  // Create a proper farm (the default "My Farm" from register)
  const farmRes = await request
    .post('/api/farms')
    .set('Authorization', `Bearer ${managerToken}`)
    .send({
      name: 'Test Farm',
      boundary_geojson: { type: 'Polygon', coordinates: [[[0,0],[1,0],[1,1],[0,1],[0,0]]] },
    });

  assert.strictEqual(farmRes.status, 201);
  farmId = farmRes.body.farm.id;
  managerToken = farmRes.body.token;
});

describe('POST /api/invites', () => {
  test('creates an invite token for a worker', async () => {
    const res = await request
      .post('/api/invites')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ email: 'worker1@farm.com' });

    assert.strictEqual(res.status, 201);
    assert.ok(res.body.invite.id);
    assert.strictEqual(res.body.invite.email, 'worker1@farm.com');
    assert.strictEqual(res.body.invite.role, 'worker');
    assert.ok(res.body.invite.token);
    assert.ok(res.body.invite.expires_at);
    assert.strictEqual(res.body.invite.used, 0);
  });

  test('creates an invite defaulting to worker role', async () => {
    const res = await request
      .post('/api/invites')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ email: 'worker2@farm.com' });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.invite.role, 'worker');
  });

  test('returns 401 without auth', async () => {
    const res = await request
      .post('/api/invites')
      .send({ email: 'nobody@farm.com' });

    assert.strictEqual(res.status, 401);
  });

  test('returns 403 for non-manager', async () => {
    const fakeToken = generateToken({ id: 99999, email: 'worker@test.com', role: 'worker', farm_id: farmId });

    const res = await request
      .post('/api/invites')
      .set('Authorization', `Bearer ${fakeToken}`)
      .send({ email: 'nobody@farm.com' });

    assert.strictEqual(res.status, 403);
  });

  test('returns 400 without email', async () => {
    const res = await request
      .post('/api/invites')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({});

    assert.strictEqual(res.status, 400);
  });

  test('returns 409 if invite already exists for email', async () => {
    const res = await request
      .post('/api/invites')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ email: 'worker1@farm.com' });

    assert.strictEqual(res.status, 409);
  });
});

describe('POST /api/accept-invite/:token', () => {
  let inviteToken;

  test('setup: create a fresh invite', async () => {
    const res = await request
      .post('/api/invites')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ email: 'new-worker@farm.com' });

    assert.strictEqual(res.status, 201);
    inviteToken = res.body.invite.token;
  });

  test('creates a worker account and returns auth token', async () => {
    const res = await request
      .post(`/api/accept-invite/${inviteToken}`)
      .send({ name: 'New Worker', password: 'workerpass' });

    assert.strictEqual(res.status, 201);
    assert.ok(res.body.token);
    assert.strictEqual(res.body.user.email, 'new-worker@farm.com');
    assert.strictEqual(res.body.user.name, 'New Worker');
    assert.strictEqual(res.body.user.role, 'worker');
    assert.strictEqual(res.body.user.farm_id, farmId);

    workerToken = res.body.token;
  });

  test('returns 410 for already used token', async () => {
    const res = await request
      .post(`/api/accept-invite/${inviteToken}`)
      .send({ name: 'Sneaky', password: 'pass123' });

    assert.strictEqual(res.status, 410);
  });

  test('returns 404 for invalid token', async () => {
    const res = await request
      .post('/api/accept-invite/nonexistent-token')
      .send({ name: 'Ghost', password: 'pass123' });

    assert.strictEqual(res.status, 404);
  });

  test('returns 400 without name or password', async () => {
    const inv = await request
      .post('/api/invites')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ email: 'incomplete@farm.com' });

    assert.strictEqual(inv.status, 201);
    const tok = inv.body.invite.token;

    const res1 = await request
      .post(`/api/accept-invite/${tok}`)
      .send({ name: 'NoPass' });

    assert.strictEqual(res1.status, 400);

    // Token is still valid (validation fails before consuming the invite)
    const inv2 = await request
      .post('/api/invites')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ email: 'incomplete2@farm.com' });

    assert.strictEqual(inv2.status, 201);
    const tok2 = inv2.body.invite.token;

    const res2 = await request
      .post(`/api/accept-invite/${tok2}`)
      .send({ password: 'pass123' });

    assert.strictEqual(res2.status, 400);
  });

  test('returns 410 for expired token', async () => {
    const inv = await request
      .post('/api/invites')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ email: 'expired@farm.com' });

    assert.strictEqual(inv.status, 201);
    const inviteId = inv.body.invite.id;

    // Manually expire the invite in the database
    const db = getDb();
    db.prepare('UPDATE invite_tokens SET expires_at = ? WHERE id = ?').run(
      new Date(Date.now() - 86400000).toISOString(), inviteId
    );

    const expiredInvite = db.prepare('SELECT token FROM invite_tokens WHERE id = ?').get(inviteId);

    const res = await request
      .post(`/api/accept-invite/${expiredInvite.token}`)
      .send({ name: 'Too Late', password: 'pass123' });

    assert.strictEqual(res.status, 410);
  });

  test('returns 409 if email already registered', async () => {
    // Create an invite for an already-registered email
    const inv = await request
      .post('/api/invites')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ email: 'boss@farm.com' });

    assert.strictEqual(inv.status, 201);
    const tok = inv.body.invite.token;

    const res = await request
      .post(`/api/accept-invite/${tok}`)
      .send({ name: 'Impostor', password: 'pass123' });

    assert.strictEqual(res.status, 409);
  });
});

describe('GET /accept-invite/:token (SPA routing)', () => {
  test('serves index.html for accept-invite path', async () => {
    const res = await request
      .get('/accept-invite/some-test-token-12345');

    assert.strictEqual(res.status, 200);
    assert.ok(res.text.includes('<div id="app">'), 'should contain SPA root div');
  });
});

describe('GET /api/farms/:id/workers', () => {
  test('lists all workers on the farm (excluding manager)', async () => {
    const res = await request
      .get(`/api/farms/${farmId}/workers`)
      .set('Authorization', `Bearer ${managerToken}`);

    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.workers));

    const emails = res.body.workers.map(w => w.email);
    assert.ok(emails.includes('new-worker@farm.com'));
    // Manager should not be in the list
    assert.ok(!emails.includes('boss@farm.com'));
  });

  test('returns 401 without auth', async () => {
    const res = await request.get(`/api/farms/${farmId}/workers`);
    assert.strictEqual(res.status, 401);
  });

  test('returns 403 for non-manager', async () => {
    const res = await request
      .get(`/api/farms/${farmId}/workers`)
      .set('Authorization', `Bearer ${workerToken}`);

    assert.strictEqual(res.status, 403);
  });

  test('returns 404 for non-existent farm', async () => {
    const res = await request
      .get('/api/farms/99999/workers')
      .set('Authorization', `Bearer ${managerToken}`);

    assert.strictEqual(res.status, 404);
  });
});

describe('DELETE /api/farms/:id/workers/:userId', () => {
  let workerId;

  test('setup: get worker id', async () => {
    const res = await request
      .get(`/api/farms/${farmId}/workers`)
      .set('Authorization', `Bearer ${managerToken}`);

    assert.strictEqual(res.status, 200);
    workerId = res.body.workers[0].id;
    assert.ok(workerId);
  });

  test('removes a worker from the farm', async () => {
    const res = await request
      .delete(`/api/farms/${farmId}/workers/${workerId}`)
      .set('Authorization', `Bearer ${managerToken}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.message, 'Worker removed');
  });

  test('worker no longer appears in the list', async () => {
    const res = await request
      .get(`/api/farms/${farmId}/workers`)
      .set('Authorization', `Bearer ${managerToken}`);

    assert.strictEqual(res.status, 200);
    const ids = res.body.workers.map(w => w.id);
    assert.ok(!ids.includes(workerId));
  });

  test('returns 401 without auth', async () => {
    const res = await request.delete(`/api/farms/${farmId}/workers/${workerId}`);
    assert.strictEqual(res.status, 401);
  });

  test('returns 403 for non-manager', async () => {
    const res = await request
      .delete(`/api/farms/${farmId}/workers/${workerId}`)
      .set('Authorization', `Bearer ${workerToken}`);

    assert.strictEqual(res.status, 403);
  });

  test('returns 404 for non-existent worker on the farm', async () => {
    const res = await request
      .delete(`/api/farms/${farmId}/workers/99999`)
      .set('Authorization', `Bearer ${managerToken}`);

    assert.strictEqual(res.status, 404);
  });

  test('returns 404 for non-existent farm', async () => {
    const res = await request
      .delete('/api/farms/99999/workers/1')
      .set('Authorization', `Bearer ${managerToken}`);

    assert.strictEqual(res.status, 404);
  });
});
