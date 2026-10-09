const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../db/database');
const { requireAuth, requireRole } = require('../middleware/auth');
const { logAudit, notify, notifyAdmins, genRef, refreshOverdue } = require('../utils/helpers');

const router = express.Router();
const CONDITIONS = ['Excellent','Good','Fair','Damaged'];

router.get('/', requireAuth, (req, res) => {
  refreshOverdue();
  const { search, status, sort } = req.query;
  const user = req.session.user;
  let sql = `
    SELECT b.*, i.item_name, u.name as staff_name
    FROM borrowing b
    JOIN inventory i ON i.id = b.inventory_item_id
    JOIN users u ON u.id = b.staff_id
    WHERE 1=1
  `;
  const params = [];
  if (user.role === 'staff') { sql += ' AND b.staff_id = ?'; params.push(user.id); }
  if (search) { sql += ' AND (u.name LIKE ? OR i.item_name LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
  if (status) { sql += ' AND b.status = ?'; params.push(status); }

  const sortMap = { newest: 'b.created_at DESC', oldest: 'b.created_at ASC', status: 'b.status ASC', date: 'b.date_out DESC' };
  sql += ' ORDER BY ' + (sortMap[sort] || sortMap.newest);

  res.json({ borrowing: db.prepare(sql).all(...params) });
});

router.post('/', requireAuth, requireRole('staff', 'admin'), [
  body('inventory_item_id').isInt(),
  body('quantity').isInt({ min: 1 }),
  body('date_out').isISO8601(),
  body('expected_return_date').isISO8601(),
  body('condition_on_release').isIn(CONDITIONS),
  body('purpose').optional({ checkFalsy: true }).trim().isLength({ max: 500 }).escape(),
  body('notes').optional({ checkFalsy: true }).trim().isLength({ max: 1000 }).escape()
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: 'Please check the borrowing request details.', details: errors.array() });

  const b = req.body;
  if (b.expected_return_date < b.date_out) {
    return res.status(400).json({ error: 'Please enter a valid return date.' });
  }

  const item = db.prepare('SELECT * FROM inventory WHERE id = ?').get(b.inventory_item_id);
  if (!item) return res.status(404).json({ error: 'Selected resource was not found.' });
  if (item.status === 'Under Repair') return res.status(400).json({ error: 'This resource is currently unavailable (under repair).' });
  if (item.available_quantity < Number(b.quantity)) {
    return res.status(400).json({ error: `Only ${item.available_quantity} unit(s) are currently available.` });
  }

  const ref = genRef('BRW');
  const info = db.prepare(`
    INSERT INTO borrowing (borrowing_ref, staff_id, inventory_item_id, quantity, date_out, expected_return_date, condition_on_release, purpose, notes, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending')
  `).run(ref, req.session.user.id, b.inventory_item_id, b.quantity, b.date_out, b.expected_return_date, b.condition_on_release, b.purpose || '', b.notes || '');

  logAudit({ userId: req.session.user.id, userLabel: req.session.user.email, action: 'Resource borrow requested', entityType: 'borrowing', entityId: info.lastInsertRowid, details: `${ref} (${item.item_name} x${b.quantity})` });
  notifyAdmins({ title: 'New borrowing request', message: `${req.session.user.name} requested ${b.quantity} x ${item.item_name}.`, type: 'info' });

  res.status(201).json({ id: info.lastInsertRowid, borrowing_ref: ref, message: 'Borrowing request submitted successfully.' });
});

