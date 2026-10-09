const db = require('../db/database');

function logAudit({ userId, userLabel, action, entityType, entityId, result = 'success', details = '' }) {
  db.prepare(`
    INSERT INTO audit_logs (user_id, user_label, action, entity_type, entity_id, result, details)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(userId || null, userLabel || 'system', action, entityType || null, entityId ? String(entityId) : null, result, details);
}

function notify({ recipientId = null, recipientRole = null, title, message, type = 'info' }) {
  db.prepare(`
    INSERT INTO notifications (recipient_id, recipient_role, title, message, type)
    VALUES (?, ?, ?, ?, ?)
  `).run(recipientId, recipientRole, title, message, type);
}

function notifyAdmins({ title, message, type = 'info' }) {
  notify({ recipientRole: 'admin', title, message, type });
}

function genRef(prefix) {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-${stamp}-${rand}`;
}

// Recompute overdue statuses; called on relevant reads
function refreshOverdue() {
  const today = new Date().toISOString().slice(0, 10);
  const rows = db.prepare(`
    SELECT id FROM borrowing
    WHERE status = 'Borrowed' AND expected_return_date < ?
  `).all(today);
  const upd = db.prepare(`UPDATE borrowing SET status = 'Overdue', updated_at = datetime('now') WHERE id = ?`);
  for (const r of rows) {
    upd.run(r.id);
    logAudit({ action: 'Status changed to Overdue (auto)', entityType: 'borrowing', entityId: r.id, userLabel: 'system' });
  }
}

function publicUser(u) {
  if (!u) return u;
  const { password_hash, ...rest } = u;
  return rest;
}

module.exports = { logAudit, notify, notifyAdmins, genRef, refreshOverdue, publicUser };
