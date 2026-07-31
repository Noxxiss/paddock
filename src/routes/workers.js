const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { getDb } = require('../db');

const router = express.Router();

router.get('/api/farms/:id/workers', authMiddleware, (req, res) => {
  const db = getDb();

  const farm = db.prepare('SELECT id FROM farms WHERE id = ?').get(req.params.id);
  if (!farm || farm.id !== req.user.farm_id) {
    return res.status(404).json({ error: 'Farm not found' });
  }

  if (req.user.role !== 'manager') {
    return res.status(403).json({ error: 'Only managers can view workers' });
  }

  const workers = db.prepare(
    'SELECT id, email, name, role, created_at FROM users WHERE farm_id = ? AND role = ?'
  ).all(req.user.farm_id, 'worker');

  res.json({ workers });
});

router.delete('/api/farms/:id/workers/:userId', authMiddleware, (req, res) => {
  const db = getDb();

  const farm = db.prepare('SELECT id FROM farms WHERE id = ?').get(req.params.id);
  if (!farm || farm.id !== req.user.farm_id) {
    return res.status(404).json({ error: 'Farm not found' });
  }

  if (req.user.role !== 'manager') {
    return res.status(403).json({ error: 'Only managers can remove workers' });
  }

  const worker = db.prepare(
    'SELECT id, farm_id FROM users WHERE id = ? AND farm_id = ? AND role = ?'
  ).get(req.params.userId, req.user.farm_id, 'worker');

  if (!worker) {
    return res.status(404).json({ error: 'Worker not found' });
  }

  db.prepare('DELETE FROM users WHERE id = ?').run(worker.id);

  res.json({ message: 'Worker removed' });
});

module.exports = router;
