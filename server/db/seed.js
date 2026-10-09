const bcrypt = require('bcryptjs');
const db = require('./database');
const { genRef } = require('../utils/helpers');

function hash(pw) {
  return bcrypt.hashSync(pw, 12);
}

const userCount = db.prepare('SELECT COUNT(*) c FROM users').get().c;

if (userCount === 0) {
  console.log('Seeding database with initial + demo data...');

  const insertUser = db.prepare(`
    INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)
  `);
  const admin = insertUser.run('System Administrator', 'admin@americancornermtaani.org', hash('AdminPass#2026'), 'admin');
  const staff1 = insertUser.run('Grace Wanjiru', 'staff@americancornermtaani.org', hash('StaffPass#2026'), 'staff');
  const staff2 = insertUser.run('Brian Otieno', 'brian.otieno@americancornermtaani.org', hash('StaffPass#2026'), 'staff');
  const alumni1 = insertUser.run('Amina Yusuf', 'alumni@example.com', hash('AlumniPass#2026'), 'alumni');

  const insertInv = db.prepare(`
    INSERT INTO inventory (item_name, category, quantity, available_quantity, location, condition_status, status, description, verification_status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Clearly labelled demo/sample inventory - real counts must be entered by staff (see section 18)
  const laptop = insertInv.run('Laptop A (Dell Latitude)', 'Laptops', 10, 10, 'Main Resource Room - Shelf A', 'Good', 'Available', 'Demo sample record — replace with verified count.', 'Needs Verification');
  const projector = insertInv.run('Projector - Epson EX3260', 'Projectors', 3, 3, 'Storage Cabinet 2', 'Excellent', 'Available', 'Demo sample record — replace with verified count.', 'Needs Verification');
  insertInv.run('Camera - Canon EOS 200D', 'Cameras', 2, 2, 'Storage Cabinet 1', 'Good', 'Available', 'Demo sample record — replace with verified count.', 'Needs Verification');
  insertInv.run('Wireless Microphone Set', 'Microphones', 4, 4, 'AV Cabinet', 'Fair', 'Available', 'Demo sample record — replace with verified count.', 'Needs Verification');
  insertInv.run('HDMI Cable (5m)', 'Cables', 15, 15, 'Cable Drawer', 'Good', 'Available', 'Demo sample record — replace with verified count.', 'Verified');
  insertInv.run('Conference Table (6-seat)', 'Furniture', 2, 2, 'Alumni Meeting Room', 'Good', 'Available', 'Demo sample record — replace with verified count.', 'Verified');
  insertInv.run('Router - TP-Link Archer', 'Networking Equipment', 2, 2, 'IT Closet', 'Excellent', 'Under Repair', 'One unit currently under repair (demo).', 'Needs Verification');

  const insertBooking = db.prepare(`
    INSERT INTO bookings (booking_ref, user_id, full_name, contact, email, alumni_status, booking_date, start_time, end_time, purpose, attendees, equipment_needed, notes, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 5);
  const bookingDate = futureDate.toISOString().slice(0, 10);

  insertBooking.run(
    genRef('BKG'), alumni1.lastInsertRowid, 'Amina Yusuf', '+254 7XX XXX XXX', 'alumni@example.com',
    'EducationUSA Alumni (2019 cohort)', bookingDate, '14:00', '16:00',
    'Alumni networking and career mentorship session (demo booking test 1)', 25,
    'Projector, Wireless Microphone Set', 'Sample/demo data — Booking Test 1 from spec.', 'Pending'
  );

  const insertBorrow = db.prepare(`
    INSERT INTO borrowing (borrowing_ref, staff_id, inventory_item_id, quantity, date_out, expected_return_date, condition_on_release, purpose, notes, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const today = new Date().toISOString().slice(0, 10);
  const returnSoon = new Date();
  returnSoon.setDate(returnSoon.getDate() + 3);

  // Borrowing Test 1
  insertBorrow.run(
    genRef('BRW'), staff1.lastInsertRowid, laptop.lastInsertRowid, 2, today,
    returnSoon.toISOString().slice(0, 10), 'Good', 'Outreach event at partner school (demo).',
    'Sample/demo data — Borrowing Test 1 from spec.', 'Pending'
  );

  // Borrowing Test 2 - a different resource, already overdue to demonstrate overdue tracking
  const overdueDate = new Date();
  overdueDate.setDate(overdueDate.getDate() - 20);
  const overdueDue = new Date();
  overdueDue.setDate(overdueDue.getDate() - 6);
  const borrow2 = insertBorrow.run(
    genRef('BRW'), staff2.lastInsertRowid, projector.lastInsertRowid, 1, overdueDate.toISOString().slice(0, 10),
    overdueDue.toISOString().slice(0, 10), 'Excellent', 'Community film screening (demo).',
    'Sample/demo data — Borrowing Test 2 from spec (intentionally overdue for testing).', 'Borrowed'
  );
  // reflect availability change for this approved/borrowed demo record
  db.prepare('UPDATE inventory SET available_quantity = available_quantity - 1, status = ? WHERE id = ?')
    .run('Borrowed', projector.lastInsertRowid);

  console.log('Seed complete.');
  console.log('---------------------------------------------');
  console.log('DEMO LOGIN CREDENTIALS (change in production):');
  console.log('  Admin:  admin@americancornermtaani.org / AdminPass#2026');
  console.log('  Staff:  staff@americancornermtaani.org / StaffPass#2026');
  console.log('  Alumni: alumni@example.com / AlumniPass#2026');
  console.log('---------------------------------------------');
} else {
  console.log('Database already has users; skipping seed.');
}
