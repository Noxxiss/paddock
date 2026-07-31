const express = require('express');
const bcrypt = require('bcryptjs');
const { getDb } = require('../db');
const { generateToken } = require('../middleware/auth');

const router = express.Router();

router.post('/api/auth/register', (req, res) => {
  const { email, password, name } = req.body;

  if (!email || !password || !name) {
    return res.status(400).json({ error: 'email, password, and name are required' });
  }

  const db = getDb();

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    return res.status(409).json({ error: 'Email already registered' });
  }

  const password_hash = bcrypt.hashSync(password, 10);

  const insertFarm = db.prepare('INSERT INTO farms (name) VALUES (?)');
  const insertUser = db.prepare(
    'INSERT INTO users (farm_id, email, password_hash, name, role) VALUES (?, ?, ?, ?, ?)'
  );

  const result = db.transaction(() => {
    const farmInfo = insertFarm.run('My Farm');
    const farm_id = farmInfo.lastInsertRowid;
    const userInfo = insertUser.run(farm_id, email, password_hash, name, 'manager');
    return { id: userInfo.lastInsertRowid, farm_id };
  })();

  const user = { id: result.id, email, role: 'manager', farm_id: result.farm_id };
  const token = generateToken(user);

  res.status(201).json({
    token,
    user: { id: user.id, email: user.email, name, role: user.role, farm_id: user.farm_id },
  });
});

router.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  const db = getDb();

  const user = db.prepare(
    'SELECT id, email, password_hash, name, role, farm_id FROM users WHERE email = ?'
  ).get(email);

  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const valid = bcrypt.compareSync(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = generateToken({ id: user.id, email: user.email, role: user.role, farm_id: user.farm_id });

  res.json({
    token,
    user: { id: user.id, email: user.email, name: user.name, role: user.role, farm_id: user.farm_id },
  });
});

module.exports = router;
