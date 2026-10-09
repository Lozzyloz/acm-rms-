/* American Corner Mtaani — Resource Management System (frontend) */

const state = { user: null, route: 'dashboard', notifications: [], toasts: [] };
const $app = document.getElementById('app');

const NAV_ITEMS = [
  { key: 'dashboard', label: 'Dashboard', roles: ['admin', 'staff', 'alumni'] },
  { key: 'bookings', label: 'Bookings', roles: ['admin', 'staff', 'alumni'] },
  { key: 'borrowing', label: 'Borrowing', roles: ['admin', 'staff'] },
  { key: 'inventory', label: 'Inventory', roles: ['admin', 'staff'] },
  { key: 'calendar', label: 'Calendar', roles: ['admin', 'staff'] },
  { key: 'notifications', label: 'Notifications', roles: ['admin', 'staff', 'alumni'] },
  { key: 'reports', label: 'Reports', roles: ['admin'] },
  { key: 'audit', label: 'Audit Logs', roles: ['admin'] },
  { key: 'settings', label: 'Settings', roles: ['admin'] }
];

function esc(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function fmtDate(d) { if (!d) return '—'; return d; }
function fmtDateTime(d) { if (!d) return '—'; return d.replace('T', ' ').slice(0, 16); }
function badge(text, cls) { return `<span class="badge badge-${cls || text.toLowerCase().replace(/\s+/g,'-')}">${esc(text)}</span>`; }

function toast(message, type = 'info') {
  const el = document.createElement('div');
  el.className = `alert alert-${type}`;
  el.style.position = 'fixed';
  el.style.bottom = '20px';
  el.style.right = '20px';
  el.style.zIndex = '999';
  el.style.minWidth = '260px';
  el.style.boxShadow = '0 8px 24px rgba(0,0,0,0.15)';
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 4200);
}

window.addEventListener('acm:unauthorized', () => {
  state.user = null;
  render();
});

// ---------- Bootstrapping ----------
async function bootstrap() {
  try {
    const data = await API.get('/api/auth/me');
    state.user = data.user;
  } catch (e) {
    state.user = null;
  }
  render();
}

function navigate(route) {
  state.route = route;
  render();
}

// ---------- Layout ----------
function renderLayout(contentHtml) {
  const items = NAV_ITEMS.filter(n => n.roles.includes(state.user.role));
  $app.innerHTML = `
    <div class="app-shell">
      <button id="mobileNavToggle" class="btn btn-outline btn-sm" style="position:fixed;top:10px;left:10px;z-index:41;display:none;">☰</button>
      <aside class="sidebar" id="sidebar">
        <div class="brand">
          <strong>American Corner Mtaani</strong>
          <span>Resource Management System</span>
        </div>
        <ul class="nav-list">
          ${items.map(n => `<li><a href="#" data-nav="${n.key}" class="${state.route === n.key ? 'active' : ''}">${esc(n.label)}</a></li>`).join('')}
        </ul>
        <div class="sidebar-footer">
          <div style="margin-bottom:8px;">${esc(state.user.name)}<br><span class="text-muted" style="font-size:11px;">${esc(state.user.role.toUpperCase())}</span></div>
          <button id="logoutBtn">Log out</button>
        </div>
      </aside>
      <div class="main-area">
        <div class="topbar">
          <h1>${esc((NAV_ITEMS.find(n => n.key === state.route) || {}).label || '')}</h1>
          <div class="flex gap-12">
            <a href="#" data-nav="notifications" style="position:relative; text-decoration:none; color:var(--navy); font-size:20px;" title="Notifications">
              🔔 <span id="notifCount" class="text-muted" style="font-size:12px;"></span>
            </a>
          </div>
        </div>
        <div class="content" id="content">${contentHtml}</div>
      </div>
    </div>
  `;
  document.querySelectorAll('[data-nav]').forEach(el => {
    el.addEventListener('click', (e) => { e.preventDefault(); navigate(el.dataset.nav); document.getElementById('sidebar')?.classList.remove('open'); });
  });
  document.getElementById('logoutBtn').addEventListener('click', doLogout);
  const toggle = document.getElementById('mobileNavToggle');
  if (window.innerWidth <= 860) {
    toggle.style.display = 'block';
    toggle.addEventListener('click', () => document.getElementById('sidebar').classList.toggle('open'));
  }
  updateNotifCount();
}

async function updateNotifCount() {
  try {
    const { notifications } = await API.get('/api/notifications');
    state.notifications = notifications;
    const unread = notifications.filter(n => !n.read_status).length;
    const el = document.getElementById('notifCount');
    if (el) el.textContent = unread ? `(${unread})` : '';
  } catch (e) { /* ignore */ }
}

async function doLogout() {
  try { await API.post('/api/auth/logout'); } catch (e) {}
  state.user = null;
  render();
}

