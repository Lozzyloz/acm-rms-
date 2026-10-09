const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, 'acm_rms.sqlite');
const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin','staff','alumni')),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','disabled')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS inventory (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_name TEXT NOT NULL,
  category TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0 CHECK(quantity >= 0),
  available_quantity INTEGER NOT NULL DEFAULT 0 CHECK(available_quantity >= 0),
  location TEXT,
  condition_status TEXT NOT NULL DEFAULT 'Good' CHECK(condition_status IN ('Excellent','Good','Fair','Damaged')),
  status TEXT NOT NULL DEFAULT 'Available' CHECK(status IN ('Available','Borrowed','Under Repair')),
  description TEXT,
  verification_status TEXT NOT NULL DEFAULT 'Needs Verification' CHECK(verification_status IN ('Verified','Needs Verification')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS bookings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_ref TEXT NOT NULL UNIQUE,
  user_id INTEGER REFERENCES users(id),
  full_name TEXT NOT NULL,
  contact TEXT NOT NULL,
  email TEXT NOT NULL,
  alumni_status TEXT,
  booking_date TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  purpose TEXT NOT NULL,
  attendees INTEGER NOT NULL,
  equipment_needed TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'Pending' CHECK(status IN ('Pending','Approved','Rejected','Completed','Cancelled')),
  reviewed_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS borrowing (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  borrowing_ref TEXT NOT NULL UNIQUE,
  staff_id INTEGER NOT NULL REFERENCES users(id),
  inventory_item_id INTEGER NOT NULL REFERENCES inventory(id),
  quantity INTEGER NOT NULL CHECK(quantity > 0),
  date_out TEXT NOT NULL,
  expected_return_date TEXT NOT NULL,
  actual_return_date TEXT,
  condition_on_release TEXT NOT NULL CHECK(condition_on_release IN ('Excellent','Good','Fair','Damaged')),
  condition_on_return TEXT CHECK(condition_on_return IN ('Excellent','Good','Fair','Damaged')),
  purpose TEXT,
  notes TEXT,
  return_notes TEXT,
  condition_flag INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Pending' CHECK(status IN ('Pending','Approved','Borrowed','Returned','Overdue','Cancelled','Rejected')),
  reviewed_by INTEGER REFERENCES users(id),
  returned_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recipient_id INTEGER REFERENCES users(id),
  recipient_role TEXT,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info',
  read_status INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id),
  user_label TEXT,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  result TEXT NOT NULL DEFAULT 'success',
  details TEXT,
  timestamp TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

module.exports = db;
