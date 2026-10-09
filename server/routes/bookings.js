const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../db/database');
const { requireAuth, requireRole } = require('../middleware/auth');
const { logAudit, notify, notifyAdmins, genRef } = require('../utils/helpers');

const router = express.Router();

function hasConflict(date, start, end, excludeId = null) {
  let sql = `
    SELECT * FROM bookings
    WHERE booking_date = ? AND status = 'Approved'
    AND NOT (end_time <= ? OR start_time >= ?)
  `;
  const params = [date, start, end];
  if (excludeId) { sql += ' AND id != ?'; params.push(excludeId); }
  return db.prepare(sql).all(...params);
}

router.get('/', requireAuth, (req, res) => {
  const { search, status, date, sort } = req.query;
  const user = req.session.user;
  let sql = 'SELECT * FROM bookings WHERE 1=1';
  const params = [];

  // Alumni can only see their own bookings
  if (user.role === 'alumni') { sql += ' AND user_id = ?'; params.push(user.id); }

  if (search) { sql += ' AND (full_name LIKE ? OR purpose LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
  if (status) { sql += ' AND status = ?'; params.push(status); }
  if (date) { sql += ' AND booking_date = ?'; params.push(date); }

  const sortMap = { newest: 'created_at DESC', oldest: 'created_at ASC', status: 'status ASC', date: 'booking_date ASC' };
  sql += ' ORDER BY ' + (sortMap[sort] || sortMap.newest);

  res.json({ bookings: db.prepare(sql).all(...params) });
});

const validateBooking = [
  body('full_name').trim().isLength({ min: 1, max: 150 }).escape(),
  body('contact').trim().isLength({ min: 1, max: 100 }).escape(),
  body('email').isEmail().normalizeEmail(),
  body('alumni_status').optional({ checkFalsy: true }).trim().isLength({ max: 150 }).escape(),
  body('booking_date').isISO8601(),
  body('start_time').matches(/^([01]\d|2[0-3]):([0-5]\d)$/),
  body('end_time').matches(/^([01]\d|2[0-3]):([0-5]\d)$/),
  body('purpose').trim().isLength({ min: 1, max: 500 }).escape(),
  body('attendees').isInt({ min: 1, max: 1000 }),
  body('equipment_needed').optional({ checkFalsy: true }).trim().isLength({ max: 300 }).escape(),
  body('notes').optional({ checkFalsy: true }).trim().isLength({ max: 1000 }).escape()
];

router.post('/', requireAuth, validateBooking, (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: 'Please check the booking details and try again.', details: errors.array() });

  const b = req.body;
  if (b.end_time <= b.start_time) {
    return res.status(400).json({ error: 'End time must be after start time.' });
  }
  const bookingDateObj = new Date(b.booking_date);
  if (isNaN(bookingDateObj.getTime()) || b.booking_date < new Date().toISOString().slice(0, 10)) {
    return res.status(400).json({ error: 'Please enter a valid future booking date.' });
  }

  const conflicts = hasConflict(b.booking_date, b.start_time, b.end_time);
  const ref = genRef('BKG');
  const status = 'Pending';

  const info = db.prepare(`
    INSERT INTO bookings (booking_ref, user_id, full_name, contact, email, alumni_status, booking_date, start_time, end_time, purpose, attendees, equipment_needed, notes, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(ref, req.session.user.id, b.full_name, b.contact, b.email, b.alumni_status || '', b.booking_date, b.start_time, b.end_time, b.purpose, b.attendees, b.equipment_needed || '', b.notes || '', status);

  logAudit({ userId: req.session.user.id, userLabel: req.session.user.email, action: 'Booking submitted', entityType: 'booking', entityId: info.lastInsertRowid, details: ref });

  const conflictNote = conflicts.length ? ` Note: this time overlaps with ${conflicts.length} existing approved booking(s) — please review.` : '';
  notifyAdmins({ title: 'New venue booking request', message: `${b.full_name} requested the venue for ${b.booking_date} (${b.start_time}-${b.end_time}).${conflictNote}`, type: conflicts.length ? 'warning' : 'info' });

  res.status(201).json({
    id: info.lastInsertRowid,
    booking_ref: ref,
    message: 'Booking submitted successfully. You will be notified once it is reviewed.',
    possibleConflict: conflicts.length > 0
  });
});

router.put('/:id/status', requireAuth, requireRole('admin'), body('status').isIn(['Approved','Rejected','Completed','Cancelled']), (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: 'Invalid status.' });

  const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
  if (!booking) return res.status(404).json({ error: 'Booking not found.' });

  const { status } = req.body;

  if (status === 'Approved') {
    const conflicts = hasConflict(booking.booking_date, booking.start_time, booking.end_time, booking.id);
    if (conflicts.length > 0) {
      return res.status(409).json({ error: 'This booking conflicts with another already-approved booking for the same date/time.' });
    }
  }

  db.prepare(`UPDATE bookings SET status=?, reviewed_by=?, updated_at=datetime('now') WHERE id=?`)
    .run(status, req.session.user.id, req.params.id);

  logAudit({ userId: req.session.user.id, userLabel: req.session.user.email, action: `Booking ${status.toLowerCase()}`, entityType: 'booking', entityId: booking.id, details: booking.booking_ref });

  if (booking.user_id) {
    notify({ recipientId: booking.user_id, title: `Booking ${status}`, message: `Your booking (${booking.booking_ref}) for ${booking.booking_date} has been ${status.toLowerCase()}.`, type: status === 'Approved' ? 'success' : 'info' });
  }

  res.json({ message: `Booking ${status.toLowerCase()} successfully.` });
});

module.exports = router;
