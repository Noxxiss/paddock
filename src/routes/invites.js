const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { authMiddleware, generateToken } = require('../middleware/auth');
const { getDb } = require('../db');

const router = express.Router();

router.post('/api/invites', authMiddleware, (req, res) => {
  if (req.user.role !== 'manager') {
    return res.status(403).json({ error: 'Only managers can create invites' });
  }

  const { email } = req.body;

  if (!email || !email.trim()) {
    return res.status(400).json({ error: 'email is required' });
  }

  const db = getDb();
  const farmId = req.user.farm_id;

  const existing = db.prepare(
    'SELECT id FROM invite_tokens WHERE farm_id = ? AND email = ? AND used = 0 AND expires_at > datetime(\'now\')'
  ).get(farmId, email.trim().toLowerCase());

  if (existing) {
    return res.status(409).json({ error: 'An active invite already exists for this email' });
  }

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const result = db.prepare(
    'INSERT INTO invite_tokens (farm_id, email, token, role, expires_at) VALUES (?, ?, ?, ?, ?)'
  ).run(farmId, email.trim().toLowerCase(), token, 'worker', expiresAt);

  const invite = db.prepare(
    'SELECT id, farm_id, email, token, role, used, created_at, expires_at FROM invite_tokens WHERE id = ?'
  ).get(result.lastInsertRowid);

  const inviteLink = `${req.protocol}://${req.get('host')}/accept-invite/${token}`;
  console.log(`[INVITE] Invite for ${email}: ${inviteLink}`);

  res.status(201).json({ invite });
});

router.post('/api/accept-invite/:token', (req, res) => {
  const { token } = req.params;
  const { name, password } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'name is required' });
  }

  if (!password) {
    return res.status(400).json({ error: 'password is required' });
  }

  const db = getDb();

  const invite = db.prepare(
    'SELECT id, farm_id, email, token, role, used, expires_at FROM invite_tokens WHERE token = ?'
  ).get(token);

  if (!invite) {
    return res.status(404).json({ error: 'Invite not found' });
  }

  if (invite.used) {
    return res.status(410).json({ error: 'Invite has already been used' });
  }

  if (new Date(invite.expires_at) < new Date()) {
    return res.status(410).json({ error: 'Invite has expired' });
  }

  const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(invite.email);
  if (existingUser) {
    return res.status(409).json({ error: 'Email already registered' });
  }

  const password_hash = bcrypt.hashSync(password, 10);

  const result = db.transaction(() => {
    const userInfo = db.prepare(
      'INSERT INTO users (farm_id, email, password_hash, name, role) VALUES (?, ?, ?, ?, ?)'
    ).run(invite.farm_id, invite.email, password_hash, name.trim(), invite.role);

    db.prepare('UPDATE invite_tokens SET used = 1 WHERE id = ?').run(invite.id);

    return { id: userInfo.lastInsertRowid, farm_id: invite.farm_id };
  })();

  const user = { id: result.id, email: invite.email, role: invite.role, farm_id: result.farm_id };
  const authToken = generateToken(user);

  res.status(201).json({
    token: authToken,
    user: { id: user.id, email: user.email, name: name.trim(), role: user.role, farm_id: user.farm_id },
  });
});

module.exports = router;
