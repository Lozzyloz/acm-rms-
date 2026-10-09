const express = require('express');
const db = require('../db/database');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, requireRole('admin'), (req, res) => {
  const { search, action, limit } = req.query;
  let sql = 'SELECT * FROM audit_logs WHERE 1=1';
  const params = [];
  if (search) { sql += ' AND (user_label LIKE ? OR details LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
  if (action) { sql += ' AND action LIKE ?'; params.push(`%${action}%`); }
  sql += ' ORDER BY timestamp DESC LIMIT ?';
  params.push(Math.min(Number(limit) || 200, 500));
  res.json({ logs: db.prepare(sql).all(...params) });
});

module.exports = router;
