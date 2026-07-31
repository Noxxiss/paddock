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

  test('creates a task with assigned worker and reflects assigned_to_name in GET', async () => {
    const createRes = await request
      .post('/api/tasks')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        title: 'Named assigned task',
        priority: 'high',
        location_type: 'drawing',
        location_geojson: { type: 'Point', coordinates: [6, 6] },
        assigned_to: managerUser.id,
      });

    assert.strictEqual(createRes.status, 201);

    const getRes = await request
      .get('/api/tasks')
      .set('Authorization', `Bearer ${managerToken}`);

    assert.strictEqual(getRes.status, 200);
    const assigned = getRes.body.tasks.find(t => t.title === 'Named assigned task');
    assert.ok(assigned);
    assert.strictEqual(assigned.assigned_to_name, 'Task Manager');
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
    // assigned_to_name should be null for unassigned tasks
    assert.strictEqual(task.assigned_to_name, null);
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

describe('PATCH /api/tasks/reorder', () => {
  test('reorders tasks and persists new order indices', async () => {
    // Create 3 tasks in known order
    const t1 = await request
      .post('/api/tasks')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ title: 'Reorder A', location_type: 'drawing', location_geojson: { type: 'Point', coordinates: [0, 0] } });
    const t2 = await request
      .post('/api/tasks')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ title: 'Reorder B', location_type: 'drawing', location_geojson: { type: 'Point', coordinates: [1, 1] } });
    const t3 = await request
      .post('/api/tasks')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ title: 'Reorder C', location_type: 'drawing', location_geojson: { type: 'Point', coordinates: [2, 2] } });

    // Verify initial order (created sequentially)
    let getRes = await request
      .get('/api/tasks')
      .set('Authorization', `Bearer ${managerToken}`);
    const initial = getRes.body.tasks.filter(t => t.title.startsWith('Reorder '));
    assert.strictEqual(initial.length, 3);
    const aOrder = initial.find(t => t.title === 'Reorder A').order;
    const bOrder = initial.find(t => t.title === 'Reorder B').order;
    const cOrder = initial.find(t => t.title === 'Reorder C').order;
    assert.ok(aOrder < bOrder, 'A should come before B');
    assert.ok(bOrder < cOrder, 'B should come before C');

    // Reorder: move C to front, A to end
    const newOrder = [
      { id: t3.body.task.id, order: aOrder },
      { id: t2.body.task.id, order: bOrder },
      { id: t1.body.task.id, order: cOrder },
    ];

    const reorderRes = await request
      .patch('/api/tasks/reorder')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ order: newOrder });

    assert.strictEqual(reorderRes.status, 200);

    // Verify new order via GET
    getRes = await request
      .get('/api/tasks')
      .set('Authorization', `Bearer ${managerToken}`);
    const reordered = getRes.body.tasks.filter(t => t.title.startsWith('Reorder '));
    assert.strictEqual(reordered[0].title, 'Reorder C');
    assert.strictEqual(reordered[1].title, 'Reorder B');
    assert.strictEqual(reordered[2].title, 'Reorder A');
  });

  test('returns 400 without order array', async () => {
    const res = await request
      .patch('/api/tasks/reorder')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({});

    assert.strictEqual(res.status, 400);
  });

  test('returns 400 if order is not an array', async () => {
    const res = await request
      .patch('/api/tasks/reorder')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ order: 'not-an-array' });

    assert.strictEqual(res.status, 400);
  });

  test('returns 400 if order item has missing fields', async () => {
    const res = await request
      .patch('/api/tasks/reorder')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ order: [{ id: 1 }] });

    assert.strictEqual(res.status, 400);
  });

  test('returns 401 without auth', async () => {
    const res = await request
      .patch('/api/tasks/reorder')
      .send({ order: [] });

    assert.strictEqual(res.status, 401);
  });

  test('rejects task ids that do not belong to the farm', async () => {
    const res = await request
      .patch('/api/tasks/reorder')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ order: [{ id: 99999, order: 0 }] });

    assert.strictEqual(res.status, 400);
    assert.ok(res.body.error);
    assert.ok(res.body.unknownIds);
    assert.strictEqual(res.body.unknownIds[0], 99999);
  });

  test('rejects duplicate task ids in order', async () => {
    // Create a task to use
    const createRes = await request
      .post('/api/tasks')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ title: 'Dup test', location_type: 'drawing', location_geojson: { type: 'Point', coordinates: [0, 0] } });

    const taskId = createRes.body.task.id;

    const res = await request
      .patch('/api/tasks/reorder')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ order: [{ id: taskId, order: 0 }, { id: taskId, order: 1 }] });

    assert.strictEqual(res.status, 400);
    assert.ok(res.body.error.includes('duplicate'));
  });
});

describe('Map view data', () => {
  test('tasks data includes all fields needed for map rendering', async () => {
    const res = await request
      .get('/api/tasks')
      .set('Authorization', `Bearer ${managerToken}`);

    assert.strictEqual(res.status, 200);
    assert.ok(res.body.tasks.length > 0);

    for (const task of res.body.tasks) {
      assert.ok(task.id);
      assert.ok(task.title);
      assert.ok(task.priority);
      assert.strictEqual(task.status, 'todo');
      assert.ok(task.location_type);
      assert.ok(task.created_at);

      // Each task must have a location representation for the map
      if (task.location_type === 'drawing') {
        assert.ok(task.location_geojson);
        const geo = JSON.parse(task.location_geojson);
        assert.ok(geo.type);
        assert.ok(geo.coordinates);
      }

      if (task.location_type === 'paddock') {
        assert.ok(task.paddock_id);
        assert.ok(task.paddock_name);
        assert.ok(task.paddock_geometry_geojson);
        const padGeo = JSON.parse(task.paddock_geometry_geojson);
        assert.ok(padGeo.type);
        assert.ok(padGeo.coordinates);
      }
    }
  });

  test('tasks with different geometry types are returned for map display', async () => {
    const geometries = [
      { type: 'Point', coordinates: [148.5, -20.5] },
      { type: 'Polygon', coordinates: [[[148.0, -20.0], [149.0, -20.0], [149.0, -21.0], [148.0, -21.0], [148.0, -20.0]]] },
      { type: 'LineString', coordinates: [[148.1, -20.1], [148.2, -20.2], [148.3, -20.1]] },
    ];

    for (const geo of geometries) {
      const res = await request
        .post('/api/tasks')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          title: `Map geo ${geo.type}`,
          location_type: 'drawing',
          location_geojson: geo,
        });
      assert.strictEqual(res.status, 201);
    }

    const getRes = await request
      .get('/api/tasks')
      .set('Authorization', `Bearer ${managerToken}`);

    assert.strictEqual(getRes.status, 200);
    for (const geo of geometries) {
      const task = getRes.body.tasks.find(t => t.title === `Map geo ${geo.type}`);
      assert.ok(task, `Task for ${geo.type} should exist`);
      assert.ok(task.location_geojson);
      const parsed = JSON.parse(task.location_geojson);
      assert.strictEqual(parsed.type, geo.type);
    }
  });
});