// ---------- Router ----------
async function render() {
  if (!state.user) return renderLogin();
  const allowed = NAV_ITEMS.find(n => n.key === state.route);
  if (!allowed || !allowed.roles.includes(state.user.role)) state.route = 'dashboard';

  renderLayout('<div class="empty-state">Loading…</div>');
  try {
    switch (state.route) {
      case 'dashboard': await renderDashboard(); break;
      case 'bookings': await renderBookings(); break;
      case 'borrowing': await renderBorrowing(); break;
      case 'inventory': await renderInventory(); break;
      case 'calendar': await renderCalendar(); break;
      case 'notifications': await renderNotifications(); break;
      case 'reports': await renderReports(); break;
      case 'audit': await renderAudit(); break;
      case 'settings': await renderSettings(); break;
      default: renderLayout('<div class="empty-state">Not found</div>');
    }
  } catch (e) {
    document.getElementById('content').innerHTML = `<div class="alert alert-error">${esc(e.message)}</div>`;
  }
}

// ---------- Login ----------
function renderLogin() {
  $app.innerHTML = `
    <div class="login-wrap">
      <div class="login-card">
        <div class="brand-mark"><div class="stripe"></div><div><strong style="color:var(--navy);font-size:16px;">American Corner Mtaani</strong><div class="text-muted" style="font-size:12px;">Resource Management System</div></div></div>
        <h2 style="margin-top:18px;">Sign in</h2>
        <div id="loginError"></div>
        <form id="loginForm">
          <div class="form-row">
            <label for="email">Email address</label>
            <input type="email" id="email" name="email" required autocomplete="username">
          </div>
          <div class="form-row">
            <label for="password">Password</label>
            <input type="password" id="password" name="password" required autocomplete="current-password">
          </div>
          <button type="submit" class="btn btn-primary" style="width:100%; justify-content:center;">Sign in</button>
        </form>
        <div class="demo-creds">
          <strong>Demo credentials</strong><br>
          Admin: admin@americancornermtaani.org / AdminPass#2026<br>
          Staff: staff@americancornermtaani.org / StaffPass#2026<br>
          Alumni: alumni@example.com / AlumniPass#2026
        </div>
      </div>
    </div>
  `;
  document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    try {
      const data = await API.post('/api/auth/login', { email, password });
      state.user = data.user;
      state.route = 'dashboard';
      render();
    } catch (err) {
      document.getElementById('loginError').innerHTML = `<div class="alert alert-error">${esc(err.message)}</div>`;
    }
  });
}

// ---------- Shared UI helpers ----------
function openModal(html) {
  const wrap = document.createElement('div');
  wrap.className = 'modal-overlay';
  wrap.id = 'modalOverlay';
  wrap.innerHTML = `<div class="modal">${html}</div>`;
  wrap.addEventListener('click', (e) => { if (e.target === wrap) closeModal(); });
  document.body.appendChild(wrap);
}
function closeModal() { document.getElementById('modalOverlay')?.remove(); }

function confirmAction(message, onConfirm) {
  openModal(`
    <h3>Please confirm</h3>
    <p class="text-muted">${esc(message)}</p>
    <div class="modal-actions">
      <button class="btn btn-outline" id="confirmCancel">Cancel</button>
      <button class="btn btn-accent" id="confirmOk">Confirm</button>
    </div>
  `);
  document.getElementById('confirmCancel').addEventListener('click', closeModal);
  document.getElementById('confirmOk').addEventListener('click', () => { closeModal(); onConfirm(); });
}

function statusBadgeClass(status) {
  return status.toLowerCase().replace(/\s+/g, '-');
}

