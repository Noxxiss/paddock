const assert = require('node:assert');
const { test, before, after, describe } = require('node:test');
const supertest = require('supertest');
const path = require('path');
const fs = require('fs');
const app = require('../src/app');
const { initialize, close, getDb } = require('../src/db');
const { generateToken } = require('../src/middleware/auth');

const TEST_DB_PATH = path.join(__dirname, '..', 'paddock-test-tasks.db');

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
let workerToken;

test('setup: register a manager, create a farm, create a paddock, register a worker', async () => {
  const res = await request
    .post('/api/auth/register')
    .send({ email: 'task-manager@test.com', password: 'secret123', name: 'Task Manager' });

  assert.strictEqual(res.status, 201);
  managerToken = res.body.token;
  managerUser = res.body.user;
  farmId = res.body.user.farm_id;

  const boundary = {
    type: 'Polygon',
    coordinates: [[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]],
  };
  const farmRes = await request
    .post('/api/farms')
    .set('Authorization', `Bearer ${managerToken}`)
    .send({ name: 'Task Farm', boundary_geojson: boundary });

  assert.strictEqual(farmRes.status, 201);
  farmId = farmRes.body.farm.id;
  managerToken = farmRes.body.token;

  const geometry = { type: 'Polygon', coordinates: [[[1, 1], [2, 1], [2, 2], [1, 2], [1, 1]]] };
  const padRes = await request
    .post('/api/paddocks')
    .set('Authorization', `Bearer ${managerToken}`)
    .send({ name: 'Test Paddock', geometry_geojson: geometry });

  assert.strictEqual(padRes.status, 201);
  paddockId = padRes.body.paddock.id;

  // Create a worker user in the DB for testing worker permissions
  const bcrypt = require('bcryptjs');
  const db = getDb();
  const workerHash = bcrypt.hashSync('secret123', 10);
  const workerResult = db.prepare(
    'INSERT INTO users (farm_id, email, password_hash, name, role) VALUES (?, ?, ?, ?, ?)'
  ).run(farmId, 'task-worker@test.com', workerHash, 'Task Worker', 'worker');

  workerToken = generateToken({ id: workerResult.lastInsertRowid, email: 'task-worker@test.com', role: 'worker', farm_id: farmId });
});

describe('POST /api/tasks', () => {
  test('creates a task with drawing location (polygon)', async () => {
    const location = {
      type: 'Polygon',
      coordinates: [[[0, 0], [5, 0], [5, 5], [0, 5], [0, 0]]],
    };

    const res = await request
      .post('/api/tasks')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        title: 'Fix fence',
        priority: 'high',
        location_type: 'drawing',
        location_geojson: location,
      });

    assert.strictEqual(res.status, 201);
    assert.ok(res.body.task.id);
    assert.strictEqual(res.body.task.title, 'Fix fence');
    assert.strictEqual(res.body.task.priority, 'high');
    assert.strictEqual(res.body.task.status, 'todo');
    assert.strictEqual(res.body.task.location_type, 'drawing');
    assert.deepStrictEqual(JSON.parse(res.body.task.location_geojson), location);
    assert.strictEqual(res.body.task.farm_id, farmId);
    assert.strictEqual(res.body.task.created_by, managerUser.id);
    assert.ok(res.body.task.created_at);
    assert.strictEqual(res.body.task.assigned_to, null);
    assert.strictEqual(res.body.task.paddock_id, null);
  });

  test('creates a task with drawing location (point)', async () => {
    const location = { type: 'Point', coordinates: [3, 4] };

    const res = await request
      .post('/api/tasks')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        title: 'Check gate',
        location_type: 'drawing',
        location_geojson: location,
      });

    assert.strictEqual(res.status, 201);
    assert.deepStrictEqual(JSON.parse(res.body.task.location_geojson), location);
    assert.strictEqual(res.body.task.priority, 'medium');
  });

  test('creates a task with drawing location (line)', async () => {
    const location = { type: 'LineString', coordinates: [[0, 0], [1, 1], [2, 0]] };

    const res = await request
      .post('/api/tasks')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        title: 'Repair pipeline',
        priority: 'low',
        location_type: 'drawing',
        location_geojson: location,
      });

    assert.strictEqual(res.status, 201);
    assert.deepStrictEqual(JSON.parse(res.body.task.location_geojson), location);
    assert.strictEqual(res.body.task.priority, 'low');
  });

  test('creates a task with paddock location', async () => {
    const res = await request
      .post('/api/tasks')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        title: 'Mow Test Paddock',
        priority: 'medium',
        location_type: 'paddock',
        paddock_id: paddockId,
      });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.task.location_type, 'paddock');
    assert.strictEqual(res.body.task.paddock_id, paddockId);
    assert.strictEqual(res.body.task.location_geojson, null);
  });

  test('creates a task with assigned worker', async () => {
    const res = await request
      .post('/api/tasks')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        title: 'Assigned task',
        priority: 'high',
        location_type: 'drawing',
        location_geojson: { type: 'Point', coordinates: [5, 5] },
        assigned_to: managerUser.id,
      });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.task.assigned_to, managerUser.id);
  });

  test('worker can create a task', async () => {
    const res = await request
      .post('/api/tasks')
      .set('Authorization', `Bearer ${workerToken}`)
      .send({
        title: 'Worker task',
        location_type: 'drawing',
        location_geojson: { type: 'Point', coordinates: [7, 7] },
      });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.task.title, 'Worker task');
  });

  test('returns 400 without title', async () => {
    const res = await request
      .post('/api/tasks')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ location_type: 'drawing', location_geojson: { type: 'Point', coordinates: [0, 0] } });

    assert.strictEqual(res.status, 400);
  });

  test('returns 400 without location_type', async () => {
    const res = await request
      .post('/api/tasks')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ title: 'No location type' });

    assert.strictEqual(res.status, 400);
  });

  test('returns 400 with invalid location_type', async () => {
    const res = await request
      .post('/api/tasks')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ title: 'Bad', location_type: 'invalid' });

    assert.strictEqual(res.status, 400);
  });

  test('returns 400 with drawing type but no location_geojson', async () => {
    const res = await request
      .post('/api/tasks')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ title: 'No geo', location_type: 'drawing' });

    assert.strictEqual(res.status, 400);
  });

  test('returns 400 with paddock type but no paddock_id', async () => {
    const res = await request
      .post('/api/tasks')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ title: 'No paddock', location_type: 'paddock' });

    assert.strictEqual(res.status, 400);
  });

  test('returns 400 with invalid priority', async () => {
    const res = await request
      .post('/api/tasks')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        title: 'Bad priority',
        priority: 'urgent',
        location_type: 'drawing',
        location_geojson: { type: 'Point', coordinates: [0, 0] },
      });

    assert.strictEqual(res.status, 400);
  });

  test('returns 400 with non-existent paddock_id', async () => {
    const res = await request
      .post('/api/tasks')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        title: 'Bad paddock',
        location_type: 'paddock',
        paddock_id: 99999,
      });

    assert.strictEqual(res.status, 400);
  });

  test('returns 401 without auth', async () => {
    const res = await request
      .post('/api/tasks')
      .send({ title: 'No auth', location_type: 'drawing', location_geojson: { type: 'Point', coordinates: [0, 0] } });

    assert.strictEqual(res.status, 401);
  });
});

