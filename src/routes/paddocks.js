const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { getDb } = require('../db');

const router = express.Router();

router.get('/api/paddocks', authMiddleware, (req, res) => {
  const db = getDb();
  const paddocks = db.prepare(
    'SELECT id, farm_id, name, geometry_geojson, created_at FROM paddocks WHERE farm_id = ? ORDER BY name'
  ).all(req.user.farm_id);

  res.json({ paddocks });
});

router.post('/api/paddocks', authMiddleware, (req, res) => {
  if (req.user.role !== 'manager') {
    return res.status(403).json({ error: 'Only managers can create paddocks' });
  }

  const { name, geometry_geojson } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'name is required' });
  }

  if (!geometry_geojson) {
    return res.status(400).json({ error: 'geometry_geojson is required' });
  }

  const db = getDb();

  const result = db.prepare(
    'INSERT INTO paddocks (farm_id, name, geometry_geojson) VALUES (?, ?, ?)'
  ).run(req.user.farm_id, name.trim(), JSON.stringify(geometry_geojson));

  const paddock = db.prepare(
    'SELECT id, farm_id, name, geometry_geojson, created_at FROM paddocks WHERE id = ?'
  ).get(result.lastInsertRowid);

  res.status(201).json({ paddock });
});

router.get('/api/paddocks/:id', authMiddleware, (req, res) => {
  const db = getDb();
  const paddock = db.prepare(
    'SELECT id, farm_id, name, geometry_geojson, created_at FROM paddocks WHERE id = ?'
  ).get(req.params.id);

  if (!paddock) {
    return res.status(404).json({ error: 'Paddock not found' });
  }

  if (paddock.farm_id !== req.user.farm_id) {
    return res.status(404).json({ error: 'Paddock not found' });
  }

  res.json({ paddock });
});

router.patch('/api/paddocks/:id', authMiddleware, (req, res) => {
  const db = getDb();

  const paddock = db.prepare(
    'SELECT id, farm_id, name, geometry_geojson, created_at FROM paddocks WHERE id = ?'
  ).get(req.params.id);

  if (!paddock) {
    return res.status(404).json({ error: 'Paddock not found' });
  }

  if (paddock.farm_id !== req.user.farm_id) {
    return res.status(404).json({ error: 'Paddock not found' });
  }

  if (req.user.role !== 'manager') {
    return res.status(403).json({ error: 'Only managers can update paddocks' });
  }

  const { name, geometry_geojson } = req.body;

  const updates = [];
  const values = [];

  if (name !== undefined) {
    updates.push('name = ?');
    values.push(name.trim());
  }

  if (geometry_geojson !== undefined) {
    updates.push('geometry_geojson = ?');
    values.push(JSON.stringify(geometry_geojson));
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  values.push(req.params.id);

  db.prepare(`UPDATE paddocks SET ${updates.join(', ')} WHERE id = ?`).run(...values);

  const updatedPaddock = db.prepare(
    'SELECT id, farm_id, name, geometry_geojson, created_at FROM paddocks WHERE id = ?'
  ).get(req.params.id);

  res.json({ paddock: updatedPaddock });
});

router.delete('/api/paddocks/:id', authMiddleware, (req, res) => {
  const db = getDb();

  const paddock = db.prepare(
    'SELECT id, farm_id, name, geometry_geojson, created_at FROM paddocks WHERE id = ?'
  ).get(req.params.id);

  if (!paddock) {
    return res.status(404).json({ error: 'Paddock not found' });
  }

  if (paddock.farm_id !== req.user.farm_id) {
    return res.status(404).json({ error: 'Paddock not found' });
  }

  if (req.user.role !== 'manager') {
    return res.status(403).json({ error: 'Only managers can delete paddocks' });
  }

  const taskRefCount = db.prepare(
    'SELECT COUNT(*) AS count FROM tasks WHERE paddock_id = ?'
  ).get(req.params.id);

  if (taskRefCount.count > 0) {
    return res.status(409).json({ error: 'Cannot delete paddock that is referenced by tasks' });
  }

  db.prepare('DELETE FROM paddocks WHERE id = ?').run(req.params.id);

  res.json({ message: 'Paddock deleted' });
});

module.exports = router;