// ---------- Dashboard ----------
async function renderDashboard() {
  const data = await API.get('/api/reports/dashboard');
  const s = data.summary;
  const cards = [
    { label: 'Total Inventory Items', value: s.totalItems },
    { label: 'Available Resources', value: s.availableItems },
    { label: 'Currently Borrowed', value: s.borrowedNow },
    { label: 'Under Repair', value: s.underRepair },
    { label: 'Pending Bookings', value: s.pendingBookings, alert: s.pendingBookings > 0 },
    { label: 'Pending Borrowing Requests', value: s.pendingBorrowing, alert: s.pendingBorrowing > 0 },
    { label: 'Upcoming Bookings', value: s.upcomingBookings },
    { label: 'Overdue Resources', value: s.overdue, alert: s.overdue > 0 }
  ];

  const html = `
    ${state.user.role !== 'alumni' ? `
    <div class="flex gap-12" style="margin-bottom:18px; flex-wrap:wrap;">
      <button class="btn btn-accent" data-action="new-booking">+ New Booking</button>
      ${state.user.role !== 'admin' || true ? `<button class="btn btn-accent" data-action="new-borrow">+ Borrow Resource</button>` : ''}
      ${state.user.role === 'admin' ? `<button class="btn btn-accent" data-action="new-inventory">+ Add Inventory Item</button>` : ''}
    </div>` : `<div class="flex gap-12" style="margin-bottom:18px;"><button class="btn btn-accent" data-action="new-booking">+ New Booking</button></div>`}

    <div class="grid grid-cards" style="margin-bottom:24px;">
      ${cards.map(c => `<div class="card stat-card ${c.alert ? 'alert' : ''}"><div class="stat-label">${esc(c.label)}</div><div class="stat-value">${c.value}</div></div>`).join('')}
    </div>

    ${s.overdue > 0 ? `
    <div class="panel">
      <div class="panel-header"><h3 class="mt-0">Overdue Resources</h3></div>
      <div class="table-wrap"><table>
        <thead><tr><th>Item</th><th>Borrower</th><th>Date Borrowed</th><th>Expected Return</th><th>Days Overdue</th></tr></thead>
        <tbody>${data.overdueList.map(o => `<tr><td>${esc(o.item_name)}</td><td>${esc(o.staff_name)}</td><td>${fmtDate(o.date_out)}</td><td>${fmtDate(o.expected_return_date)}</td><td>${badge('OVERDUE ' + o.days_overdue + 'd', 'overdue')}</td></tr>`).join('') || '<tr><td colspan="5" class="text-muted">None</td></tr>'}</tbody>
      </table></div>
    </div>` : ''}

    <div class="grid" style="grid-template-columns: 1fr 1fr; gap:20px;">
      <div class="panel">
        <h3 class="mt-0">Recent Bookings</h3>
        <div class="table-wrap"><table><tbody>
          ${data.recentBookings.map(b => `<tr><td>${esc(b.full_name)}</td><td>${fmtDate(b.booking_date)}</td><td>${badge(b.status, statusBadgeClass(b.status))}</td></tr>`).join('') || '<tr><td class="text-muted">No bookings yet</td></tr>'}
        </tbody></table></div>
      </div>
      <div class="panel">
        <h3 class="mt-0">Recent Borrowing</h3>
        <div class="table-wrap"><table><tbody>
          ${data.recentBorrowing.map(b => `<tr><td>${esc(b.item_name)}</td><td>${esc(b.staff_name)}</td><td>${badge(b.status, statusBadgeClass(b.status))}</td></tr>`).join('') || '<tr><td class="text-muted">No borrowing records yet</td></tr>'}
        </tbody></table></div>
      </div>
    </div>
    <div class="panel">
      <h3 class="mt-0">Recently Returned</h3>
      <div class="table-wrap"><table><tbody>
        ${data.recentReturns.map(b => `<tr><td>${esc(b.item_name)}</td><td>${esc(b.staff_name)}</td><td>${fmtDate(b.actual_return_date)}</td><td>${b.condition_flag ? badge('Condition changed', 'overdue') : badge('OK', 'available')}</td></tr>`).join('') || '<tr><td class="text-muted">No returns yet</td></tr>'}
      </tbody></table></div>
    </div>
  `;
  document.getElementById('content').innerHTML = html;
  document.querySelector('[data-action="new-booking"]')?.addEventListener('click', showBookingForm);
  document.querySelector('[data-action="new-borrow"]')?.addEventListener('click', showBorrowForm);
  document.querySelector('[data-action="new-inventory"]')?.addEventListener('click', () => showInventoryForm());
}

// ---------- Bookings ----------
async function renderBookings() {
  const params = new URLSearchParams(state.bookingFilters || {});
  const { bookings } = await API.get('/api/bookings?' + params.toString());
  const isAdmin = state.user.role === 'admin';

  const html = `
    <div class="panel-header">
      <div class="search-bar">
        <input type="text" id="bkgSearch" placeholder="Search by name or purpose" value="${esc((state.bookingFilters||{}).search||'')}">
        <select id="bkgStatus">
          <option value="">All statuses</option>
          ${['Pending','Approved','Rejected','Completed','Cancelled'].map(s => `<option ${((state.bookingFilters||{}).status===s)?'selected':''}>${s}</option>`).join('')}
        </select>
        <select id="bkgSort">
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="status">By status</option>
          <option value="date">By date</option>
        </select>
        <button class="btn btn-outline btn-sm" id="bkgFilterBtn">Filter</button>
      </div>
      <button class="btn btn-accent" id="newBookingBtn">+ New Booking</button>
    </div>
    <div class="panel">
      <div class="table-wrap"><table>
        <thead><tr><th>Booking ID</th><th>Requester</th><th>Date</th><th>Time</th><th>Purpose</th><th>Attendees</th><th>Status</th>${isAdmin?'<th>Actions</th>':''}</tr></thead>
        <tbody>
          ${bookings.map(b => `
            <tr>
              <td>${esc(b.booking_ref)}</td>
              <td>${esc(b.full_name)}</td>
              <td>${fmtDate(b.booking_date)}</td>
              <td>${esc(b.start_time)}–${esc(b.end_time)}</td>
              <td>${esc(b.purpose)}</td>
              <td>${b.attendees}</td>
              <td>${badge(b.status, statusBadgeClass(b.status))}</td>
              ${isAdmin ? `<td>
                ${b.status === 'Pending' ? `
                  <button class="btn btn-sm btn-primary" data-approve="${b.id}">Approve</button>
                  <button class="btn btn-sm btn-danger" data-reject="${b.id}">Reject</button>` : ''}
                ${b.status === 'Approved' ? `<button class="btn btn-sm btn-outline" data-complete="${b.id}">Mark Completed</button>` : ''}
              </td>` : ''}
            </tr>
          `).join('') || `<tr><td colspan="${isAdmin?8:7}" class="empty-state">No bookings found.</td></tr>`}
        </tbody>
      </table></div>
    </div>
  `;
  document.getElementById('content').innerHTML = html;

  document.getElementById('newBookingBtn').addEventListener('click', showBookingForm);
  document.getElementById('bkgFilterBtn').addEventListener('click', () => {
    state.bookingFilters = {
      search: document.getElementById('bkgSearch').value,
      status: document.getElementById('bkgStatus').value,
      sort: document.getElementById('bkgSort').value
    };
    renderBookings();
  });

  document.querySelectorAll('[data-approve]').forEach(btn => btn.addEventListener('click', () => updateBookingStatus(btn.dataset.approve, 'Approved')));
  document.querySelectorAll('[data-reject]').forEach(btn => btn.addEventListener('click', () => confirmAction('Reject this booking request?', () => updateBookingStatus(btn.dataset.reject, 'Rejected'))));
  document.querySelectorAll('[data-complete]').forEach(btn => btn.addEventListener('click', () => updateBookingStatus(btn.dataset.complete, 'Completed')));
}

