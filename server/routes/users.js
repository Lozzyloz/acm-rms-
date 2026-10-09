const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const db = require('../db/database');
const { requireAuth, requireRole } = require('../middleware/auth');
const { logAudit, publicUser } = require('../utils/helpers');

const router = express.Router();

router.get('/', requireAuth, requireRole('admin'), (req, res) => {
  const rows = db.prepare('SELECT id, name, email, role, status, created_at FROM users ORDER BY created_at DESC').all();
  res.json({ users: rows });
});

router.post('/', requireAuth, requireRole('admin'), [
  body('name').trim().isLength({ min: 1, max: 150 }).escape(),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8, max: 200 }),
  body('role').isIn(['admin', 'staff', 'alumni'])
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: 'Please provide valid user details (password must be at least 8 characters).' });

  const { name, email, password, role } = req.body;
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return res.status(409).json({ error: 'A user with this email already exists.' });

  const hash = bcrypt.hashSync(password, 12);
  const info = db.prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)').run(name, email, hash, role);
  logAudit({ userId: req.session.user.id, userLabel: req.session.user.email, action: 'User created', entityType: 'user', entityId: info.lastInsertRowid, details: `${email} (${role})` });
  res.status(201).json({ id: info.lastInsertRowid, message: 'User created successfully.' });
});

router.put('/:id/status', requireAuth, requireRole('admin'), body('status').isIn(['active', 'disabled']), (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: 'Invalid status.' });
  if (Number(req.params.id) === req.session.user.id) {
    return res.status(400).json({ error: 'You cannot change the status of your own account.' });
  }
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found.' });

  db.prepare(`UPDATE users SET status = ?, updated_at = datetime('now') WHERE id = ?`).run(req.body.status, req.params.id);
  logAudit({ userId: req.session.user.id, userLabel: req.session.user.email, action: `User ${req.body.status}`, entityType: 'user', entityId: user.id, details: user.email });
  res.json({ message: `User account ${req.body.status}.` });
});

module.exports = router;
