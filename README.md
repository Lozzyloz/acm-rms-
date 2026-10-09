# American Corner Mtaani — Resource Management System

A centralized, secure resource management platform combining alumni venue booking, staff
resource borrowing, inventory management, notifications, and administrative reporting into
one application.

## 1. Features

- **Role-based access control** — Administrator, Staff, and Alumni roles with distinct
  permissions enforced on both the frontend and backend.
- **Venue/space booking** — Alumni submit booking requests; the system flags date/time
  conflicts against already-approved bookings before admin approval.
- **Resource borrowing** — Staff submit borrowing requests against live inventory. Approval,
  borrowing, and return automatically keep inventory quantities accurate.
- **Inventory management** — Full CRUD for items, with category, condition, status, and a
  "Verified / Needs Verification" flag for real-world stock-taking.
- **Return management** — Comparing condition-on-release vs condition-on-return; a mismatch
  is flagged for administrator review.
- **Overdue tracking** — Borrowing records past their expected return date are automatically
  marked Overdue and surfaced on the dashboard.
- **Notifications** — In-app notifications for admins (new requests, overdue items, returns)
  and requesters (approval/rejection decisions).
- **Audit logging** — Every significant action (login, logout, approvals, inventory changes,
  returns, etc.) is recorded with user, timestamp, entity, and result.
- **Reports** — Dashboard summary cards, most-frequently-borrowed resources, and CSV export
  for inventory, bookings, and borrowing records.
- **Search, filter, and sort** across bookings, borrowing, and inventory.
- **Responsive UI** — Works on desktop, tablet, and mobile.

## 2. Technology Stack

| Layer          | Technology                                              |
|----------------|-----------------------------------------------------------|
| Backend        | Node.js, Express                                         |
| Database       | SQLite (via `better-sqlite3`), file-based, zero external services required |
| Authentication | `express-session` (server-side sessions) + `bcryptjs` password hashing |
| Security       | `helmet` (security headers), custom CSRF protection, `express-rate-limit`, `express-validator` |
| Frontend       | Vanilla HTML/CSS/JavaScript (no build step required)     |

The backend, frontend, and database layers are kept in clearly separated folders
(`server/`, `public/`, `data/`) with business logic (routes), data access (db/), and
cross-cutting concerns (middleware/, utils/) further separated for maintainability.

## 3. Project Structure

```
acm-rms/
├── server/
│   ├── index.js            # App entrypoint, security middleware, route mounting
│   ├── db/
│   │   ├── database.js     # SQLite connection + schema (DDL)
│   │   └── seed.js         # Demo/sample data seeding script
│   ├── middleware/
│   │   ├── auth.js         # requireAuth / requireRole (RBAC)
│   │   └── csrf.js         # CSRF token issuance + verification
│   ├── routes/
│   │   ├── auth.js, bookings.js, borrowing.js, inventory.js,
│   │   ├── notifications.js, audit.js, reports.js, users.js
│   └── utils/helpers.js    # Audit logging, notifications, ref-number generation
├── public/
│   ├── index.html
│   ├── css/styles.css      # American Corner Mtaani design system
│   └── js/{api.js, app.js} # Frontend application (SPA-style, no framework)
├── data/                   # SQLite database file lives here (git-ignored)
├── .env.example
├── package.json
└── README.md
```

## 4. Installation

**Prerequisites:** Node.js 18+ and npm.

```bash
cd acm-rms
npm install
cp .env.example .env
# Edit .env and set a strong SESSION_SECRET (see instructions inside the file)
npm run seed     # creates the database and demo accounts (only runs if empty)
npm start
```

The application will be available at `http://localhost:3000`.

## 5. Environment Variables

See `.env.example`. Required variables:

| Variable        | Purpose                                                        |
|------------------|------------------------------------------------------------------|
| `PORT`           | Port the server listens on (default 3000)                      |
| `NODE_ENV`       | `development` or `production`                                  |
| `SESSION_SECRET` | Secret used to sign session cookies. **Required in production**; the app refuses to start in production without it. Generate with: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `DB_PATH`        | Optional override for the SQLite file location                 |

Secrets are never hard-coded; the app reads them exclusively from environment variables via
`dotenv`.

## 6. Database Setup

No external database server is required. `better-sqlite3` creates and manages a local file
at `data/acm_rms.sqlite` on first run. The schema (users, inventory, bookings, borrowing,
notifications, audit_logs) is created automatically by `server/db/database.js` if it doesn't
already exist. Foreign keys and CHECK constraints are enforced at the database level.

Run `npm run seed` once to populate demo accounts and clearly-labelled sample data (see
Section 8). Re-running seed is a no-op once users already exist, so it's safe to include in
setup scripts.

## 7. Test Credentials (demo data — change/remove before real deployment)

| Role       | Email                                   | Password         |
|------------|------------------------------------------|-------------------|
| Admin      | admin@americancornermtaani.org           | AdminPass#2026    |
| Staff      | staff@americancornermtaani.org           | StaffPass#2026    |
| Staff      | brian.otieno@americancornermtaani.org    | StaffPass#2026    |
| Alumni     | alumni@example.com                       | AlumniPass#2026   |