async function updateBookingStatus(id, status) {
  try {
    await API.put(`/api/bookings/${id}/status`, { status });
    toast(`Booking ${status.toLowerCase()}.`, 'success');
    renderBookings();
  } catch (e) {
    toast(e.message, 'error');
  }
}

function showBookingForm() {
  const u = state.user;
  openModal(`
    <h3>New Venue Booking</h3>
    <p class="text-muted" style="margin-top:-6px;">Fields marked are required.</p>
    <form id="bookingForm">
      <div class="form-grid">
        <div class="form-row"><label>Full Name *</label><input name="full_name" required value="${esc(u.name)}"></div>
        <div class="form-row"><label>Email *</label><input type="email" name="email" required value="${esc(u.email)}"></div>
        <div class="form-row"><label>Contact Information *</label><input name="contact" required placeholder="Phone number"></div>
        <div class="form-row"><label>Alumni Status</label><input name="alumni_status" placeholder="e.g. Alumni cohort / program"></div>
        <div class="form-row"><label>Date *</label><input type="date" name="booking_date" required min="${new Date().toISOString().slice(0,10)}"></div>
        <div class="form-row"><label>Number of Attendees *</label><input type="number" name="attendees" required min="1" max="500"></div>
        <div class="form-row"><label>Start Time *</label><input type="time" name="start_time" required></div>
        <div class="form-row"><label>End Time *</label><input type="time" name="end_time" required></div>
      </div>
      <div class="form-row"><label>Purpose *</label><textarea name="purpose" rows="2" required></textarea></div>
      <div class="form-row"><label>Equipment Needed</label><input name="equipment_needed" placeholder="e.g. Projector, Microphone"></div>
      <div class="form-row"><label>Additional Notes</label><textarea name="notes" rows="2"></textarea></div>
      <div id="bookingFormError"></div>
      <div class="modal-actions">
        <button type="button" class="btn btn-outline" id="cancelBookingForm">Cancel</button>
        <button type="submit" class="btn btn-accent">Submit Booking</button>
      </div>
    </form>
  `);
  document.getElementById('cancelBookingForm').addEventListener('click', closeModal);
  document.getElementById('bookingForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.target).entries());
    fd.attendees = Number(fd.attendees);
    try {
      const res = await API.post('/api/bookings', fd);
      closeModal();
      toast(res.message, res.possibleConflict ? 'warning' : 'success');
      if (state.route === 'bookings') renderBookings(); else if (state.route === 'dashboard') renderDashboard();
    } catch (err) {
      document.getElementById('bookingFormError').innerHTML = `<div class="alert alert-error">${esc(err.message)}</div>`;
    }
  });
}

// ---------- Borrowing ----------
async function renderBorrowing() {
  const params = new URLSearchParams(state.borrowFilters || {});
  const { borrowing } = await API.get('/api/borrowing?' + params.toString());
  const isAdmin = state.user.role === 'admin';

  const html = `
    <div class="panel-header">
      <div class="search-bar">
        <input type="text" id="brwSearch" placeholder="Search by staff or item" value="${esc((state.borrowFilters||{}).search||'')}">
        <select id="brwStatus">
          <option value="">All statuses</option>
          ${['Pending','Approved','Borrowed','Returned','Overdue','Cancelled','Rejected'].map(s => `<option ${((state.borrowFilters||{}).status===s)?'selected':''}>${s}</option>`).join('')}
        </select>
        <button class="btn btn-outline btn-sm" id="brwFilterBtn">Filter</button>
      </div>
      <button class="btn btn-accent" id="newBorrowBtn">+ Borrow Resource</button>
    </div>
    <div class="panel">
      <div class="table-wrap"><table>
        <thead><tr><th>Borrow ID</th><th>Staff</th><th>Item</th><th>Qty</th><th>Date Out</th><th>Expected Return</th><th>Actual Return</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>
          ${borrowing.map(b => `
            <tr>
              <td>${esc(b.borrowing_ref)}</td>
              <td>${esc(b.staff_name)}</td>
              <td>${esc(b.item_name)}</td>
              <td>${b.quantity}</td>
              <td>${fmtDate(b.date_out)}</td>
              <td>${fmtDate(b.expected_return_date)}</td>
              <td>${fmtDate(b.actual_return_date)}</td>
              <td>${badge(b.status, statusBadgeClass(b.status))}${b.condition_flag ? ' ' + badge('Condition changed', 'overdue') : ''}</td>
              <td>
                ${isAdmin && b.status === 'Pending' ? `<button class="btn btn-sm btn-primary" data-brw-approve="${b.id}">Approve</button> <button class="btn btn-sm btn-danger" data-brw-reject="${b.id}">Reject</button>` : ''}
                ${(b.status === 'Borrowed' || b.status === 'Overdue') && (isAdmin || b.staff_id === state.user.id) ? `<button class="btn btn-sm btn-outline" data-brw-return="${b.id}">Record Return</button>` : ''}
              </td>
            </tr>
          `).join('') || `<tr><td colspan="9" class="empty-state">No borrowing records found.</td></tr>`}
        </tbody>
      </table></div>
    </div>
  `;
  document.getElementById('content').innerHTML = html;

  document.getElementById('newBorrowBtn').addEventListener('click', showBorrowForm);
  document.getElementById('brwFilterBtn').addEventListener('click', () => {
    state.borrowFilters = { search: document.getElementById('brwSearch').value, status: document.getElementById('brwStatus').value };
    renderBorrowing();
  });
  document.querySelectorAll('[data-brw-approve]').forEach(btn => btn.addEventListener('click', () => updateBorrowStatus(btn.dataset.brwApprove, 'Approved')));
  document.querySelectorAll('[data-brw-reject]').forEach(btn => btn.addEventListener('click', () => confirmAction('Reject this borrowing request?', () => updateBorrowStatus(btn.dataset.brwReject, 'Rejected'))));
  document.querySelectorAll('[data-brw-return]').forEach(btn => btn.addEventListener('click', () => showReturnForm(btn.dataset.brwReturn, borrowing.find(b => String(b.id) === btn.dataset.brwReturn))));
}

