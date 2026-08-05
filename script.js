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
  let equipmentFilter = 'all';   // 'all' | 'maintenance'
  let regRole = 'user';          // unified registration role: 'user' | 'trainer'

  // Lightweight cache of the latest server responses (powers modals).
  const cache = { trainers: [], members: [], classes: [], payments: [], bookings: [], equipment: [], plans: [], gym: null, salaries: [] };

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
    formRegister: document.getElementById('form-register'),
    formBookTrainer: document.getElementById('form-book-trainer'),
    formMember: document.getElementById('form-member'),
    formClass: document.getElementById('form-class'),
    formPayment: document.getElementById('form-payment'),
    formEquipment: document.getElementById('form-equipment'),
    formPlan: document.getElementById('form-plan'),
    formSalary: document.getElementById('form-salary'),
    formGymInfo: document.getElementById('form-gym-info'),

    regFieldsUser: document.getElementById('reg-fields-user'),
    regFieldsTrainer: document.getElementById('reg-fields-trainer'),

    userClassesGrid: document.getElementById('user-classes-grid'),
    userEquipmentGrid: document.getElementById('user-equipment-grid'),
    userPlansGrid: document.getElementById('user-plans-grid'),
    gymInfoPanel: document.getElementById('gym-info-panel'),

    trainerDashStats: document.getElementById('trainer-dashboard-stats'),
    trainerProfileDetails: document.getElementById('trainer-profile-details'),
    trainerSalaryList: document.getElementById('trainer-salary-list'),

    equipmentTableTbody: document.getElementById('equipment-table-tbody'),
    btnAddEquipment: document.getElementById('btn-add-equipment'),
    adminPlansGrid: document.getElementById('admin-plans-grid'),
    btnAddPlan: document.getElementById('btn-add-plan'),
    salaryTableTbody: document.getElementById('salary-table-tbody'),
    btnAddSalary: document.getElementById('btn-add-salary'),
    inputSalaryTrainer: document.getElementById('input-salary-trainer'),

    modalEquipment: document.getElementById('modal-equipment'),
    modalPlan: document.getElementById('modal-plan'),
    modalSalary: document.getElementById('modal-salary')
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
      { tab: 'admin-gym', icon: 'fa-store', label: 'Gym Setup' },
      { tab: 'admin-overview', icon: 'fa-chart-line', label: 'System Overview' }
    ],
    user: [
      { tab: 'user-trainers', icon: 'fa-dumbbell', label: 'Find Trainers' },
      { tab: 'user-bookings', icon: 'fa-calendar-check', label: 'My Bookings' },
      { tab: 'user-classes', icon: 'fa-calendar-days', label: 'Class Schedule' },
      { tab: 'user-equipment', icon: 'fa-toolbox', label: 'Gym Equipment' },
      { tab: 'user-plans', icon: 'fa-tags', label: 'Membership Plans' },
      { tab: 'user-gym', icon: 'fa-location-dot', label: 'About & Location' }
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
    if (!email || !password) {
      showToast('Please enter your email and password.', 'error');
      document.getElementById(email ? 'login-password' : 'login-email').focus();
      return;
    }
    setAuthBtn(el.formLogin, true);
    try {
      const data = await api('auth/login.php', { method: 'POST', body: { email, password } });
      applySession(data);
      await renderAll();
      showToast(`Welcome, ${session.name.split(' ')[0]}! Signed in to the ${ROLE_LABELS[session.role]} portal.`, 'success');
    } catch (err) {
      showToast(err.message || 'Login failed. Please try again.', 'error');
    } finally {
      setAuthBtn(el.formLogin, false);
    }
  }

  async function submitRegister(e) {
    e.preventDefault();
    const body = {
      type: regRole,
      name: document.getElementById('reg-name').value.trim(),
      email: document.getElementById('reg-email').value.trim(),
      password: document.getElementById('reg-password').value,
      phone: document.getElementById('reg-phone').value.trim(),
      bio: document.getElementById('reg-bio').value.trim()
    };

    if (regRole === 'user') {
      body.goal = document.getElementById('reg-goal').value;
    } else {
      body.specialization = document.getElementById('reg-spec').value.trim();
      body.experience = parseInt(document.getElementById('reg-exp').value, 10) || 0;
      body.shift = document.getElementById('reg-shift').value;
      body.salary_expectation = parseFloat(document.getElementById('reg-salary').value) || 0;
      body.certifications = document.getElementById('reg-certs').value.trim();
    }

    if (!body.name || !body.email || !body.password) {
      showToast('Please fill in your name, email and password.', 'error');
      return;
    }
    if (body.password.length < 6) {
      showToast('Password must be at least 6 characters long.', 'error');
      return;
    }
    if (regRole === 'trainer' && (!body.specialization || !body.shift || !body.salary_expectation)) {
      showToast('Please fill in your specialization, preferred shift and expected salary.', 'error');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
      showToast('Please enter a valid email address.', 'error');
      return;
    }

    setAuthBtn(el.formRegister, true);
    try {
      const data = await api('auth/register.php', { method: 'POST', body });
      showToast(data.message, 'success');
      switchAuthTab('login');
      document.getElementById('login-email').value = body.email;
      document.getElementById('login-password').value = '';
      el.formRegister.reset();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setAuthBtn(el.formRegister, false);
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
      register: el.formRegister
    };
    document.querySelectorAll('.auth-tab-btn').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-auth-mode') === mode);
    });
    Object.entries(forms).forEach(([key, form]) => {
      if (form) form.classList.toggle('active', key === mode);
    });
  }

  function setRegRole(role) {
    regRole = role;
    document.querySelectorAll('.role-toggle-btn').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-reg-role') === role);
    });
    if (el.regFieldsUser) el.regFieldsUser.style.display = role === 'user' ? 'block' : 'none';
    if (el.regFieldsTrainer) el.regFieldsTrainer.style.display = role === 'trainer' ? 'block' : 'none';
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
      if (el.pendingTbody) el.pendingTbody.innerHTML = emptyRow('fa-user-clock', msg, 8);
      if (el.approvedTbody) el.approvedTbody.innerHTML = emptyRow('fa-user-check', msg, 7);
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
              <td><strong>${Number(t.salary_expectation || 0).toLocaleString()} NPR</strong></td>
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
        : emptyRow('fa-circle-check', 'No pending trainer applications. All caught up!', 8);

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
              <td><span class="badge badge-orange">${assigned} members</span></td>
              <td>${t.shifts.length} active</td>
              <td><strong>${Number(t.salary_expectation || 0).toLocaleString()} NPR</strong></td>
              <td><span class="badge badge-emerald"><i class="fa-solid fa-circle" style="font-size:6px;margin-right:4px;"></i> Verified</span></td>
              <td class="text-right">
                <div class="action-buttons">
                  <button class="btn btn-outline btn-sm" onclick="window.payTrainerSalary(${t.id}, '${escapeHtml(t.name).replace(/'/g, "\\'")}')">
                    <i class="fa-solid fa-wallet"></i> Pay Salary
                  </button>
                  <button class="btn btn-outline btn-sm" onclick="window.viewTrainerProfile(${t.id})">
                    <i class="fa-solid fa-id-card"></i> Profile
                  </button>
                </div>
              </td>
            </tr>
          `;
          }).join('')
        : emptyRow('fa-user-check', 'No approved trainers yet. Approve pending applications to publish them.', 7);
    } catch (err) {
      el.pendingTbody.innerHTML = emptyRow('fa-triangle-exclamation', err.message, 8);
      el.approvedTbody.innerHTML = emptyRow('fa-triangle-exclamation', err.message, 7);
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
                ${Number(t.rating) > 0 ? `<div class="text-muted text-sm"><i class="fa-solid fa-star" style="color:#f59e0b;"></i> ${Number(t.rating).toFixed(1)} / 5.0 rating</div>` : ''}
              </div>
            </div>
            ${t.certifications ? `<div class="trainer-certs"><i class="fa-solid fa-certificate"></i> ${escapeHtml(t.certifications)}</div>` : ''}
            ${t.bio ? `<p class="trainer-bio">${escapeHtml(t.bio)}</p>` : ''}
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
  // 10B. USER PORTAL: CLASS SCHEDULE, EQUIPMENT, PLANS, ABOUT & LOCATION
  // ------------------------------------------------------------------------
  async function renderUserClasses() {
    if (!el.userClassesGrid) return;
    try {
      const data = await api('classes.php');
      const classes = data.classes || [];
      if (!classes.length) {
        el.userClassesGrid.innerHTML = `<div class="class-card" style="grid-column:1 / -1;border-style:dashed;text-align:center;color:var(--text-muted);">
          <i class="fa-solid fa-calendar-xmark" style="font-size:2rem;margin-bottom:10px;display:block;"></i>
          No classes scheduled yet. Check back soon!
        </div>`;
        return;
      }
      el.userClassesGrid.innerHTML = classes.map(c => `
        <div class="class-card">
          <div class="class-card-header">
            <span class="class-category">${escapeHtml(c.category)}</span>
            <span class="badge badge-orange">${escapeHtml(c.day)}</span>
          </div>
          <h3 class="class-card-title">${escapeHtml(c.title)}</h3>
          <div class="class-info-item"><i class="fa-regular fa-clock"></i> ${escapeHtml(c.time)}</div>
          <div class="class-info-item"><i class="fa-solid fa-user-ninja"></i> Trainer: <strong>${escapeHtml(c.trainer || '-')}</strong></div>
          <div class="class-capacity-bar">
            <span class="text-muted text-sm"><i class="fa-solid fa-users"></i> ${c.booked} / ${c.capacity} Booked</span>
            <span class="badge ${(c.booked >= c.capacity) ? 'badge-rose' : 'badge-emerald'}">${(c.booked >= c.capacity) ? 'Full' : 'Open'}</span>
          </div>
        </div>
      `).join('');
    } catch (err) {
      el.userClassesGrid.innerHTML = `<div style="grid-column:1 / -1;padding:40px;text-align:center;color:var(--text-muted);">${escapeHtml(err.message)}</div>`;
    }
  }

  function getEquipmentStatusBadge(status) {
    const map = {
      'New': ['badge-emerald', 'fa-circle-check'],
      'Good': ['badge-orange', 'fa-circle'],
      'Needs Maintenance': ['badge-amber', 'fa-toolbox'],
      'Out of Service': ['badge-rose', 'fa-circle-xmark']
    };
    const [cls, icon] = map[status] || ['badge-orange', 'fa-circle'];
    return `<span class="badge ${cls}"><i class="fa-solid ${icon}" style="font-size:8px;margin-right:4px;"></i> ${escapeHtml(status)}</span>`;
  }

  async function renderUserEquipment() {
    if (!el.userEquipmentGrid) return;
    try {
      const data = await api('equipment.php');
      const items = data.equipment || [];
      if (!items.length) {
        el.userEquipmentGrid.innerHTML = `<div style="grid-column:1 / -1;padding:40px;text-align:center;color:var(--text-muted);">
          <i class="fa-solid fa-toolbox" style="font-size:2rem;margin-bottom:10px;display:block;"></i>No equipment listed yet.
        </div>`;
        return;
      }
      el.userEquipmentGrid.innerHTML = items.map(eq => `
        <div class="equipment-card">
          <div class="equipment-card-icon"><i class="fa-solid ${equipmentIcon(eq.category)}"></i></div>
          <div class="equipment-card-body">
            <h4>${escapeHtml(eq.name)}</h4>
            <div class="text-muted text-sm"><i class="fa-solid fa-layer-group"></i> ${escapeHtml(eq.category)} &bull; <strong>${eq.quantity}×</strong></div>
            <div style="margin-top:8px;">${getEquipmentStatusBadge(eq.equipment_status)}</div>
            ${eq.notes ? `<div class="text-muted text-sm" style="margin-top:6px;"><i class="fa-solid fa-note-sticky"></i> ${escapeHtml(eq.notes)}</div>` : ''}
          </div>
        </div>
      `).join('');
    } catch (err) {
      el.userEquipmentGrid.innerHTML = `<div style="grid-column:1 / -1;padding:40px;text-align:center;color:var(--text-muted);">${escapeHtml(err.message)}</div>`;
    }
  }

  function equipmentIcon(category) {
    const map = {
      'Strength': 'fa-solid fa-dumbbell',
      'Cardio': 'fa-solid fa-heart-pulse',
      'Flexibility': 'fa-solid fa-person-walking',
      'Functional': 'fa-solid fa-fire',
      'Other': 'fa-solid fa-gears'
    };
    return map[category] || 'fa-solid fa-dumbbell';
  }

  async function renderUserPlans() {
    if (!el.userPlansGrid) return;
    try {
      const data = await api('plans.php');
      const plans = data.plans || [];
      if (!plans.length) {
        el.userPlansGrid.innerHTML = `<div style="grid-column:1 / -1;padding:40px;text-align:center;color:var(--text-muted);">
          <i class="fa-solid fa-tags" style="font-size:2rem;margin-bottom:10px;display:block;"></i>No membership plans available yet.
        </div>`;
        return;
      }
      el.userPlansGrid.innerHTML = plans.map(p => `
        <div class="plan-card ${Number(p.popular) ? 'plan-card-popular' : ''}">
          ${Number(p.popular) ? '<span class="plan-ribbon">Most Popular</span>' : ''}
          <div class="plan-name">${escapeHtml(p.name)}</div>
          <div class="plan-price"><span class="plan-currency">Rs.</span>${Number(p.price).toLocaleString()}<span class="plan-duration"> / ${escapeHtml(p.duration)}</span></div>
          <ul class="plan-features">
            ${(p.features || '').split('\n').filter(f => f.trim()).map(f => `<li><i class="fa-solid fa-check"></i> ${escapeHtml(f.trim())}</li>`).join('')}
          </ul>
          <button class="btn ${Number(p.popular) ? 'btn-primary' : 'btn-outline'} btn-block" onclick="window.fitPulseApp.showToast('Membership sign-up coming soon! Contact the front desk to join ${escapeHtml(p.name)}.', 'info')">
            <i class="fa-solid fa-user-plus"></i> Join ${escapeHtml(p.name)}
          </button>
        </div>
      `).join('');
    } catch (err) {
      el.userPlansGrid.innerHTML = `<div style="grid-column:1 / -1;padding:40px;text-align:center;color:var(--text-muted);">${escapeHtml(err.message)}</div>`;
    }
  }

  async function renderGymInfo() {
    if (!el.gymInfoPanel) return;
    try {
      const data = await api('gym.php');
      cache.gym = data.gym || null;
      const g = cache.gym;
      if (!g) return;
      const hours = (g.hours || '').split('\n').filter(h => h.trim());
      el.gymInfoPanel.innerHTML = `
        <div class="panel">
          <div class="panel-body p-0">
            <div class="gym-hero">
              <div class="gym-hero-icon"><i class="fa-solid fa-dumbbell"></i></div>
              <div>
                <h2>${escapeHtml(g.name)}</h2>
                <p>${escapeHtml(g.address || '')}</p>
              </div>
            </div>
            <div class="gym-sections">
              <div class="gym-section">
                <div class="gym-section-title"><i class="fa-solid fa-book-open text-amber"></i> About Our Gym</div>
                <p class="gym-about-text">${escapeHtml(g.about || 'No description yet.')}</p>
                <div class="gym-contact-row">
                  <span><i class="fa-solid fa-phone"></i> ${escapeHtml(g.phone || '-')}</span>
                  <span><i class="fa-solid fa-envelope"></i> ${escapeHtml(g.email || '-')}</span>
                </div>
              </div>
              <div class="gym-section">
                <div class="gym-section-title"><i class="fa-regular fa-clock text-amber"></i> Opening Hours</div>
                <ul class="gym-hours-list">
                  ${hours.map(h => `<li><i class="fa-solid fa-circle" style="font-size:6px;margin-right:8px;"></i> ${escapeHtml(h)}</li>`).join('')}
                </ul>
              </div>
              <div class="gym-section">
                <div class="gym-section-title"><i class="fa-solid fa-location-dot text-amber"></i> Find Us</div>
                <p class="gym-address-line">${escapeHtml(g.address || '-')}</p>
                ${g.map_url ? `<iframe class="gym-map" src="${escapeHtml(g.map_url)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe>` : ''}
              </div>
            </div>
          </div>
        </div>`;
    } catch (err) {
      el.gymInfoPanel.innerHTML = `<div class="panel"><div class="panel-body">${escapeHtml(err.message)}</div></div>`;
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
          <div class="panel user-booking-banner" style="background:linear-gradient(135deg,#ea580c,#f97316)">
            <h3><i class="fa-solid fa-user-ninja"></i> Trainer Portal</h3>
            <p style="opacity:0.9">Register as a trainer in the Register form, then get verified by an admin to access your dashboard.</p>
          </div>`;
      }
      if (el.trainerShiftList) el.trainerShiftList.innerHTML = emptyState('fa-clock', 'Login as a trainer to view your shifts.');
      if (el.trainerClientsList) el.trainerClientsList.innerHTML = emptyState('fa-users', 'Login as a trainer to view your clients.');
      if (el.trainerDashStats) el.trainerDashStats.innerHTML = '';
      if (el.trainerProfileDetails) el.trainerProfileDetails.innerHTML = emptyState('fa-id-badge', 'Login as a trainer to view your profile.');
      if (el.trainerSalaryList) el.trainerSalaryList.innerHTML = emptyState('fa-wallet', 'Login as a trainer to view your salary records.');
      return;
    }

    // Status banner
    let html = '';
    if (trainer) {
      if (trainer.status === 'approved') {
        html = `<div class="panel user-booking-banner" style="background:linear-gradient(135deg,#059669,#10b981)">
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
      const [bookData, payData] = await Promise.all([
        api('bookings.php').catch(() => ({ bookings: [] })),
        api('trainer-payments.php').catch(() => ({ payments: [] }))
      ]);
      cache.bookings = bookData.bookings || [];
      cache.salaries = payData.payments || [];

      // ---- Performance dashboard stats ----
      if (el.trainerDashStats) {
        const totalClients = cache.bookings.length;
        const paid = cache.salaries.filter(s => s.status === 'Paid').reduce((a, s) => a + Number(s.amount || 0), 0);
        const pending = cache.salaries.filter(s => s.status === 'Pending').reduce((a, s) => a + Number(s.amount || 0), 0);
        el.trainerDashStats.innerHTML = `
          <div class="metric-card">
            <div class="metric-header">
              <div class="metric-icon icon-amber"><i class="fa-solid fa-users"></i></div>
              <span class="trend trend-up">Active</span>
            </div>
            <div class="metric-body">
              <h3>${totalClients}</h3>
              <p>Assigned Clients</p>
            </div>
          </div>
          <div class="metric-card">
            <div class="metric-header">
              <div class="metric-icon icon-emerald"><i class="fa-solid fa-wallet"></i></div>
              <span class="trend trend-up">Received</span>
            </div>
            <div class="metric-body">
              <h3>${Number(paid).toLocaleString()}</h3>
              <p>Salary Received (NPR)</p>
            </div>
          </div>
          <div class="metric-card">
            <div class="metric-header">
              <div class="metric-icon icon-blue"><i class="fa-regular fa-clock"></i></div>
              <span class="trend trend-neutral">Due</span>
            </div>
            <div class="metric-body">
              <h3>${Number(pending).toLocaleString()}</h3>
              <p>Pending Salary (NPR)</p>
            </div>
          </div>
          <div class="metric-card">
            <div class="metric-header">
              <div class="metric-icon icon-purple"><i class="fa-solid fa-star"></i></div>
              <span class="trend trend-up">Rating</span>
            </div>
            <div class="metric-body">
              <h3>${Number(trainer.rating || 0).toFixed(1)}<span style="font-size:16px;color:var(--text-muted);"> / 5.0</span></h3>
              <p>Member Rating</p>
            </div>
          </div>`;
      }

      // ---- Professional profile ----
      if (el.trainerProfileDetails) {
        el.trainerProfileDetails.innerHTML = `
          <div class="trainer-profile">
            <div class="trainer-profile-top">
              <div class="trainer-avatar" style="width:56px;height:56px;font-size:1.2rem;">${getInitials(session.name)}</div>
              <div>
                <h4>${escapeHtml(session.name)}</h4>
                <div class="text-muted text-sm">${escapeHtml(trainer.specialization)}</div>
                <div class="text-muted text-sm"><i class="fa-solid fa-briefcase"></i> ${trainer.experience} yrs experience</div>
              </div>
            </div>
            <div class="trainer-profile-detail"><span><i class="fa-solid fa-envelope"></i> Email</span><strong>${escapeHtml(session.email)}</strong></div>
            <div class="trainer-profile-detail"><span><i class="fa-solid fa-phone"></i> Phone</span><strong>${escapeHtml(session.phone || '-')}</strong></div>
            <div class="trainer-profile-detail"><span><i class="fa-solid fa-certificate"></i> Certifications</span><strong>${escapeHtml(trainer.certifications || '-')}</strong></div>
            <div class="trainer-profile-detail"><span><i class="fa-solid fa-money-bill-wave"></i> Expected Salary</span><strong>${Number(trainer.salary_expectation || 0).toLocaleString()} NPR / month</strong></div>
            ${session.bio ? `<div class="trainer-profile-bio">${escapeHtml(session.bio)}</div>` : ''}
          </div>`;
      }

      // ---- Salary & payments ----
      if (el.trainerSalaryList) {
        el.trainerSalaryList.innerHTML = cache.salaries.length
          ? cache.salaries.map(s => `
              <div class="booking-item">
                <div class="booking-item-icon"><i class="fa-solid fa-money-bill-wave"></i></div>
                <div class="booking-item-info">
                  <strong>${Number(s.amount).toLocaleString()} NPR</strong>
                  <div class="text-muted text-sm">Month: ${escapeHtml(s.month)} &bull; ${escapeHtml(s.method)}</div>
                  <div class="text-muted text-sm">${s.payment_date ? 'Paid on ' + s.payment_date : 'Awaiting payment'}</div>
                </div>
                ${s.status === 'Paid'
                  ? '<span class="badge badge-emerald"><i class="fa-solid fa-circle-check"></i> Paid</span>'
                  : '<span class="badge badge-amber"><i class="fa-solid fa-clock"></i> Pending</span>'}
              </div>
            `).join('')
          : emptyState('fa-money-bill-wave', 'No salary records yet. Once the admin records your salary, it appears here.');
      }

      // ---- Shifts ----
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
                <span class="badge badge-orange">Scheduled</span>
              </div>
            `).join('')
          : emptyState('fa-calendar-plus', 'No shifts assigned yet.');
      }

      // ---- Clients ----
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
              <td><span class="badge badge-orange">${escapeHtml(m.plan)}</span></td>
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
            <span class="badge badge-orange">${escapeHtml(c.day)}</span>
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
  // 14B. ADMIN VIEWS: GYM SETUP (PROFILE, EQUIPMENT, PLANS, SALARIES)
  // ------------------------------------------------------------------------
  async function renderAdminGymInfo() {
    if (!el.formGymInfo) return;
    try {
      const data = await api('gym.php');
      cache.gym = data.gym || null;
      const g = cache.gym;
      if (!g) return;
      document.getElementById('gym-name').value = g.name || '';
      document.getElementById('gym-phone').value = g.phone || '';
      document.getElementById('gym-email').value = g.email || '';
      document.getElementById('gym-address').value = g.address || '';
      document.getElementById('gym-hours').value = g.hours || '';
      document.getElementById('gym-about').value = g.about || '';
      document.getElementById('gym-map').value = g.map_url || '';
    } catch (err) { /* non-critical */ }
  }

  async function saveGymInfo(e) {
    e.preventDefault();
    if (!isAdmin()) { showToast('Admin access required.', 'error'); return; }
    const body = {
      name: document.getElementById('gym-name').value.trim(),
      phone: document.getElementById('gym-phone').value.trim(),
      email: document.getElementById('gym-email').value.trim(),
      address: document.getElementById('gym-address').value.trim(),
      hours: document.getElementById('gym-hours').value.trim(),
      about: document.getElementById('gym-about').value.trim(),
      map_url: document.getElementById('gym-map').value.trim()
    };
    try {
      const data = await api('gym.php', { method: 'PUT', body });
      showToast(data.message, 'success');
      await renderGymInfo();
    } catch (err) { showToast(err.message, 'error'); }
  }

  async function renderAdminEquipment() {
    if (!el.equipmentTableTbody) return;
    if (!isAdmin()) {
      el.equipmentTableTbody.innerHTML = emptyRow('fa-toolbox', 'Sign in as an admin to manage equipment.', 7);
      return;
    }
    try {
      const data = await api('equipment.php');
      cache.equipment = data.equipment || [];
      const filtered = equipmentFilter === 'maintenance'
        ? cache.equipment.filter(eq => eq.equipment_status === 'Needs Maintenance' || eq.equipment_status === 'Out of Service')
        : cache.equipment;

      el.equipmentTableTbody.innerHTML = filtered.length
        ? filtered.map(eq => `
            <tr>
              <td>
                <div class="member-cell">
                  <div class="avatar-chip">${getInitials(eq.name)}</div>
                  <div>
                    <strong>${escapeHtml(eq.name)}</strong>
                    <div class="text-muted text-sm">ID: #EQ-${1000 + eq.id}</div>
                  </div>
                </div>
              </td>
              <td><span class="badge badge-orange">${escapeHtml(eq.category)}</span></td>
              <td>${eq.quantity}×</td>
              <td>${getEquipmentStatusBadge(eq.equipment_status)}</td>
              <td>${eq.last_maintenance || '-'}</td>
              <td class="text-muted text-sm">${escapeHtml(eq.notes || '-')}</td>
              <td class="text-right">
                <div class="action-buttons">
                  <button class="action-icon-btn" title="Edit Equipment" onclick="window.editEquipment(${eq.id})">
                    <i class="fa-solid fa-pen-to-square"></i>
                  </button>
                  <button class="action-icon-btn delete-btn" title="Delete Equipment" onclick="window.deleteEquipment(${eq.id})">
                    <i class="fa-solid fa-trash"></i>
                  </button>
                </div>
              </td>
            </tr>
          `).join('')
        : emptyRow('fa-toolbox', 'No equipment found' + (equipmentFilter === 'maintenance' ? ' needing maintenance.' : '.'), 7);
    } catch (err) {
      el.equipmentTableTbody.innerHTML = emptyRow('fa-triangle-exclamation', err.message, 7);
    }
  }

  function openEquipmentModal() {
    document.getElementById('equipment-id').value = '';
    el.formEquipment.reset();
    document.getElementById('modal-equipment-title').textContent = 'Add Equipment';
    document.getElementById('input-equipment-qty').value = 1;
    showModal('modal-equipment');
  }

  window.editEquipment = function (id) {
    const eq = cache.equipment.find(x => x.id === id);
    if (!eq) return;
    document.getElementById('equipment-id').value = eq.id;
    document.getElementById('input-equipment-name').value = eq.name;
    document.getElementById('input-equipment-category').value = eq.category;
    document.getElementById('input-equipment-qty').value = eq.quantity;
    document.getElementById('input-equipment-status').value = eq.equipment_status;
    document.getElementById('input-equipment-maintenance').value = eq.last_maintenance || '';
    document.getElementById('input-equipment-notes').value = eq.notes || '';
    document.getElementById('modal-equipment-title').textContent = 'Edit Equipment';
    showModal('modal-equipment');
  };

  async function saveEquipment(e) {
    e.preventDefault();
    if (!isAdmin()) { showToast('Admin access required.', 'error'); return; }
    const id = document.getElementById('equipment-id').value;
    const body = {
      name: document.getElementById('input-equipment-name').value.trim(),
      category: document.getElementById('input-equipment-category').value,
      quantity: parseInt(document.getElementById('input-equipment-qty').value, 10) || 1,
      equipment_status: document.getElementById('input-equipment-status').value,
      last_maintenance: document.getElementById('input-equipment-maintenance').value,
      notes: document.getElementById('input-equipment-notes').value.trim()
    };
    try {
      const data = await api('equipment.php', { method: id ? 'PUT' : 'POST', body: id ? { ...body, id: parseInt(id, 10) } : body });
      hideModal('modal-equipment');
      showToast(data.message, 'success');
      await Promise.all([renderAdminEquipment(), renderUserEquipment()]);
    } catch (err) { showToast(err.message, 'error'); }
  }

  window.deleteEquipment = async function (id) {
    if (!isAdmin()) { showToast('Admin access required.', 'error'); return; }
    if (!confirm('Delete this equipment record?')) return;
    try {
      const data = await api(`equipment.php?id=${id}`, { method: 'DELETE' });
      showToast(data.message, 'info');
      await Promise.all([renderAdminEquipment(), renderUserEquipment()]);
    } catch (err) { showToast(err.message, 'error'); }
  };

  window.toggleEquipmentFilter = function () {
    equipmentFilter = equipmentFilter === 'maintenance' ? 'all' : 'maintenance';
    renderAdminEquipment();
  };

  async function renderAdminPlans() {
    if (!el.adminPlansGrid) return;
    try {
      const data = await api('plans.php');
      cache.plans = data.plans || [];
      if (!cache.plans.length) {
        el.adminPlansGrid.innerHTML = `<div style="grid-column:1 / -1;padding:30px;text-align:center;color:var(--text-muted);border:1px dashed var(--border-color);border-radius:var(--radius-md);">
          <i class="fa-solid fa-tags" style="font-size:2rem;margin-bottom:10px;display:block;"></i>No plans yet. Add your first membership plan.
        </div>`;
        return;
      }
      el.adminPlansGrid.innerHTML = cache.plans.map(p => `
        <div class="admin-plan-card">
          <div class="admin-plan-head">
            <div>
              <strong>${escapeHtml(p.name)}</strong>
              ${Number(p.popular) ? '<span class="badge badge-amber" style="margin-left:6px;">Popular</span>' : ''}
            </div>
            <span class="admin-plan-price">Rs.${Number(p.price).toLocaleString()}<span class="text-muted text-sm"> / ${escapeHtml(p.duration)}</span></span>
          </div>
          <div class="text-muted text-sm">${(p.features || '').split('\n').filter(f => f.trim()).length} features</div>
          <div class="admin-plan-actions">
            <button class="btn btn-outline btn-sm" onclick="window.editPlan(${p.id})"><i class="fa-solid fa-pen"></i> Edit</button>
            <button class="btn btn-outline btn-sm" onclick="window.deletePlan(${p.id})"><i class="fa-solid fa-trash"></i> Delete</button>
          </div>
        </div>
      `).join('');
    } catch (err) {
      el.adminPlansGrid.innerHTML = `<div style="grid-column:1 / -1;padding:30px;text-align:center;color:var(--text-muted);">${escapeHtml(err.message)}</div>`;
    }
  }

  function openPlanModal() {
    document.getElementById('plan-id').value = '';
    el.formPlan.reset();
    document.getElementById('modal-plan-title').textContent = 'Add Membership Plan';
    showModal('modal-plan');
  }

  window.editPlan = function (id) {
    const p = cache.plans.find(x => x.id === id);
    if (!p) return;
    document.getElementById('plan-id').value = p.id;
    document.getElementById('input-plan-name').value = p.name;
    document.getElementById('input-plan-price').value = p.price;
    document.getElementById('input-plan-duration').value = p.duration;
    document.getElementById('input-plan-popular').value = String(Number(p.popular) ? 1 : 0);
    document.getElementById('input-plan-features').value = p.features || '';
    document.getElementById('modal-plan-title').textContent = 'Edit Membership Plan';
    showModal('modal-plan');
  };

  async function savePlan(e) {
    e.preventDefault();
    if (!isAdmin()) { showToast('Admin access required.', 'error'); return; }
    const id = document.getElementById('plan-id').value;
    const body = {
      name: document.getElementById('input-plan-name').value.trim(),
      price: parseFloat(document.getElementById('input-plan-price').value) || 0,
      duration: document.getElementById('input-plan-duration').value,
      popular: parseInt(document.getElementById('input-plan-popular').value, 10) || 0,
      features: document.getElementById('input-plan-features').value
    };
    try {
      const data = await api('plans.php', { method: id ? 'PUT' : 'POST', body: id ? { ...body, id: parseInt(id, 10) } : body });
      hideModal('modal-plan');
      showToast(data.message, 'success');
      await Promise.all([renderAdminPlans(), renderUserPlans()]);
    } catch (err) { showToast(err.message, 'error'); }
  }

  window.deletePlan = async function (id) {
    if (!isAdmin()) { showToast('Admin access required.', 'error'); return; }
    if (!confirm('Delete this membership plan?')) return;
    try {
      const data = await api(`plans.php?id=${id}`, { method: 'DELETE' });
      showToast(data.message, 'info');
      await Promise.all([renderAdminPlans(), renderUserPlans()]);
    } catch (err) { showToast(err.message, 'error'); }
  };

  async function populateSalaryTrainerSelect() {
    if (!el.inputSalaryTrainer) return;
    try {
      const data = await api('trainers.php');
      const approved = (data.trainers || []).filter(t => t.status === 'approved');
      el.inputSalaryTrainer.innerHTML = approved.map(t =>
        `<option value="${t.id}" data-salary="${escapeHtml(t.salary_expectation || 0)}">${escapeHtml(t.name)} (${escapeHtml(t.specialization)})</option>`
      ).join('');
    } catch (err) { /* ignored */ }
  }

  async function renderSalariesTable() {
    if (!el.salaryTableTbody) return;
    if (!isAdmin()) {
      el.salaryTableTbody.innerHTML = emptyRow('fa-wallet', 'Sign in as an admin to manage trainer salaries.', 7);
      return;
    }
    try {
      const data = await api('trainer-payments.php');
      cache.salaries = data.payments || [];
      el.salaryTableTbody.innerHTML = cache.salaries.length
        ? cache.salaries.map(s => `
            <tr>
              <td>
                <div class="member-cell">
                  <div class="avatar-chip">${getInitials(s.trainer_name)}</div>
                  <div>
                    <strong>${escapeHtml(s.trainer_name)}</strong>
                    <div class="text-muted text-sm">${escapeHtml(s.notes || 'Salary')}</div>
                  </div>
                </div>
              </td>
              <td><strong>${escapeHtml(s.month)}</strong></td>
              <td><strong>${Number(s.amount).toLocaleString()} NPR</strong></td>
              <td>${escapeHtml(s.method)}</td>
              <td>${s.payment_date || '-'}</td>
              <td>${s.status === 'Paid'
                ? '<span class="badge badge-emerald">Paid</span>'
                : '<span class="badge badge-amber">Pending</span>'}</td>
              <td class="text-right">
                ${s.status === 'Pending'
                  ? `<button class="btn btn-approve btn-sm" onclick="window.markSalaryPaid(${s.id})"><i class="fa-solid fa-check"></i> Mark Paid</button>`
                  : '<span class="text-muted text-sm">Settled</span>'}
              </td>
            </tr>
          `).join('')
        : emptyRow('fa-wallet', 'No salary payments recorded yet.', 7);
    } catch (err) {
      el.salaryTableTbody.innerHTML = emptyRow('fa-triangle-exclamation', err.message, 7);
    }
  }

  async function openSalaryModal(trainerId) {
    el.formSalary.reset();
    await populateSalaryTrainerSelect();
    const now = new Date();
    const monthInput = document.getElementById('input-salary-month');
    monthInput.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    document.getElementById('input-salary-status').value = 'Paid';
    if (trainerId) {
      el.inputSalaryTrainer.value = String(trainerId);
      const opt = el.inputSalaryTrainer.selectedOptions[0];
      if (opt && opt.dataset.salary) {
        document.getElementById('input-salary-amount').value = opt.dataset.salary;
      }
    }
    showModal('modal-salary');
  }

  window.payTrainerSalary = function (id) {
    if (!isAdmin()) { showToast('Admin access required.', 'error'); return; }
    openSalaryModal(id);
  };

  window.viewTrainerProfile = function (id) {
    const t = cache.trainers.find(x => x.id === id);
    if (!t) return;
    showToast(`${t.name} • ${t.specialization} • ${t.experience} yrs • ${t.certifications || 'No certs listed'}`, 'info');
  };

  async function saveSalary(e) {
    e.preventDefault();
    if (!isAdmin()) { showToast('Admin access required.', 'error'); return; }
    const body = {
      trainer_id: parseInt(el.inputSalaryTrainer.value, 10),
      amount: parseFloat(document.getElementById('input-salary-amount').value) || 0,
      month: document.getElementById('input-salary-month').value,
      status: document.getElementById('input-salary-status').value,
      method: document.getElementById('input-salary-method').value,
      notes: document.getElementById('input-salary-notes').value.trim()
    };
    try {
      const data = await api('trainer-payments.php', { method: 'POST', body });
      hideModal('modal-salary');
      showToast(data.message, 'success');
      await Promise.all([renderSalariesTable(), renderTrainerPortal(), renderMetrics()]);
    } catch (err) { showToast(err.message, 'error'); }
  }

  window.markSalaryPaid = async function (id) {
    if (!isAdmin()) { showToast('Admin access required.', 'error'); return; }
    try {
      const data = await api('trainer-payments.php', { method: 'PUT', body: { id, status: 'Paid' } });
      showToast(data.message, 'success');
      await Promise.all([renderSalariesTable(), renderTrainerPortal(), renderMetrics()]);
    } catch (err) { showToast(err.message, 'error'); }
  };

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
      renderUserClasses(),
      renderUserEquipment(),
      renderUserPlans(),
      renderGymInfo(),
      renderTrainerPortal(),
      renderMembersTable(),
      renderClassesGrid(),
      renderPaymentsTable(),
      renderAdminGymInfo(),
      renderAdminEquipment(),
      renderAdminPlans(),
      renderSalariesTable(),
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

    document.querySelectorAll('.role-toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => setRegRole(btn.getAttribute('data-reg-role')));
    });

    if (el.formLogin) el.formLogin.addEventListener('submit', submitLogin);
    if (el.formRegister) el.formRegister.addEventListener('submit', submitRegister);
    if (el.formBookTrainer) el.formBookTrainer.addEventListener('submit', submitBooking);
    if (el.formMember) el.formMember.addEventListener('submit', saveMember);
    if (el.formClass) el.formClass.addEventListener('submit', saveClass);
    if (el.formPayment) el.formPayment.addEventListener('submit', savePayment);
    if (el.formEquipment) el.formEquipment.addEventListener('submit', saveEquipment);
    if (el.formPlan) el.formPlan.addEventListener('submit', savePlan);
    if (el.formSalary) el.formSalary.addEventListener('submit', saveSalary);
    if (el.formGymInfo) el.formGymInfo.addEventListener('submit', saveGymInfo);

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
    if (el.btnAddEquipment) el.btnAddEquipment.addEventListener('click', openEquipmentModal);
    if (el.btnAddPlan) el.btnAddPlan.addEventListener('click', openPlanModal);
    if (el.btnAddSalary) el.btnAddSalary.addEventListener('click', () => openSalaryModal(null));

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
    deleteClass: window.deleteClass,
    toggleEquipmentFilter: window.toggleEquipmentFilter,
    editEquipment: window.editEquipment,
    deleteEquipment: window.deleteEquipment,
    editPlan: window.editPlan,
    deletePlan: window.deletePlan,
    payTrainerSalary: window.payTrainerSalary,
    viewTrainerProfile: window.viewTrainerProfile,
    markSalaryPaid: window.markSalaryPaid
  };
});
