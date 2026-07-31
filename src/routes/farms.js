const express = require('express');
const { authMiddleware, generateToken } = require('../middleware/auth');
const { getDb } = require('../db');

const router = express.Router();

router.get('/api/farms', authMiddleware, (req, res) => {
  const db = getDb();
  const farm = db.prepare('SELECT id, name, boundary_geojson, created_at FROM farms WHERE id = ?').get(req.user.farm_id);

  if (!farm) {
    return res.status(404).json({ error: 'Farm not found' });
  }

  res.json({ farm, user: req.user });
});

router.post('/api/farms', authMiddleware, (req, res) => {
  if (req.user.role !== 'manager') {
    return res.status(403).json({ error: 'Only managers can create a farm' });
  }

  const { name, boundary_geojson } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'name is required' });
  }

  const db = getDb();

  const result = db.transaction(() => {
    const insertFarm = db.prepare(
      'INSERT INTO farms (name, boundary_geojson) VALUES (?, ?)'
    );
    const farmInfo = insertFarm.run(
      name.trim(),
      boundary_geojson ? JSON.stringify(boundary_geojson) : null
    );

    const updateUser = db.prepare(
      'UPDATE users SET farm_id = ? WHERE id = ?'
    );
    updateUser.run(farmInfo.lastInsertRowid, req.user.id);

    return farmInfo.lastInsertRowid;
  })();

  const farm = db.prepare('SELECT id, name, boundary_geojson, created_at FROM farms WHERE id = ?').get(result);

  const updatedUser = { ...req.user, farm_id: result };
  const token = generateToken(updatedUser);

  res.status(201).json({
    farm,
    user: { id: req.user.id, email: req.user.email, role: req.user.role, farm_id: result },
    token,
  });
});

router.get('/api/farms/:id', authMiddleware, (req, res) => {
  const db = getDb();
  const farm = db.prepare('SELECT id, name, boundary_geojson, created_at FROM farms WHERE id = ?').get(req.params.id);

  if (!farm) {
    return res.status(404).json({ error: 'Farm not found' });
  }

  if (farm.id !== req.user.farm_id) {
    return res.status(404).json({ error: 'Farm not found' });
  }

  res.json({ farm });
});

router.patch('/api/farms/:id', authMiddleware, (req, res) => {
  const db = getDb();

  const farm = db.prepare('SELECT id, name, boundary_geojson, created_at FROM farms WHERE id = ?').get(req.params.id);

  if (!farm) {
    return res.status(404).json({ error: 'Farm not found' });
  }

  if (farm.id !== req.user.farm_id) {
    return res.status(404).json({ error: 'Farm not found' });
  }

  if (req.user.role !== 'manager') {
    return res.status(403).json({ error: 'Only managers can update the farm' });
  }

  const { name, boundary_geojson } = req.body;

  const updates = [];
  const values = [];

  if (name !== undefined) {
    updates.push('name = ?');
    values.push(name.trim());
  }

  if (boundary_geojson !== undefined) {
    updates.push('boundary_geojson = ?');
    values.push(JSON.stringify(boundary_geojson));
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  values.push(req.params.id);

  db.prepare(`UPDATE farms SET ${updates.join(', ')} WHERE id = ?`).run(...values);

  const updatedFarm = db.prepare('SELECT id, name, boundary_geojson, created_at FROM farms WHERE id = ?').get(req.params.id);

  res.json({ farm: updatedFarm });
});

module.exports = router;
