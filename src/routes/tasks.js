const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { getDb } = require('../db');

const router = express.Router();

const VALID_PRIORITIES = ['high', 'medium', 'low'];
const VALID_LOCATION_TYPES = ['drawing', 'paddock'];

router.post('/api/tasks', authMiddleware, (req, res) => {
  const { title, priority, location_type, location_geojson, paddock_id, assigned_to } = req.body;

  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'title is required' });
  }

  if (!location_type || !VALID_LOCATION_TYPES.includes(location_type)) {
    return res.status(400).json({ error: 'location_type must be "drawing" or "paddock"' });
  }

  if (priority && !VALID_PRIORITIES.includes(priority)) {
    return res.status(400).json({ error: 'priority must be "high", "medium", or "low"' });
  }

  if (location_type === 'drawing' && !location_geojson) {
    return res.status(400).json({ error: 'location_geojson is required when location_type is "drawing"' });
  }

  if (location_type === 'paddock' && !paddock_id) {
    return res.status(400).json({ error: 'paddock_id is required when location_type is "paddock"' });
  }

  const db = getDb();

  if (location_type === 'paddock') {
    const paddock = db.prepare(
      'SELECT id, farm_id FROM paddocks WHERE id = ?'
    ).get(paddock_id);

    if (!paddock) {
      return res.status(400).json({ error: 'paddock_id does not exist' });
    }

    if (paddock.farm_id !== req.user.farm_id) {
      return res.status(400).json({ error: 'paddock_id does not exist' });
    }
  }

  if (assigned_to !== undefined && assigned_to !== null) {
    const user = db.prepare(
      'SELECT id, farm_id FROM users WHERE id = ?'
    ).get(assigned_to);

    if (!user) {
      return res.status(400).json({ error: 'assigned_to user does not exist' });
    }

    if (user.farm_id !== req.user.farm_id) {
      return res.status(400).json({ error: 'assigned_to user is not on this farm' });
    }
  }

  const nextOrder = db.prepare(
    'SELECT COALESCE(MAX("order"), -1) + 1 AS next_order FROM tasks WHERE farm_id = ?'
  ).get(req.user.farm_id).next_order;

  const result = db.prepare(`
    INSERT INTO tasks (farm_id, title, priority, "order", location_type, location_geojson, paddock_id, assigned_to, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    req.user.farm_id,
    title.trim(),
    priority || 'medium',
    nextOrder,
    location_type,
    location_geojson ? JSON.stringify(location_geojson) : null,
    location_type === 'paddock' ? paddock_id : null,
    assigned_to || null,
    req.user.id
  );

  const task = db.prepare(`
    SELECT id, farm_id, title, status, priority, "order", location_geojson, location_type, paddock_id, assigned_to, created_by, completed_by, completed_at, created_at, updated_at
    FROM tasks WHERE id = ?
  `).get(result.lastInsertRowid);

  res.status(201).json({ task });
});

router.get('/api/tasks', authMiddleware, (req, res) => {
  const db = getDb();

  const tasks = db.prepare(`
    SELECT
      t.id,
      t.farm_id,
      t.title,
      t.status,
      t.priority,
      t."order",
      t.location_geojson,
      t.location_type,
      t.paddock_id,
      t.assigned_to,
      t.created_by,
      t.completed_by,
      t.completed_at,
      t.created_at,
      t.updated_at,
      p.name AS paddock_name,
      p.geometry_geojson AS paddock_geometry_geojson,
      u.name AS assigned_to_name
    FROM tasks t
    LEFT JOIN paddocks p ON p.id = t.paddock_id
    LEFT JOIN users u ON u.id = t.assigned_to
    WHERE t.farm_id = ? AND t.status = 'todo'
    ORDER BY t."order"
  `).all(req.user.farm_id);

  res.json({ tasks });
});

router.patch('/api/tasks/reorder', authMiddleware, (req, res) => {
  const { order } = req.body;

  if (!order || !Array.isArray(order)) {
    return res.status(400).json({ error: 'order must be an array of { id, order }' });
  }

  if (order.length === 0) {
    return res.status(400).json({ error: 'order array must not be empty' });
  }

  const seen = new Set();
  for (const item of order) {
    if (!item.id || !Number.isInteger(item.order)) {
      return res.status(400).json({ error: 'each item in order must have an id and an integer order value' });
    }
    if (seen.has(item.id)) {
      return res.status(400).json({ error: `duplicate task id in order: ${item.id}` });
    }
    seen.add(item.id);
  }

  const db = getDb();

  const ids = order.map(i => i.id);
  const placeholders = ids.map(() => '?').join(',');
  const owned = db.prepare(
    `SELECT id FROM tasks WHERE id IN (${placeholders}) AND farm_id = ?`
  ).all(...ids, req.user.farm_id);

  const ownedIds = new Set(owned.map(r => r.id));
  const unknownIds = ids.filter(id => !ownedIds.has(id));
  if (unknownIds.length > 0) {
    return res.status(400).json({ error: 'some task ids do not exist on this farm', unknownIds });
  }

  const updateStmt = db.prepare(
    'UPDATE tasks SET "order" = ? WHERE id = ? AND farm_id = ?'
  );

  db.transaction(() => {
    for (const item of order) {
      updateStmt.run(item.order, item.id, req.user.farm_id);
    }
  })();

  res.json({ success: true });
});

router.patch('/api/tasks/:id/complete', authMiddleware, (req, res) => {
  const { id } = req.params;
  const db = getDb();

  const task = db.prepare(
    'SELECT id, farm_id, status FROM tasks WHERE id = ?'
  ).get(id);

  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }

  if (task.farm_id !== req.user.farm_id) {
    return res.status(404).json({ error: 'Task not found' });
  }

  if (task.status === 'done') {
    return res.status(400).json({ error: 'Task is already completed' });
  }

  db.transaction(() => {
    db.prepare(
      `UPDATE tasks SET status = 'done', completed_by = ?, completed_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`
    ).run(req.user.id, id);

    db.prepare(
      'INSERT INTO completion_log (task_id, user_id, completed_at) VALUES (?, ?, datetime(\'now\'))'
    ).run(id, req.user.id);
  })();

  const updated = db.prepare(`
    SELECT id, farm_id, title, status, priority, "order", location_geojson, location_type, paddock_id, assigned_to, created_by, completed_by, completed_at, created_at, updated_at
    FROM tasks WHERE id = ?
  `).get(id);

  res.json({ task: updated });
});

router.get('/api/tasks/:id', authMiddleware, (req, res) => {
  const { id } = req.params;
  const db = getDb();

  const task = db.prepare(`
    SELECT
      t.id,
      t.farm_id,
      t.title,
      t.status,
      t.priority,
      t."order",
      t.location_geojson,
      t.location_type,
      t.paddock_id,
      t.assigned_to,
      t.created_by,
      t.completed_by,
      t.completed_at,
      t.created_at,
      t.updated_at,
      p.name AS paddock_name,
      p.geometry_geojson AS paddock_geometry_geojson,
      u.name AS assigned_to_name,
      cb.name AS completed_by_name
    FROM tasks t
    LEFT JOIN paddocks p ON p.id = t.paddock_id
    LEFT JOIN users u ON u.id = t.assigned_to
    LEFT JOIN users cb ON cb.id = t.completed_by
    WHERE t.id = ?
  `).get(id);

  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }

  if (task.farm_id !== req.user.farm_id) {
    return res.status(404).json({ error: 'Task not found' });
  }

  res.json({ task });
});

router.get('/api/completion-log', authMiddleware, (req, res) => {
  const db = getDb();

  const entries = db.prepare(`
    SELECT
      cl.id,
      cl.task_id,
      cl.user_id,
      cl.completed_at,
      t.title AS task_title,
      u.name AS completed_by_name
    FROM completion_log cl
    LEFT JOIN tasks t ON t.id = cl.task_id
    LEFT JOIN users u ON u.id = cl.user_id
    WHERE t.farm_id = ?
    ORDER BY cl.completed_at DESC
  `).all(req.user.farm_id);

  res.json({ entries });
});

module.exports = router;