async function updateBorrowStatus(id, status) {
  try {
    await API.put(`/api/borrowing/${id}/status`, { status });
    toast(`Borrowing request ${status.toLowerCase()}.`, 'success');
    renderBorrowing();
  } catch (e) { toast(e.message, 'error'); }
}

async function showBorrowForm() {
  const { items } = await API.get('/api/inventory');
  const available = items.filter(i => i.status !== 'Under Repair' && i.available_quantity > 0);
  openModal(`
    <h3>Borrow a Resource</h3>
    <form id="borrowForm">
      <div class="form-row">
        <label>Item / Resource *</label>
        <select name="inventory_item_id" id="borrowItemSelect" required>
          <option value="">Select an item…</option>
          ${available.map(i => `<option value="${i.id}" data-max="${i.available_quantity}">${esc(i.item_name)} (${i.available_quantity} available)</option>`).join('')}
        </select>
        ${available.length === 0 ? '<div class="hint">No items are currently available to borrow.</div>' : ''}
      </div>
      <div class="form-grid">
        <div class="form-row"><label>Quantity *</label><input type="number" name="quantity" id="borrowQty" min="1" required></div>
        <div class="form-row"><label>Condition on Release *</label>
          <select name="condition_on_release" required>
            <option>Excellent</option><option selected>Good</option><option>Fair</option><option>Damaged</option>
          </select>
        </div>
        <div class="form-row"><label>Date Out *</label><input type="date" name="date_out" required value="${new Date().toISOString().slice(0,10)}"></div>
        <div class="form-row"><label>Expected Return Date *</label><input type="date" name="expected_return_date" required></div>
      </div>
      <div class="form-row"><label>Purpose / Reason</label><textarea name="purpose" rows="2"></textarea></div>
      <div class="form-row"><label>Additional Notes</label><textarea name="notes" rows="2"></textarea></div>
      <div id="borrowFormError"></div>
      <div class="modal-actions">
        <button type="button" class="btn btn-outline" id="cancelBorrowForm">Cancel</button>
        <button type="submit" class="btn btn-accent" ${available.length===0?'disabled':''}>Submit Request</button>
      </div>
    </form>
  `);
  document.getElementById('cancelBorrowForm').addEventListener('click', closeModal);
  const sel = document.getElementById('borrowItemSelect');
  const qty = document.getElementById('borrowQty');
  sel.addEventListener('change', () => { qty.max = sel.selectedOptions[0]?.dataset.max || ''; });

  document.getElementById('borrowForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.target).entries());
    fd.inventory_item_id = Number(fd.inventory_item_id);
    fd.quantity = Number(fd.quantity);
    try {
      const res = await API.post('/api/borrowing', fd);
      closeModal();
      toast(res.message, 'success');
      if (state.route === 'borrowing') renderBorrowing(); else if (state.route === 'dashboard') renderDashboard();
    } catch (err) {
      document.getElementById('borrowFormError').innerHTML = `<div class="alert alert-error">${esc(err.message)}</div>`;
    }
  });
}