describe('GET /api/tasks', () => {
  test('returns active tasks for the farm', async () => {
    const res = await request
      .get('/api/tasks')
      .set('Authorization', `Bearer ${managerToken}`);

    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.tasks));
    assert.ok(res.body.tasks.length >= 5);

    const task = res.body.tasks[0];
    assert.ok(task.id);
    assert.ok(task.title);
    assert.ok(task.status);
    assert.ok(task.priority);
    assert.ok(task.location_type);
    assert.ok(task.farm_id);
    assert.ok(task.created_by);
    assert.ok(task.created_at);
    assert.ok(task.order >= 0);
  });

  test('tasks include paddock details when location_type is paddock', async () => {
    const res = await request
      .get('/api/tasks')
      .set('Authorization', `Bearer ${managerToken}`);

    assert.strictEqual(res.status, 200);
    const padTask = res.body.tasks.find(t => t.location_type === 'paddock');
    assert.ok(padTask);
    assert.ok(padTask.paddock_name);
    assert.ok(padTask.paddock_geometry_geojson);
  });

  test('returns 401 without auth', async () => {
    const res = await request.get('/api/tasks');
    assert.strictEqual(res.status, 401);
  });

  test('does not return tasks from other farms', async () => {
    const otherToken = generateToken({
      id: 99990, email: 'other@test.com', role: 'worker', farm_id: 99999,
    });

    const res = await request
      .get('/api/tasks')
      .set('Authorization', `Bearer ${otherToken}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.tasks.length, 0);
  });

  test('only returns todo (active) tasks - excludes done tasks', async () => {
    const createRes = await request
      .post('/api/tasks')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        title: 'Will be done',
        location_type: 'drawing',
        location_geojson: { type: 'Point', coordinates: [9, 9] },
      });

    assert.strictEqual(createRes.status, 201);
    const taskId = createRes.body.task.id;

    const db = getDb();
    db.prepare("UPDATE tasks SET status = 'done', completed_by = ?, completed_at = datetime('now') WHERE id = ?")
      .run(managerUser.id, taskId);

    const res = await request
      .get('/api/tasks')
      .set('Authorization', `Bearer ${managerToken}`);

    const titles = res.body.tasks.map(t => t.title);
    assert.ok(!titles.includes('Will be done'));
  });
});
