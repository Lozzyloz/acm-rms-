const express = require('express');
const db = require('../db/database');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, (req, res) => {
  const user = req.session.user;
  const rows = db.prepare(`
    SELECT * FROM notifications
    WHERE recipient_id = ? OR (recipient_role = ? AND recipient_id IS NULL)
    ORDER BY created_at DESC LIMIT 100
  `).all(user.id, user.role);
  res.json({ notifications: rows });
});

router.put('/:id/read', requireAuth, (req, res) => {
  db.prepare('UPDATE notifications SET read_status = 1 WHERE id = ?').run(req.params.id);
  res.json({ message: 'Marked as read.' });
});

router.put('/read-all', requireAuth, (req, res) => {
  const user = req.session.user;
  db.prepare(`
    UPDATE notifications SET read_status = 1
    WHERE recipient_id = ? OR (recipient_role = ? AND recipient_id IS NULL)
  `).run(user.id, user.role);
  res.json({ message: 'All notifications marked as read.' });
});

module.exports = router;
