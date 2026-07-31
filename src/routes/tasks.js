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

module.exports = router;
