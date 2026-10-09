const express = require('express');
const db = require('../db/database');
const { requireAuth, requireRole } = require('../middleware/auth');
const { refreshOverdue } = require('../utils/helpers');

const router = express.Router();

router.get('/dashboard', requireAuth, (req, res) => {
  refreshOverdue();
  const totalItems = db.prepare('SELECT COALESCE(SUM(quantity),0) c FROM inventory').get().c;
  const availableItems = db.prepare('SELECT COALESCE(SUM(available_quantity),0) c FROM inventory').get().c;
  const borrowedNow = db.prepare(`SELECT COALESCE(SUM(quantity),0) c FROM borrowing WHERE status IN ('Borrowed','Overdue')`).get().c;
  const underRepair = db.prepare(`SELECT COUNT(*) c FROM inventory WHERE status = 'Under Repair'`).get().c;
  const pendingBookings = db.prepare(`SELECT COUNT(*) c FROM bookings WHERE status = 'Pending'`).get().c;
  const pendingBorrowing = db.prepare(`SELECT COUNT(*) c FROM borrowing WHERE status = 'Pending'`).get().c;
  const upcomingBookings = db.prepare(`SELECT COUNT(*) c FROM bookings WHERE status = 'Approved' AND booking_date >= date('now')`).get().c;
  const overdue = db.prepare(`SELECT COUNT(*) c FROM borrowing WHERE status = 'Overdue'`).get().c;

  const recentBookings = db.prepare('SELECT * FROM bookings ORDER BY created_at DESC LIMIT 5').all();
  const recentBorrowing = db.prepare(`
    SELECT b.*, i.item_name, u.name as staff_name FROM borrowing b
    JOIN inventory i ON i.id = b.inventory_item_id JOIN users u ON u.id = b.staff_id
    ORDER BY b.created_at DESC LIMIT 5
  `).all();
  const recentReturns = db.prepare(`
    SELECT b.*, i.item_name, u.name as staff_name FROM borrowing b
    JOIN inventory i ON i.id = b.inventory_item_id JOIN users u ON u.id = b.staff_id
    WHERE b.status = 'Returned' ORDER BY b.updated_at DESC LIMIT 5
  `).all();
  const overdueList = db.prepare(`
    SELECT b.*, i.item_name, u.name as staff_name,
    CAST(julianday('now') - julianday(b.expected_return_date) AS INTEGER) as days_overdue
    FROM borrowing b JOIN inventory i ON i.id = b.inventory_item_id JOIN users u ON u.id = b.staff_id
    WHERE b.status = 'Overdue' ORDER BY days_overdue DESC
  `).all();

  res.json({
    summary: { totalItems, availableItems, borrowedNow, underRepair, pendingBookings, pendingBorrowing, upcomingBookings, overdue },
    recentBookings, recentBorrowing, recentReturns, overdueList
  });
});

router.get('/most-borrowed', requireAuth, requireRole('admin'), (req, res) => {
  const rows = db.prepare(`
    SELECT i.item_name, COUNT(*) as times_borrowed, SUM(b.quantity) as total_quantity
    FROM borrowing b JOIN inventory i ON i.id = b.inventory_item_id
    GROUP BY b.inventory_item_id ORDER BY times_borrowed DESC LIMIT 10
  `).all();
  res.json({ mostBorrowed: rows });
});

function toCsv(rows) {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [headers.join(',')];
  for (const row of rows) lines.push(headers.map(h => esc(row[h])).join(','));
  return lines.join('\n');
}

router.get('/export/:type', requireAuth, requireRole('admin'), (req, res) => {
  const { type } = req.params;
  let rows, filename;
  if (type === 'inventory') {
    rows = db.prepare('SELECT * FROM inventory').all(); filename = 'inventory.csv';
  } else if (type === 'bookings') {
    rows = db.prepare('SELECT * FROM bookings').all(); filename = 'bookings.csv';
  } else if (type === 'borrowing') {
    rows = db.prepare(`SELECT b.*, i.item_name, u.name as staff_name FROM borrowing b JOIN inventory i ON i.id=b.inventory_item_id JOIN users u ON u.id=b.staff_id`).all();
    filename = 'borrowing.csv';
  } else {
    return res.status(400).json({ error: 'Unknown report type.' });
  }
  const csv = toCsv(rows);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csv);
});

module.exports = router;
