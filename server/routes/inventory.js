const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../db/database');
const { requireAuth, requireRole } = require('../middleware/auth');
const { logAudit } = require('../utils/helpers');

const router = express.Router();

const CATEGORIES = ['Computers','Laptops','Projectors','Cameras','Microphones','Cables','Networking Equipment','Furniture','Books','Media Equipment','Other'];
const CONDITIONS = ['Excellent','Good','Fair','Damaged'];
const STATUSES = ['Available','Borrowed','Under Repair'];

// All authenticated users can view inventory (read-only for staff/alumni)
router.get('/', requireAuth, (req, res) => {
  const { search, category, status, condition, sort } = req.query;
  let sql = 'SELECT * FROM inventory WHERE 1=1';
  const params = [];
  if (search) {
    sql += ' AND (item_name LIKE ? OR location LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }
  if (category) { sql += ' AND category = ?'; params.push(category); }
  if (status) { sql += ' AND status = ?'; params.push(status); }
  if (condition) { sql += ' AND condition_status = ?'; params.push(condition); }

  const sortMap = {
    newest: 'created_at DESC',
    oldest: 'created_at ASC',
    status: 'status ASC',
    name: 'item_name ASC'
  };
  sql += ' ORDER BY ' + (sortMap[sort] || sortMap.newest);

  const rows = db.prepare(sql).all(...params);
  res.json({ items: rows });
});

router.get('/categories', requireAuth, (req, res) => res.json({ categories: CATEGORIES, conditions: CONDITIONS, statuses: STATUSES }));

const validateItem = [
  body('item_name').trim().isLength({ min: 1, max: 150 }).escape(),
  body('category').isIn(CATEGORIES),
  body('quantity').isInt({ min: 0 }),
  body('location').optional({ checkFalsy: true }).trim().isLength({ max: 150 }).escape(),
  body('condition_status').isIn(CONDITIONS),
  body('description').optional({ checkFalsy: true }).trim().isLength({ max: 1000 }).escape(),
  body('verification_status').optional().isIn(['Verified','Needs Verification'])
];

router.post('/', requireAuth, requireRole('admin'), validateItem, (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: 'Invalid item data.', details: errors.array() });

  const { item_name, category, quantity, location, condition_status, description } = req.body;
  const verification_status = req.body.verification_status || 'Needs Verification';
  const status = Number(quantity) === 0 ? 'Borrowed' : 'Available';

  const info = db.prepare(`
    INSERT INTO inventory (item_name, category, quantity, available_quantity, location, condition_status, status, description, verification_status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(item_name, category, quantity, quantity, location || '', condition_status, status, description || '', verification_status);

  logAudit({ userId: req.session.user.id, userLabel: req.session.user.email, action: 'Inventory created', entityType: 'inventory', entityId: info.lastInsertRowid, details: item_name });
  res.status(201).json({ id: info.lastInsertRowid, message: 'Inventory item added successfully.' });
});

router.put('/:id', requireAuth, requireRole('admin'), validateItem, (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: 'Invalid item data.', details: errors.array() });

  const item = db.prepare('SELECT * FROM inventory WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Inventory item not found.' });

  const { item_name, category, quantity, location, condition_status, description } = req.body;
  const verification_status = req.body.verification_status || item.verification_status;
  let status = req.body.status && STATUSES.includes(req.body.status) ? req.body.status : item.status;

  // Recompute available_quantity proportionally when total quantity changes
  const borrowedOut = item.quantity - item.available_quantity;
  let newAvailable = Math.max(0, Number(quantity) - borrowedOut);
  if (status === 'Under Repair') newAvailable = 0;

  db.prepare(`
    UPDATE inventory SET item_name=?, category=?, quantity=?, available_quantity=?, location=?, condition_status=?, status=?, description=?, verification_status=?, updated_at=datetime('now')
    WHERE id=?
  `).run(item_name, category, quantity, newAvailable, location || '', condition_status, status, description || '', verification_status, req.params.id);

  logAudit({ userId: req.session.user.id, userLabel: req.session.user.email, action: 'Inventory updated', entityType: 'inventory', entityId: req.params.id, details: item_name });
  res.json({ message: 'Inventory item updated successfully.' });
});

router.delete('/:id', requireAuth, requireRole('admin'), (req, res) => {
  const item = db.prepare('SELECT * FROM inventory WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Inventory item not found.' });

  const activeBorrow = db.prepare(`SELECT COUNT(*) c FROM borrowing WHERE inventory_item_id = ? AND status IN ('Approved','Borrowed','Overdue')`).get(req.params.id);
  if (activeBorrow.c > 0) {
    return res.status(400).json({ error: 'Cannot delete an item that is currently borrowed or reserved.' });
  }

  db.prepare('DELETE FROM inventory WHERE id = ?').run(req.params.id);
  logAudit({ userId: req.session.user.id, userLabel: req.session.user.email, action: 'Inventory deleted', entityType: 'inventory', entityId: req.params.id, details: item.item_name });
  res.json({ message: 'Inventory item deleted successfully.' });
});

module.exports = router;