// Approve / reject / cancel
router.put('/:id/status', requireAuth, requireRole('admin'), body('status').isIn(['Approved','Rejected','Cancelled']), (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: 'Invalid status.' });

  const record = db.prepare('SELECT * FROM borrowing WHERE id = ?').get(req.params.id);
  if (!record) return res.status(404).json({ error: 'Borrowing record not found.' });
  if (record.status !== 'Pending') return res.status(400).json({ error: 'Only pending requests can be updated this way.' });

  const { status } = req.body;
  const item = db.prepare('SELECT * FROM inventory WHERE id = ?').get(record.inventory_item_id);

  const txn = db.transaction(() => {
    if (status === 'Approved') {
      if (!item || item.available_quantity < record.quantity) {
        throw new Error('INSUFFICIENT_STOCK');
      }
      const newAvailable = item.available_quantity - record.quantity;
      const newStatus = newAvailable === 0 ? 'Borrowed' : 'Available';
      db.prepare(`UPDATE inventory SET available_quantity = ?, status = ?, updated_at = datetime('now') WHERE id = ?`)
        .run(newAvailable, newStatus, item.id);
      db.prepare(`UPDATE borrowing SET status = 'Borrowed', reviewed_by = ?, updated_at = datetime('now') WHERE id = ?`)
        .run(req.session.user.id, record.id);
    } else {
      db.prepare(`UPDATE borrowing SET status = ?, reviewed_by = ?, updated_at = datetime('now') WHERE id = ?`)
        .run(status, req.session.user.id, record.id);
    }
  });

  try {
    txn();
  } catch (e) {
    if (e.message === 'INSUFFICIENT_STOCK') {
      return res.status(409).json({ error: 'This resource no longer has enough available units.' });
    }
    return res.status(500).json({ error: 'Could not process this request. Please try again.' });
  }

  logAudit({ userId: req.session.user.id, userLabel: req.session.user.email, action: `Resource borrowing ${status.toLowerCase()}`, entityType: 'borrowing', entityId: record.id, details: record.borrowing_ref });
  notify({ recipientId: record.staff_id, title: `Borrowing request ${status}`, message: `Your request (${record.borrowing_ref}) has been ${status.toLowerCase()}.`, type: status === 'Approved' ? 'success' : 'info' });

  res.json({ message: `Borrowing request ${status.toLowerCase()} successfully.` });
});

// Record return
router.put('/:id/return', requireAuth, requireRole('staff', 'admin'), [
  body('condition_on_return').isIn(CONDITIONS),
  body('return_notes').optional({ checkFalsy: true }).trim().isLength({ max: 1000 }).escape()
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: 'Please provide a valid return condition.' });

  const record = db.prepare('SELECT * FROM borrowing WHERE id = ?').get(req.params.id);
  if (!record) return res.status(404).json({ error: 'Borrowing record not found.' });
  if (!['Borrowed', 'Overdue'].includes(record.status)) {
    return res.status(400).json({ error: 'This resource is not currently marked as borrowed.' });
  }
  if (req.session.user.role === 'staff' && record.staff_id !== req.session.user.id) {
    return res.status(403).json({ error: 'You do not have permission to perform this action.' });
  }

  const { condition_on_return, return_notes } = req.body;
  const item = db.prepare('SELECT * FROM inventory WHERE id = ?').get(record.inventory_item_id);
  const conditionFlag = condition_on_return !== record.condition_on_release ? 1 : 0;

  const txn = db.transaction(() => {
    const newAvailable = Math.min(item.quantity, item.available_quantity + record.quantity);
    const newStatus = item.status === 'Under Repair' ? 'Under Repair' : (newAvailable > 0 ? 'Available' : item.status);
    db.prepare(`UPDATE inventory SET available_quantity = ?, status = ?, updated_at = datetime('now') WHERE id = ?`)
      .run(newAvailable, newStatus, item.id);
    db.prepare(`
      UPDATE borrowing SET status = 'Returned', actual_return_date = date('now'), condition_on_return = ?,
      return_notes = ?, condition_flag = ?, returned_by = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(condition_on_return, return_notes || '', conditionFlag, req.session.user.id, record.id);
  });
  txn();

  logAudit({ userId: req.session.user.id, userLabel: req.session.user.email, action: 'Resource returned', entityType: 'borrowing', entityId: record.id, details: `${record.borrowing_ref}${conditionFlag ? ' [CONDITION CHANGED]' : ''}` });

  notifyAdmins({
    title: conditionFlag ? 'Resource returned — condition changed' : 'Resource returned',
    message: conditionFlag
      ? `${record.borrowing_ref}: condition changed from ${record.condition_on_release} to ${condition_on_return}. Administrator review required.`
      : `${record.borrowing_ref} was returned in ${condition_on_return} condition.`,
    type: conditionFlag ? 'warning' : 'success'
  });

  res.json({ message: 'Return recorded successfully.', conditionChanged: !!conditionFlag });
});

module.exports = router;
