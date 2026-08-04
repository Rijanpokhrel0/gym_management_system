/**
 * ==========================================================================
 * FITPULSE GYM MANAGEMENT SYSTEM - FRONTEND LOGIC (PHP + MySQL Backend)
 * Author: Rijan Pokhrel
 * Description:
 *   - All data is read/written through the PHP REST API (api/ folder).
 *   - Auth uses PHP sessions (httpOnly cookies) on the MySQL users table.
 *   - Role-based UI: Admin (verification / members / classes / payments /
 *     overview), Member (trainer catalog + bookings), Trainer (portal).
 * ==========================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
  // ------------------------------------------------------------------------
  // 0. PROTOCOL GUARD
  // The PHP API only works over HTTP(S). If the file is opened directly from
  // disk (file://), show a clear message instead of a broken login screen.
  // ------------------------------------------------------------------------
  if (window.location.protocol !== 'http:' && window.location.protocol !== 'https:') {
    const screen = document.getElementById('auth-screen');
    if (screen) {
      screen.innerHTML = `
        <div class="auth-card" style="max-width:520px;padding:28px;text-align:center">
          <div class="auth-logo"><i class="fa-solid fa-triangle-exclamation"></i></div>
          <h2 style="margin:12px 0 10px">Cannot connect to the backend</h2>
          <p style="color:var(--text-muted);margin-bottom:18px;line-height:1.6">
            This page must be opened through a web server.<br>
            Start <strong>Apache</strong> and <strong>MySQL</strong> in XAMPP,
            then open <strong>http://localhost/gym/</strong> in your browser.
          </p>
          <a class="btn btn-primary" href="http://localhost/gym/" style="text-decoration:none;display:inline-flex">
            Open FitPulse
          </a>
        </div>`;
    }
    return;
  }

  // ------------------------------------------------------------------------
  // 1. CONFIGURATION
  // ------------------------------------------------------------------------
  const API_BASE = window.location.pathname.replace(/index\.html$/i, '').replace(/\/+$/, '') + '/api';
  const ROLE_LABELS = { admin: 'System Admin', user: 'Member / User', trainer: 'Trainer' };
  const SHIFT_OPTIONS = [
    'Morning Shift (06:00 AM - 10:00 AM)',
    'Afternoon Shift (12:00 PM - 04:00 PM)',
    'Evening Shift (05:00 PM - 09:00 PM)'
  ];

  // ------------------------------------------------------------------------
  // 2. UI STATE
  // ------------------------------------------------------------------------
  let session = null;        // { id, name, email, role, goal, created_at }
  let trainer = null;        // trainer profile when signed in as trainer
  let activeRole = 'admin';  // role currently previewed in the UI
  let activeTab = 'admin-verification';
  let catalogQuery = '';
  let memberQuery = '';
  let memberStatus = 'all';
  let memberPlan = 'all';
  let paymentQuery = '';

  // Lightweight cache of the latest server responses (powers modals).
  const cache = { trainers: [], members: [], classes: [], payments: [], bookings: [] };

  // ------------------------------------------------------------------------
  // 3. API HELPER
  // ------------------------------------------------------------------------
  async function api(url, options = {}) {
    const res = await fetch(`${API_BASE}/${url}`, {
      method: options.method || 'GET',
      headers: { 'Content-Type': 'application/json' },
      body: options.body ? JSON.stringify(options.body) : undefined,
      credentials: 'same-origin'
    });
    let data = null;
    const text = await res.text();
    try { data = text ? JSON.parse(text) : null; } catch (e) { data = null; }
    if (!res.ok || !data || typeof data.ok !== 'boolean') {
      const err = new Error(
        data && data.message
          ? data.message
          : res.ok
            ? 'Backend not responding. Serve this app through XAMPP Apache (http://localhost/gym/) — static live servers cannot run PHP.'
            : `Request failed (${res.status})`
      );
      err.status = res.status;
      throw err;
    }
    return data;
  }

  // ------------------------------------------------------------------------
  // 4. DOM ELEMENT REFERENCES
  // ------------------------------------------------------------------------
  const el = {
    sidebar: document.getElementById('sidebar'),
    menuToggle: document.getElementById('menu-toggle'),
    sidebarMenu: document.getElementById('sidebar-menu-list'),
    currentUserAvatar: document.getElementById('current-user-avatar'),
    currentUserName: document.getElementById('current-user-name'),
    currentUserRole: document.getElementById('current-user-role-label'),
    roleBadge: document.getElementById('role-badge-display'),
    btnLogout: document.getElementById('btn-logout'),
    roleSelector: document.getElementById('role-selector'),
    globalSearch: document.getElementById('global-search'),
    toastContainer: document.getElementById('toast-container'),

    pendingCountBadge: document.getElementById('pending-verification-count-badge'),
    pendingTbody: document.getElementById('pending-trainers-tbody'),
    approvedTbody: document.getElementById('approved-trainers-tbody'),

    trainersGrid: document.getElementById('trainers-catalog-grid'),
    bookingBanner: document.getElementById('user-booking-status-card'),
    userBookingsList: document.getElementById('user-bookings-list'),

    trainerStatusBanner: document.getElementById('trainer-status-banner'),
    trainerShiftList: document.getElementById('trainer-shift-list'),
    trainerClientsList: document.getElementById('trainer-clients-list'),

    statUsers: document.getElementById('stat-total-users'),
    statApproved: document.getElementById('stat-approved-trainers'),
    statPending: document.getElementById('stat-pending-trainers'),
    statBookings: document.getElementById('stat-booked-shifts'),

    membersTableTbody: document.getElementById('members-table-tbody'),
    memberSearchInput: document.getElementById('member-search-input'),
    memberStatusFilter: document.getElementById('member-status-filter'),
    memberPlanFilter: document.getElementById('member-plan-filter'),
    btnAddMember: document.getElementById('btn-add-member'),

    classesCardsGrid: document.getElementById('classes-cards-grid'),
    btnAddClass: document.getElementById('btn-add-class'),

    paymentsTableTbody: document.getElementById('payments-table-tbody'),
    paymentSearchInput: document.getElementById('payment-search-input'),
    btnAddPayment: document.getElementById('btn-add-payment'),
    inputPayMember: document.getElementById('input-pay-member'),

    modalBook: document.getElementById('modal-book-trainer'),
    modalMember: document.getElementById('modal-member'),
    modalClass: document.getElementById('modal-class'),
    modalPayment: document.getElementById('modal-payment'),

    bookTrainerId: document.getElementById('book-trainer-id'),
    bookSummary: document.getElementById('book-trainer-summary-box'),
    bookShiftSelect: document.getElementById('select-trainer-shift'),
    bookNotes: document.getElementById('book-notes'),

    formLogin: document.getElementById('form-login'),
    formUserRegister: document.getElementById('form-user-register'),
    formTrainerRegister: document.getElementById('form-trainer-register'),
    formBookTrainer: document.getElementById('form-book-trainer'),
    formMember: document.getElementById('form-member'),
    formClass: document.getElementById('form-class'),
    formPayment: document.getElementById('form-payment')
  };

  // ------------------------------------------------------------------------
  // 5. HELPER UTILITIES
  // ------------------------------------------------------------------------
  function todayStr() {
    return new Date().toISOString().split('T')[0];
  }

  function getInitials(name) {
    if (!name) return 'GU';
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  }

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/[&<>"']/g, match => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[match]));
  }

  function showModal(modalId) {
    const m = document.getElementById(modalId);
    if (m) m.classList.add('active');
  }

  function hideModal(modalId) {
    const m = document.getElementById(modalId);
    if (m) m.classList.remove('active');
  }

  function showToast(message, type = 'info') {
    if (!el.toastContainer) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const icon = type === 'success' ? 'fa-circle-check' : type === 'error' ? 'fa-circle-xmark' : 'fa-circle-info';
    toast.innerHTML = `<i class="fa-solid ${icon}"></i><span>${escapeHtml(message)}</span>`;
    el.toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(50px)';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  function emptyRow(icon, text, cols) {
    return `<tr><td colspan="${cols}" class="text-center" style="padding:40px;text-align:center;color:var(--text-muted);">
      <i class="fa-solid ${icon}" style="font-size:2rem;margin-bottom:10px;display:block;"></i>${escapeHtml(text)}
    </td></tr>`;
  }

  function emptyState(icon, text) {
    return `<div class="empty-state"><i class="fa-solid ${icon}"></i><p>${escapeHtml(text)}</p></div>`;
  }

  function isAdmin() {
    return !!(session && session.role === 'admin');
  }

  function isUser() {
    return !!(session && session.role === 'user');
  }

  function isTrainer() {
    return !!(session && session.role === 'trainer');
  }

  // ------------------------------------------------------------------------
  // 6. NAVIGATION: SIDEBAR MENU, ROLE SELECTOR, TAB SWITCHING
  // ------------------------------------------------------------------------
  const ROLE_NAV = {
    admin: [
      { tab: 'admin-verification', icon: 'fa-user-clock', label: 'Trainer Verification' },
      { tab: 'admin-members', icon: 'fa-users', label: 'Members Directory' },
      { tab: 'admin-classes', icon: 'fa-dumbbell', label: 'Class Schedule' },
      { tab: 'admin-payments', icon: 'fa-money-check-dollar', label: 'Payments' },
      { tab: 'admin-overview', icon: 'fa-chart-line', label: 'System Overview' }
    ],
    user: [
      { tab: 'user-trainers', icon: 'fa-dumbbell', label: 'Find Trainers' },
      { tab: 'user-bookings', icon: 'fa-calendar-check', label: 'My Bookings' }
    ],
    trainer: [
      { tab: 'trainer-portal', icon: 'fa-user-ninja', label: 'My Trainer Portal' }
    ]
  };

  function defaultTabForRole(role) {
    if (role === 'user') return 'user-trainers';
    if (role === 'trainer') return 'trainer-portal';
    return 'admin-verification';
  }

  function buildSidebarMenu(role) {
    const items = ROLE_NAV[role] || ROLE_NAV.admin;
    el.sidebarMenu.innerHTML = items.map(item => `
      <li>
        <a href="#" class="nav-item ${item.tab === activeTab ? 'active' : ''}" data-tab="${item.tab}">
          <i class="fa-solid ${item.icon}"></i>
          <span>${item.label}</span>
        </a>
      </li>
    `).join('');

    el.sidebarMenu.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        switchTab(item.getAttribute('data-tab'));
        if (window.innerWidth <= 768) el.sidebar.classList.remove('show');
      });
    });
  }

  function switchTab(tabId) {
    activeTab = tabId;
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    const target = document.getElementById(`tab-${tabId}`);
    if (target) target.classList.add('active');
    el.sidebarMenu.querySelectorAll('.nav-item').forEach(n => {
      n.classList.toggle('active', n.getAttribute('data-tab') === tabId);
    });
  }

  // ------------------------------------------------------------------------
  // 7. SESSION UI
  // ------------------------------------------------------------------------
  function updateSessionUI() {
    if (session) {
      el.currentUserName.textContent = session.name;
      el.currentUserRole.textContent = ROLE_LABELS[session.role];
      el.roleBadge.textContent = `${ROLE_LABELS[session.role]} Portal`;
      el.currentUserAvatar.innerHTML = '';
      el.currentUserAvatar.textContent = getInitials(session.name);
      el.btnLogout.style.display = 'inline-flex';
    } else {
      el.currentUserName.textContent = 'Guest';
      el.currentUserRole.textContent = 'Not signed in';
      el.roleBadge.textContent = 'Sign in to continue';
      el.currentUserAvatar.innerHTML = '';
      el.currentUserAvatar.textContent = 'GU';
      el.btnLogout.style.display = 'none';
    }
    el.roleSelector.value = activeRole;
    buildSidebarMenu(activeRole);
  }

  // Show the app (hide the login screen) or go back to the login screen.
  function enterApp() {
    document.body.classList.add('authed');
    if (el.globalSearch) el.globalSearch.value = '';
  }

  function exitApp() {
    document.body.classList.remove('authed');
  }

  // ------------------------------------------------------------------------
  // 8. AUTH FLOWS
  // ------------------------------------------------------------------------
  function applySession(data) {
    session = data.user || null;
    trainer = data.trainer || null;
    activeRole = session ? session.role : 'admin';
    updateSessionUI();
    enterApp();
    switchTab(defaultTabForRole(activeRole));
  }

  function setAuthBtn(form, loading) {
    const btn = form && form.querySelector('.btn-primary');
    if (!btn) return;
    if (loading) {
      btn.dataset.orig = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Please wait...';
    } else {
      btn.disabled = false;
      if (btn.dataset.orig) btn.innerHTML = btn.dataset.orig;
    }
  }

  async function submitLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const portal = document.getElementById('login-role').value;
    if (!email || !password) {
      showToast('Please enter your email and password.', 'error');
      document.getElementById(email ? 'login-password' : 'login-email').focus();
      return;
    }
    setAuthBtn(el.formLogin, true);
    try {
      const data = await api('auth/login.php', { method: 'POST', body: { email, password, portal } });
      applySession(data);
      await renderAll();
      showToast(`Welcome, ${session.name.split(' ')[0]}! Signed in as ${ROLE_LABELS[session.role]}.`, 'success');
    } catch (err) {
      showToast(err.message || 'Login failed. Please try again.', 'error');
    } finally {
      setAuthBtn(el.formLogin, false);
    }
  }

  async function submitUserRegister(e) {
    e.preventDefault();
    const body = {
      type: 'user',
      name: document.getElementById('user-reg-name').value.trim(),
      email: document.getElementById('user-reg-email').value.trim(),
      password: document.getElementById('user-reg-password').value,
      goal: document.getElementById('user-reg-goal').value
    };
    if (!body.name || !body.email || !body.password) {
      showToast('Please fill in your name, email and password.', 'error');
      return;
    }
    if (body.password.length < 6) {
      showToast('Password must be at least 6 characters long.', 'error');
      return;
    }
    setAuthBtn(el.formUserRegister, true);
    try {
      const data = await api('auth/register.php', { method: 'POST', body });
      showToast(data.message, 'success');
      switchAuthTab('login');
      document.getElementById('login-email').value = body.email;
      document.getElementById('login-password').value = '';
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setAuthBtn(el.formUserRegister, false);
    }
  }

  async function submitTrainerRegister(e) {
    e.preventDefault();
    const body = {
      type: 'trainer',
      name: document.getElementById('trainer-reg-name').value.trim(),
      email: document.getElementById('trainer-reg-email').value.trim(),
      password: document.getElementById('trainer-reg-password').value,
      specialization: document.getElementById('trainer-reg-spec').value.trim(),
      experience: parseInt(document.getElementById('trainer-reg-exp').value, 10) || 0,
      shift: document.getElementById('trainer-reg-shift').value
    };
    if (!body.name || !body.email || !body.password || !body.specialization || !body.shift) {
      showToast('Please fill in all required fields.', 'error');
      return;
    }
    if (body.password.length < 6) {
      showToast('Password must be at least 6 characters long.', 'error');
      return;
    }
    setAuthBtn(el.formTrainerRegister, true);
    try {
      const data = await api('auth/register.php', { method: 'POST', body });
      showToast(data.message, 'success');
      switchAuthTab('login');
      document.getElementById('login-email').value = body.email;
      document.getElementById('login-password').value = '';
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setAuthBtn(el.formTrainerRegister, false);
    }
  }

  async function logout() {
    try { await api('auth/logout.php', { method: 'POST' }); } catch (e) { /* ignore */ }
    session = null;
    trainer = null;
    activeRole = 'admin';
    catalogQuery = '';
    memberQuery = '';
    paymentQuery = '';
    if (el.globalSearch) el.globalSearch.value = '';
    updateSessionUI();
    exitApp();
    switchAuthTab('login');
    showToast('Signed out successfully.', 'info');
  }

  function switchAuthTab(mode) {
    const forms = {
      login: el.formLogin,
      'user-register': el.formUserRegister,
      'trainer-register': el.formTrainerRegister
    };
    document.querySelectorAll('.auth-tab-btn').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-auth-mode') === mode);
    });
    Object.entries(forms).forEach(([key, form]) => {
      if (form) form.classList.toggle('active', key === mode);
    });
  }

  async function loadSession() {
    try {
      const data = await api('auth/me.php');
      session = data.user || null;
      trainer = data.trainer || null;
    } catch (err) {
      session = null;
      trainer = null;
      showToast(err.message || 'Cannot reach the backend.', 'error');
      const box = document.getElementById('backend-error-box');
      if (box) box.style.display = 'flex';
    }
    activeRole = session ? session.role : 'admin';
    updateSessionUI();
    if (session) {
      enterApp();
      switchTab(defaultTabForRole(activeRole));
    } else {
      exitApp();
    }
  }

  // ------------------------------------------------------------------------
  // 9. ADMIN VIEWS: TRAINER VERIFICATION
  // ------------------------------------------------------------------------
  async function renderAdminTrainers() {
    if (!el.pendingTbody && !el.approvedTbody) return;

    if (!isAdmin()) {
      const msg = 'Sign in as an admin to review trainer applications.';
      if (el.pendingTbody) el.pendingTbody.innerHTML = emptyRow('fa-user-clock', msg, 7);
      if (el.approvedTbody) el.approvedTbody.innerHTML = emptyRow('fa-user-check', msg, 6);
      if (el.pendingCountBadge) el.pendingCountBadge.textContent = '0 Pending Approvals';
      return;
    }

    try {
      const data = await api('trainers.php');
      cache.trainers = data.trainers || [];
      const pending = cache.trainers.filter(t => t.status === 'pending');
      const approved = cache.trainers.filter(t => t.status === 'approved');

      if (el.pendingCountBadge) {
        el.pendingCountBadge.textContent = `${pending.length} Pending Approval${pending.length === 1 ? '' : 's'}`;
      }

      el.pendingTbody.innerHTML = pending.length
        ? pending.map(t => `
            <tr>
              <td>
                <div class="member-cell">
                  <div class="avatar-chip">${getInitials(t.name)}</div>
                  <div>
                    <strong>${escapeHtml(t.name)}</strong>
                    <div class="text-muted text-sm">${escapeHtml(t.email)}</div>
                  </div>
                </div>
              </td>
              <td>${escapeHtml(t.specialization)}</td>
              <td>${t.experience} yrs</td>
              <td>${t.shifts.map(s => `<span class="shift-tag">${escapeHtml(s)}</span>`).join('')}</td>
              <td><span class="badge badge-amber"><i class="fa-solid fa-clock" style="font-size:8px;margin-right:4px;"></i> Pending</span></td>
              <td>${t.registered_at || '-'}</td>
              <td class="text-right">
                <div class="action-buttons">
                  <button class="btn btn-approve btn-sm" onclick="window.approveTrainer(${t.id})"><i class="fa-solid fa-check"></i> Approve</button>
                  <button class="btn btn-reject btn-sm" onclick="window.rejectTrainer(${t.id})"><i class="fa-solid fa-xmark"></i> Reject</button>
                </div>
              </td>
            </tr>
          `).join('')
        : emptyRow('fa-circle-check', 'No pending trainer applications. All caught up!', 7);

      el.approvedTbody.innerHTML = approved.length
        ? approved.map(t => {
            const assigned = cache.bookings.filter(b => b.trainer_id === t.id).length;
            return `
            <tr>
              <td>
                <div class="member-cell">
                  <div class="avatar-chip">${getInitials(t.name)}</div>
                  <div>
                    <strong>${escapeHtml(t.name)}</strong>
                    <div class="text-muted text-sm">${escapeHtml(t.specialization)}</div>
                  </div>
                </div>
              </td>
              <td>${escapeHtml(t.specialization)}</td>
              <td><span class="badge badge-indigo">${assigned} members</span></td>
              <td>${t.shifts.length} active</td>
              <td><span class="badge badge-emerald"><i class="fa-solid fa-circle" style="font-size:6px;margin-right:4px;"></i> Verified</span></td>
              <td class="text-right">
                <button class="btn btn-outline btn-sm" onclick="window.fitPulseApp.showToast('Managing ${escapeHtml(t.name)}...', 'info')">
                  <i class="fa-solid fa-gear"></i> Manage
                </button>
              </td>
            </tr>
          `;
          }).join('')
        : emptyRow('fa-user-check', 'No approved trainers yet. Approve pending applications to publish them.', 6);
    } catch (err) {
      el.pendingTbody.innerHTML = emptyRow('fa-triangle-exclamation', err.message, 7);
      el.approvedTbody.innerHTML = emptyRow('fa-triangle-exclamation', err.message, 6);
    }
  }

  window.approveTrainer = async function (id) {
    if (!isAdmin()) { showToast('Only a signed-in System Admin can verify trainers.', 'error'); return; }
    try {
      const data = await api('trainers.php', { method: 'POST', body: { id, action: 'approve' } });
      showToast(data.message, 'success');
      await Promise.all([renderAdminTrainers(), renderTrainerCatalog(), renderMetrics()]);
    } catch (err) { showToast(err.message, 'error'); }
  };

  window.rejectTrainer = async function (id) {
    if (!isAdmin()) { showToast('Only a signed-in System Admin can verify trainers.', 'error'); return; }
    try {
      const data = await api('trainers.php', { method: 'POST', body: { id, action: 'reject' } });
      showToast(data.message, 'info');
      await Promise.all([renderAdminTrainers(), renderTrainerCatalog(), renderMetrics()]);
    } catch (err) { showToast(err.message, 'error'); }
  };

  // ------------------------------------------------------------------------
  // 10. MEMBER / USER VIEWS
  // ------------------------------------------------------------------------
  async function renderTrainerCatalog() {
    if (!el.trainersGrid) return;
    try {
      const data = await api('trainers.php');
      cache.trainers = data.trainers || [];
      const approved = cache.trainers.filter(t =>
        !catalogQuery || t.name.toLowerCase().includes(catalogQuery) || t.specialization.toLowerCase().includes(catalogQuery)
      );

      if (!approved.length) {
        el.trainersGrid.innerHTML = `<div style="grid-column:1 / -1;padding:40px;text-align:center;color:var(--text-muted);background:white;border-radius:var(--radius-lg);border:1px solid var(--border-color);">
          <i class="fa-solid fa-dumbbell" style="font-size:2rem;margin-bottom:10px;display:block;"></i>
          No verified trainers${catalogQuery ? ' matching your search' : ''} yet. Check back soon!
        </div>`;
        return;
      }

      el.trainersGrid.innerHTML = approved.map(t => `
        <div class="trainer-card">
          <div>
            <div class="trainer-header">
              <div class="trainer-avatar">${getInitials(t.name)}</div>
              <div class="trainer-info">
                <h4>${escapeHtml(t.name)}</h4>
                <div class="trainer-spec">${escapeHtml(t.specialization)}</div>
                <div class="text-muted text-sm"><i class="fa-solid fa-briefcase"></i> ${t.experience} yrs experience</div>
              </div>
            </div>
            <div class="trainer-shifts-list">
              ${t.shifts.map(s => `<span class="shift-tag"><i class="fa-regular fa-clock"></i> ${escapeHtml(s)}</span>`).join('')}
            </div>
          </div>
          <button class="btn btn-primary" onclick="window.openBookTrainer(${t.id})">
            <i class="fa-solid fa-calendar-plus"></i> Select This Trainer
          </button>
        </div>
      `).join('');
    } catch (err) {
      el.trainersGrid.innerHTML = `<div style="grid-column:1 / -1;padding:40px;text-align:center;color:var(--text-muted);">
        <i class="fa-solid fa-triangle-exclamation" style="font-size:2rem;margin-bottom:10px;display:block;"></i>${escapeHtml(err.message)}
      </div>`;
    }
  }

  async function renderUserBookings() {
    if (!el.bookingBanner && !el.userBookingsList) return;

    if (!session) {
      if (el.bookingBanner) {
        el.bookingBanner.innerHTML = `
          <h3><i class="fa-solid fa-lock"></i> Member Booking Area</h3>
          <p style="opacity:0.9">Sign in with your member account to book a verified trainer and reserve your shift.</p>`;
      }
      if (el.userBookingsList) el.userBookingsList.innerHTML = emptyState('fa-lock', 'Sign in as a member to view your bookings.');
      return;
    }

    try {
      const data = await api('bookings.php');
      cache.bookings = data.bookings || [];

      const latest = cache.bookings[0];
      if (el.bookingBanner) {
        if (!latest) {
          el.bookingBanner.innerHTML = `
            <h3>Hi ${escapeHtml(session.name.split(' ')[0])}, ready to train?</h3>
            <p style="opacity:0.9">Browse the verified trainer catalog below and select your preferred shift.</p>`;
        } else {
          el.bookingBanner.innerHTML = `
            <h3><i class="fa-solid fa-circle-check"></i> Current Selection</h3>
            <p style="opacity:0.9">Trainer: <strong>${escapeHtml(latest.trainer_name)}</strong> &bull; ${escapeHtml(latest.shift)}</p>`;
        }
      }

      if (el.userBookingsList) {
        el.userBookingsList.innerHTML = cache.bookings.length
          ? cache.bookings.map(b => `
              <div class="booking-item">
                <div class="booking-item-icon"><i class="fa-solid fa-user-ninja"></i></div>
                <div class="booking-item-info">
                  <strong>${escapeHtml(b.trainer_name)}</strong>
                  <div class="text-muted text-sm"><i class="fa-regular fa-clock"></i> ${escapeHtml(b.shift)}</div>
                  <div class="text-muted text-sm">Booked on ${b.booking_date}${b.notes ? ' &bull; ' + escapeHtml(b.notes) : ''}</div>
                </div>
                <span class="badge badge-emerald">Confirmed</span>
              </div>
            `).join('')
          : emptyState('fa-calendar-plus', 'You have not booked any trainer yet. Head to Find Trainers to get started.');
      }
    } catch (err) {
      if (el.bookingBanner) el.bookingBanner.innerHTML = `<h3>Booking area unavailable</h3><p style="opacity:0.9">${escapeHtml(err.message)}</p>`;
      if (el.userBookingsList) el.userBookingsList.innerHTML = emptyState('fa-triangle-exclamation', err.message);
    }
  }

  window.openBookTrainer = async function (id) {
    if (!isUser()) {
      showToast('Please log in as a member to book a trainer.', 'error');
      return;
    }
    const t = cache.trainers.find(x => x.id === id);
    if (!t) {
      try { await renderTrainerCatalog(); } catch (e) { /* ignore */ }
      return window.openBookTrainer(id);
    }

    el.bookTrainerId.value = t.id;
    el.bookSummary.innerHTML = `
      <div class="trainer-avatar">${getInitials(t.name)}</div>
      <div>
        <strong>${escapeHtml(t.name)}</strong>
        <div class="text-muted text-sm">${escapeHtml(t.specialization)}</div>
        <div class="text-muted text-sm"><i class="fa-solid fa-briefcase"></i> ${t.experience} yrs experience</div>
      </div>`;
    const shifts = t.shifts && t.shifts.length ? t.shifts : SHIFT_OPTIONS;
    el.bookShiftSelect.innerHTML = shifts.map(s => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('');
    el.bookNotes.value = '';
    showModal('modal-book-trainer');
  };

  async function submitBooking(e) {
    e.preventDefault();
    if (!isUser()) {
      showToast('Please log in as a member to book a trainer.', 'error');
      return;
    }
    try {
      const data = await api('bookings.php', {
        method: 'POST',
        body: {
          trainer_id: parseInt(el.bookTrainerId.value, 10),
          shift: el.bookShiftSelect.value,
          notes: el.bookNotes.value.trim()
        }
      });
      hideModal('modal-book-trainer');
      showToast(data.message, 'success');
      await Promise.all([renderUserBookings(), renderMetrics()]);
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  // ------------------------------------------------------------------------
  // 11. TRAINER PORTAL VIEWS
  // ------------------------------------------------------------------------
  async function renderTrainerPortal() {
    if (!el.trainerStatusBanner && !el.trainerShiftList && !el.trainerClientsList) return;

    if (!isTrainer()) {
      if (el.trainerStatusBanner) {
        el.trainerStatusBanner.innerHTML = `
          <div class="panel user-booking-banner" style="background:linear-gradient(135deg,#4338ca,#6366f1)">
            <h3><i class="fa-solid fa-user-ninja"></i> Trainer Portal</h3>
            <p style="opacity:0.9">Register as a trainer via the Trainer Register form, then get verified by an admin to access your dashboard.</p>
          </div>`;
      }
      if (el.trainerShiftList) el.trainerShiftList.innerHTML = emptyState('fa-clock', 'Login as a trainer to view your shifts.');
      if (el.trainerClientsList) el.trainerClientsList.innerHTML = emptyState('fa-users', 'Login as a trainer to view your clients.');
      return;
    }

    // Status banner
    let html = '';
    if (trainer) {
      if (trainer.status === 'approved') {
        html = `<div class="panel user-booking-banner" style="background:linear-gradient(135deg,#047857,#059669)">
          <h3><i class="fa-solid fa-circle-check"></i> Verified Trainer</h3>
          <p style="opacity:0.9">You are approved and visible in the member trainer catalog.</p></div>`;
      } else if (trainer.status === 'pending') {
        html = `<div class="panel user-booking-banner" style="background:linear-gradient(135deg,#b45309,#d97706)">
          <h3><i class="fa-solid fa-hourglass-half"></i> Awaiting Admin Verification</h3>
          <p style="opacity:0.9">Your application (${escapeHtml(trainer.specialization)}) is under review. You will be activated once approved.</p></div>`;
      } else {
        html = `<div class="panel user-booking-banner" style="background:linear-gradient(135deg,#be123c,#e11d48)">
          <h3><i class="fa-solid fa-circle-xmark"></i> Application Not Approved</h3>
          <p style="opacity:0.9">Please contact the gym admin for more details about your application.</p></div>`;
      }
    }
    if (el.trainerStatusBanner) el.trainerStatusBanner.innerHTML = html;

    try {
      const data = await api('bookings.php');
      cache.bookings = data.bookings || [];

      if (el.trainerShiftList) {
        const shifts = trainer && trainer.shifts && trainer.shifts.length ? trainer.shifts : [];
        el.trainerShiftList.innerHTML = shifts.length
          ? shifts.map(s => `
              <div class="booking-item">
                <div class="booking-item-icon"><i class="fa-regular fa-clock"></i></div>
                <div class="booking-item-info">
                  <strong>${escapeHtml(s)}</strong>
                  <div class="text-muted text-sm">Availability shift</div>
                </div>
                <span class="badge badge-indigo">Scheduled</span>
              </div>
            `).join('')
          : emptyState('fa-calendar-plus', 'No shifts assigned yet.');
      }

      if (el.trainerClientsList) {
        el.trainerClientsList.innerHTML = cache.bookings.length
          ? cache.bookings.map(c => `
              <div class="booking-item">
                <div class="booking-item-icon"><i class="fa-solid fa-user"></i></div>
                <div class="booking-item-info">
                  <strong>${escapeHtml(c.member_name)}</strong>
                  <div class="text-muted text-sm"><i class="fa-regular fa-clock"></i> ${escapeHtml(c.shift)}</div>
                  ${c.notes ? `<div class="text-muted text-sm"><i class="fa-solid fa-note-sticky"></i> ${escapeHtml(c.notes)}</div>` : ''}
                </div>
                <span class="badge badge-emerald">Client</span>
              </div>
            `).join('')
          : emptyState('fa-user-group', 'No clients assigned yet. Once members book your shifts, they appear here.');
      }
    } catch (err) {
      if (el.trainerShiftList) el.trainerShiftList.innerHTML = emptyState('fa-triangle-exclamation', err.message);
      if (el.trainerClientsList) el.trainerClientsList.innerHTML = emptyState('fa-triangle-exclamation', err.message);
    }
  }

  // ------------------------------------------------------------------------
  // 12. ADMIN VIEWS: MEMBERS DIRECTORY (CRUD)
  // ------------------------------------------------------------------------
  async function renderMembersTable() {
    if (!el.membersTableTbody) return;

    if (!isAdmin()) {
      el.membersTableTbody.innerHTML = emptyRow('fa-users', 'Sign in as an admin to manage the member directory.', 7);
      return;
    }

    try {
      const data = await api('members.php');
      cache.members = data.members || [];

      const filtered = cache.members.filter(m => {
        const q = memberQuery;
        const matchesSearch = !q || m.name.toLowerCase().includes(q) || (m.email || '').toLowerCase().includes(q) || (m.phone || '').includes(q);
        const matchesStatus = memberStatus === 'all' || m.status === memberStatus;
        const matchesPlan = memberPlan === 'all' || m.plan === memberPlan;
        return matchesSearch && matchesStatus && matchesPlan;
      });

      el.membersTableTbody.innerHTML = filtered.length
        ? filtered.map(m => `
            <tr>
              <td>
                <div class="member-cell">
                  <div class="avatar-chip">${getInitials(m.name)}</div>
                  <div>
                    <strong>${escapeHtml(m.name)}</strong>
                    <div class="text-muted text-sm">ID: #MP-${1000 + m.id}</div>
                  </div>
                </div>
              </td>
              <td>
                <div>${escapeHtml(m.email || '-')}</div>
                <div class="text-muted text-sm">${escapeHtml(m.phone || '-')}</div>
              </td>
              <td><span class="badge badge-indigo">${escapeHtml(m.plan)}</span></td>
              <td>${getStatusBadgeHtml(m.status)}</td>
              <td>${m.join_date || '-'}</td>
              <td>${m.expiry_date || '-'}</td>
              <td class="text-right">
                <div class="action-buttons">
                  <button class="action-icon-btn" title="Edit Member" onclick="window.editMember(${m.id})">
                    <i class="fa-solid fa-pen-to-square"></i>
                  </button>
                  <button class="action-icon-btn delete-btn" title="Delete Member" onclick="window.deleteMember(${m.id})">
                    <i class="fa-solid fa-trash"></i>
                  </button>
                </div>
              </td>
            </tr>
          `).join('')
        : emptyRow('fa-user-slash', 'No members matching your search filters.', 7);
    } catch (err) {
      el.membersTableTbody.innerHTML = emptyRow('fa-triangle-exclamation', err.message, 7);
    }
  }

  function openMemberModal() {
    document.getElementById('member-id').value = '';
    el.formMember.reset();
    document.getElementById('modal-member-title').textContent = 'Add New Member';
    const today = todayStr();
    document.getElementById('input-member-joindate').value = today;
    const nextYear = new Date();
    nextYear.setFullYear(nextYear.getFullYear() + 1);
    document.getElementById('input-member-expirydate').value = nextYear.toISOString().split('T')[0];
    showModal('modal-member');
  }

  window.editMember = function (id) {
    const m = cache.members.find(x => x.id === id);
    if (!m) return;
    document.getElementById('member-id').value = m.id;
    document.getElementById('input-member-name').value = m.name;
    document.getElementById('input-member-email').value = m.email || '';
    document.getElementById('input-member-phone').value = m.phone || '';
    document.getElementById('input-member-plan').value = m.plan;
    document.getElementById('input-member-status').value = m.status;
    document.getElementById('input-member-joindate').value = m.join_date || todayStr();
    document.getElementById('input-member-expirydate').value = m.expiry_date || '';
    document.getElementById('modal-member-title').textContent = 'Edit Member Profile';
    showModal('modal-member');
  };

  async function saveMember(e) {
    e.preventDefault();
    if (!isAdmin()) { showToast('Admin access required.', 'error'); return; }
    const id = document.getElementById('member-id').value;
    const body = {
      name: document.getElementById('input-member-name').value.trim(),
      email: document.getElementById('input-member-email').value.trim(),
      phone: document.getElementById('input-member-phone').value.trim(),
      plan: document.getElementById('input-member-plan').value,
      status: document.getElementById('input-member-status').value,
      join_date: document.getElementById('input-member-joindate').value,
      expiry_date: document.getElementById('input-member-expirydate').value
    };
    try {
      const data = await api('members.php', { method: id ? 'PUT' : 'POST', body: id ? { ...body, id: parseInt(id, 10) } : body });
      hideModal('modal-member');
      showToast(data.message, 'success');
      await renderMembersTable();
      await populatePaymentMemberSelect();
    } catch (err) { showToast(err.message, 'error'); }
  }

  window.deleteMember = async function (id) {
    if (!isAdmin()) { showToast('Admin access required.', 'error'); return; }
    const m = cache.members.find(x => x.id === id);
    if (!confirm(`Are you sure you want to delete member ${m ? m.name : ''}?`)) return;
    try {
      const data = await api(`members.php?id=${id}`, { method: 'DELETE' });
      showToast(data.message, 'info');
      await renderMembersTable();
      await populatePaymentMemberSelect();
    } catch (err) { showToast(err.message, 'error'); }
  };

  // ------------------------------------------------------------------------
  // 13. ADMIN VIEWS: CLASS SCHEDULE
  // ------------------------------------------------------------------------
  async function renderClassesGrid() {
    if (!el.classesCardsGrid) return;
    try {
      const data = await api('classes.php');
      cache.classes = data.classes || [];

      if (!cache.classes.length) {
        el.classesCardsGrid.innerHTML = `<div class="class-card" style="grid-column:1 / -1;border-style:dashed;text-align:center;color:var(--text-muted);">
          <i class="fa-solid fa-calendar-xmark" style="font-size:2rem;margin-bottom:10px;display:block;"></i>
          No classes scheduled yet.${isAdmin() ? ' Use "Schedule Class" to add one.' : ''}
        </div>`;
        return;
      }

      el.classesCardsGrid.innerHTML = cache.classes.map(c => `
        <div class="class-card">
          <div class="class-card-header">
            <span class="class-category">${escapeHtml(c.category)}</span>
            <span class="badge badge-indigo">${escapeHtml(c.day)}</span>
          </div>
          <h3 class="class-card-title">${escapeHtml(c.title)}</h3>
          <div class="class-info-item"><i class="fa-regular fa-clock"></i> ${escapeHtml(c.time)}</div>
          <div class="class-info-item"><i class="fa-solid fa-user-ninja"></i> Trainer: <strong>${escapeHtml(c.trainer || '-')}</strong></div>
          <div class="class-capacity-bar">
            <span class="text-muted text-sm"><i class="fa-solid fa-users"></i> ${c.booked} / ${c.capacity} Booked</span>
            ${isAdmin()
              ? `<button class="btn btn-outline btn-sm" onclick="window.deleteClass(${c.id}, '${escapeHtml(c.title)}')"><i class="fa-solid fa-trash"></i> Delete</button>`
              : `<span class="text-muted text-sm">Class open for booking</span>`}
          </div>
        </div>
      `).join('');
    } catch (err) {
      el.classesCardsGrid.innerHTML = `<div style="grid-column:1 / -1;padding:40px;text-align:center;color:var(--text-muted);">${escapeHtml(err.message)}</div>`;
    }
  }

  async function saveClass(e) {
    e.preventDefault();
    if (!isAdmin()) { showToast('Admin access required.', 'error'); return; }
    const body = {
      title: document.getElementById('input-class-name').value.trim(),
      trainer: document.getElementById('input-class-trainer').value.trim(),
      day: document.getElementById('input-class-day').value,
      time: document.getElementById('input-class-time').value.trim(),
      capacity: parseInt(document.getElementById('input-class-capacity').value, 10) || 20,
      category: document.getElementById('input-class-category').value
    };
    try {
      const data = await api('classes.php', { method: 'POST', body });
      hideModal('modal-class');
      showToast(data.message, 'success');
      await renderClassesGrid();
    } catch (err) { showToast(err.message, 'error'); }
  }

  window.deleteClass = async function (id, title) {
    if (!isAdmin()) { showToast('Admin access required.', 'error'); return; }
    if (!confirm(`Delete the class "${title}"?`)) return;
    try {
      const data = await api(`classes.php?id=${id}`, { method: 'DELETE' });
      showToast(data.message, 'info');
      await renderClassesGrid();
    } catch (err) { showToast(err.message, 'error'); }
  };

  // ------------------------------------------------------------------------
  // 14. ADMIN VIEWS: PAYMENTS
  // ------------------------------------------------------------------------
  async function renderPaymentsTable() {
    if (!el.paymentsTableTbody) return;

    if (!isAdmin()) {
      el.paymentsTableTbody.innerHTML = emptyRow('fa-money-check-dollar', 'Sign in as an admin to view payment history.', 7);
      return;
    }

    try {
      const data = await api('payments.php');
      cache.payments = data.payments || [];

      const filtered = cache.payments.filter(p =>
        !paymentQuery || p.invoice_no.toLowerCase().includes(paymentQuery) ||
        p.member.toLowerCase().includes(paymentQuery) || p.plan.toLowerCase().includes(paymentQuery)
      );

      el.paymentsTableTbody.innerHTML = filtered.length
        ? filtered.map(p => `
            <tr>
              <td><strong>${escapeHtml(p.invoice_no)}</strong></td>
              <td>${escapeHtml(p.member)}</td>
              <td>${escapeHtml(p.plan)}</td>
              <td><strong>${Number(p.amount).toLocaleString()} NPR</strong></td>
              <td>${escapeHtml(p.method)}</td>
              <td>${p.payment_date || '-'}</td>
              <td>${getPaymentStatusBadge(p.status)}</td>
            </tr>
          `).join('')
        : emptyRow('fa-file-invoice-dollar', 'No payments found matching your search.', 7);
    } catch (err) {
      el.paymentsTableTbody.innerHTML = emptyRow('fa-triangle-exclamation', err.message, 7);
    }
  }

  async function populatePaymentMemberSelect() {
    if (!el.inputPayMember) return;
    try {
      const data = await api('members.php');
      cache.members = data.members || [];
      el.inputPayMember.innerHTML = cache.members.map(m =>
        `<option value="${escapeHtml(m.name)}">${escapeHtml(m.name)}</option>`
      ).join('');
    } catch (err) { /* ignored */ }
  }

  async function savePayment(e) {
    e.preventDefault();
    if (!isAdmin()) { showToast('Admin access required.', 'error'); return; }
    const body = {
      member: el.inputPayMember.value,
      plan: document.getElementById('input-pay-plan').value.trim() || 'Membership Fee',
      amount: parseFloat(document.getElementById('input-pay-amount').value) || 0,
      method: document.getElementById('input-pay-method').value,
      status: document.getElementById('input-pay-status').value
    };
    try {
      const data = await api('payments.php', { method: 'POST', body });
      hideModal('modal-payment');
      showToast(data.message, 'success');
      await renderPaymentsTable();
    } catch (err) { showToast(err.message, 'error'); }
  }

  // ------------------------------------------------------------------------
  // 15. SYSTEM METRICS OVERVIEW
  // ------------------------------------------------------------------------
  async function renderMetrics() {
    const ids = [el.statUsers, el.statApproved, el.statPending, el.statBookings];
    ids.forEach(x => { if (x) x.textContent = '-'; });
    if (!session) return;

    try {
      const data = await api('metrics.php');
      const m = data.metrics || {};
      if (el.statUsers) el.statUsers.textContent = m.users ?? '-';
      if (el.statApproved) el.statApproved.textContent = m.approvedTrainers ?? '-';
      if (el.statPending) el.statPending.textContent = m.pendingTrainers ?? '-';
      if (el.statBookings) el.statBookings.textContent = m.bookings ?? '-';
    } catch (err) { /* metrics are non-critical */ }
  }

  // ------------------------------------------------------------------------
  // 16. BADGE HELPERS
  // ------------------------------------------------------------------------
  function getStatusBadgeHtml(status) {
    if (status === 'Active') return '<span class="badge badge-emerald"><i class="fa-solid fa-circle" style="font-size:6px;margin-right:4px;"></i> Active</span>';
    if (status === 'Expiring') return '<span class="badge badge-amber"><i class="fa-solid fa-clock" style="font-size:8px;margin-right:4px;"></i> Expiring</span>';
    return '<span class="badge badge-rose">Inactive</span>';
  }

  function getPaymentStatusBadge(status) {
    if (status === 'Paid') return '<span class="badge badge-emerald">Paid</span>';
    return '<span class="badge badge-amber">Pending</span>';
  }

  // ------------------------------------------------------------------------
  // 17. MASTER RENDER
  // ------------------------------------------------------------------------
  async function renderAll() {
    const jobs = [
      renderAdminTrainers(),
      renderTrainerCatalog(),
      renderUserBookings(),
      renderTrainerPortal(),
      renderMembersTable(),
      renderClassesGrid(),
      renderPaymentsTable(),
      renderMetrics()
    ];
    await Promise.allSettled(jobs);
  }

  // ------------------------------------------------------------------------
  // 18. EVENT WIRING
  // ------------------------------------------------------------------------
  function setupEvents() {
    if (el.menuToggle) {
      el.menuToggle.addEventListener('click', () => el.sidebar.classList.toggle('show'));
    }

    if (el.btnLogout) el.btnLogout.addEventListener('click', logout);

    if (el.roleSelector) {
      el.roleSelector.addEventListener('change', () => {
        const role = el.roleSelector.value;
        activeRole = role;
        buildSidebarMenu(role);
        switchTab(defaultTabForRole(role));
        if (session && role !== session.role) {
          showToast(`Previewing the ${ROLE_LABELS[role]} portal. You are signed in as ${ROLE_LABELS[session.role]}.`, 'info');
        }
      });
    }

    if (el.globalSearch) {
      el.globalSearch.addEventListener('input', (e) => {
        catalogQuery = e.target.value.toLowerCase().trim();
        renderTrainerCatalog();
      });
    }

    document.querySelectorAll('.auth-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => switchAuthTab(btn.getAttribute('data-auth-mode')));
    });

    if (el.formLogin) el.formLogin.addEventListener('submit', submitLogin);
    if (el.formUserRegister) el.formUserRegister.addEventListener('submit', submitUserRegister);
    if (el.formTrainerRegister) el.formTrainerRegister.addEventListener('submit', submitTrainerRegister);
    if (el.formBookTrainer) el.formBookTrainer.addEventListener('submit', submitBooking);
    if (el.formMember) el.formMember.addEventListener('submit', saveMember);
    if (el.formClass) el.formClass.addEventListener('submit', saveClass);
    if (el.formPayment) el.formPayment.addEventListener('submit', savePayment);

    if (el.btnAddMember) el.btnAddMember.addEventListener('click', openMemberModal);
    if (el.btnAddClass) {
      el.btnAddClass.addEventListener('click', () => {
        el.formClass.reset();
        document.getElementById('input-class-capacity').value = 20;
        showModal('modal-class');
      });
    }
    if (el.btnAddPayment) {
      el.btnAddPayment.addEventListener('click', async () => {
        el.formPayment.reset();
        await populatePaymentMemberSelect();
        showModal('modal-payment');
      });
    }

    if (el.memberSearchInput) el.memberSearchInput.addEventListener('input', (e) => { memberQuery = e.target.value.toLowerCase().trim(); renderMembersTable(); });
    if (el.memberStatusFilter) el.memberStatusFilter.addEventListener('change', (e) => { memberStatus = e.target.value; renderMembersTable(); });
    if (el.memberPlanFilter) el.memberPlanFilter.addEventListener('change', (e) => { memberPlan = e.target.value; renderMembersTable(); });
    if (el.paymentSearchInput) el.paymentSearchInput.addEventListener('input', (e) => { paymentQuery = e.target.value.toLowerCase().trim(); renderPaymentsTable(); });

    document.querySelectorAll('[data-close]').forEach(btn => {
      btn.addEventListener('click', () => hideModal(btn.getAttribute('data-close')));
    });

    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) hideModal(overlay.id);
      });
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
        e.preventDefault();
        if (el.globalSearch) el.globalSearch.focus();
      }
    });
  }

  // ------------------------------------------------------------------------
  // 19. BOOTSTRAP
  // ------------------------------------------------------------------------
  setupEvents();

  (async function init() {
    await loadSession();
    if (session) await renderAll();
  })();

  window.fitPulseApp = {
    showToast,
    logout,
    switchTab,
    approveTrainer: window.approveTrainer,
    rejectTrainer: window.rejectTrainer,
    openBookTrainer: window.openBookTrainer,
    editMember: window.editMember,
    deleteMember: window.deleteMember,
    deleteClass: window.deleteClass
  };
});