function showReturnForm(id, record) {
  openModal(`
    <h3>Record Return</h3>
    <p class="text-muted" style="margin-top:-6px;">${esc(record.item_name)} — released in <strong>${esc(record.condition_on_release)}</strong> condition.</p>
    <form id="returnForm">
      <div class="form-row">
        <label>Condition on Return *</label>
        <select name="condition_on_return" id="returnCondition" required>
          <option>Excellent</option><option>Good</option><option>Fair</option><option>Damaged</option>
        </select>
      </div>
      <div id="conditionWarning"></div>
      <div class="form-row"><label>Notes</label><textarea name="return_notes" rows="2"></textarea></div>
      <div id="returnFormError"></div>
      <div class="modal-actions">
        <button type="button" class="btn btn-outline" id="cancelReturnForm">Cancel</button>
        <button type="submit" class="btn btn-accent">Confirm Return</button>
      </div>
    </form>
  `);
  document.getElementById('cancelReturnForm').addEventListener('click', closeModal);
  const condSel = document.getElementById('returnCondition');
  condSel.value = record.condition_on_release;
  const checkWarn = () => {
    document.getElementById('conditionWarning').innerHTML = condSel.value !== record.condition_on_release
      ? `<div class="condition-warning">⚠ Condition changed — administrator review required.</div>` : '';
  };
  condSel.addEventListener('change', checkWarn);
  checkWarn();

  document.getElementById('returnForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.target).entries());
    try {
      const res = await API.put(`/api/borrowing/${id}/return`, fd);
      closeModal();
      toast(res.message, res.conditionChanged ? 'warning' : 'success');
      renderBorrowing();
    } catch (err) {
      document.getElementById('returnFormError').innerHTML = `<div class="alert alert-error">${esc(err.message)}</div>`;
    }
  });
}

// ---------- Inventory ----------
async function renderInventory() {
  const params = new URLSearchParams(state.invFilters || {});
  const [{ items }, meta] = await Promise.all([
    API.get('/api/inventory?' + params.toString()),
    API.get('/api/inventory/categories')
  ]);
  const isAdmin = state.user.role === 'admin';

  const html = `
    <div class="panel-header">
      <div class="search-bar">
        <input type="text" id="invSearch" placeholder="Search name or location" value="${esc((state.invFilters||{}).search||'')}">
        <select id="invCategory"><option value="">All categories</option>${meta.categories.map(c => `<option ${((state.invFilters||{}).category===c)?'selected':''}>${c}</option>`).join('')}</select>
        <select id="invStatus"><option value="">All statuses</option>${meta.statuses.map(c => `<option ${((state.invFilters||{}).status===c)?'selected':''}>${c}</option>`).join('')}</select>
        <select id="invCondition"><option value="">All conditions</option>${meta.conditions.map(c => `<option ${((state.invFilters||{}).condition===c)?'selected':''}>${c}</option>`).join('')}</select>
        <button class="btn btn-outline btn-sm" id="invFilterBtn">Filter</button>
      </div>
      ${isAdmin ? `<button class="btn btn-accent" id="newInvBtn">+ Add Inventory Item</button>` : ''}
    </div>
    <div class="panel">
      <div class="table-wrap"><table>
        <thead><tr><th>Item</th><th>Category</th><th>Qty</th><th>Available</th><th>Location</th><th>Condition</th><th>Status</th><th>Verification</th>${isAdmin?'<th>Actions</th>':''}</tr></thead>
        <tbody>
          ${items.map(i => `
            <tr>
              <td>${esc(i.item_name)}</td>
              <td>${esc(i.category)}</td>
              <td>${i.quantity}</td>
              <td>${i.available_quantity}</td>
              <td>${esc(i.location)||'—'}</td>
              <td>${badge(i.condition_status, statusBadgeClass(i.condition_status))}</td>
              <td>${badge(i.status, i.status === 'Under Repair' ? 'repair' : statusBadgeClass(i.status))}</td>
              <td>${badge(i.verification_status, i.verification_status === 'Verified' ? 'available' : 'pending')}</td>
              ${isAdmin ? `<td>
                <button class="btn btn-sm btn-outline" data-edit-inv="${i.id}">Edit</button>
                <button class="btn btn-sm btn-danger" data-del-inv="${i.id}">Delete</button>
              </td>` : ''}
            </tr>
          `).join('') || `<tr><td colspan="${isAdmin?9:8}" class="empty-state">No inventory items found.</td></tr>`}
        </tbody>
      </table></div>
    </div>
  `;
  document.getElementById('content').innerHTML = html;
  document.getElementById('newInvBtn')?.addEventListener('click', () => showInventoryForm(null, meta));
  document.getElementById('invFilterBtn').addEventListener('click', () => {
    state.invFilters = {
      search: document.getElementById('invSearch').value,
      category: document.getElementById('invCategory').value,
      status: document.getElementById('invStatus').value,
      condition: document.getElementById('invCondition').value
    };
    renderInventory();
  });
  document.querySelectorAll('[data-edit-inv]').forEach(btn => btn.addEventListener('click', () => showInventoryForm(items.find(i => String(i.id) === btn.dataset.editInv), meta)));
  document.querySelectorAll('[data-del-inv]').forEach(btn => btn.addEventListener('click', () => confirmAction('Are you sure you want to delete this inventory item?', async () => {
    try { await API.del(`/api/inventory/${btn.dataset.delInv}`); toast('Inventory item deleted.', 'success'); renderInventory(); }
    catch (e) { toast(e.message, 'error'); }
  })));
}

