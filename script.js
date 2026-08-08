/* ==========================================================================
   FITPULSE MULTI-ADMIN GYM MANAGEMENT SYSTEM - FRONTEND LOGIC
   Portals: Superadmin / Admin / Trainer / User
   ========================================================================== */
(function () {
  'use strict';

  /* ----------------------------- helpers ------------------------------- */
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
  const money = (n) => 'NPR ' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
  const fmtDate = (d) => d ? String(d).slice(0, 10) : '-';

  const state = { user: null, portal: null, gyms: [], gymMap: {}, selected: new Set(), resetToken: null };

  /* ----------------------------- toasts ------------------------------- */
  function toast(msg, type = 'success') {
    let stack = document.querySelector('.toast-container');
    if (!stack) {
      stack = document.createElement('div');
      stack.className = 'toast-container';
      document.body.appendChild(stack);
    }
    const t = document.createElement('div');
    t.className = 'toast toast-' + type;
    const icons = { success: 'fa-circle-check', error: 'fa-circle-xmark', info: 'fa-circle-info' };
    t.innerHTML = '<i class="fa-solid ' + (icons[type] || icons.info) + '"></i><span>' + esc(msg) + '</span>';
    stack.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateX(20px)'; }, 2600);
    setTimeout(() => t.remove(), 3000);
  }

  /* --------------------------- API helper ------------------------------ */
  // When the page is served directly by XAMPP Apache (port 80) relative API
  // paths work. When served from a static/dev server (VS Code Live Server on
  // :5500 etc.) route API calls to the XAMPP backend on the SAME hostname
  // (CORS enabled in config/init.php). Using location.hostname keeps the
  // session cookie same-site (localhost vs 127.0.0.1 are different sites).
  // Override by setting window.GYM_API_BASE before loading.
  const API_BASE = window.GYM_API_BASE
    || (location.protocol === 'http:' && (location.port === '' || location.port === '80') ? '' : 'http://' + location.hostname + '/gym/');
  const apiUrl = (path) => path.startsWith('http') ? path : API_BASE + path;

  function showBackendError() {
    const box = $('backend-error-box');
    if (box) box.style.display = 'flex';
  }

  async function api(path, opts = {}) {
    let res;
    try {
      res = await fetch(apiUrl(path), {
        method: opts.method || 'GET',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      });
    } catch (err) {
      showBackendError();
      throw new Error('Cannot reach the backend at http://localhost/gym/. Make sure XAMPP Apache + MySQL are running, then reload.');
    }
    const data = await res.json().catch(() => ({ ok: false, message: 'Invalid server response' }));
    if (!res.ok) {
      const err = new Error(data.message || 'Request failed (' + res.status + ')');
      err.status = res.status;
      throw err;
    }
    return data;
  }

  const apiQuery = (path, params) => {
    const qs = Object.entries(params).filter(([, v]) => v !== undefined && v !== '' && v !== null)
      .map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v)).join('&');
    return path + (qs ? '?' + qs : '');
  };

  /* Upload helper: POST multipart FormData (no Content-Type header, so the
     browser sets the correct multipart boundary). */
  async function apiForm(path, formData) {
    let res;
    try {
      res = await fetch(apiUrl(path), {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
    } catch (err) {
      showBackendError();
      throw new Error('Cannot reach the backend at http://localhost/gym/. Make sure XAMPP Apache + MySQL are running, then reload.');
    }
    const data = await res.json().catch(() => ({ ok: false, message: 'Invalid server response' }));
    if (!res.ok) {
      const err = new Error(data.message || 'Upload failed (' + res.status + ')');
      err.status = res.status;
      throw err;
    }
    return data;
  }

  /* Upload a gym logo image; resolves to the stored URL (e.g. "uploads/..."). */
  async function uploadLogo(file) {
    const fd = new FormData();
    fd.append('logo', file);
    const d = await apiForm('api/upload.php', fd);
    return d.url;
  }

  /* Client-side check for an image file before uploading. */
  function isImageFile(file) {
    return file && /^image\/(png|jpe?g|webp|gif)$/i.test(file.type);
  }

  /* ----------------------------- modals ------------------------------- */
  function openModal(id) { $(id).classList.add('active'); }
  function closeModal(id) { $(id).classList.remove('active'); }
  function closeActiveModal() {
    document.querySelectorAll('.modal-overlay.active').forEach((m) => m.classList.remove('active'));
  }

  /* --------------------------- navigation ----------------------------- */
  const NAV = {
    superadmin: [
      { tab: 'tab-sa-dashboard',    icon: 'fa-chart-pie',     label: 'Dashboard' },
      { tab: 'tab-sa-admins',       icon: 'fa-user-shield',   label: 'Admin Portals' },
    ],
    admin: [
      { tab: 'tab-admin-dashboard',  icon: 'fa-chart-pie',     label: 'Dashboard' },
      { tab: 'tab-admin-attendance', icon: 'fa-calendar-check',label: 'Attendance' },
      { tab: 'tab-admin-progress',   icon: 'fa-heart-pulse',   label: 'Progress' },
      { tab: 'tab-admin-workouts',   icon: 'fa-person-running',label: 'Workouts' },
      { tab: 'tab-admin-diets',      icon: 'fa-utensils',      label: 'Diet Plans' },
      { tab: 'tab-admin-classes',    icon: 'fa-calendar-day',  label: 'Classes' },
      { tab: 'tab-admin-invoices',   icon: 'fa-file-invoice',  label: 'Billing' },
      { tab: 'tab-admin-announcements', icon: 'fa-bullhorn',   label: 'Announce' },
      { tab: 'tab-admin-reports',    icon: 'fa-chart-pie',     label: 'Reports' },
      { tab: 'tab-admin-products',   icon: 'fa-box-open',      label: 'Products' },
      { tab: 'tab-admin-equipment',  icon: 'fa-dumbbell',      label: 'Equipment' },
      { tab: 'tab-admin-users',      icon: 'fa-users',         label: 'My Users' },
      { tab: 'tab-admin-trainers',   icon: 'fa-user-ninja',    label: 'Trainers' },
    ],
    trainer: [
      { tab: 'tab-trainer-dashboard', icon: 'fa-chart-pie',    label: 'My Dashboard' },
      { tab: 'tab-trainer-attendance',icon: 'fa-calendar-check',label: 'Attendance' },
      { tab: 'tab-trainer-members',   icon: 'fa-users',        label: 'My Members' },
      { tab: 'tab-trainer-workouts',  icon: 'fa-person-running',label: 'Workouts' },
      { tab: 'tab-trainer-diets',     icon: 'fa-utensils',     label: 'Diet Plans' },
      { tab: 'tab-trainer-classes',   icon: 'fa-calendar-day', label: 'Classes' },
    ],
    user: [
      { tab: 'tab-user-dashboard', icon: 'fa-chart-pie',    label: 'Dashboard' },
      { tab: 'tab-user-notifications', icon: 'fa-bell',     label: 'Notifications' },
      { tab: 'tab-user-gyms',      icon: 'fa-dumbbell',     label: 'Browse Gyms' },
      { tab: 'tab-user-products',  icon: 'fa-box-open',     label: 'Gym Products' },
      { tab: 'tab-user-trainers',  icon: 'fa-user-ninja',   label: 'Gym Trainers' },
      { tab: 'tab-user-equipment', icon: 'fa-dumbbell',     label: 'Gym Equipment' },
      { tab: 'tab-user-attendance',icon: 'fa-calendar-check',label: 'My Attendance' },
      { tab: 'tab-user-progress',  icon: 'fa-heart-pulse',  label: 'My Progress' },
      { tab: 'tab-user-workouts',  icon: 'fa-person-running',label: 'My Workouts' },
      { tab: 'tab-user-diets',     icon: 'fa-utensils',     label: 'My Diet' },
      { tab: 'tab-user-classes',   icon: 'fa-calendar-day', label: 'Classes' },
      { tab: 'tab-user-invoices',  icon: 'fa-file-invoice', label: 'My Invoices' },
    ],
    guest: [
      { tab: 'tab-user-gyms',      icon: 'fa-dumbbell',  label: 'Browse Gyms' },
      { tab: 'tab-user-products',  icon: 'fa-box-open',  label: 'Gym Products' },
      { tab: 'tab-user-trainers',  icon: 'fa-user-ninja', label: 'Gym Trainers' },
      { tab: 'tab-user-equipment', icon: 'fa-dumbbell',  label: 'Gym Equipment' },
    ],
  };

  const LOADERS = {
    'tab-sa-dashboard':     loadSuperadminDashboard,
    'tab-sa-admins':        loadSuperadminAdmins,
    'tab-admin-dashboard':  loadAdminDashboard,
    'tab-admin-attendance': loadAdminAttendance,
    'tab-admin-progress':   loadAdminProgress,
    'tab-admin-workouts':   loadAdminWorkouts,
    'tab-admin-diets':      loadAdminDiets,
    'tab-admin-classes':    loadAdminClasses,
    'tab-admin-invoices':   loadAdminInvoices,
    'tab-admin-announcements': loadAdminAnnouncements,
    'tab-admin-reports':    loadAdminReports,
    'tab-admin-products':   loadAdminProducts,
    'tab-admin-equipment':  loadAdminEquipment,
    'tab-admin-users':      loadAdminUsers,
    'tab-admin-trainers':   loadAdminTrainers,
    'tab-trainer-dashboard': loadTrainerDashboard,
    'tab-trainer-attendance': loadTrainerAttendance,
    'tab-trainer-members':  loadTrainerMembers,
    'tab-trainer-workouts': loadTrainerWorkouts,
    'tab-trainer-diets':    loadTrainerDiets,
    'tab-trainer-classes':  loadTrainerClasses,
    'tab-user-dashboard':   loadUserDashboard,
    'tab-user-gyms':        loadUserGyms,
    'tab-user-products':    loadUserProducts,
    'tab-user-trainers':    loadUserTrainers,
    'tab-user-equipment':   loadUserEquipment,
    'tab-user-attendance':  loadUserAttendance,
    'tab-user-progress':    loadUserProgress,
    'tab-user-workouts':    loadUserWorkouts,
    'tab-user-diets':       loadUserDiets,
    'tab-user-classes':     loadUserClasses,
    'tab-user-invoices':    loadUserInvoices,
    'tab-user-notifications': loadUserNotifications,
  };

  function showSection(id) {
    document.querySelectorAll('.tab-content').forEach((s) => s.classList.remove('active'));
    const sec = $(id);
    if (!sec) return;
    sec.classList.add('active');
    document.querySelectorAll('#sidebar-menu-list .nav-item').forEach((n) =>
      n.classList.toggle('active', n.dataset.tab === id));
    if (LOADERS[id]) LOADERS[id]();
  }

  function buildMenu() {
    const list = $('sidebar-menu-list');
    list.innerHTML = (NAV[state.portal] || []).map((item) => `
      <li class="nav-item" data-tab="${item.tab}">
        <a href="#" data-tab="${item.tab}">
          <i class="fa-solid ${item.icon}"></i><span>${item.label}</span>
        </a>
      </li>`).join('');
    list.querySelectorAll('[data-tab]').forEach((a) => {
      a.addEventListener('click', (e) => { e.preventDefault(); showSection(a.dataset.tab); });
    });
  }

  /* --------------------------- auth flow ------------------------------ */
  function showAuthScreen() {
    document.body.classList.remove('authed');
  }
  function showApp() {
    document.body.classList.add('authed');
  }

  function applyUser() {
    const u = state.user;
    state.portal = u.portal;
    $('current-user-name').textContent = u.name;
    $('current-user-role-label').textContent = portalLabel(u.portal);
    $('role-badge-display').textContent = portalLabel(u.portal) + ' Portal';
    $('active-role-label').textContent = portalLabel(u.portal);
    $('current-user-avatar').textContent = initials(u.name);
    $('btn-logout').style.display = '';
    $('btn-signin').style.display = 'none';
    $('sidebar-user-box').style.display = 'flex';
    buildMenu();
    showApp();
    showSection(NAV[state.portal][0].tab);
  }

  function applyGuest() {
    state.portal = 'guest';
    state.user = null;
    state.selected = new Set();
    $('current-user-name').textContent = 'Guest';
    $('current-user-role-label').textContent = 'Browsing';
    $('role-badge-display').textContent = 'Guest';
    $('active-role-label').textContent = 'Guest';
    $('current-user-avatar').textContent = 'GU';
    $('btn-logout').style.display = 'none';
    $('btn-signin').style.display = '';
    $('sidebar-user-box').style.display = 'flex';
    buildMenu();
    showApp();
    showSection('tab-user-gyms');
  }

  function portalLabel(p) {
    return p === 'superadmin' ? 'Superadmin' : p === 'admin' ? 'Admin' : p === 'trainer' ? 'Trainer' : p === 'guest' ? 'Guest' : 'User';
  }
  function initials(name) {
    return String(name || '?').trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  }

  function logoImg(url, alt) {
    return url ? '<img class="gym-logo" src="' + esc(url) + '" alt="' + esc(alt) + ' logo">'
      : '<div class="gym-logo gym-logo-fallback">' + esc(initials(alt || 'Gym')) + '</div>';
  }

  async function restoreSession() {
    try {
      const d = await api('api/auth/me.php');
      state.user = d;
      applyUser();
    } catch (err) {
      showAuthScreen();
    }
  }

  $('form-login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $('login-email').value.trim();
    try {
      const d = await api('api/auth/login.php', {
        method: 'POST',
        body: { email, password: $('login-password').value },
      });
      state.user = { ...d, name: d.name };
      await restoreSession();
      toast('Welcome back, ' + d.name + ' (' + portalLabel(d.portal) + ')');
    } catch (err) {
      if (/verify your email/i.test(err.message || '')) {
        $('verify-email').value = email;
        switchAuthStep('form-verify');
      }
      toast(err.message, 'error');
    }
  });

  $('form-register').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const d = await api('api/auth/register.php', {
        method: 'POST',
        body: {
          name: $('reg-name').value.trim(),
          email: $('reg-email').value.trim(),
          password: $('reg-password').value,
          phone: $('reg-phone').value.trim(),
          goal: $('reg-goal').value,
        },
      });
      if (d.portal) {
        state.user = d;
        await restoreSession();
      }
      toast(d.message || 'Account created.');
      if (d.portal) {
        switchAuthStep('form-login');
      } else {
        switchAuthStep('form-verify');
        $('verify-email').value = $('reg-email').value.trim();
        $('login-email').value = $('reg-email').value.trim();
      }
    } catch (err) {
      toast(err.message, 'error');
    }
  });

  $('btn-logout').addEventListener('click', async () => {
    try { await api('api/auth/logout.php', { method: 'POST', body: {} }); } catch (e) { /* ignore */ }
    state.user = null; state.portal = null;
    showAuthScreen();
    $('login-email').value = ''; $('login-password').value = '';
  });

  $('btn-signin').addEventListener('click', () => {
    showAuthScreen();
    switchAuthStep('form-login');
  });

  $('btn-browse-guest').addEventListener('click', () => {
    applyGuest();
    toast('Browsing as guest. Sign in to follow gyms.');
  });

  /* auth tab switching */
  const authSteps = () => document.querySelectorAll('.auth-form-step');
  function switchAuthStep(id) {
    authSteps().forEach((f) => f.classList.remove('active'));
    $(id).classList.add('active');
  }
  function showLoginForm() {
    document.querySelectorAll('.auth-tab-btn').forEach((b) => b.classList.toggle('active', b.dataset.authMode === 'login'));
    switchAuthStep('form-login');
  }
  document.querySelectorAll('.auth-tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.auth-tab-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const mode = btn.dataset.authMode;
      switchAuthStep(mode === 'login' ? 'form-login' : 'form-register');
    });
  });

  /* forgot password (contact superadmin) + email verification steps */
  async function loadForgotInfo() {
    try {
      const d = await api('api/auth/forgot.php', { method: 'POST', body: {} });
      $('forgot-sa-email').textContent = (d.superadmin_email ? d.superadmin_name + ' &middot; ' + d.superadmin_email : 'Contact the Superadmin through the admin panel.');
    } catch (err) {
      $('forgot-sa-email').textContent = err.message;
    }
  }
  $('link-forgot').addEventListener('click', (e) => {
    e.preventDefault();
    loadForgotInfo();
    switchAuthStep('form-forgot');
  });
  $('back-to-login-forgot').addEventListener('click', showLoginForm);
  $('back-to-login-verify').addEventListener('click', showLoginForm);

  $('form-verify').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $('verify-email').value.trim();
    if (!email) { toast('Enter your email address.', 'error'); return; }
    try {
      const d = await api('api/auth/resend.php', { method: 'POST', body: { email } });
      toast(d.message || 'Verification link sent.');
      showLoginForm();
    } catch (err) { toast(err.message, 'error'); }
  });
  $('form-reset').addEventListener('submit', async (e) => {
    e.preventDefault();
    const p1 = $('reset-pass').value;
    if (p1 !== $('reset-pass2').value) { toast('Passwords do not match.', 'error'); return; }
    try {
      const d = await api('api/auth/reset.php', { method: 'POST', body: { token: state.resetToken, password: p1 } });
      toast(d.message || 'Password updated.');
      state.resetToken = null;
      showLoginForm();
    } catch (err) { toast(err.message, 'error'); }
  });

  /* modal close buttons + overlay click */
  document.querySelectorAll('[data-close]').forEach((btn) => {
    btn.addEventListener('click', () => closeModal(btn.dataset.close));
  });
  document.querySelectorAll('.modal-overlay').forEach((ov) => {
    ov.addEventListener('click', (e) => { if (e.target === ov) ov.classList.remove('active'); });
  });
  $('menu-toggle').addEventListener('click', () => $('sidebar').classList.toggle('collapsed'));

  document.addEventListener('click', (e) => {
    const goto = e.target.closest('[data-goto]');
    if (goto) { e.preventDefault(); showSection(goto.dataset.goto); }
  });

  /* ======================================================================
     SUPERADMIN
     ====================================================================== */
  function statusBadge(status) {
    const map = {
      active: '<span class="badge badge-emerald">Active</span>',
      pending: '<span class="badge badge-amber">Pending</span>',
      expired: '<span class="badge badge-neutral">Expired</span>',
      rejected: '<span class="badge badge-rose">Rejected</span>',
      suspended: '<span class="badge badge-rose">Suspended</span>',
      inactive: '<span class="badge badge-neutral">Inactive</span>',
    };
    return map[status] || '<span class="badge badge-neutral">' + esc(status) + '</span>';
  }

  async function loadSuperadminDashboard() {
    try {
      const d = await api('api/superadmin/metrics.php');
      const cards = [
        ['fa-user-shield', 'icon-blue',    d.admins,        'Admins',      'Active: ' + d.active_admins],
        ['fa-building',    'icon-emerald', d.active_admins, 'Active Gyms', 'Managing the platform'],
        ['fa-user-ninja',  'icon-purple',  d.trainers,      'Trainers',    'Across all gyms'],
        ['fa-box-open',    'icon-orange',  d.products,      'Products',    'Across all gyms'],
        ['fa-user',        'icon-teal',    d.users,         'Members',     'Registered users'],
      ];
      $('sa-metrics-grid').innerHTML = cards.map(([icon, color, val, label, sub]) => `
        <div class="metric-card">
          <div class="metric-header">
            <div class="metric-icon ${color}"><i class="fa-solid ${icon}"></i></div>
            <span class="trend trend-neutral">${esc(sub)}</span>
          </div>
          <div class="metric-body"><h3>${Number(val || 0)}</h3><p>${esc(label)}</p></div>
        </div>`).join('');
    } catch (err) { $('sa-metrics-grid').innerHTML = '<p class="text-muted">' + esc(err.message) + '</p>'; }
  }

  async function loadSuperadminAdmins() {
    try {
      const d = await api('api/superadmin/admins.php');
      $('sa-admins-tbody').innerHTML = d.admins.map((a) => `
        <tr>
          <td>
            <div class="cell-user">
              ${logoImg(a.logo_url, a.gym_name)}
              <div>
                <strong>${esc(a.name)}</strong>
                <br><span class="text-muted text-sm">${esc(a.email)}</span>
              </div>
            </div>
          </td>
          <td>${esc(a.gym_name) || '-'}</td>
          <td class="text-sm">${esc(a.phone) || '-'}<br>${esc(a.address) || ''}</td>
          <td>${statusBadge(a.status)}</td>
          <td class="text-right">
            <button class="btn btn-outline btn-sm" onclick="window.gm.editAdmin(${a.id})"><i class="fa-solid fa-pen"></i></button>
            <button class="btn btn-outline btn-sm" onclick="window.gm.toggleAdmin(${a.id},'${a.status === 'active' ? 'suspended' : 'active'}')"><i class="fa-solid ${a.status === 'active' ? 'fa-ban' : 'fa-play'}"></i></button>
            <button class="btn btn-outline btn-sm btn-danger" onclick="window.gm.deleteAdmin(${a.id})"><i class="fa-solid fa-trash"></i></button>
          </td>
        </tr>`).join('') || emptyRow('No admins yet.');
    } catch (err) { $('sa-admins-tbody').innerHTML = emptyRow(err.message); }
  }

  /* ------------------ superadmin forms & actions ---------------------- */
  $('btn-add-admin').addEventListener('click', () => openAdminModal());
  function renderLogoPreview(containerId, url, gymName) {
    const c = $(containerId);
    if (!c) return;
    c.innerHTML = url
      ? '<img class="gym-logo gym-logo-lg" src="' + esc(url) + '" alt="logo preview"> <span class="text-muted text-sm">Logo preview (used everywhere the gym appears).</span>'
      : '<div class="gym-logo gym-logo-lg gym-logo-fallback">' + esc(initials(gymName || 'Gym')) + '</div> <span class="text-muted text-sm">No logo yet &mdash; gym initials will be used. Upload an image above.</span>';
  }
  function openAdminModal(admin) {
    $('modal-sa-admin-title').textContent = admin ? 'Edit Admin' : 'Add Admin';
    $('sa-admin-id').value = admin ? admin.id : '';
    $('sa-admin-name').value = admin ? admin.name : '';
    $('sa-admin-gym').value = admin ? admin.gym_name : '';
    $('sa-admin-email').value = admin ? admin.email : '';
    $('sa-admin-pass').value = '';
    $('sa-admin-pass').required = !admin;
    $('sa-admin-pass').placeholder = admin ? 'Leave blank to keep current' : 'Min. 6 characters';
    $('sa-admin-phone').value = admin ? admin.phone : '';
    $('sa-admin-address').value = admin ? admin.address : '';
    $('sa-admin-logo').value = admin ? admin.logo_url : '';
    $('sa-admin-logo-file').value = '';
    $('sa-admin-logo-file').required = !admin;
    renderLogoPreview('sa-admin-logo-preview', admin ? admin.logo_url : '', admin ? admin.gym_name : '');
    $('sa-admin-desc').value = admin ? admin.description : '';
    $('sa-admin-status').value = admin ? admin.status : 'active';
    openModal('modal-sa-admin');
  }
  $('sa-admin-logo-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!isImageFile(file)) { toast('Please choose an image file (PNG, JPG, WEBP or GIF).', 'error'); e.target.value = ''; return; }
    if (file.size > 2 * 1024 * 1024) { toast('Image must be smaller than 2 MB.', 'error'); e.target.value = ''; return; }
    try {
      const url = await uploadLogo(file);
      $('sa-admin-logo').value = url;
      renderLogoPreview('sa-admin-logo-preview', url, $('sa-admin-gym').value);
      toast('Logo uploaded.');
    } catch (err) { toast(err.message, 'error'); e.target.value = ''; }
  });
  $('sa-admin-gym').addEventListener('input', () => renderLogoPreview('sa-admin-logo-preview', $('sa-admin-logo').value, $('sa-admin-gym').value));
  $('form-sa-admin').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = $('sa-admin-id').value;
    if (!id && !$('sa-admin-logo').value) {
      toast('Please upload a gym logo (required).', 'error');
      return;
    }
    const payload = {
      name: $('sa-admin-name').value.trim(),
      gym_name: $('sa-admin-gym').value.trim(),
      email: $('sa-admin-email').value.trim(),
      phone: $('sa-admin-phone').value.trim(),
      address: $('sa-admin-address').value.trim(),
      logo_url: $('sa-admin-logo').value.trim(),
      description: $('sa-admin-desc').value.trim(),
      status: $('sa-admin-status').value,
    };
    if ($('sa-admin-pass').value) payload.password = $('sa-admin-pass').value;
    try {
      await api('api/superadmin/admins.php', { method: id ? 'PUT' : 'POST', body: id ? { id, ...payload } : payload });
      closeModal('modal-sa-admin');
      toast(id ? 'Admin updated.' : 'Admin account created.');
      loadSuperadminAdmins();
    } catch (err) { toast(err.message, 'error'); }
  });

  /* ======================================================================
     ADMIN
     ====================================================================== */
  async function loadAdminDashboard() {
    try {
      const d = await api('api/admin/dashboard.php');
      $('admin-dash-title').textContent = state.user.gym_name
        ? 'Dashboard - ' + state.user.gym_name : 'Admin Dashboard';
      const cards = [
        ['fa-box-open', 'icon-orange', d.products, 'Products', d.active_products + ' active'],
        ['fa-users', 'icon-blue', d.users, 'Gym Users', 'Created by you'],
        ['fa-user-ninja', 'icon-purple', d.trainers, 'Trainers', d.active_trainers + ' active'],
        ['fa-coins', 'icon-emerald', money(d.inventory_value), 'Inventory Value', 'Stock x price'],
      ];
      $('admin-metrics-grid').innerHTML = cards.map(([icon, color, val, label, sub]) => `
        <div class="metric-card">
          <div class="metric-header">
            <div class="metric-icon ${color}"><i class="fa-solid ${icon}"></i></div>
            <span class="trend trend-neutral">${esc(sub)}</span>
          </div>
          <div class="metric-body"><h3>${val}</h3><p>${esc(label)}</p></div>
        </div>`).join('');
    } catch (err) { $('admin-metrics-grid').innerHTML = '<p class="text-muted">' + esc(err.message) + '</p>'; }
  }

  /* ------------------ admin gym profile ------------------------------- */
  $('btn-admin-profile').addEventListener('click', async () => {
    try {
      const d = await api('api/auth/me.php');
      $('ap-gym-name').value = d.gym_name || '';
      $('ap-logo').value = d.logo_url || '';
      $('ap-logo-file').value = '';
      $('ap-phone').value = d.phone || '';
      $('ap-address').value = d.address || '';
      $('ap-description').value = d.description || '';
      updateLogoPreview();
      openModal('modal-admin-profile');
    } catch (err) { toast(err.message, 'error'); }
  });
  function updateLogoPreview() {
    const url = $('ap-logo').value.trim();
    const gymName = $('ap-gym-name').value.trim();
    $('ap-logo-preview-label').innerHTML = url
      ? '<img class="gym-logo gym-logo-sm" src="' + esc(url) + '" alt="logo preview"> Logo preview (used everywhere the gym appears).'
      : '<div class="gym-logo gym-logo-sm gym-logo-fallback">' + esc(initials(gymName || 'Gym')) + '</div> Preview: gym initials are used automatically when no logo is set. Upload an image to set the logo.';
  }
  $('ap-gym-name').addEventListener('input', updateLogoPreview);
  $('ap-logo-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!isImageFile(file)) { toast('Please choose an image file (PNG, JPG, WEBP or GIF).', 'error'); e.target.value = ''; return; }
    if (file.size > 2 * 1024 * 1024) { toast('Image must be smaller than 2 MB.', 'error'); e.target.value = ''; return; }
    try {
      const url = await uploadLogo(file);
      $('ap-logo').value = url;
      updateLogoPreview();
      toast('Logo uploaded.');
    } catch (err) { toast(err.message, 'error'); e.target.value = ''; }
  });
  $('form-admin-profile').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      gym_name: $('ap-gym-name').value.trim(),
      logo_url: $('ap-logo').value.trim(),
      phone: $('ap-phone').value.trim(),
      address: $('ap-address').value.trim(),
      description: $('ap-description').value.trim(),
    };
    try {
      await api('api/admin/profile.php', { method: 'PUT', body: payload });
      closeModal('modal-admin-profile');
      state.user = { ...state.user, ...payload };
      toast('Gym profile updated.');
      loadAdminDashboard();
    } catch (err) { toast(err.message, 'error'); }
  });

  async function loadAdminProducts() {
    try {
      const d = await api('api/admin/products.php');
      const cat = $('admin-product-cat-filter').value;
      const rows = d.products.filter((p) => cat === 'all' || p.category === cat);
      $('admin-products-tbody').innerHTML = rows.map((p) => `
        <tr>
          <td><strong>${esc(p.name)}</strong><br><span class="text-muted text-sm">${esc(p.description || '')}</span></td>
          <td>${esc(p.category)}</td>
          <td>${money(p.price)}</td>
          <td>${p.stock}</td>
          <td>${statusBadge(p.status)}</td>
          <td>${fmtDate(p.created_at)}</td>
          <td class="text-right">
            <button class="btn btn-outline btn-sm" onclick="window.gm.editProduct(${p.id})"><i class="fa-solid fa-pen"></i></button>
            <button class="btn btn-outline btn-sm btn-danger" onclick="window.gm.deleteProduct(${p.id})"><i class="fa-solid fa-trash"></i></button>
          </td>
        </tr>`).join('') || emptyRow('No products yet. Add your first product.');
    } catch (err) { $('admin-products-tbody').innerHTML = emptyRow(err.message); }
  }

  function openProductModal(product) {
    $('modal-product-title').textContent = product ? 'Edit Product' : 'Add Product';
    $('product-id').value = product ? product.id : '';
    $('product-name').value = product ? product.name : '';
    $('product-category').value = product ? product.category : 'Supplement';
    $('product-price').value = product ? product.price : '';
    $('product-stock').value = product ? product.stock : 1;
    $('product-status').value = product ? product.status : 'active';
    $('product-image').value = product ? product.image_url : '';
    $('product-desc').value = product ? product.description : '';
    openModal('modal-product');
  }
  $('form-product').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = $('product-id').value;
    const payload = {
      name: $('product-name').value.trim(),
      category: $('product-category').value,
      price: $('product-price').value,
      stock: $('product-stock').value,
      status: $('product-status').value,
      image_url: $('product-image').value.trim(),
      description: $('product-desc').value.trim(),
    };
    try {
      await api('api/admin/products.php', { method: id ? 'PUT' : 'POST', body: id ? { id, ...payload } : payload });
      closeModal('modal-product');
      toast(id ? 'Product updated.' : 'Product added.');
      loadAdminProducts();
    } catch (err) { toast(err.message, 'error'); }
  });

  async function loadAdminUsers() {
    try {
      const d = await api('api/admin/users.php');
      const q = $('admin-user-search').value.trim().toLowerCase();
      const rows = d.users.filter((u) => !q || (u.name + ' ' + u.email).toLowerCase().includes(q));
      $('admin-users-tbody').innerHTML = rows.map((u) => `
        <tr>
          <td><strong>${esc(u.name)}</strong></td>
          <td>${esc(u.email)}</td>
          <td>${esc(u.phone) || '-'}</td>
          <td>${esc(u.goal) || '-'}</td>
          <td>${fmtDate(u.created_at)}</td>
          <td class="text-right">
            <button class="btn btn-outline btn-sm" onclick="window.gm.editAdminUser(${u.id})"><i class="fa-solid fa-pen"></i></button>
            <button class="btn btn-outline btn-sm btn-danger" onclick="window.gm.deleteAdminUser(${u.id})"><i class="fa-solid fa-trash"></i></button>
          </td>
        </tr>`).join('') || emptyRow('No users in your gym yet.');
    } catch (err) { $('admin-users-tbody').innerHTML = emptyRow(err.message); }
  }

  function openUserModal(user) {
    $('modal-user-title').textContent = user ? 'Edit User' : 'Add User';
    $('user-id').value = user ? user.id : '';
    $('user-name').value = user ? user.name : '';
    $('user-email').value = user ? user.email : '';
    $('user-pass').value = '';
    $('user-pass').required = !user;
    $('user-pass').placeholder = user ? 'Leave blank to keep current' : 'Min. 6 characters';
    $('user-phone').value = user ? user.phone : '';
    $('user-goal').value = user ? user.goal || '' : '';
    openModal('modal-user');
  }
  $('form-user').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = $('user-id').value;
    const payload = {
      name: $('user-name').value.trim(),
      email: $('user-email').value.trim(),
      phone: $('user-phone').value.trim(),
      goal: $('user-goal').value.trim(),
    };
    if ($('user-pass').value) payload.password = $('user-pass').value;
    try {
      await api('api/admin/users.php', { method: id ? 'PUT' : 'POST', body: id ? { id, ...payload } : payload });
      closeModal('modal-user');
      toast(id ? 'User updated.' : 'User created.');
      loadAdminUsers();
    } catch (err) { toast(err.message, 'error'); }
  });

  async function loadAdminTrainers() {
    try {
      const d = await api('api/admin/trainers.php');
      $('admin-trainers-tbody').innerHTML = d.trainers.map((t) => `
        <tr>
          <td><strong>${esc(t.name)}</strong><br><span class="text-muted text-sm">${esc(t.certifications || '')}</span></td>
          <td>${esc(t.email)}</td>
          <td>${esc(t.specialization) || '-'}</td>
          <td>${t.experience} yrs</td>
          <td>${money(t.salary)}</td>
          <td>${statusBadge(t.status)}</td>
          <td class="text-right">
            <button class="btn btn-outline btn-sm" onclick="window.gm.editAdminTrainer(${t.id})"><i class="fa-solid fa-pen"></i></button>
            <button class="btn btn-outline btn-sm btn-danger" onclick="window.gm.deleteTrainer(${t.id})"><i class="fa-solid fa-trash"></i></button>
          </td>
        </tr>`).join('') || emptyRow('No trainers yet. Add them with a login account.');
    } catch (err) { $('admin-trainers-tbody').innerHTML = emptyRow(err.message); }
  }

  /* ------------------ trainer modal (admin only) ---------------------- */
  function openTrainerModal(trainer) {
    $('modal-trainer-title').textContent = trainer ? 'Edit Trainer' : 'Add Trainer';
    $('trainer-id').value = trainer ? trainer.id : '';
    $('trainer-name').value = trainer ? trainer.name : '';
    $('trainer-email').value = trainer ? trainer.email : '';
    $('trainer-pass').value = '';
    $('trainer-pass').required = !trainer;
    $('trainer-pass').placeholder = trainer ? 'Leave blank to keep current' : 'Min. 6 characters';
    $('trainer-spec').value = trainer ? trainer.specialization : '';
    $('trainer-exp').value = trainer ? trainer.experience : 1;
    $('trainer-phone').value = trainer ? trainer.phone : '';
    $('trainer-salary').value = trainer ? trainer.salary : 0;
    $('trainer-certs').value = trainer ? trainer.certifications : '';
    $('trainer-status').value = trainer ? trainer.status : 'active';
    openModal('modal-trainer');
  }
  $('form-trainer').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = $('trainer-id').value;
    const payload = {
      name: $('trainer-name').value.trim(),
      email: $('trainer-email').value.trim(),
      specialization: $('trainer-spec').value.trim(),
      experience: $('trainer-exp').value,
      phone: $('trainer-phone').value.trim(),
      salary: $('trainer-salary').value,
      certifications: $('trainer-certs').value.trim(),
      status: $('trainer-status').value,
    };
    if ($('trainer-pass').value) payload.password = $('trainer-pass').value;
    try {
      await api('api/admin/trainers.php', { method: id ? 'PUT' : 'POST', body: id ? { id, ...payload } : payload });
      closeModal('modal-trainer');
      toast(id ? 'Trainer updated.' : 'Trainer added with login access.');
      loadAdminTrainers();
    } catch (err) { toast(err.message, 'error'); }
  });

  /* ------------------ equipment (admin) ------------------------------ */
  async function loadAdminEquipment() {
    try {
      const d = await api('api/admin/equipment.php');
      $('admin-equipment-tbody').innerHTML = d.equipment.map((e) => `
        <tr>
          <td><strong>${esc(e.name)}</strong><br><span class="text-muted text-sm">${esc(e.description || '')}</span></td>
          <td>${esc(e.category) || '-'}</td>
          <td>${e.quantity}</td>
          <td>${statusBadge(e.status)}</td>
          <td>${fmtDate(e.created_at)}</td>
          <td class="text-right">
            <button class="btn btn-outline btn-sm" onclick="window.gm.editEquipment(${e.id})"><i class="fa-solid fa-pen"></i></button>
            <button class="btn btn-outline btn-sm btn-danger" onclick="window.gm.deleteEquipment(${e.id})"><i class="fa-solid fa-trash"></i></button>
          </td>
        </tr>`).join('') || emptyRow('No equipment yet. Add your gym equipment.');
    } catch (err) { $('admin-equipment-tbody').innerHTML = emptyRow(err.message); }
  }

  function openEquipmentModal(eq) {
    $('modal-equipment-title').textContent = eq ? 'Edit Equipment' : 'Add Equipment';
    $('equipment-id').value = eq ? eq.id : '';
    $('equipment-name').value = eq ? eq.name : '';
    $('equipment-category').value = eq ? eq.category || '' : '';
    $('equipment-quantity').value = eq ? eq.quantity : 1;
    $('equipment-status').value = eq ? eq.status : 'active';
    $('equipment-desc').value = eq ? eq.description : '';
    openModal('modal-equipment');
  }
  $('form-equipment').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = $('equipment-id').value;
    const payload = {
      name: $('equipment-name').value.trim(),
      category: $('equipment-category').value.trim(),
      quantity: $('equipment-quantity').value,
      status: $('equipment-status').value,
      description: $('equipment-desc').value.trim(),
    };
    try {
      await api('api/admin/equipment.php', { method: id ? 'PUT' : 'POST', body: id ? { id, ...payload } : payload });
      closeModal('modal-equipment');
      toast(id ? 'Equipment updated.' : 'Equipment added.');
      loadAdminEquipment();
    } catch (err) { toast(err.message, 'error'); }
  });
  $('btn-add-equipment').addEventListener('click', () => openEquipmentModal(null));

  /* ======================================================================
     TRAINER
     ====================================================================== */
  async function loadTrainerDashboard() {
    try {
      const d = await api('api/trainer/dashboard.php');
      $('trainer-dash-title').textContent = 'Trainer Dashboard - ' + state.user.name;
      $('trainer-gym-box').innerHTML = `
        <div class="cell-user">
          ${logoImg(d.logo_url, d.gym_name)}
          <div>
            <p><strong>${esc(d.gym_name)}</strong></p>
            <span class="text-muted text-sm">${esc(d.address || '')}</span>
          </div>
        </div>
        ${d.gym_description ? '<p class="text-muted text-sm" style="margin-top:10px;">' + esc(d.gym_description) + '</p>' : ''}`;
      const cards = [
        ['fa-users', 'icon-blue', d.metrics.members, 'Gym Members', 'Registered at your gym'],
        ['fa-box-open', 'icon-orange', d.metrics.products, 'Active Products', 'Sold by your gym'],
        ['fa-dumbbell', 'icon-emerald', d.metrics.member_gyms, 'Gym Followers', 'Members following the gym'],
      ];
      $('trainer-metrics-grid').innerHTML = cards.map(([icon, color, val, label, sub]) => `
        <div class="metric-card">
          <div class="metric-header">
            <div class="metric-icon ${color}"><i class="fa-solid ${icon}"></i></div>
            <span class="trend trend-neutral">${esc(sub)}</span>
          </div>
          <div class="metric-body"><h3>${Number(val || 0)}</h3><p>${esc(label)}</p></div>
        </div>`).join('');
      $('trainer-members-tbody').innerHTML = d.members.map((m) => `
        <tr>
          <td><strong>${esc(m.name)}</strong></td>
          <td>${esc(m.email)}</td>
          <td>${esc(m.phone) || '-'}</td>
          <td>${esc(m.goal) || '-'}</td>
          <td>${fmtDate(m.created_at)}</td>
        </tr>`).join('') || emptyRow('No members at your gym yet.');
    } catch (err) {
      $('trainer-gym-box').innerHTML = '<p class="text-muted">' + esc(err.message) + '</p>';
      $('trainer-members-tbody').innerHTML = emptyRow(err.message);
    }
  }

  /* ======================================================================
     USER
     ====================================================================== */
  async function loadUserDashboard() {
    try {
      const d = await api('api/user/dashboard.php');
      $('user-dash-title').textContent = 'Member Dashboard - ' + state.user.name;
      const cards = [
        ['fa-dumbbell', 'icon-orange', d.selected_gyms, 'Selected Gyms', 'You follow these'],
        ['fa-box-open', 'icon-blue', d.products_count, 'Products Available', 'From your gyms'],
        ['fa-building', 'icon-emerald', d.gyms_available, 'Gyms Online', 'Active on the platform'],
      ];
      $('user-metrics-grid').innerHTML = cards.map(([icon, color, val, label, sub]) => `
        <div class="metric-card">
          <div class="metric-header">
            <div class="metric-icon ${color}"><i class="fa-solid ${icon}"></i></div>
            <span class="trend trend-neutral">${esc(sub)}</span>
          </div>
          <div class="metric-body"><h3>${Number(val || 0)}</h3><p>${esc(label)}</p></div>
        </div>`).join('');
      const h = d.home_gym;
      $('user-home-gym-box').innerHTML = h
        ? `<div class="cell-user">
             ${logoImg(h.logo_url, h.gym_name)}
             <div>
               <p><strong>${esc(h.gym_name)}</strong> &mdash; managed by ${esc(h.admin_name)}</p>
               <span class="text-muted text-sm">${esc(h.address || '')}</span>
             </div>
           </div>`
        : '<p class="text-muted">No home gym assigned. Browse gyms and select one.</p>';

      const mine = d.selected_gyms_list || [];
      $('user-my-gyms-grid').innerHTML = mine.map((g) => `
        <div class="gym-card">
          <div class="gym-card-head">
            <div class="cell-user">
              ${logoImg(g.logo_url, g.gym_name)}
              <h3>${esc(g.gym_name)}</h3>
            </div>
            <span class="badge badge-emerald">Selected</span>
          </div>
          <div class="gym-card-loc"><i class="fa-solid fa-location-dot"></i>${esc(g.address || 'N/A')}</div>
          <div class="gym-card-desc">${esc(g.description || 'No description yet.')}</div>
          <div class="gym-card-meta">
            <span><i class="fa-solid fa-user-shield"></i> ${esc(g.admin_name)}</span>
            <span><i class="fa-solid fa-phone"></i> ${esc(g.phone || '-')}</span>
          </div>
          <div class="gym-card-stats">
            <span><i class="fa-solid fa-box-open"></i> ${Number(g.product_count || 0)} products</span>
            <span><i class="fa-solid fa-user-ninja"></i> ${Number(g.trainer_count || 0)} trainers</span>
            <span><i class="fa-solid fa-dumbbell"></i> ${Number(g.equipment_count || 0)} equipment</span>
          </div>
        </div>`).join('') || emptyState('You have not selected any gyms yet. Browse gyms and choose the ones you need.');
    } catch (err) { $('user-metrics-grid').innerHTML = '<p class="text-muted">' + esc(err.message) + '</p>'; }
  }

  /* ------------------ user change password (via Gmail) --------------- */
  $('btn-user-changepass').addEventListener('click', () => {
    $('cp-email-display').textContent = state.user.email || '';
    openModal('modal-user-changepass');
  });
  $('btn-cp-send').addEventListener('click', async () => {
    const btn = $('btn-cp-send');
    btn.disabled = true;
    try {
      const d = await api('api/user/change-password.php', { method: 'POST', body: {} });
      toast(d.message || 'Verification link sent.');
      closeModal('modal-user-changepass');
    } catch (err) { toast(err.message, 'error'); }
    btn.disabled = false;
  });
  $('link-user-browse-gyms').addEventListener('click', (e) => {
    e.preventDefault();
    showSection('tab-user-gyms');
  });

  async function loadUserGyms() {
    try {
      const d = await api('api/public/gyms.php');
      state.gyms = d.gyms;
      state.selected = new Set((d.selected || []).map(String));
      $('user-gyms-grid').innerHTML = d.gyms.map((g) => {
        const followed = state.selected.has(String(g.id));
        const isGuest = state.portal === 'guest';
        return `
        <div class="gym-card">
          <div class="gym-card-head">
            <div class="cell-user">
              ${logoImg(g.logo_url, g.gym_name)}
              <h3>${esc(g.gym_name)}</h3>
            </div>
            ${followed ? '<span class="badge badge-emerald">Following</span>' : '<span class="badge badge-neutral">Available</span>'}
          </div>
          <div class="gym-card-loc"><i class="fa-solid fa-location-dot"></i>${esc(g.address || 'N/A')}</div>
          <div class="gym-card-desc">${esc(g.description || 'No description yet.')}</div>
          <div class="gym-card-meta">
            <span><i class="fa-solid fa-user-shield"></i> ${esc(g.name)}</span>
            <span><i class="fa-solid fa-phone"></i> ${esc(g.phone || '-')}</span>
          </div>
          <button class="btn ${followed ? 'btn-outline' : 'btn-primary'} btn-sm" onclick="window.gm.toggleGym(${g.id}, ${followed})">
            ${followed ? '<i class="fa-solid fa-minus"></i> Unfollow' : '<i class="fa-solid fa-plus"></i> Select Gym'}
          </button>
          ${isGuest ? '<p class="text-muted text-sm" style="margin-top:8px;">Sign in to follow this gym.</p>' : ''}
        </div>`;
      }).join('') || emptyState('No gyms available yet.');
    } catch (err) { $('user-gyms-grid').innerHTML = emptyState(err.message); }
  }

  function emptyState(msg) {
    return '<div class="empty-state" style="grid-column:1/-1;"><i class="fa-solid fa-circle-info"></i>' + esc(msg) + '</div>';
  }

  async function toggleGym(adminId, currentlyFollowing) {
    if (state.portal === 'guest') {
      toast('Please sign in or create a member account to follow gyms.', 'info');
      showAuthScreen();
      return;
    }
    try {
      await api('api/user/gyms.php', { method: currentlyFollowing ? 'DELETE' : 'POST', body: { admin_id: adminId } });
      toast(currentlyFollowing ? 'Gym removed from selection.' : 'Gym selected.');
      loadUserGyms();
    } catch (err) { toast(err.message, 'error'); }
  }

  async function refreshGymSelects(keepValue) {
    try {
      const d = await api('api/public/gyms.php');
      state.gyms = d.gyms;
      [['user-product-gym-select'], ['user-trainer-gym-select'], ['user-equipment-gym-select'], ['user-class-gym-select']].forEach(([id]) => {
        const sel = $(id);
        if (!sel) return;
        const prev = keepValue || sel.value;
        sel.innerHTML = '<option value="">Choose a gym...</option>' + d.gyms.map((g) =>
          `<option value="${g.id}">${esc(g.gym_name)}</option>`).join('');
        sel.value = d.gyms.some((g) => String(g.id) === String(prev)) ? prev : '';
      });
    } catch (err) { toast(err.message, 'error'); }
  }

  async function loadUserProducts() {
    try {
      if (!state.gyms.length) { await refreshGymSelects(); }
      const gymId = $('user-product-gym-select').value;
      if (!gymId) {
        $('user-products-grid').innerHTML = emptyState('Select a gym to view its products.');
        return;
      }
      const d = await api(apiQuery('api/public/products.php', { gym_id: gymId }));
      const catIcon = { Supplement: 'fa-capsules', Merchandise: 'fa-shirt', Membership: 'fa-id-card', Service: 'fa-handshake' };
      $('user-products-grid').innerHTML = d.products.map((p) => `
        <div class="product-card">
          <div class="product-card-img"><i class="fa-solid ${catIcon[p.category] || 'fa-box-open'}"></i></div>
          <div class="product-card-body">
            <span class="product-card-cat">${esc(p.category)}</span>
            <h4>${esc(p.name)}</h4>
            <p class="product-card-desc">${esc(p.description || '')}</p>
            <div class="product-card-foot">
              <span class="product-price">${money(p.price)}</span>
              <span class="product-stock">Stock: ${p.stock}</span>
            </div>
          </div>
        </div>`).join('') || emptyState('No products at this gym yet.');
    } catch (err) { $('user-products-grid').innerHTML = emptyState(err.message); }
  }

  async function loadUserTrainers() {
    try {
      if (!state.gyms.length) { await refreshGymSelects(); }
      const gymId = $('user-trainer-gym-select').value;
      if (!gymId) {
        $('user-trainers-grid').innerHTML = emptyState('Select a gym to view its trainers.');
        return;
      }
      const d = await api(apiQuery('api/public/trainers.php', { gym_id: gymId }));
      $('user-trainers-grid').innerHTML = d.trainers.map((t) => `
        <div class="gym-card">
          <div class="gym-card-head">
            <h3><i class="fa-solid fa-user-ninja text-orange"></i> ${esc(t.name)}</h3>
            <span class="badge badge-emerald">Active</span>
          </div>
          <div class="gym-card-loc"><i class="fa-solid fa-bolt"></i>${esc(t.specialization || 'General Fitness')}</div>
          <div class="gym-card-meta">
            <span><i class="fa-solid fa-calendar-days"></i> ${t.experience} yrs exp</span>
            <span><i class="fa-solid fa-phone"></i> ${esc(t.phone || '-')}</span>
          </div>
          <p class="text-muted text-sm">${esc(t.certifications || '')}</p>
        </div>`).join('') || emptyState('No trainers at this gym.');
    } catch (err) { $('user-trainers-grid').innerHTML = emptyState(err.message); }
  }

  async function loadUserEquipment() {
    try {
      if (!state.gyms.length) { await refreshGymSelects(); }
      const gymId = $('user-equipment-gym-select').value;
      if (!gymId) {
        $('user-equipment-grid').innerHTML = emptyState('Select a gym to view its equipment.');
        return;
      }
      const d = await api(apiQuery('api/public/equipment.php', { gym_id: gymId }));
      const catIcon = { Cardio: 'fa-heart-pulse', Strength: 'fa-dumbbell', Functional: 'fa-bolt', Flexibility: 'fa-person-walking', Machines: 'fa-gears', Recovery: 'fa-spa' };
      $('user-equipment-grid').innerHTML = d.equipment.map((e) => `
        <div class="product-card">
          <div class="product-card-img"><i class="fa-solid ${catIcon[e.category] || 'fa-dumbbell'}"></i></div>
          <div class="product-card-body">
            <span class="product-card-cat">${esc(e.category) || 'Equipment'}</span>
            <h4>${esc(e.name)}</h4>
            <p class="product-card-desc">${esc(e.description || '')}</p>
            <div class="product-card-foot">
              <span class="product-price"><i class="fa-solid fa-layer-group"></i> ${Number(e.quantity || 1)} unit${Number(e.quantity || 1) > 1 ? 's' : ''}</span>
            </div>
          </div>
        </div>`).join('') || emptyState('No equipment at this gym yet.');
    } catch (err) { $('user-equipment-grid').innerHTML = emptyState(err.message); }
  }

  /* ======================================================================
     PROFESSIONAL FEATURES
     attendance, progress, workout/diet plans, classes, billing,
     announcements, reports, notifications
     ====================================================================== */

  /* ------------------------ small shared helpers ----------------------- */
  function todayISO() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function pill(status) {
    const map = {
      active: '<span class="badge badge-emerald">Active</span>',
      inactive: '<span class="badge badge-neutral">Inactive</span>',
      paid: '<span class="badge badge-emerald">Paid</span>',
      unpaid: '<span class="badge badge-rose">Unpaid</span>',
      partial: '<span class="badge badge-amber">Partial</span>',
      normal: '<span class="badge badge-neutral">Normal</span>',
      important: '<span class="badge badge-amber">Important</span>',
      urgent: '<span class="badge badge-rose">Urgent</span>',
    };
    return map[status] || '<span class="badge badge-neutral">' + esc(status) + '</span>';
  }

  function invoiceStatus(inv) {
    if (inv.status === 'paid') return '<span class="badge badge-emerald">Paid</span>';
    if (inv.status === 'partial') return '<span class="badge badge-amber">Partial</span>';
    return '<span class="badge badge-rose">Unpaid</span>';
  }

  function metricCard(icon, color, val, label, sub) {
    return '<div class="metric-card"><div class="metric-header"><div class="metric-icon ' + color + '"><i class="fa-solid ' + icon + '"></i></div><span class="trend trend-neutral">' + esc(sub || '') + '</span></div><div class="metric-body"><h3>' + esc(val) + '</h3><p>' + esc(label) + '</p></div></div>';
  }

  /* member caches (per portal) */
  let adminUsersCache = [];
  let trainerMembersCache = [];

  async function getAdminUsers(refresh) {
    if (refresh || !adminUsersCache.length) {
      const d = await api('api/admin/users.php');
      adminUsersCache = d.users || [];
    }
    return adminUsersCache;
  }

  async function getTrainerMembers(refresh) {
    if (refresh || !trainerMembersCache.length) {
      const d = await api('api/trainer/members.php');
      trainerMembersCache = d.members || [];
    }
    return trainerMembersCache;
  }

  async function fillAdminMemberSelects(selectIds) {
    const users = await getAdminUsers();
    const opts = users.map((u) => '<option value="' + u.id + '">' + esc(u.name) + '</option>').join('');
    (selectIds || ['admin-att-user', 'admin-progress-user', 'progress-user', 'invoice-user']).forEach((id) => {
      const sel = $(id);
      if (!sel) return;
      const prev = sel.value;
      const prefix = id === 'admin-att-user' ? '<option value="">All Members</option>' : '<option value="">-- Select member --</option>';
      sel.innerHTML = prefix + opts;
      sel.value = prev;
    });
  }

  function planApiBase() {
    return state.portal === 'trainer' ? 'api/trainer' : 'api/admin';
  }

  function reloadPlans() {
    if (state.portal === 'trainer') { loadTrainerWorkouts(); loadTrainerDiets(); loadTrainerClasses(); }
    else { loadAdminWorkouts(); loadAdminDiets(); loadAdminClasses(); }
  }

  /* ======================================================================
     ATTENDANCE (admin / trainer)
     ====================================================================== */
  async function loadAdminAttendance() {
    try {
      await fillAdminMemberSelects(['admin-att-user']);
      const date = $('admin-att-date').value || todayISO();
      const d = await api(apiQuery('api/admin/attendance.php', { date, user_id: $('admin-att-user').value || undefined }));
      const log = d.attendance || [];
      $('admin-attendance-tbody').innerHTML = log.map((r) => `
        <tr>
          <td><strong>${esc(r.user_name)}</strong></td>
          <td>${esc(r.member_code || '-')}</td>
          <td>${esc(r.check_in_at || '-')}</td>
          <td>${esc(r.checked_in_by || 'staff')}</td>
        </tr>`).join('') || emptyRow('No check-ins found for this date.');
      const unique = new Set(log.map((r) => r.user_id || r.member_id)).size;
      const stats = d.stats || {};
      $('admin-att-stats-grid').innerHTML =
        metricCard('fa-fingerprint', 'icon-blue', stats.checks_today !== undefined ? stats.checks_today : log.length, 'Check-ins Today', 'On ' + date) +
        metricCard('fa-users', 'icon-emerald', stats.members_today !== undefined ? stats.members_today : unique, 'Members Checked In', 'On this date') +
        metricCard('fa-calendar-check', 'icon-orange', log.length, 'Records Shown', 'Filtered log');
    } catch (err) { $('admin-attendance-tbody').innerHTML = emptyRow(err.message); }
  }

  async function loadTrainerAttendance() {
    try {
      const date = $('trainer-att-date').value || todayISO();
      const d = await api(apiQuery('api/trainer/attendance.php', { date }));
      const log = d.attendance || [];
      $('trainer-attendance-tbody').innerHTML = log.map((r) => `
        <tr>
          <td><strong>${esc(r.user_name)}</strong></td>
          <td>${esc(r.member_code || '-')}</td>
          <td>${esc(r.check_in_at || '-')}</td>
          <td>${esc(r.checked_in_by || 'staff')}</td>
        </tr>`).join('') || emptyRow('No check-ins on this date.');
    } catch (err) { $('trainer-attendance-tbody').innerHTML = emptyRow(err.message); }
  }

  function fillCheckinSelect() {
    const sel = $('checkin-user');
    if (!sel) return;
    const users = state.portal === 'trainer' ? trainerMembersCache : adminUsersCache;
    sel.innerHTML = '<option value="">-- Select member --</option>' + users.map((u) =>
      '<option value="' + u.id + '" data-code="' + esc(u.member_code || u.code || '') + '">' + esc(u.name) + (u.member_code ? ' &middot; ' + esc(u.member_code) : '') + '</option>').join('');
  }

  async function openCheckinModal() {
    try {
      if (state.portal === 'trainer') await getTrainerMembers(true);
      else await getAdminUsers(true);
      fillCheckinSelect();
      $('checkin-code').value = '';
      $('checkin-user').value = '';
      openModal('modal-checkin');
    } catch (err) { toast(err.message, 'error'); }
  }

  async function doCheckin() {
    const code = $('checkin-code').value.trim().toUpperCase();
    const uid = $('checkin-user').value;
    if (!code && !uid) { toast('Enter a member code or pick a member.', 'error'); return; }
    const label = code || (($('checkin-user').selectedOptions[0] || {}).textContent || '').trim();
    try {
      await api(planApiBase() + '/attendance.php', { method: 'POST', body: code ? { member_code: code } : { user_id: uid } });
      toast('Check-in recorded for ' + label + '.');
      closeModal('modal-checkin');
      if (state.portal === 'trainer') loadTrainerAttendance(); else loadAdminAttendance();
    } catch (err) { toast(err.message, 'error'); }
  }

  /* ======================================================================
     PROGRESS (admin)
     ====================================================================== */
  async function loadAdminProgress() {
    try {
      await fillAdminMemberSelects(['admin-progress-user', 'progress-user']);
      const sel = $('admin-progress-user');
      if (!sel.value) {
        $('admin-progress-tbody').innerHTML = emptyRow('Select a member to see their progress.');
        $('admin-progress-summary').innerHTML = '';
        return;
      }
      const d = await api(apiQuery('api/admin/progress.php', { user_id: sel.value }));
      const entries = d.progress || [];
      $('admin-progress-tbody').innerHTML = entries.map((e) => `
        <tr>
          <td>${fmtDate(e.recorded_at)}</td>
          <td>${e.weight ?? '-'}</td>
          <td>${e.body_fat ?? '-'}</td>
          <td>${e.bmi ?? '-'}</td>
          <td>${e.chest ?? '-'}</td>
          <td>${e.waist ?? '-'}</td>
          <td>${e.arms ?? '-'}</td>
          <td class="text-muted text-sm">${esc(e.notes || '')}</td>
          <td class="text-right">
            <button class="btn btn-outline btn-sm" onclick="window.gm.editProgress(${e.id})"><i class="fa-solid fa-pen"></i></button>
            <button class="btn btn-outline btn-sm btn-danger" onclick="window.gm.deleteProgress(${e.id})"><i class="fa-solid fa-trash"></i></button>
          </td>
        </tr>`).join('') || emptyRow('No progress records for this member yet.');
      const last = entries[0] || {};
      $('admin-progress-summary').innerHTML =
        metricCard('fa-weight-scale', 'icon-orange', last.weight ?? '-', 'Weight (kg)', 'Latest entry') +
        metricCard('fa-percent', 'icon-blue', last.body_fat ?? '-', 'Body Fat (%)', 'Latest entry') +
        metricCard('fa-heart-pulse', 'icon-emerald', last.bmi ?? '-', 'BMI', 'Latest entry') +
        metricCard('fa-arrow-trend-up', 'icon-purple', entries.length, 'Total Entries', 'Recorded');
    } catch (err) { $('admin-progress-tbody').innerHTML = emptyRow(err.message); }
  }

  function openProgressModal(entry) {
    $('modal-progress-title').textContent = entry ? 'Edit Progress Record' : 'Add Progress Record';
    $('progress-id').value = entry ? entry.id : '';
    $('progress-user').value = entry ? entry.user_id : ($('admin-progress-user').value || '');
    $('progress-date').value = entry ? fmtDate(entry.recorded_at) : todayISO();
    $('progress-weight').value = entry ? entry.weight : '';
    $('progress-bodyfat').value = entry ? entry.body_fat : '';
    $('progress-bmi').value = entry ? entry.bmi : '';
    $('progress-chest').value = entry ? entry.chest : '';
    $('progress-waist').value = entry ? entry.waist : '';
    $('progress-arms').value = entry ? entry.arms : '';
    $('progress-notes').value = entry ? entry.notes : '';
    openModal('modal-progress');
  }

  $('form-progress').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = $('progress-id').value;
    const payload = {
      user_id: $('progress-user').value,
      recorded_at: $('progress-date').value,
      weight: $('progress-weight').value || null,
      body_fat: $('progress-bodyfat').value || null,
      bmi: $('progress-bmi').value || null,
      chest: $('progress-chest').value || null,
      waist: $('progress-waist').value || null,
      arms: $('progress-arms').value || null,
      notes: $('progress-notes').value.trim(),
    };
    try {
      await api('api/admin/progress.php', { method: id ? 'PUT' : 'POST', body: id ? { id, ...payload } : payload });
      closeModal('modal-progress');
      toast(id ? 'Progress record updated.' : 'Progress record added.');
      loadAdminProgress();
    } catch (err) { toast(err.message, 'error'); }
  });

  /* ======================================================================
     WORKOUT PLANS (admin / trainer)
     ====================================================================== */
  function workoutExerciseRow(ex) {
    const e = ex || {};
    return '<div class="ex-row form-row">' +
      '<div class="form-group col-2"><input type="text" class="form-control wx-day" placeholder="Day" value="' + esc(e.day_label || '') + '"></div>' +
      '<div class="form-group col-3"><input type="text" class="form-control wx-name" placeholder="Exercise name" value="' + esc(e.name || '') + '"></div>' +
      '<div class="form-group col-2"><input type="number" class="form-control wx-sets" placeholder="Sets" value="' + (e.sets || '') + '"></div>' +
      '<div class="form-group col-2"><input type="text" class="form-control wx-reps" placeholder="Reps" value="' + esc(e.reps || '') + '"></div>' +
      '<div class="form-group col-2"><input type="text" class="form-control wx-rest" placeholder="Rest" value="' + esc(e.rest || '') + '"></div>' +
      '<div class="form-group col-1"><button type="button" class="btn btn-outline btn-sm btn-danger" onclick="this.closest(\'.ex-row\').remove()"><i class="fa-solid fa-xmark"></i></button></div>' +
      '</div>';
  }

  function adminWorkoutCard(p) {
    const exs = p.exercises || [];
    const shown = exs.slice(0, 4);
    return `
      <div class="admin-plan-card">
        <div class="admin-plan-head">
          <div>
            <span class="plan-cat">${esc(p.difficulty || 'General')} &middot; ${p.days_per_week || 0} days/wk</span>
            <h4 style="margin:4px 0 0;">${esc(p.title)}</h4>
          </div>
          ${pill(p.status)}
        </div>
        ${p.description ? '<p class="text-muted text-sm">' + esc(p.description) + '</p>' : ''}
        <ul class="plan-ex-list">
          ${shown.map((e) => '<li><i class="fa-solid fa-dumbbell"></i> <strong>' + esc(e.name) + '</strong> <span class="text-muted text-sm">' + esc(e.day_label || '') + ' &middot; ' + (e.sets || 0) + 'x' + esc(e.reps || 0) + (e.rest ? ' &middot; rest ' + esc(e.rest) : '') + '</span></li>').join('')}
          ${exs.length > 4 ? '<li class="text-muted text-sm"><i class="fa-solid fa-plus"></i> ' + (exs.length - 4) + ' more exercises</li>' : ''}
        </ul>
        <div class="admin-plan-actions">
          <button class="btn btn-outline btn-sm" onclick="window.gm.editWorkout(${p.id})"><i class="fa-solid fa-pen"></i></button>
          <button class="btn btn-outline btn-sm" onclick="window.gm.assignWorkout(${p.id})"><i class="fa-solid fa-user-plus"></i> ${p.assigned_count || 0}</button>
          <button class="btn btn-outline btn-sm btn-danger" onclick="window.gm.deleteWorkout(${p.id})"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>`;
  }

  async function loadAdminWorkouts() {
    try {
      const d = await api('api/admin/workouts.php');
      $('admin-workouts-grid').innerHTML = (d.plans || []).map(adminWorkoutCard).join('') || emptyState('No workout plans yet. Create one to get started.');
    } catch (err) { $('admin-workouts-grid').innerHTML = emptyState(err.message); }
  }

  async function loadTrainerWorkouts() {
    try {
      const d = await api('api/trainer/workouts.php');
      $('trainer-workouts-grid').innerHTML = (d.plans || []).map(adminWorkoutCard).join('') || emptyState('No workout plans yet. Create one to get started.');
    } catch (err) { $('trainer-workouts-grid').innerHTML = emptyState(err.message); }
  }

  function openWorkoutModal(plan) {
    $('modal-workout-title').textContent = plan ? 'Edit Workout Plan' : 'New Workout Plan';
    $('workout-id').value = plan ? plan.id : '';
    $('workout-title').value = plan ? plan.title : '';
    $('workout-days').value = plan ? plan.days_per_week : 3;
    $('workout-difficulty').value = plan ? plan.difficulty : 'Beginner';
    $('workout-status').value = plan ? plan.status : 'active';
    $('workout-desc').value = plan ? plan.description : '';
    const exs = (plan && plan.exercises && plan.exercises.length) ? plan.exercises : [{}];
    $('workout-exercises-rows').innerHTML = exs.map(workoutExerciseRow).join('');
    openModal('modal-workout');
  }

  $('form-workout').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = $('workout-id').value;
    const exercises = Array.from(document.querySelectorAll('#workout-exercises-rows .ex-row')).map((r) => ({
      day_label: r.querySelector('.wx-day').value.trim(),
      name: r.querySelector('.wx-name').value.trim(),
      sets: r.querySelector('.wx-sets').value,
      reps: r.querySelector('.wx-reps').value.trim(),
      rest: r.querySelector('.wx-rest').value.trim(),
    })).filter((x) => x.name);
    if (!exercises.length) { toast('Add at least one exercise.', 'error'); return; }
    const payload = {
      title: $('workout-title').value.trim(),
      days_per_week: $('workout-days').value,
      difficulty: $('workout-difficulty').value,
      status: $('workout-status').value,
      description: $('workout-desc').value.trim(),
      exercises,
    };
    try {
      await api(planApiBase() + '/workouts.php', { method: id ? 'PUT' : 'POST', body: id ? { id, ...payload } : payload });
      closeModal('modal-workout');
      toast(id ? 'Workout plan updated.' : 'Workout plan created.');
      if (state.portal === 'trainer') loadTrainerWorkouts(); else loadAdminWorkouts();
    } catch (err) { toast(err.message, 'error'); }
  });

  let currentAssignIds = [];

  async function openAssignWorkout(planId) {
    try {
      const d = await api(planApiBase() + '/workouts.php');
      const plan = (d.plans || []).find((p) => String(p.id) === String(planId));
      if (!plan) throw new Error('Workout plan not found.');
      $('assign-workout-id').value = planId;
      $('assign-workout-title').textContent = plan.title;
      const users = state.portal === 'trainer' ? await getTrainerMembers() : await getAdminUsers();
      currentAssignIds = (plan.assigned_user_ids || []).map(String);
      const assigned = new Set(currentAssignIds);
      $('assign-workout-members').innerHTML = users.map((u) =>
        '<label class="checkbox-item"><input type="checkbox" class="assign-mem" value="' + u.id + '"' + (assigned.has(String(u.id)) ? ' checked' : '') + '> ' + esc(u.name) + ' <span class="text-muted text-sm">' + esc(u.email) + '</span></label>'
      ).join('') || '<p class="text-muted">No members yet. Add members first.</p>';
      openModal('modal-assign-workout');
    } catch (err) { toast(err.message, 'error'); }
  }

  $('form-assign-workout').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = $('assign-workout-id').value;
    const assignUsers = Array.from(document.querySelectorAll('#assign-workout-members .assign-mem:checked')).map((c) => c.value);
    const prev = new Set(currentAssignIds);
    const next = new Set(assignUsers.map(String));
    const added = assignUsers.filter((u) => !prev.has(String(u)));
    const removed = Array.from(prev).filter((u) => !next.has(u));
    if (!added.length && !removed.length) { closeModal('modal-assign-workout'); toast('No changes to assignments.'); return; }
    try {
      if (state.portal === 'trainer') {
        if (added.length) await api('api/trainer/workouts.php', { method: 'POST', body: { action: 'assign', plan_id: id, user_ids: added } });
        if (removed.length) await api('api/trainer/workouts.php', { method: 'POST', body: { action: 'unassign', plan_id: id, user_ids: removed } });
      } else {
        if (added.length) await api('api/admin/workout-assignments.php', { method: 'POST', body: { plan_id: id, user_ids: added } });
        for (const uid of removed) await api('api/admin/workout-assignments.php', { method: 'DELETE', body: { plan_id: id, user_id: uid } });
      }
      closeModal('modal-assign-workout');
      toast('Assignments updated for ' + assignUsers.length + ' member(s).');
      if (state.portal === 'trainer') loadTrainerWorkouts(); else loadAdminWorkouts();
    } catch (err) { toast(err.message, 'error'); }
  });

  /* ======================================================================
     DIET PLANS (admin / trainer)
     ====================================================================== */
  function dietMealRow(m) {
    const x = m || {};
    return '<div class="meal-row-editor form-row">' +
      '<div class="form-group col-2"><input type="text" class="form-control meal-day" placeholder="Day" value="' + esc(x.day_label || '') + '"></div>' +
      '<div class="form-group col-2"><input type="text" class="form-control meal-type" placeholder="Meal" value="' + esc(x.meal_type || '') + '"></div>' +
      '<div class="form-group col-3"><input type="text" class="form-control meal-name" placeholder="Food" value="' + esc(x.name || '') + '"></div>' +
      '<div class="form-group col-1"><input type="number" class="form-control meal-cals" placeholder="kcal" value="' + (x.calories || '') + '"></div>' +
      '<div class="form-group col-1"><input type="text" class="form-control meal-p" placeholder="P" value="' + (x.protein || '') + '"></div>' +
      '<div class="form-group col-1"><input type="text" class="form-control meal-c" placeholder="C" value="' + (x.carbs || '') + '"></div>' +
      '<div class="form-group col-1"><input type="text" class="form-control meal-f" placeholder="F" value="' + (x.fat || '') + '"></div>' +
      '<div class="form-group col-1"><button type="button" class="btn btn-outline btn-sm btn-danger" onclick="this.closest(\'.meal-row-editor\').remove()"><i class="fa-solid fa-xmark"></i></button></div>' +
      '</div>';
  }

  function adminDietCard(p) {
    const meals = p.meals || [];
    const shown = meals.slice(0, 4);
    return `
      <div class="admin-plan-card">
        <div class="admin-plan-head">
          <div>
            <span class="plan-cat">${esc(p.goal || 'Nutrition')} &middot; ${Number(p.target_calories || 0)} kcal</span>
            <h4 style="margin:4px 0 0;">${esc(p.title)}</h4>
          </div>
          ${pill(p.status)}
        </div>
        ${p.description ? '<p class="text-muted text-sm">' + esc(p.description) + '</p>' : ''}
        <ul class="plan-ex-list">
          ${shown.map((m) => '<li><i class="fa-solid fa-utensils"></i> <strong>' + esc(m.name) + '</strong> <span class="text-muted text-sm">' + esc(m.day_label || '') + ' &middot; ' + esc(m.meal_type || '') + ' &middot; ' + Number(m.calories || 0) + ' kcal</span></li>').join('')}
          ${meals.length > 4 ? '<li class="text-muted text-sm"><i class="fa-solid fa-plus"></i> ' + (meals.length - 4) + ' more meals</li>' : ''}
        </ul>
        <div class="admin-plan-actions">
          <button class="btn btn-outline btn-sm" onclick="window.gm.editDiet(${p.id})"><i class="fa-solid fa-pen"></i></button>
          <button class="btn btn-outline btn-sm" onclick="window.gm.assignDiet(${p.id})"><i class="fa-solid fa-user-plus"></i> ${p.assigned_count || 0}</button>
          <button class="btn btn-outline btn-sm btn-danger" onclick="window.gm.deleteDiet(${p.id})"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>`;
  }

  async function loadAdminDiets() {
    try {
      const d = await api('api/admin/diets.php');
      $('admin-diets-grid').innerHTML = (d.plans || []).map(adminDietCard).join('') || emptyState('No diet plans yet. Create one to get started.');
    } catch (err) { $('admin-diets-grid').innerHTML = emptyState(err.message); }
  }

  async function loadTrainerDiets() {
    try {
      const d = await api('api/trainer/diets.php');
      $('trainer-diets-grid').innerHTML = (d.plans || []).map(adminDietCard).join('') || emptyState('No diet plans yet. Create one to get started.');
    } catch (err) { $('trainer-diets-grid').innerHTML = emptyState(err.message); }
  }

  function openDietModal(plan) {
    $('modal-diet-title').textContent = plan ? 'Edit Diet Plan' : 'New Diet Plan';
    $('diet-id').value = plan ? plan.id : '';
    $('diet-title').value = plan ? plan.title : '';
    $('diet-calories').value = plan ? plan.target_calories : 2000;
    $('diet-goal').value = plan ? plan.goal : '';
    $('diet-status').value = plan ? plan.status : 'active';
    $('diet-desc').value = plan ? plan.description : '';
    const meals = (plan && plan.meals && plan.meals.length) ? plan.meals : [{}];
    $('diet-meals-rows').innerHTML = meals.map(dietMealRow).join('');
    openModal('modal-diet');
  }

  $('form-diet').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = $('diet-id').value;
    const meals = Array.from(document.querySelectorAll('#diet-meals-rows .meal-row-editor')).map((r) => ({
      day_label: r.querySelector('.meal-day').value.trim(),
      meal_type: r.querySelector('.meal-type').value.trim(),
      name: r.querySelector('.meal-name').value.trim(),
      calories: r.querySelector('.meal-cals').value,
      protein: r.querySelector('.meal-p').value,
      carbs: r.querySelector('.meal-c').value,
      fat: r.querySelector('.meal-f').value,
    })).filter((x) => x.name);
    if (!meals.length) { toast('Add at least one meal.', 'error'); return; }
    const payload = {
      title: $('diet-title').value.trim(),
      target_calories: $('diet-calories').value,
      goal: $('diet-goal').value.trim(),
      status: $('diet-status').value,
      description: $('diet-desc').value.trim(),
      meals,
    };
    try {
      await api(planApiBase() + '/diets.php', { method: id ? 'PUT' : 'POST', body: id ? { id, ...payload } : payload });
      closeModal('modal-diet');
      toast(id ? 'Diet plan updated.' : 'Diet plan created.');
      if (state.portal === 'trainer') loadTrainerDiets(); else loadAdminDiets();
    } catch (err) { toast(err.message, 'error'); }
  });

  async function openAssignDiet(planId) {
    try {
      const d = await api(planApiBase() + '/diets.php');
      const plan = (d.plans || []).find((p) => String(p.id) === String(planId));
      if (!plan) throw new Error('Diet plan not found.');
      $('assign-diet-id').value = planId;
      $('assign-diet-title').textContent = plan.title;
      const users = state.portal === 'trainer' ? await getTrainerMembers() : await getAdminUsers();
      currentAssignIds = (plan.assigned_user_ids || []).map(String);
      const assigned = new Set(currentAssignIds);
      $('assign-diet-members').innerHTML = users.map((u) =>
        '<label class="checkbox-item"><input type="checkbox" class="assign-mem" value="' + u.id + '"' + (assigned.has(String(u.id)) ? ' checked' : '') + '> ' + esc(u.name) + ' <span class="text-muted text-sm">' + esc(u.email) + '</span></label>'
      ).join('') || '<p class="text-muted">No members yet. Add members first.</p>';
      openModal('modal-assign-diet');
    } catch (err) { toast(err.message, 'error'); }
  }

  $('form-assign-diet').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = $('assign-diet-id').value;
    const assignUsers = Array.from(document.querySelectorAll('#assign-diet-members .assign-mem:checked')).map((c) => c.value);
    const prev = new Set(currentAssignIds);
    const next = new Set(assignUsers.map(String));
    const added = assignUsers.filter((u) => !prev.has(String(u)));
    const removed = Array.from(prev).filter((u) => !next.has(u));
    if (!added.length && !removed.length) { closeModal('modal-assign-diet'); toast('No changes to assignments.'); return; }
    try {
      if (state.portal === 'trainer') {
        if (added.length) await api('api/trainer/diets.php', { method: 'POST', body: { action: 'assign', plan_id: id, user_ids: added } });
        if (removed.length) await api('api/trainer/diets.php', { method: 'POST', body: { action: 'unassign', plan_id: id, user_ids: removed } });
      } else {
        if (added.length) await api('api/admin/diet-assignments.php', { method: 'POST', body: { plan_id: id, user_ids: added } });
        for (const uid of removed) await api('api/admin/diet-assignments.php', { method: 'DELETE', body: { plan_id: id, user_id: uid } });
      }
      closeModal('modal-assign-diet');
      toast('Assignments updated for ' + assignUsers.length + ' member(s).');
      if (state.portal === 'trainer') loadTrainerDiets(); else loadAdminDiets();
    } catch (err) { toast(err.message, 'error'); }
  });

  /* ======================================================================
     GROUP CLASSES (admin / trainer / user)
     ====================================================================== */
  function classCard(c) {
    return `
      <div class="class-card">
        <div class="class-card-header">
          <span class="class-category">${esc(c.day_of_week || '')}</span>
          ${pill(c.status)}
        </div>
        <h4 class="class-card-title">${esc(c.name)}</h4>
        <div class="class-info-item"><i class="fa-solid fa-clock"></i> ${esc(c.start_time || '')} - ${esc(c.end_time || '')}</div>
        <div class="class-info-item"><i class="fa-solid fa-location-dot"></i> ${esc(c.location || 'Studio')}</div>
        <div class="class-info-item"><i class="fa-solid fa-user-ninja"></i> ${esc(c.trainer_name || 'Any trainer')}</div>
        <div class="class-info-item"><i class="fa-solid fa-users"></i> ${c.booked_count || 0} / ${c.capacity || 15} booked</div>
        <div class="admin-plan-actions">
          <button class="btn btn-outline btn-sm" onclick="window.gm.rosterClass(${c.id})"><i class="fa-solid fa-users"></i> Roster</button>
          <button class="btn btn-outline btn-sm" onclick="window.gm.editClass(${c.id})"><i class="fa-solid fa-pen"></i></button>
          <button class="btn btn-outline btn-sm btn-danger" onclick="window.gm.deleteClass(${c.id})"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>`;
  }

  async function loadAdminClasses() {
    try {
      const d = await api('api/admin/classes.php');
      $('admin-classes-grid').innerHTML = (d.classes || []).map(classCard).join('') || emptyState('No classes yet. Schedule your first class.');
    } catch (err) { $('admin-classes-grid').innerHTML = emptyState(err.message); }
  }

  async function loadTrainerClasses() {
    try {
      const d = await api('api/trainer/classes.php');
      $('trainer-classes-grid').innerHTML = (d.classes || []).map(classCard).join('') || emptyState('No classes yet. Schedule your first class.');
    } catch (err) { $('trainer-classes-grid').innerHTML = emptyState(err.message); }
  }

  async function openClassModal(cls) {
    const trainersEl = $('class-trainer');
    if (state.portal === 'trainer') {
      trainersEl.innerHTML = '<option value="">-- Assign trainer --</option>';
    } else {
      try {
        const t = await api('api/admin/trainers.php');
        trainersEl.innerHTML = '<option value="">-- Assign trainer --</option>' + (t.trainers || []).map((x) =>
          '<option value="' + x.id + '"' + (cls && String(cls.trainer_id) === String(x.id) ? ' selected' : '') + '>' + esc(x.name) + '</option>').join('');
      } catch (err) {
        trainersEl.innerHTML = '<option value="">-- Assign trainer --</option>';
      }
    }
    $('modal-class-title').textContent = cls ? 'Edit Class' : 'New Class';
    $('class-id').value = cls ? cls.id : '';
    $('class-name').value = cls ? cls.name : '';
    $('class-day').value = cls ? cls.day_of_week : 'Monday';
    $('class-location').value = cls ? cls.location : '';
    $('class-start').value = cls ? cls.start_time : '';
    $('class-end').value = cls ? cls.end_time : '';
    $('class-capacity').value = cls ? cls.capacity : 15;
    $('class-status').value = cls ? cls.status : 'active';
    $('class-desc').value = cls ? cls.description : '';
    openModal('modal-class');
  }

  $('form-class').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = $('class-id').value;
    const payload = {
      name: $('class-name').value.trim(),
      day_of_week: $('class-day').value,
      location: $('class-location').value.trim(),
      start_time: $('class-start').value,
      end_time: $('class-end').value,
      capacity: $('class-capacity').value,
      trainer_id: $('class-trainer').value || null,
      status: $('class-status').value,
      description: $('class-desc').value.trim(),
    };
    try {
      await api(planApiBase() + '/classes.php', { method: id ? 'PUT' : 'POST', body: id ? { id, ...payload } : payload });
      closeModal('modal-class');
      toast(id ? 'Class updated.' : 'Class created.');
      if (state.portal === 'trainer') loadTrainerClasses(); else loadAdminClasses();
    } catch (err) { toast(err.message, 'error'); }
  });

  /* class roster modal */
  let currentRosterClass = null;

  async function openRoster(cls) {
    currentRosterClass = cls;
    $('modal-roster-title').textContent = 'Class Roster - ' + (cls ? cls.name : '');
    const users = state.portal === 'trainer' ? await getTrainerMembers() : await getAdminUsers();
    $('roster-add-user').innerHTML = '<option value="">-- Add member --</option>' + users.map((u) => '<option value="' + u.id + '">' + esc(u.name) + '</option>').join('');
    renderRoster();
    openModal('modal-roster');
  }

  async function renderRoster() {
    try {
      const d = (state.portal === 'trainer')
        ? await api('api/trainer/classes.php', { method: 'POST', body: { action: 'roster', class_id: currentRosterClass.id } })
        : await api(apiQuery('api/admin/class-bookings.php', { class_id: currentRosterClass.id }));
      $('roster-tbody').innerHTML = (d.bookings || []).map((m) => `
        <tr>
          <td><strong>${esc(m.name)}</strong></td>
          <td>${esc(m.member_code || '-')}</td>
          <td class="text-right">
            <button class="btn btn-outline btn-sm btn-danger" onclick="window.gm.removeFromRoster(${m.user_id || m.id})"><i class="fa-solid fa-user-minus"></i></button>
          </td>
        </tr>`).join('') || emptyRow('No members in this class yet.');
    } catch (err) { $('roster-tbody').innerHTML = emptyRow(err.message); }
  }

  $('btn-roster-add').addEventListener('click', async () => {
    const uid = $('roster-add-user').value;
    if (!uid || !currentRosterClass) { toast('Select a member to add.', 'error'); return; }
    try {
      if (state.portal === 'trainer') {
        await api('api/trainer/classes.php', { method: 'POST', body: { action: 'book', class_id: currentRosterClass.id, user_id: uid } });
      } else {
        await api('api/admin/class-bookings.php', { method: 'POST', body: { class_id: currentRosterClass.id, user_id: uid } });
      }
      toast('Member added to class.');
      renderRoster();
    } catch (err) { toast(err.message, 'error'); }
  });

  /* ======================================================================
     INVOICES & PAYMENTS (admin / user)
     ====================================================================== */
  async function loadAdminInvoices() {
    try {
      await fillAdminMemberSelects(['invoice-user']);
      const d = await api('api/admin/invoices.php');
      const inv = d.invoices || [];
      $('admin-invoices-tbody').innerHTML = inv.map((i) => {
        const actions = (i.status !== 'paid'
          ? '<button class="btn btn-outline btn-sm" onclick="window.gm.payInvoice(' + i.id + ')"><i class="fa-solid fa-money-bill-wave"></i></button>'
          : '') +
          '<button class="btn btn-outline btn-sm" onclick="window.gm.editInvoice(' + i.id + ')"><i class="fa-solid fa-pen"></i></button>' +
          '<button class="btn btn-outline btn-sm btn-danger" onclick="window.gm.deleteInvoice(' + i.id + ')"><i class="fa-solid fa-trash"></i></button>';
        return '<tr>' +
          '<td><strong>' + esc(i.invoice_no || ('INV-' + i.id)) + '</strong></td>' +
          '<td>' + esc(i.user_name || i.name || '') + '</td>' +
          '<td>' + esc(i.title || '') + '</td>' +
          '<td>' + money(i.amount) + '</td>' +
          '<td>' + money(i.paid_amount) + '</td>' +
          '<td>' + invoiceStatus(i) + '</td>' +
          '<td>' + fmtDate(i.due_date) + '</td>' +
          '<td class="text-right">' + actions + '</td>' +
          '</tr>';
      }).join('') || emptyRow('No invoices yet. Issue one to a member.');
      const paid = inv.reduce((s, i) => s + Number(i.paid_amount || 0), 0);
      const billed = inv.reduce((s, i) => s + Number(i.amount || 0), 0);
      const pending = inv.filter((i) => i.status === 'unpaid' || i.status === 'partial').length;
      $('admin-invoice-stats').innerHTML =
        metricCard('fa-coins', 'icon-emerald', money(paid), 'Collected', 'Total paid') +
        metricCard('fa-file-invoice', 'icon-orange', money(billed), 'Billed', 'Total invoiced') +
        metricCard('fa-clock', 'icon-blue', pending, 'Pending', 'Unpaid invoices');
    } catch (err) { $('admin-invoices-tbody').innerHTML = emptyRow(err.message); }
  }

  function openInvoiceModal(inv) {
    $('modal-invoice-title').textContent = inv ? 'Edit Invoice' : 'New Invoice';
    $('invoice-id').value = inv ? inv.id : '';
    $('invoice-user').value = inv ? inv.user_id : '';
    $('invoice-title').value = inv ? inv.title : '';
    $('invoice-amount').value = inv ? inv.amount : '';
    $('invoice-due').value = inv ? fmtDate(inv.due_date) : '';
    $('invoice-desc').value = inv ? inv.description : '';
    openModal('modal-invoice');
  }

  $('form-invoice').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = $('invoice-id').value;
    const payload = {
      user_id: $('invoice-user').value,
      title: $('invoice-title').value.trim(),
      amount: $('invoice-amount').value,
      due_date: $('invoice-due').value || null,
      description: $('invoice-desc').value.trim(),
    };
    try {
      await api('api/admin/invoices.php', { method: id ? 'PUT' : 'POST', body: id ? { id, ...payload } : payload });
      closeModal('modal-invoice');
      toast(id ? 'Invoice updated.' : 'Invoice created.');
      loadAdminInvoices();
    } catch (err) { toast(err.message, 'error'); }
  });

  function openPayInvoice(inv) {
    $('pay-invoice-id').value = inv.id;
    $('pay-invoice-no').textContent = inv.invoice_no || ('INV-' + inv.id);
    $('pay-invoice-total').textContent = money(inv.amount);
    $('pay-invoice-paid').textContent = money(inv.paid_amount);
    $('pay-amount').value = (Number(inv.amount) - Number(inv.paid_amount)).toFixed(2);
    $('pay-method').value = '';
    openModal('modal-pay-invoice');
  }

  $('form-pay-invoice').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const id = $('pay-invoice-id').value;
      await api('api/admin/invoices.php', {
        method: 'POST',
        body: { action: 'pay', id, paid_amount: $('pay-amount').value, payment_method: $('pay-method').value },
      });
      closeModal('modal-pay-invoice');
      toast('Payment recorded.');
      loadAdminInvoices();
    } catch (err) { toast(err.message, 'error'); }
  });

  async function loadUserInvoices() {
    try {
      const d = await api('api/user/invoices.php');
      const inv = d.invoices || [];
      $('user-invoices-tbody').innerHTML = inv.map((i) => `
        <tr>
          <td><strong>${esc(i.invoice_no || ('INV-' + i.id))}</strong></td>
          <td>${esc(i.gym_name || '')}</td>
          <td>${esc(i.title || '')}</td>
          <td>${money(i.amount)}</td>
          <td>${money(i.paid_amount)}</td>
          <td>${invoiceStatus(i)}</td>
          <td>${fmtDate(i.due_date)}</td>
          <td>${fmtDate(i.paid_at)}</td>
        </tr>`).join('') || emptyRow('No invoices yet.');
      const billed = inv.reduce((s, i) => s + Number(i.amount || 0), 0);
      const paid = inv.reduce((s, i) => s + Number(i.paid_amount || 0), 0);
      $('user-invoice-stats').innerHTML =
        metricCard('fa-file-invoice', 'icon-orange', money(billed), 'Total Billed', 'Across your gyms') +
        metricCard('fa-circle-check', 'icon-emerald', money(paid), 'Total Paid', 'Cleared') +
        metricCard('fa-hourglass-half', 'icon-blue', money(Math.max(billed - paid, 0)), 'Outstanding', 'Still due');
    } catch (err) { $('user-invoices-tbody').innerHTML = emptyRow(err.message); }
  }

  /* ======================================================================
     ANNOUNCEMENTS (admin)
     ====================================================================== */
  async function loadAdminAnnouncements() {
    try {
      const d = await api('api/admin/announcements.php');
      $('admin-announcements-list').innerHTML = (d.announcements || []).map((a) => `
        <div class="announcement-card ${a.priority === 'urgent' ? 'ann-urgent' : a.priority === 'important' ? 'ann-important' : ''}">
          <div class="announcement-head">
            <h4>${esc(a.title)}</h4>
            ${pill(a.priority)}
          </div>
          <p class="text-muted">${esc(a.body || '')}</p>
          <div class="announcement-meta">
            <span><i class="fa-solid fa-calendar-days"></i> ${fmtDate(a.created_at)}</span>
            ${pill(a.status)}
          </div>
          <div class="admin-plan-actions">
            <button class="btn btn-outline btn-sm btn-danger" onclick="window.gm.deleteAnnouncement(${a.id})"><i class="fa-solid fa-trash"></i> Delete</button>
          </div>
        </div>`).join('') || emptyState('No announcements yet. Post one to notify your members.');
    } catch (err) { $('admin-announcements-list').innerHTML = emptyState(err.message); }
  }

  function openAnnouncementModal() {
    $('ann-title').value = '';
    $('ann-priority').value = 'normal';
    $('ann-status').value = 'active';
    $('ann-body').value = '';
    openModal('modal-announcement');
  }

  $('form-announcement').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      title: $('ann-title').value.trim(),
      priority: $('ann-priority').value,
      status: $('ann-status').value,
      body: $('ann-body').value.trim(),
    };
    try {
      await api('api/admin/announcements.php', { method: 'POST', body: payload });
      closeModal('modal-announcement');
      toast('Announcement posted. Members notified.');
      loadAdminAnnouncements();
    } catch (err) { toast(err.message, 'error'); }
  });

  /* ======================================================================
     REPORTS & ANALYTICS (admin)
     ====================================================================== */
  function drawBarChart(canvasId, labels, values, hue) {
    const c = $(canvasId);
    if (!c) return;
    const ctx = c.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const w = c.clientWidth || c.parentElement.clientWidth || 420;
    const h = 220;
    c.width = w * dpr; c.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    if (!labels || !labels.length || !values || !values.length) {
      ctx.fillStyle = '#94a3b8'; ctx.font = '13px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('No data yet', w / 2, h / 2);
      return;
    }
    const colors = { orange: '#f97316', blue: '#3b82f6', emerald: '#10b981' };
    const padL = 44, padB = 24, padT = 12, padR = 8;
    const plotW = w - padL - padR, plotH = h - padT - padB;
    const nums = values.map(Number);
    const max = Math.max.apply(null, nums.concat([1]));
    const steps = 4;
    ctx.strokeStyle = 'rgba(148,163,184,0.18)';
    ctx.font = '11px sans-serif';
    for (let i = 0; i <= steps; i++) {
      const y = padT + plotH - (i / steps) * plotH;
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - padR, y); ctx.stroke();
      ctx.fillStyle = '#94a3b8'; ctx.textAlign = 'right';
      ctx.fillText(String(Math.round(max * i / steps)), padL - 6, y + 4);
    }
    const gap = plotW / labels.length;
    const bw = Math.min(34, gap * 0.55);
    ctx.textAlign = 'center';
    labels.forEach((lb, i) => {
      const v = nums[i] || 0;
      const bh = (v / max) * plotH;
      const x = padL + gap * i + (gap - bw) / 2;
      const y = padT + plotH - bh;
      ctx.fillStyle = colors[hue] || '#f97316';
      ctx.fillRect(x, y, bw, Math.max(bh, 1));
      ctx.fillStyle = '#94a3b8'; ctx.font = '10px sans-serif';
      ctx.fillText(String(lb).slice(0, 8), padL + gap * i + gap / 2, h - 8);
    });
  }

  function drawLineChart(canvasId, labels, values) {
    const c = $(canvasId);
    if (!c) return;
    const ctx = c.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const w = c.clientWidth || c.parentElement.clientWidth || 420;
    const h = 200;
    c.width = w * dpr; c.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    if (!labels || !labels.length || !values || !values.length) {
      ctx.fillStyle = '#94a3b8'; ctx.font = '13px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('No data yet', w / 2, h / 2);
      return;
    }
    const padL = 44, padB = 24, padT = 12, padR = 8;
    const plotW = w - padL - padR, plotH = h - padT - padB;
    const nums = values.map(Number);
    const max = Math.max.apply(null, nums.concat([1]));
    const min = Math.min.apply(null, nums.concat([0]));
    const range = Math.max(max - min, 1);
    const gap = labels.length > 1 ? plotW / (labels.length - 1) : plotW;
    const px = (i) => padL + (labels.length > 1 ? gap * i : gap / 2);
    const py = (v) => padT + plotH - ((v - min) / range) * plotH;
    ctx.strokeStyle = 'rgba(148,163,184,0.18)';
    ctx.font = '11px sans-serif';
    for (let i = 0; i <= 4; i++) {
      const y = padT + plotH - (i / 4) * plotH;
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - padR, y); ctx.stroke();
      ctx.fillStyle = '#94a3b8'; ctx.textAlign = 'right';
      ctx.fillText(String(Math.round(min + (range * i / 4))), padL - 6, y + 4);
    }
    ctx.strokeStyle = '#f97316'; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
    ctx.beginPath();
    nums.forEach((v, i) => { const X = px(i), Y = py(v); i === 0 ? ctx.moveTo(X, Y) : ctx.lineTo(X, Y); });
    ctx.stroke();
    ctx.lineWidth = 1;
    nums.forEach((v, i) => {
      const X = px(i), Y = py(v);
      ctx.fillStyle = '#f97316';
      ctx.beginPath(); ctx.arc(X, Y, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#94a3b8'; ctx.textAlign = 'center'; ctx.font = '10px sans-serif';
      ctx.fillText(String(labels[i]).slice(0, 8), X, h - 8);
    });
  }

  function downloadCSV(filename, rows) {
    const csv = rows.map((r) => r.map((v) => '"' + String(v ?? '').replace(/"/g, '""') + '"').join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function downloadReportCsv(report) {
    window.location.href = apiUrl(apiQuery('api/admin/reports.php', { report, format: 'csv' }));
  }

  async function loadAdminReports() {
    try {
      const [o, c] = await Promise.all([
        api(apiQuery('api/admin/reports.php', { report: 'overview' })),
        api(apiQuery('api/admin/reports.php', { report: 'classes' })),
      ]);
      const k = o.kpis || {};
      $('admin-reports-kpis').innerHTML =
        metricCard('fa-coins', 'icon-emerald', money(k.revenue_collected), 'Collected Revenue', 'All time') +
        metricCard('fa-users', 'icon-blue', k.members || 0, 'Total Members', 'Registered') +
        metricCard('fa-fingerprint', 'icon-orange', k.attendance_today || 0, 'Check-ins Today', 'Today') +
        metricCard('fa-calendar-day', 'icon-purple', k.classes || 0, 'Classes', 'Scheduled');
      const rev = o.monthly_revenue || [];
      const att = o.attendance_trend || [];
      const mem = o.member_growth || [];
      drawBarChart('chart-revenue', rev.map((r) => r.label), rev.map((r) => Number(r.v || 0)), 'orange');
      drawBarChart('chart-attendance', att.map((r) => r.label), att.map((r) => Number(r.v || 0)), 'blue');
      drawBarChart('chart-members', mem.map((r) => r.label), mem.map((r) => Number(r.v || 0)), 'emerald');
      const classes = c.rows || [];
      $('admin-reports-classes-tbody').innerHTML = classes.map((cl) => {
        const fill = Math.round((Number(cl.booked || 0) / Math.max(1, Number(cl.capacity || 1))) * 100);
        return '<tr>' +
          '<td><strong>' + esc(cl.name) + '</strong></td>' +
          '<td>' + esc(cl.day_of_week || '') + ' ' + esc(cl.start_time || '') + '</td>' +
          '<td>' + (cl.capacity || 0) + '</td>' +
          '<td>' + (cl.booked || 0) + '</td>' +
          '<td><div class="fill-bar"><div class="fill-bar-inner" style="width:' + Math.min(fill, 100) + '%"></div></div><span class="text-muted text-sm">' + fill + '%</span></td>' +
          '</tr>';
      }).join('') || emptyRow('No classes yet.');
    } catch (err) {
      $('admin-reports-kpis').innerHTML = '';
      $('admin-reports-classes-tbody').innerHTML = emptyRow(err.message);
    }
  }

  /* ======================================================================
     TRAINER: MEMBERS
     ====================================================================== */
  async function loadTrainerMembers() {
    try {
      const d = await api('api/trainer/members.php');
      trainerMembersCache = d.members || [];
      $('trainer-members-list-tbody').innerHTML = trainerMembersCache.map((m) => `
        <tr>
          <td><strong>${esc(m.name)}</strong></td>
          <td>${esc(m.email)}</td>
          <td>${esc(m.phone) || '-'}</td>
          <td>${esc(m.goal) || '-'}</td>
          <td>${esc(m.member_code || '-')}</td>
          <td>${fmtDate(m.created_at)}</td>
        </tr>`).join('') || emptyRow('No members at your gym yet.');
    } catch (err) { $('trainer-members-list-tbody').innerHTML = emptyRow(err.message); }
  }

  /* ======================================================================
     USER: ATTENDANCE, PROGRESS, PLANS, CLASSES, INVOICES, NOTIFICATIONS
     ====================================================================== */
  async function loadUserAttendance() {
    try {
      const [d, db] = await Promise.all([
        api('api/user/checkin.php'),
        api('api/user/dashboard.php'),
      ]);
      const code = db.member_code;
      $('user-member-code-box').innerHTML = code
        ? '<div class="member-code-box"><div><i class="fa-solid fa-id-card"></i></div><div><span class="text-muted text-sm">Show this code at the front desk</span><h3 style="margin:2px 0 0;letter-spacing:2px;">' + esc(code) + '</h3></div></div>'
        : '<p class="text-muted">No member code assigned yet. Ask your gym admin to create one.</p>';
      const log = d.attendance || [];
      $('user-attendance-tbody').innerHTML = log.map((r) => `
        <tr>
          <td><strong>${esc(r.gym_name || 'My Gym')}</strong></td>
          <td>${esc(r.check_in_at || '-')}</td>
          <td>${esc(r.checked_in_by || 'check-in')}</td>
        </tr>`).join('') || emptyRow('No check-ins yet. Check in when you arrive at the gym.');
    } catch (err) { $('user-attendance-tbody').innerHTML = emptyRow(err.message); }
  }

  async function loadUserProgress() {
    try {
      const d = await api('api/user/progress.php');
      const entries = d.progress || [];
      $('user-progress-tbody').innerHTML = entries.map((e) => `
        <tr>
          <td>${fmtDate(e.recorded_at)}</td>
          <td>${e.weight ?? '-'}</td>
          <td>${e.body_fat ?? '-'}</td>
          <td>${e.bmi ?? '-'}</td>
          <td>${e.chest ?? '-'}</td>
          <td>${e.waist ?? '-'}</td>
          <td>${e.arms ?? '-'}</td>
          <td class="text-muted text-sm">${esc(e.notes || '')}</td>
        </tr>`).join('') || emptyRow('No progress logged yet. Log your first entry.');
      const last = entries[0] || {};
      $('user-progress-summary').innerHTML =
        metricCard('fa-weight-scale', 'icon-orange', last.weight ?? '-', 'Current Weight (kg)', 'Latest entry') +
        metricCard('fa-percent', 'icon-blue', last.body_fat ?? '-', 'Body Fat (%)', 'Latest entry') +
        metricCard('fa-arrow-trend-up', 'icon-emerald', entries.length, 'Entries Logged', 'All time');
      drawLineChart('chart-user-progress', entries.map((e) => e.recorded_at).reverse(), entries.map((e) => Number(e.weight)).reverse());
    } catch (err) { $('user-progress-tbody').innerHTML = emptyRow(err.message); }
  }

  function openMyProgressModal() {
    $('myprogress-date').value = todayISO();
    ['myprogress-weight', 'myprogress-bodyfat', 'myprogress-bmi', 'myprogress-chest', 'myprogress-waist', 'myprogress-arms'].forEach((id) => { $(id).value = ''; });
    $('myprogress-notes').value = '';
    openModal('modal-my-progress');
  }

  $('form-my-progress').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      recorded_at: $('myprogress-date').value,
      weight: $('myprogress-weight').value || null,
      body_fat: $('myprogress-bodyfat').value || null,
      bmi: $('myprogress-bmi').value || null,
      chest: $('myprogress-chest').value || null,
      waist: $('myprogress-waist').value || null,
      arms: $('myprogress-arms').value || null,
      notes: $('myprogress-notes').value.trim(),
    };
    try {
      await api('api/user/progress.php', { method: 'POST', body: payload });
      closeModal('modal-my-progress');
      toast('Progress logged.');
      loadUserProgress();
    } catch (err) { toast(err.message, 'error'); }
  });

  function userPlanCard(p, kind) {
    if (kind === 'diet') {
      const meals = p.meals || [];
      return `
        <div class="plan-card">
          <div class="plan-card-body">
            <span class="plan-cat">${esc(p.goal || 'Nutrition')} &middot; ${Number(p.target_calories || 0)} kcal</span>
            <h4>${esc(p.title)}</h4>
            ${p.description ? '<p class="text-muted text-sm">' + esc(p.description) + '</p>' : ''}
            <div class="meal-list">
              ${meals.slice(0, 5).map((m) => '<div class="meal-row"><i class="fa-solid fa-utensils"></i> <strong>' + esc(m.name) + '</strong> <span class="text-muted text-sm">' + esc(m.day_label || '') + ' &middot; ' + esc(m.meal_type || '') + ' &middot; ' + Number(m.calories || 0) + ' kcal</span></div>').join('')}
              ${meals.length > 5 ? '<p class="text-muted text-sm">+' + (meals.length - 5) + ' more meals</p>' : ''}
            </div>
          </div>
        </div>`;
    }
    const exs = p.exercises || [];
    return `
      <div class="plan-card">
        <div class="plan-card-body">
          <span class="plan-cat">${esc(p.difficulty || 'General')} &middot; ${Number(p.days_per_week || 0)} days/wk</span>
          <h4>${esc(p.title)}</h4>
          ${p.description ? '<p class="text-muted text-sm">' + esc(p.description) + '</p>' : ''}
          <ul class="plan-ex-list">
            ${exs.slice(0, 6).map((e) => '<li><i class="fa-solid fa-dumbbell"></i> <strong>' + esc(e.name) + '</strong> <span class="text-muted text-sm">' + esc(e.day_label || '') + ' &middot; ' + (e.sets || 0) + 'x' + esc(e.reps || 0) + '</span></li>').join('')}
            ${exs.length > 6 ? '<li class="text-muted text-sm"><i class="fa-solid fa-plus"></i> ' + (exs.length - 6) + ' more exercises</li>' : ''}
          </ul>
        </div>
      </div>`;
  }

  async function loadUserWorkouts() {
    try {
      const d = await api('api/user/workouts.php');
      $('user-workouts-grid').innerHTML = (d.plans || []).map((p) => userPlanCard(p, 'workout')).join('') || emptyState('No workout plans assigned to you yet.');
    } catch (err) { $('user-workouts-grid').innerHTML = emptyState(err.message); }
  }

  async function loadUserDiets() {
    try {
      const d = await api('api/user/diets.php');
      $('user-diets-grid').innerHTML = (d.plans || []).map((p) => userPlanCard(p, 'diet')).join('') || emptyState('No diet plans assigned to you yet.');
    } catch (err) { $('user-diets-grid').innerHTML = emptyState(err.message); }
  }

  function userClassCard(c) {
    const full = Number(c.booked_count || 0) >= Number(c.capacity || 15);
    const mine = c.my_booking === 'booked';
    const action = mine
      ? '<button class="btn btn-outline btn-sm btn-danger" onclick="window.gm.cancelClass(' + c.id + ')"><i class="fa-solid fa-circle-xmark"></i> Cancel</button>'
      : (full
        ? '<span class="badge badge-rose">Full</span>'
        : '<button class="btn btn-primary btn-sm" onclick="window.gm.bookClass(' + c.id + ')"><i class="fa-solid fa-calendar-plus"></i> Book</button>');
    return `
      <div class="class-card">
        <div class="class-card-header">
          <span class="class-category">${esc(c.day_of_week || '')}</span>
          ${pill(c.status)}
        </div>
        <h4 class="class-card-title">${esc(c.name)}</h4>
        <div class="class-info-item"><i class="fa-solid fa-clock"></i> ${esc(c.start_time || '')} - ${esc(c.end_time || '')}</div>
        <div class="class-info-item"><i class="fa-solid fa-location-dot"></i> ${esc(c.location || 'Studio')}</div>
        <div class="class-info-item"><i class="fa-solid fa-user-ninja"></i> ${esc(c.trainer_name || 'Any trainer')}</div>
        <div class="class-info-item"><i class="fa-solid fa-users"></i> ${c.booked_count || 0} / ${c.capacity || 15} booked</div>
        <div class="admin-plan-actions">${action}</div>
      </div>`;
  }

  async function loadUserClasses() {
    try {
      if (!state.gyms.length) { await refreshGymSelects(); }
      const gymId = $('user-class-gym-select').value;
      if (!gymId) {
        $('user-classes-grid').innerHTML = emptyState('Select a gym to browse its classes.');
        return;
      }
      const d = await api(apiQuery('api/user/classes.php', { admin_id: gymId }));
      $('user-classes-grid').innerHTML = (d.classes || []).map(userClassCard).join('') || emptyState('No classes at this gym yet.');
    } catch (err) { $('user-classes-grid').innerHTML = emptyState(err.message); }
  }

  function notifIcon(t) { return t === 'class' ? 'fa-calendar-day' : t === 'invoice' ? 'fa-file-invoice' : 'fa-bullhorn'; }
  function notifIconClass(t) { return t === 'class' ? 'icon-blue' : t === 'invoice' ? 'icon-emerald' : 'icon-orange'; }

  async function loadUserNotifications() {
    try {
      const d = await api('api/user/notifications.php');
      const list = d.notifications || [];
      $('user-notifications-list').innerHTML = list.map((n) => `
        <div class="notification-card ${n.is_read ? '' : 'unread'}">
          <div class="notification-icon ${notifIconClass(n.type)}"><i class="fa-solid ${notifIcon(n.type)}"></i></div>
          <div class="notification-body">
            <div class="notification-head">
              <h4>${esc(n.title || '')}</h4>
              <span class="text-muted text-sm">${fmtDate(n.created_at)}</span>
            </div>
            <p class="text-muted">${esc(n.body || '')}</p>
          </div>
          ${n.is_read ? '' : '<button class="btn btn-ghost btn-sm" onclick="window.gm.markRead(' + n.id + ')">Mark read</button>'}
        </div>`).join('') || emptyState('You are all caught up. No notifications.');
    } catch (err) { $('user-notifications-list').innerHTML = emptyState(err.message); }
  }

  /* ======================================================================
     EVENT WIRING (filters + buttons that use onclick)
     ====================================================================== */
  window.gm = {
    editAdmin: (id) => api('api/superadmin/admins.php').then((d) => openAdminModal(d.admins.find((a) => a.id === id))).catch((e) => toast(e.message, 'error')),
    toggleAdmin: async (id, status) => {
      if (!confirm(status === 'suspended' ? 'Suspend this admin?' : 'Reactivate this admin?')) return;
      try { await api('api/superadmin/admins.php', { method: 'PUT', body: { id, status } }); toast('Admin ' + status + '.'); loadSuperadminAdmins(); }
      catch (err) { toast(err.message, 'error'); }
    },
    deleteAdmin: async (id) => {
      if (!confirm('Delete this admin and all their gym data? This cannot be undone.')) return;
      try { await api('api/superadmin/admins.php', { method: 'DELETE', body: { id } }); toast('Admin removed.'); loadSuperadminAdmins(); }
      catch (err) { toast(err.message, 'error'); }
    },
    editAdminTrainer: (id) => api('api/admin/trainers.php').then((d) => openTrainerModal(d.trainers.find((t) => t.id === id))).catch((e) => toast(e.message, 'error')),
    deleteTrainer: async (id) => {
      if (!confirm('Delete this trainer and their login account?')) return;
      try {
        await api('api/admin/trainers.php', { method: 'DELETE', body: { id } });
        toast('Trainer removed.'); loadAdminTrainers();
      } catch (err) { toast(err.message, 'error'); }
    },
    editProduct: (id) => api('api/admin/products.php').then((d) => openProductModal(d.products.find((p) => p.id === id))).catch((e) => toast(e.message, 'error')),
    deleteProduct: async (id) => {
      if (!confirm('Delete this product?')) return;
      try { await api('api/admin/products.php', { method: 'DELETE', body: { id } }); toast('Product removed.'); loadAdminProducts(); }
      catch (err) { toast(err.message, 'error'); }
    },
    editAdminUser: (id) => api('api/admin/users.php').then((d) => openUserModal(d.users.find((u) => u.id === id))).catch((e) => toast(e.message, 'error')),
    deleteAdminUser: async (id) => {
      if (!confirm('Delete this user?')) return;
      try { await api('api/admin/users.php', { method: 'DELETE', body: { id } }); toast('User removed.'); loadAdminUsers(); }
      catch (err) { toast(err.message, 'error'); }
    },
    editEquipment: (id) => api('api/admin/equipment.php').then((d) => openEquipmentModal(d.equipment.find((e) => e.id === id))).catch((e) => toast(e.message, 'error')),
    deleteEquipment: async (id) => {
      if (!confirm('Delete this equipment?')) return;
      try { await api('api/admin/equipment.php', { method: 'DELETE', body: { id } }); toast('Equipment removed.'); loadAdminEquipment(); }
      catch (err) { toast(err.message, 'error'); }
    },
    toggleGym,
    /* ----------------- professional feature actions ------------------ */
    editWorkout: (id) => api(planApiBase() + '/workouts.php').then((d) => openWorkoutModal((d.plans || []).find((p) => String(p.id) === String(id)))).catch((e) => toast(e.message, 'error')),
    deleteWorkout: async (id) => {
      if (!confirm('Delete this workout plan?')) return;
      try { await api(planApiBase() + '/workouts.php', { method: 'DELETE', body: { id } }); toast('Workout plan deleted.'); if (state.portal === 'trainer') loadTrainerWorkouts(); else loadAdminWorkouts(); }
      catch (err) { toast(err.message, 'error'); }
    },
    assignWorkout: (id) => openAssignWorkout(id),
    editDiet: (id) => api(planApiBase() + '/diets.php').then((d) => openDietModal((d.plans || []).find((p) => String(p.id) === String(id)))).catch((e) => toast(e.message, 'error')),
    deleteDiet: async (id) => {
      if (!confirm('Delete this diet plan?')) return;
      try { await api(planApiBase() + '/diets.php', { method: 'DELETE', body: { id } }); toast('Diet plan deleted.'); if (state.portal === 'trainer') loadTrainerDiets(); else loadAdminDiets(); }
      catch (err) { toast(err.message, 'error'); }
    },
    assignDiet: (id) => openAssignDiet(id),
    editClass: async (id) => {
      try {
        const d = await api(planApiBase() + '/classes.php');
        const cls = (d.classes || []).find((c) => String(c.id) === String(id));
        if (!cls) throw new Error('Class not found.');
        openClassModal(cls);
      } catch (e) { toast(e.message, 'error'); }
    },
    deleteClass: async (id) => {
      if (!confirm('Delete this class and its bookings?')) return;
      try { await api(planApiBase() + '/classes.php', { method: 'DELETE', body: { id } }); toast('Class deleted.'); if (state.portal === 'trainer') loadTrainerClasses(); else loadAdminClasses(); }
      catch (err) { toast(err.message, 'error'); }
    },
    rosterClass: async (id) => {
      try {
        const d = await api(planApiBase() + '/classes.php');
        const cls = (d.classes || []).find((c) => String(c.id) === String(id));
        if (!cls) throw new Error('Class not found.');
        openRoster(cls);
      } catch (e) { toast(e.message, 'error'); }
    },
    removeFromRoster: async (uid) => {
      if (!currentRosterClass) return;
      try {
        if (state.portal === 'trainer') {
          await api('api/trainer/classes.php', { method: 'POST', body: { action: 'cancel', class_id: currentRosterClass.id, user_id: uid } });
        } else {
          await api('api/admin/class-bookings.php', { method: 'DELETE', body: { class_id: currentRosterClass.id, user_id: uid } });
        }
        toast('Member removed from class.');
        renderRoster();
      } catch (err) { toast(err.message, 'error'); }
    },
    editInvoice: (id) => api('api/admin/invoices.php').then((d) => openInvoiceModal((d.invoices || []).find((i) => String(i.id) === String(id)))).catch((e) => toast(e.message, 'error')),
    deleteInvoice: async (id) => {
      if (!confirm('Delete this invoice?')) return;
      try { await api('api/admin/invoices.php', { method: 'DELETE', body: { id } }); toast('Invoice deleted.'); loadAdminInvoices(); }
      catch (err) { toast(err.message, 'error'); }
    },
    payInvoice: (id) => api('api/admin/invoices.php').then((d) => openPayInvoice((d.invoices || []).find((i) => String(i.id) === String(id)))).catch((e) => toast(e.message, 'error')),
    deleteAnnouncement: async (id) => {
      if (!confirm('Delete this announcement?')) return;
      try { await api('api/admin/announcements.php', { method: 'DELETE', body: { id } }); toast('Announcement deleted.'); loadAdminAnnouncements(); }
      catch (err) { toast(err.message, 'error'); }
    },
    editProgress: async (id) => {
      try {
        const sel = $('admin-progress-user');
        const d = await api(apiQuery('api/admin/progress.php', { user_id: sel.value }));
        const entry = (d.progress || []).find((e) => String(e.id) === String(id));
        if (!entry) throw new Error('Progress record not found.');
        openProgressModal(entry);
      } catch (e) { toast(e.message, 'error'); }
    },
    deleteProgress: async (id) => {
      if (!confirm('Delete this progress record?')) return;
      try { await api('api/admin/progress.php', { method: 'DELETE', body: { id } }); toast('Progress record deleted.'); loadAdminProgress(); }
      catch (err) { toast(err.message, 'error'); }
    },
    bookClass: async (id) => {
      if (state.portal === 'guest') { toast('Please sign in to book classes.', 'info'); showAuthScreen(); return; }
      try { await api('api/user/classes.php', { method: 'POST', body: { class_id: id } }); toast('Class booked! See you there.'); loadUserClasses(); }
      catch (err) { toast(err.message, 'error'); }
    },
    cancelClass: async (id) => {
      try { await api('api/user/classes.php', { method: 'DELETE', body: { class_id: id } }); toast('Booking cancelled.'); loadUserClasses(); }
      catch (err) { toast(err.message, 'error'); }
    },
    markRead: async (id) => {
      try { await api('api/user/notifications.php', { method: 'POST', body: { action: 'read', id } }); loadUserNotifications(); }
      catch (err) { toast(err.message, 'error'); }
    },
  };

  $('btn-add-admin-trainer').addEventListener('click', () => openTrainerModal(null));
  $('btn-add-product').addEventListener('click', () => openProductModal(null));
  $('btn-add-admin-user').addEventListener('click', () => openUserModal(null));

  $('admin-product-cat-filter').addEventListener('change', loadAdminProducts);
  $('admin-user-search').addEventListener('input', loadAdminUsers);
  $('user-product-gym-select').addEventListener('change', loadUserProducts);
  $('user-trainer-gym-select').addEventListener('change', loadUserTrainers);
  $('user-equipment-gym-select').addEventListener('change', loadUserEquipment);

  /* ----------------- professional feature wiring --------------------- */
  $('btn-admin-checkin').addEventListener('click', openCheckinModal);
  $('btn-trainer-checkin').addEventListener('click', openCheckinModal);
  $('btn-do-checkin').addEventListener('click', doCheckin);
  $('admin-att-date').addEventListener('change', loadAdminAttendance);
  $('admin-att-user').addEventListener('change', loadAdminAttendance);
  $('trainer-att-date').addEventListener('change', loadTrainerAttendance);

  $('btn-add-progress').addEventListener('click', () => openProgressModal(null));
  $('admin-progress-user').addEventListener('change', loadAdminProgress);

  $('btn-add-workout').addEventListener('click', () => openWorkoutModal(null));
  $('btn-trainer-add-workout').addEventListener('click', () => openWorkoutModal(null));
  $('btn-add-exercise-row').addEventListener('click', () => $('workout-exercises-rows').insertAdjacentHTML('beforeend', workoutExerciseRow()));

  $('btn-add-diet').addEventListener('click', () => openDietModal(null));
  $('btn-trainer-add-diet').addEventListener('click', () => openDietModal(null));
  $('btn-add-meal-row').addEventListener('click', () => $('diet-meals-rows').insertAdjacentHTML('beforeend', dietMealRow()));

  $('btn-add-class').addEventListener('click', () => openClassModal(null));
  $('btn-trainer-add-class').addEventListener('click', () => openClassModal(null));

  $('btn-add-invoice').addEventListener('click', () => openInvoiceModal(null));
  $('btn-add-announcement').addEventListener('click', openAnnouncementModal);

  $('btn-csv-revenue').addEventListener('click', () => downloadReportCsv('revenue'));
  $('btn-csv-attendance').addEventListener('click', () => downloadReportCsv('attendance'));

  $('btn-user-checkin').addEventListener('click', async () => {
    try {
      await api('api/user/checkin.php', { method: 'POST', body: {} });
      toast('Checked in! Welcome to the gym.');
      loadUserAttendance();
    } catch (err) { toast(err.message, 'error'); }
  });

  $('btn-add-my-progress').addEventListener('click', openMyProgressModal);
  $('user-class-gym-select').addEventListener('change', loadUserClasses);

  $('btn-mark-all-read').addEventListener('click', async () => {
    try {
      await api('api/user/notifications.php', { method: 'POST', body: { action: 'read_all' } });
      toast('All notifications marked as read.');
      loadUserNotifications();
    } catch (err) { toast(err.message, 'error'); }
  });

  function emptyRow(msg) {
    return '<tr><td colspan="8"><div class="empty-state"><i class="fa-solid fa-circle-info"></i>' + esc(msg) + '</div></td></tr>';
  }

  /* ----------------------------- boot --------------------------------- */
  function handleUrlParams() {
    const params = new URLSearchParams(location.search);
    const verify = params.get('verify');
    const reset = params.get('reset');
    if (verify) {
      showAuthScreen();
      api('api/auth/verify.php', { method: 'POST', body: { token: verify } })
        .then(() => {
          toast('Email verified. You are signed in.');
          return restoreSession();
        })
        .catch((err) => {
          toast(err.message || 'Verification failed.', 'error');
          showLoginForm();
        });
      return true;
    }
    if (reset) {
      state.resetToken = reset;
      showAuthScreen();
      switchAuthStep('form-reset');
      return true;
    }
    return false;
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (location.protocol === 'file:') {
      showBackendError();
      showAuthScreen();
      return;
    }
    if (handleUrlParams()) return;
    try { restoreSession(); } catch (e) { showAuthScreen(); }
  });
})();
