const assert = require('node:assert');
const { test, before, after, describe, mock } = require('node:test');
const supertest = require('supertest');
const path = require('path');
const fs = require('fs');
const app = require('../src/app');
const { initialize, close, getDb } = require('../src/db');
const { generateToken } = require('../src/middleware/auth');

const TEST_DB_PATH = path.join(__dirname, '..', 'paddock-test-push.db');

let request;
let managerToken;
let managerId;
let farmId;
let workerToken;
let workerId;
let worker2Token;
let worker2Id;

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

test('setup: register manager and create workers', async () => {
  const res = await request
    .post('/api/auth/register')
    .send({ email: 'push-manager@test.com', password: 'secret123', name: 'Push Manager' });

  assert.strictEqual(res.status, 201);
  managerToken = res.body.token;
  managerId = res.body.user.id;
  farmId = res.body.user.farm_id;

  const db = getDb();
  const bcrypt = require('bcryptjs');
  const hash = bcrypt.hashSync('secret123', 10);

  const w1 = db.prepare(
    'INSERT INTO users (farm_id, email, password_hash, name, role) VALUES (?, ?, ?, ?, ?)'
  ).run(farmId, 'push-worker@test.com', hash, 'Push Worker', 'worker');
  workerId = w1.lastInsertRowid;
  workerToken = generateToken({ id: workerId, email: 'push-worker@test.com', role: 'worker', farm_id: farmId });

  const w2 = db.prepare(
    'INSERT INTO users (farm_id, email, password_hash, name, role) VALUES (?, ?, ?, ?, ?)'
  ).run(farmId, 'push-worker2@test.com', hash, 'Push Worker 2', 'worker');
  worker2Id = w2.lastInsertRowid;
  worker2Token = generateToken({ id: worker2Id, email: 'push-worker2@test.com', role: 'worker', farm_id: farmId });
});

describe('GET /api/push/vapid-public-key', () => {
  test('returns a public key', async () => {
    process.env.VAPID_PUBLIC_KEY = 'test-public-key';
    process.env.VAPID_PRIVATE_KEY = 'test-private-key';

    const res = await request.get('/api/push/vapid-public-key');
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.publicKey);

    delete process.env.VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
  });

  test('returns a generated key when env vars are not set', async () => {
    const res = await request.get('/api/push/vapid-public-key');
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.publicKey);
  });
});

describe('POST /api/push/subscribe', () => {
  const subscription = {
    endpoint: 'https://example.com/push/abc123',
    keys: {
      p256dh: 'test-p256dh-key',
      auth: 'test-auth-key',
    },
  };

  test('saves a push subscription', async () => {
    const res = await request
      .post('/api/push/subscribe')
      .set('Authorization', `Bearer ${managerToken}`)
      .send(subscription);

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.success, true);

    const db = getDb();
    const saved = db.prepare(
      'SELECT * FROM push_subscriptions WHERE endpoint = ?'
    ).get(subscription.endpoint);

    assert.ok(saved);
    assert.strictEqual(saved.user_id, managerId);
  });

  test('updates an existing subscription', async () => {
    const updatedKeys = {
      p256dh: 'updated-p256dh-key',
      auth: 'updated-auth-key',
    };

    const res = await request
      .post('/api/push/subscribe')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        endpoint: subscription.endpoint,
        keys: updatedKeys,
      });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);

    const db = getDb();
    const saved = db.prepare(
      'SELECT keys FROM push_subscriptions WHERE endpoint = ?'
    ).get(subscription.endpoint);

    assert.deepStrictEqual(JSON.parse(saved.keys), updatedKeys);
  });

  test('returns 400 without endpoint', async () => {
    const res = await request
      .post('/api/push/subscribe')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ keys: { p256dh: 'key', auth: 'key' } });

    assert.strictEqual(res.status, 400);
  });

  test('returns 400 without keys', async () => {
    const res = await request
      .post('/api/push/subscribe')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ endpoint: 'https://example.com/push/endpoint' });

    assert.strictEqual(res.status, 400);
  });

  test('returns 401 without auth', async () => {
    const res = await request
      .post('/api/push/subscribe')
      .send(subscription);

    assert.strictEqual(res.status, 401);
  });

  test('worker can subscribe to push', async () => {
    const res = await request
      .post('/api/push/subscribe')
      .set('Authorization', `Bearer ${workerToken}`)
      .send({
        endpoint: 'https://example.com/push/worker-sub',
        keys: { p256dh: 'worker-key', auth: 'worker-auth' },
      });

    assert.strictEqual(res.status, 201);
  });
});