## 8. Sample / Demo Data

All inventory quantities, bookings, and borrowing records created by the seed script are
placeholders for demonstration and are explicitly labelled as such in their `description` /
`notes` fields (e.g. "Demo sample record — replace with verified count."). Real inventory
counts have **not** been invented; administrators should use the Inventory page to enter
actual verified stock and mark items "Verified" as counting is completed. Seed data includes:

- One venue booking (Alumni, pending) — *Booking Test 1*
- Two borrowing records against different resources — *Borrowing Test 1* (pending) and
  *Borrowing Test 2* (already borrowed and intentionally overdue, to demonstrate overdue
  tracking on first run)
- Seven inventory items across several categories, one of which is set to "Under Repair"

## 9. Running the Core Workflow (manual test script)

1. Log in as Alumni → Bookings → submit a new booking → confirmation message appears.
2. Log in as Admin → Dashboard shows the booking in Pending Bookings / Recent Bookings.
3. Log in as Staff → Borrowing → submit a request for an available item → system checks
   and displays live availability before submission.
4. Log in as Admin → Borrowing → Approve the request → Inventory availability decreases
   automatically (verify on the Inventory page).
5. Record a Return with the **same** condition as release → no warning shown.
6. Record a Return with a **different** condition → "Condition changed — administrator
   review required" warning appears, inventory availability is restored.
7. The seeded "Borrowing Test 2" record is already overdue — visible on the Dashboard and
   in the Borrowing list with an OVERDUE badge and day count.
8. Reports → export any of the three CSV reports.
9. Audit Logs → confirm the actions above were recorded with user, action, timestamp, and
   result.

## 10. Security Considerations

- **Passwords** are hashed with bcrypt (cost factor 12) — never stored or logged in plain
  text.
- **Sessions** are server-side (SQLite-backed), httpOnly, `sameSite=lax`, and `secure` in
  production (requires HTTPS). Session IDs are regenerated on login to prevent session
  fixation.
- **CSRF** protection uses a per-session token that must be echoed in the `X-CSRF-Token`
  header for all state-changing requests.
- **Input validation** is enforced server-side with `express-validator` on every write
  endpoint (never trusting client-side validation alone); string inputs are escaped.
- **SQL injection** is mitigated by exclusive use of parameterized queries
  (`better-sqlite3` prepared statements) — no string-concatenated SQL.
- **Authorization** is enforced per-route via `requireAuth` / `requireRole` middleware;
  ownership checks (e.g. staff can only return their own items) are applied where relevant.
- **Rate limiting** is applied globally to `/api` and more strictly to the login endpoint to
  slow brute-force attempts.
- **Security headers** are set via `helmet`, including a restrictive Content-Security-Policy.
- **Error handling**: a central error handler ensures raw stack traces or database errors
  are never returned to the client; user-facing messages are generic and actionable.
- **Audit logging** captures login/logout, booking and borrowing lifecycle events, inventory
  changes, and returns, each with user, action, timestamp, entity, and result — for
  accountability.
- **Secrets** are read from environment variables only; `.env` is git-ignored and the app
  refuses to start in production without a real `SESSION_SECRET`.

### Basic security testing performed

- Unauthorized page/API access → returns 401/403 with a generic message, no data leaked.
- Role escalation attempts (e.g. alumni writing to `/api/inventory`) → blocked by
  `requireRole`.
- Invalid/missing CSRF token on state-changing requests → rejected with 403.
- SQL injection strings in search fields → treated as literal text (parameterized queries),
  no error, no data leakage.
- Borrowing more than the available quantity → rejected with a clear message; inventory
  quantities were confirmed unchanged.
- Session/logout behaviour → session destroyed server-side and cookie cleared on logout.

This project is a strong functional and security baseline. Before production deployment,
run a full dependency vulnerability scan (`npm audit`), place the app behind HTTPS, set a
strong `SESSION_SECRET`, remove or reset the demo accounts, and consider adding automated
tests and a proper email integration for notifications.

## 11. Notifications

The system currently uses an internal, database-backed notification system (visible in the
Notifications tab, keyed by role or specific user) covering all events required in the spec:
new bookings, new borrowing requests, approvals/rejections, returns, and overdue items. This
is structured so it can be extended to send real emails (e.g. via a transactional email
provider) by hooking into `server/utils/helpers.js`'s `notify()` / `notifyAdmins()`
functions without changing calling code elsewhere.

## 12. Known Limitations / Suggested Next Steps

- Reports are summary + CSV export; a dedicated charting view could be added later.
- The calendar view is a simple date-grouped agenda rather than a full month-grid calendar.
- Email delivery is not wired up (see Section 11) — internal notifications are fully
  functional and ready to be connected.
- No automated test suite is included; the manual workflow in Section 9 exercises all core
  paths and was used to validate this build end-to-end.
