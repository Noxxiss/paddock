const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { getDb } = require('../db');

function pointInPolygon(px, py, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function isGeometryOutsideBoundary(geometry, boundary) {
  if (!boundary) return false;

  let coords;
  if (geometry.type === 'Polygon') {
    coords = geometry.coordinates[0];
  } else if (geometry.type === 'MultiPolygon') {
    coords = geometry.coordinates.flatMap(p => p[0]);
  } else {
    return true;
  }

  if (!Array.isArray(coords) || coords.length < 3) return true;

  const boundaryRing = boundary.coordinates[0];
  return !coords.every(([lng, lat]) => pointInPolygon(lng, lat, boundaryRing));
}

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

  const farm = db.prepare('SELECT boundary_geojson FROM farms WHERE id = ?').get(req.user.farm_id);
  if (farm && farm.boundary_geojson && isGeometryOutsideBoundary(geometry_geojson, JSON.parse(farm.boundary_geojson))) {
    return res.status(400).json({ error: 'Paddock geometry must be within the farm boundary' });
  }

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
    const farm = db.prepare('SELECT boundary_geojson FROM farms WHERE id = ?').get(req.user.farm_id);
    if (farm && farm.boundary_geojson && isGeometryOutsideBoundary(geometry_geojson, JSON.parse(farm.boundary_geojson))) {
      return res.status(400).json({ error: 'Paddock geometry must be within the farm boundary' });
    }
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