async function showInventoryForm(item, metaIn) {
  const meta = metaIn || await API.get('/api/inventory/categories');
  const isEdit = !!item;
  openModal(`
    <h3>${isEdit ? 'Edit' : 'Add'} Inventory Item</h3>
    <form id="invForm">
      <div class="form-row"><label>Item Name *</label><input name="item_name" required value="${esc(item?.item_name||'')}"></div>
      <div class="form-grid">
        <div class="form-row"><label>Category *</label><select name="category" required>${meta.categories.map(c => `<option ${item?.category===c?'selected':''}>${c}</option>`).join('')}</select></div>
        <div class="form-row"><label>Quantity *</label><input type="number" name="quantity" min="0" required value="${item?.quantity ?? ''}"></div>
        <div class="form-row"><label>Location</label><input name="location" value="${esc(item?.location||'')}"></div>
        <div class="form-row"><label>Condition *</label><select name="condition_status" required>${meta.conditions.map(c => `<option ${item?.condition_status===c?'selected':''}>${c}</option>`).join('')}</select></div>
        ${isEdit ? `<div class="form-row"><label>Status *</label><select name="status" required>${meta.statuses.map(c => `<option ${item?.status===c?'selected':''}>${c}</option>`).join('')}</select></div>` : ''}
        <div class="form-row"><label>Verification Status</label><select name="verification_status">${['Needs Verification','Verified'].map(c => `<option ${item?.verification_status===c?'selected':''}>${c}</option>`).join('')}</select></div>
      </div>
      <div class="form-row"><label>Description</label><textarea name="description" rows="2">${esc(item?.description||'')}</textarea></div>
      <div id="invFormError"></div>
      <div class="modal-actions">
        <button type="button" class="btn btn-outline" id="cancelInvForm">Cancel</button>
        <button type="submit" class="btn btn-accent">${isEdit ? 'Save Changes' : 'Add Item'}</button>
      </div>
    </form>
  `);
  document.getElementById('cancelInvForm').addEventListener('click', closeModal);
  document.getElementById('invForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.target).entries());
    fd.quantity = Number(fd.quantity);
    try {
      if (isEdit) await API.put(`/api/inventory/${item.id}`, fd);
      else await API.post('/api/inventory', fd);
      closeModal();
      toast(`Inventory item ${isEdit ? 'updated' : 'added'} successfully.`, 'success');
      renderInventory();
    } catch (err) {
      document.getElementById('invFormError').innerHTML = `<div class="alert alert-error">${esc(err.message)}</div>`;
    }
  });
}

// ---------- Calendar (simple agenda view of approved/pending bookings) ----------
async function renderCalendar() {
  const { bookings } = await API.get('/api/bookings?sort=date');
  const upcoming = bookings.filter(b => ['Approved','Pending'].includes(b.status)).sort((a,b) => a.booking_date.localeCompare(b.booking_date));
  const byDate = {};
  upcoming.forEach(b => { (byDate[b.booking_date] = byDate[b.booking_date] || []).push(b); });
  const dates = Object.keys(byDate).sort();

  document.getElementById('content').innerHTML = `
    <div class="panel">
      <h3 class="mt-0">Upcoming & Pending Bookings</h3>
      ${dates.length === 0 ? '<div class="empty-state">No upcoming bookings.</div>' : dates.map(d => `
        <div style="margin-bottom:18px;">
          <div style="font-weight:700; color:var(--navy); margin-bottom:6px;">${fmtDate(d)}</div>
          <div class="table-wrap"><table>
            <thead><tr><th>Time</th><th>Requester</th><th>Purpose</th><th>Status</th></tr></thead>
            <tbody>${byDate[d].map(b => `<tr><td>${esc(b.start_time)}–${esc(b.end_time)}</td><td>${esc(b.full_name)}</td><td>${esc(b.purpose)}</td><td>${badge(b.status, statusBadgeClass(b.status))}</td></tr>`).join('')}</tbody>
          </table></div>
        </div>
      `).join('')}
    </div>
  `;
}

// ---------- Notifications ----------
async function renderNotifications() {
  const { notifications } = await API.get('/api/notifications');
  state.notifications = notifications;
  document.getElementById('content').innerHTML = `
    <div class="panel-header"><h3 class="mt-0">Notifications</h3><button class="btn btn-outline btn-sm" id="markAllRead">Mark all as read</button></div>
    <div class="panel">
      ${notifications.length === 0 ? '<div class="empty-state">No notifications yet.</div>' : notifications.map(n => `
        <div style="padding:12px 0; border-bottom:1px solid var(--border); ${n.read_status ? '' : 'background:#fbfdff;'}">
          <div class="flex gap-8" style="justify-content:space-between;">
            <strong style="color:var(--navy); font-size:14px;">${!n.read_status ? '<span class="notif-dot"></span> ' : ''}${esc(n.title)}</strong>
            <span class="text-muted" style="font-size:12px;">${fmtDateTime(n.created_at)}</span>
          </div>
          <div style="font-size:13.5px; margin-top:4px;">${esc(n.message)}</div>
        </div>
      `).join('')}
    </div>
  `;
  document.getElementById('markAllRead').addEventListener('click', async () => {
    await API.put('/api/notifications/read-all');
    renderNotifications();
    updateNotifCount();
  });
}

