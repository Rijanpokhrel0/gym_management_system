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
      { tab: 'tab-admin-dashboard', icon: 'fa-chart-pie',     label: 'Dashboard' },
      { tab: 'tab-admin-products',  icon: 'fa-box-open',      label: 'Products' },
      { tab: 'tab-admin-users',     icon: 'fa-users',         label: 'My Users' },
      { tab: 'tab-admin-trainers',  icon: 'fa-user-ninja',    label: 'Trainers' },
    ],
    trainer: [
      { tab: 'tab-trainer-dashboard', icon: 'fa-chart-pie', label: 'My Dashboard' },
    ],
    user: [
      { tab: 'tab-user-dashboard', icon: 'fa-chart-pie', label: 'Dashboard' },
      { tab: 'tab-user-gyms',      icon: 'fa-dumbbell',  label: 'Browse Gyms' },
      { tab: 'tab-user-products',  icon: 'fa-box-open',  label: 'Gym Products' },
      { tab: 'tab-user-trainers',  icon: 'fa-user-ninja', label: 'Gym Trainers' },
    ],
    guest: [
      { tab: 'tab-user-gyms',      icon: 'fa-dumbbell',  label: 'Browse Gyms' },
      { tab: 'tab-user-products',  icon: 'fa-box-open',  label: 'Gym Products' },
      { tab: 'tab-user-trainers',  icon: 'fa-user-ninja', label: 'Gym Trainers' },
    ],
  };

  const LOADERS = {
    'tab-sa-dashboard':     loadSuperadminDashboard,
    'tab-sa-admins':        loadSuperadminAdmins,
    'tab-admin-dashboard':  loadAdminDashboard,
    'tab-admin-products':   loadAdminProducts,
    'tab-admin-users':      loadAdminUsers,
    'tab-admin-trainers':   loadAdminTrainers,
    'tab-trainer-dashboard': loadTrainerDashboard,
    'tab-user-dashboard':   loadUserDashboard,
    'tab-user-gyms':        loadUserGyms,
    'tab-user-products':    loadUserProducts,
    'tab-user-trainers':    loadUserTrainers,
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
    try {
      const d = await api('api/auth/login.php', {
        method: 'POST',
        body: { email: $('login-email').value.trim(), password: $('login-password').value },
      });
      state.user = { ...d, name: d.name };
      await restoreSession();
      toast('Welcome back, ' + d.name + ' (' + portalLabel(d.portal) + ')');
    } catch (err) {
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
        switchAuthStep('form-login');
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

  /* forgot password + resend links */
  $('link-forgot').addEventListener('click', (e) => {
    e.preventDefault();
    switchAuthStep('form-forgot');
  });
  $('back-to-login-forgot').addEventListener('click', showLoginForm);
  $('link-resend').addEventListener('click', async (e) => {
    e.preventDefault();
    const email = prompt('Enter your email to resend the verification link:');
    if (!email) return;
    try {
      const d = await api('api/auth/resend.php', { method: 'POST', body: { email: email.trim() } });
      toast(d.message || 'Verification link sent.');
      showLoginForm();
    } catch (err) { toast(err.message, 'error'); }
  });
  $('form-forgot').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const d = await api('api/auth/forgot.php', { method: 'POST', body: { email: $('forgot-email').value.trim() } });
      toast(d.message || 'Reset link sent.');
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
    $('sa-admin-desc').value = admin ? admin.description : '';
    $('sa-admin-status').value = admin ? admin.status : 'active';
    openModal('modal-sa-admin');
  }
  $('form-sa-admin').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = $('sa-admin-id').value;
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
      : '<div class="gym-logo gym-logo-sm gym-logo-fallback">' + esc(initials(gymName || 'Gym')) + '</div> Preview: gym initials are used automatically when no logo is set. Paste an image URL to override.';
  }
  $('ap-gym-name').addEventListener('input', updateLogoPreview);
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
    } catch (err) { $('user-metrics-grid').innerHTML = '<p class="text-muted">' + esc(err.message) + '</p>'; }
  }

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
      [['user-product-gym-select'], ['user-trainer-gym-select']].forEach(([id]) => {
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
    toggleGym,
  };

  $('btn-add-admin-trainer').addEventListener('click', () => openTrainerModal(null));
  $('btn-add-product').addEventListener('click', () => openProductModal(null));
  $('btn-add-admin-user').addEventListener('click', () => openUserModal(null));

  $('admin-product-cat-filter').addEventListener('change', loadAdminProducts);
  $('admin-user-search').addEventListener('input', loadAdminUsers);
  $('user-product-gym-select').addEventListener('change', loadUserProducts);
  $('user-trainer-gym-select').addEventListener('change', loadUserTrainers);

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
