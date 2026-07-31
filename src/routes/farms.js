const express = require('express');
const { authMiddleware } = require('../middleware/auth');
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

module.exports = router;