// ---------- Reports ----------
async function renderReports() {
  const [{ mostBorrowed }] = await Promise.all([API.get('/api/reports/most-borrowed')]);
  document.getElementById('content').innerHTML = `
    <div class="panel">
      <h3 class="mt-0">Export Records</h3>
      <p class="text-muted">Download current records as CSV for use in Excel or Google Sheets.</p>
      <div class="flex gap-12" style="flex-wrap:wrap;">
        <a class="btn btn-outline" href="/api/reports/export/inventory" download>Export Inventory (CSV)</a>
        <a class="btn btn-outline" href="/api/reports/export/bookings" download>Export Bookings (CSV)</a>
        <a class="btn btn-outline" href="/api/reports/export/borrowing" download>Export Borrowing (CSV)</a>
      </div>
    </div>
    <div class="panel">
      <h3 class="mt-0">Most Frequently Borrowed Resources</h3>
      <div class="table-wrap"><table>
        <thead><tr><th>Item</th><th>Times Borrowed</th><th>Total Quantity</th></tr></thead>
        <tbody>${mostBorrowed.map(m => `<tr><td>${esc(m.item_name)}</td><td>${m.times_borrowed}</td><td>${m.total_quantity}</td></tr>`).join('') || '<tr><td colspan="3" class="text-muted">No data yet.</td></tr>'}</tbody>
      </table></div>
    </div>
    <div class="panel">
      <h3 class="mt-0">Available Report Views</h3>
      <p class="text-muted">Use the Bookings, Borrowing, and Inventory pages with search/filter to view: current inventory, borrowed resources, overdue resources, resources under repair, booking history, and borrowing history.</p>
    </div>
  `;
}

// ---------- Audit Logs ----------
async function renderAudit() {
  const { logs } = await API.get('/api/audit-logs');
  document.getElementById('content').innerHTML = `
    <div class="panel">
      <h3 class="mt-0">Audit Log</h3>
      <div class="table-wrap"><table>
        <thead><tr><th>Date/Time</th><th>User</th><th>Action</th><th>Entity</th><th>Result</th><th>Details</th></tr></thead>
        <tbody>${logs.map(l => `<tr><td>${fmtDateTime(l.timestamp)}</td><td>${esc(l.user_label)}</td><td>${esc(l.action)}</td><td>${esc(l.entity_type||'')} ${esc(l.entity_id||'')}</td><td>${l.result === 'success' ? badge('OK','available') : badge('FAILED','overdue')}</td><td>${esc(l.details||'')}</td></tr>`).join('') || '<tr><td colspan="6" class="text-muted">No audit records yet.</td></tr>'}</tbody>
      </table></div>
    </div>
  `;
}

// ---------- Settings / Users ----------
async function renderSettings() {
  const { users } = await API.get('/api/users');
  document.getElementById('content').innerHTML = `
    <div class="panel-header"><h3 class="mt-0">User Accounts</h3><button class="btn btn-accent" id="newUserBtn">+ Add User</button></div>
    <div class="panel">
      <div class="table-wrap"><table>
        <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>${users.map(u => `
          <tr>
            <td>${esc(u.name)}</td><td>${esc(u.email)}</td><td>${esc(u.role)}</td>
            <td>${badge(u.status, u.status === 'active' ? 'active' : 'disabled')}</td>
            <td>${u.id === state.user.id ? '<span class="text-muted">Current user</span>' : `<button class="btn btn-sm btn-outline" data-toggle-user="${u.id}" data-current="${u.status}">${u.status === 'active' ? 'Disable' : 'Enable'}</button>`}</td>
          </tr>`).join('')}</tbody>
      </table></div>
    </div>
  `;
  document.getElementById('newUserBtn').addEventListener('click', showUserForm);
  document.querySelectorAll('[data-toggle-user]').forEach(btn => btn.addEventListener('click', async () => {
    const newStatus = btn.dataset.current === 'active' ? 'disabled' : 'active';
    try { await API.put(`/api/users/${btn.dataset.toggleUser}/status`, { status: newStatus }); toast('User updated.', 'success'); renderSettings(); }
    catch (e) { toast(e.message, 'error'); }
  }));
}

function showUserForm() {
  openModal(`
    <h3>Add User</h3>
    <form id="userForm">
      <div class="form-row"><label>Full Name *</label><input name="name" required></div>
      <div class="form-row"><label>Email *</label><input type="email" name="email" required></div>
      <div class="form-row"><label>Temporary Password *</label><input type="password" name="password" required minlength="8"><div class="hint">Minimum 8 characters. Share securely; user should change it after first login.</div></div>
      <div class="form-row"><label>Role *</label><select name="role" required><option value="staff">Staff</option><option value="alumni">Alumni</option><option value="admin">Administrator</option></select></div>
      <div id="userFormError"></div>
      <div class="modal-actions">
        <button type="button" class="btn btn-outline" id="cancelUserForm">Cancel</button>
        <button type="submit" class="btn btn-accent">Create User</button>
      </div>
    </form>
  `);
  document.getElementById('cancelUserForm').addEventListener('click', closeModal);
  document.getElementById('userForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.target).entries());
    try {
      await API.post('/api/users', fd);
      closeModal();
      toast('User created successfully.', 'success');
      renderSettings();
    } catch (err) {
      document.getElementById('userFormError').innerHTML = `<div class="alert alert-error">${esc(err.message)}</div>`;
    }
  });
}

bootstrap();