describe('POST /api/push/unsubscribe', () => {
  test('removes a subscription', async () => {
    const res = await request
      .post('/api/push/unsubscribe')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ endpoint: 'https://example.com/push/abc123' });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);

    const db = getDb();
    const saved = db.prepare(
      'SELECT id FROM push_subscriptions WHERE endpoint = ?'
    ).get('https://example.com/push/abc123');

    assert.strictEqual(saved, undefined);
  });

  test('returns 400 without endpoint', async () => {
    const res = await request
      .post('/api/push/unsubscribe')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({});

    assert.strictEqual(res.status, 400);
  });

  test('returns 401 without auth', async () => {
    const res = await request
      .post('/api/push/unsubscribe')
      .send({ endpoint: 'https://example.com/push/whatever' });

    assert.strictEqual(res.status, 401);
  });
});

describe('Push notification dispatch on task creation', () => {
  const sentNotifications = [];

  before(() => {
    const webpush = require('web-push');
    mock.method(webpush, 'setVapidDetails', () => {});
    mock.method(webpush, 'sendNotification', (sub, payload) => {
      sentNotifications.push({ sub, payload: JSON.parse(payload) });
      return Promise.resolve();
    });
    process.env.VAPID_PUBLIC_KEY = 'test-push-public-key';
    process.env.VAPID_PRIVATE_KEY = 'test-push-private-key';
  });

  after(() => {
    mock.reset();
    delete process.env.VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
  });

  test('setup: clear subscriptions and subscribe both workers', async () => {
    const db = getDb();
    db.prepare('DELETE FROM push_subscriptions').run();

    await request
      .post('/api/push/subscribe')
      .set('Authorization', `Bearer ${workerToken}`)
      .send({
        endpoint: 'https://example.com/push/worker1',
        keys: { p256dh: 'w1-p256dh', auth: 'w1-auth' },
      });

    await request
      .post('/api/push/subscribe')
      .set('Authorization', `Bearer ${worker2Token}`)
      .send({
        endpoint: 'https://example.com/push/worker2',
        keys: { p256dh: 'w2-p256dh', auth: 'w2-auth' },
      });
  });

  test('creating a task without assignment sends push to all farm workers (excluding creator)', async () => {
    sentNotifications.length = 0;

    const res = await request
      .post('/api/tasks')
      .set('Authorization', `Bearer ${workerToken}`)
      .send({
        title: 'Push to all',
        location_type: 'drawing',
        location_geojson: { type: 'Point', coordinates: [1, 1] },
      });

    assert.strictEqual(res.status, 201);

    // Creator (worker1) is excluded, so only worker2 gets notified
    assert.strictEqual(sentNotifications.length, 1);
    assert.strictEqual(
      sentNotifications[0].sub.endpoint,
      'https://example.com/push/worker2'
    );

    assert.strictEqual(sentNotifications[0].payload.type, 'task.created');
    assert.strictEqual(sentNotifications[0].payload.task.title, 'Push to all');
    assert.ok(sentNotifications[0].payload.task.id);
  });

  test('creating a task with assignment sends push only to assigned worker', async () => {
    sentNotifications.length = 0;

    const res = await request
      .post('/api/tasks')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        title: 'Push to assigned',
        priority: 'high',
        location_type: 'drawing',
        location_geojson: { type: 'Point', coordinates: [2, 2] },
        assigned_to: workerId,
      });

    assert.strictEqual(res.status, 201);

    assert.strictEqual(sentNotifications.length, 1);
    assert.strictEqual(
      sentNotifications[0].sub.endpoint,
      'https://example.com/push/worker1'
    );

    assert.strictEqual(sentNotifications[0].payload.type, 'task.assigned');
    assert.strictEqual(sentNotifications[0].payload.task.title, 'Push to assigned');
  });

  test('creating a task without subscribers still succeeds', async () => {
    const db = getDb();
    db.prepare('DELETE FROM push_subscriptions').run();

    sentNotifications.length = 0;

    const res = await request
      .post('/api/tasks')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        title: 'No subscribers',
        location_type: 'drawing',
        location_geojson: { type: 'Point', coordinates: [3, 3] },
      });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(sentNotifications.length, 0);
  });
});
