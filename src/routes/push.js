const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { getDb } = require('../db');
const { getVapidPublicKey } = require('../push');

const router = express.Router();

router.get('/api/push/vapid-public-key', (req, res) => {
  const publicKey = getVapidPublicKey();
  if (!publicKey) {
    return res.status(500).json({ error: 'VAPID keys not configured' });
  }
  res.json({ publicKey });
});

router.post('/api/push/subscribe', authMiddleware, (req, res) => {
  const { endpoint, keys } = req.body;

  if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
    return res.status(400).json({ error: 'endpoint, keys.p256dh, and keys.auth are required' });
  }

  const db = getDb();

  const existing = db.prepare(
    'SELECT id FROM push_subscriptions WHERE user_id = ? AND endpoint = ?'
  ).get(req.user.id, endpoint);

  if (existing) {
    db.prepare(
      'UPDATE push_subscriptions SET keys = ? WHERE id = ?'
    ).run(JSON.stringify(keys), existing.id);
    return res.json({ success: true });
  }

  db.prepare(
    'INSERT INTO push_subscriptions (user_id, endpoint, keys) VALUES (?, ?, ?)'
  ).run(req.user.id, endpoint, JSON.stringify(keys));

  res.status(201).json({ success: true });
});

router.post('/api/push/unsubscribe', authMiddleware, (req, res) => {
  const { endpoint } = req.body;

  if (!endpoint) {
    return res.status(400).json({ error: 'endpoint is required' });
  }

  const db = getDb();
  db.prepare(
    'DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?'
  ).run(req.user.id, endpoint);

  res.json({ success: true });
});

module.exports = router;
