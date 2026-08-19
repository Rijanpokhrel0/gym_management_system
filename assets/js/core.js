/* ==========================================================================
   FITPULSE GYM MANAGEMENT SYSTEM - SHARED CORE UTILITIES & API CLIENT
   ========================================================================== */

(function (global) {
  'use strict';

  /* ----------------------------- DOM Helpers ----------------------------- */
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
  const money = (n) => 'NPR ' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
  const fmtDate = (d) => d ? String(d).slice(0, 10) : '-';
  const todayISO = () => {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  };
  const initials = (name) => {
    return String(name || '?').trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  };
  const logoImg = (url, alt) => {
    return url ? '<img class="gym-logo" src="' + esc(url) + '" alt="' + esc(alt) + ' logo">'
      : '<div class="gym-logo gym-logo-fallback">' + esc(initials(alt || 'Gym')) + '</div>';
  };

  /* ----------------------------- Toast System ---------------------------- */
  function toast(msg, type = 'success') {
    let stack = document.querySelector('.toast-container');
    if (!stack) {
      stack = document.createElement('div');
      stack.className = 'toast-container';
      document.body.appendChild(stack);
    }
    const t = document.createElement('div');
    t.className = 'toast toast-' + type;
    const icons = { success: 'fa-circle-check', error: 'fa-circle-xmark', info: 'fa-circle-info', warning: 'fa-triangle-exclamation' };
    t.innerHTML = '<i class="fa-solid ' + (icons[type] || icons.info) + '"></i><span>' + esc(msg) + '</span>';
    stack.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateX(20px)'; }, 2600);
    setTimeout(() => t.remove(), 3000);
  }

  /* ----------------------------- API Base & URL -------------------------- */
  function getApiBase() {
    if (global.GYM_API_BASE) return global.GYM_API_BASE;
    const origin = window.location.origin;
    if (window.location.pathname.startsWith('/gym')) {
      return origin + '/gym/';
    }
    if (window.location.port && window.location.port !== '80' && window.location.port !== '443') {
      return 'http://' + window.location.hostname + '/gym/';
    }
    return origin + '/';
  }

  function apiUrl(path) {
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    const clean = path.startsWith('/') ? path.slice(1) : path;
    const base = getApiBase();
    return base.endsWith('/') ? base + clean : base + '/' + clean;
  }

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

  async function uploadLogo(file) {
    const fd = new FormData();
    fd.append('logo', file);
    const d = await apiForm('api/upload.php', fd);
    return d.url;
  }

  function isImageFile(file) {
    return file && /^image\/(png|jpe?g|webp|gif)$/i.test(file.type);
  }

  /* ----------------------------- Modals --------------------------------- */
  function openModal(id) {
    const m = $(id);
    if (m) m.classList.add('active');
  }
  function closeModal(id) {
    const m = $(id);
    if (m) m.classList.remove('active');
  }
  function closeActiveModal() {
    document.querySelectorAll('.modal-overlay.active').forEach((m) => m.classList.remove('active'));
  }

  /* ----------------------------- Status & Badges ------------------------- */
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

  function emptyRow(msg, colSpan = 8) {
    return '<tr><td colspan="' + colSpan + '"><div class="empty-state"><i class="fa-solid fa-circle-info"></i>' + esc(msg) + '</div></td></tr>';
  }

  function emptyState(msg) {
    return '<div class="empty-state" style="grid-column:1/-1;"><i class="fa-solid fa-circle-info"></i>' + esc(msg) + '</div>';
  }

  function portalLabel(p) {
    return p === 'superadmin' ? 'Superadmin' : p === 'admin' ? 'Admin' : p === 'trainer' ? 'Trainer' : 'User';
  }

  /* ----------------------------- Navigation & Auth ----------------------- */
  function getPathPrefix() {
    const p = window.location.pathname;
    if (p.includes('/auth/') || p.includes('/admin/') || p.includes('/user/') || p.includes('/trainer/') || p.includes('/superadmin/')) {
      return '../';
    }
    return './';
  }

  function redirectToPortal(portal) {
    const prefix = getPathPrefix();
    if (portal === 'superadmin') window.location.href = prefix + 'superadmin/index.html';
    else if (portal === 'admin') window.location.href = prefix + 'admin/index.html';
    else if (portal === 'trainer') window.location.href = prefix + 'trainer/index.html';
    else if (portal === 'user') window.location.href = prefix + 'user/index.html';
    else window.location.href = prefix + 'auth/login.html';
  }

  async function checkSession() {
    try {
      const user = await api('api/auth/me.php');
      return user && user.portal ? user : null;
    } catch (e) {
      return null;
    }
  }

  async function requireAuth(expectedPortal) {
    const user = await checkSession();
    if (!user) {
      window.location.href = getPathPrefix() + 'auth/login.html';
      return null;
    }
    if (expectedPortal && user.portal !== expectedPortal) {
      redirectToPortal(user.portal);
      return null;
    }
    setupUserProfileUI(user);
    return user;
  }

  function setupUserProfileUI(user) {
    if (!user) return;
    const nameEl = $('current-user-name');
    const roleEl = $('current-user-role-label');
    const badgeEl = $('role-badge-display');
    const activeRoleEl = $('active-role-label');
    const avatarEl = $('current-user-avatar');
    const userBox = $('sidebar-user-box');

    if (nameEl) nameEl.textContent = user.name || 'User';
    if (roleEl) roleEl.textContent = portalLabel(user.portal);
    if (badgeEl) badgeEl.textContent = (user.gym_name || portalLabel(user.portal)) + ' Portal';
    if (activeRoleEl) activeRoleEl.textContent = portalLabel(user.portal);
    if (avatarEl) avatarEl.textContent = initials(user.name);
    if (userBox) userBox.style.display = 'flex';
  }

  async function logout() {
    try {
      await api('api/auth/logout.php', { method: 'POST', body: {} });
    } catch (e) {}
    window.location.href = getPathPrefix() + 'auth/login.html';
  }

  function initGlobalListeners() {
    document.querySelectorAll('[data-close]').forEach((btn) => {
      btn.addEventListener('click', () => closeModal(btn.dataset.close));
    });
    document.querySelectorAll('.modal-overlay').forEach((ov) => {
      ov.addEventListener('click', (e) => { if (e.target === ov) ov.classList.remove('active'); });
    });
    const menuToggle = $('menu-toggle');
    if (menuToggle) {
      menuToggle.addEventListener('click', () => {
        const sb = $('sidebar');
        if (sb) sb.classList.toggle('show');
      });
    }
    const logoutBtn = $('btn-logout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', logout);
    }
  }

  /* ----------------------------- Charts --------------------------------- */
  function drawBarChart(canvasId, labels, values, hue) {
    const c = $(canvasId);
    if (!c) return;
    const ctx = c.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const w = c.clientWidth || (c.parentElement ? c.parentElement.clientWidth : 420);
    const h = 220;
    c.width = w * dpr; c.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    if (!labels || !labels.length || !values || !values.length) {
      ctx.fillStyle = '#94a3b8'; ctx.font = '13px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('No data yet', w / 2, h / 2);
      return;
    }
    const colors = { orange: '#E63946', blue: '#3b82f6', emerald: '#10b981' };
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
      ctx.fillStyle = colors[hue] || '#E63946';
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
    const w = c.clientWidth || (c.parentElement ? c.parentElement.clientWidth : 420);
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
    ctx.strokeStyle = '#E63946'; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
    ctx.beginPath();
    nums.forEach((v, i) => { const X = px(i), Y = py(v); i === 0 ? ctx.moveTo(X, Y) : ctx.lineTo(X, Y); });
    ctx.stroke();
    ctx.lineWidth = 1;
    nums.forEach((v, i) => {
      const X = px(i), Y = py(v);
      ctx.fillStyle = '#E63946';
      ctx.beginPath(); ctx.arc(X, Y, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#94a3b8'; ctx.textAlign = 'center'; ctx.font = '10px sans-serif';
      ctx.fillText(String(labels[i]).slice(0, 8), X, h - 8);
    });
  }

  function downloadReportCsv(report) {
    window.location.href = apiUrl(apiQuery('api/admin/reports.php', { report, format: 'csv' }));
  }

  document.addEventListener('DOMContentLoaded', initGlobalListeners);

  /* ----------------------------- Password Toggle ------------------------- */
  function togglePassword(inputId, btn) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const icon = btn.querySelector('i');
    if (input.type === 'password') {
      input.type = 'text';
      icon.classList.remove('fa-eye');
      icon.classList.add('fa-eye-slash');
    } else {
      input.type = 'password';
      icon.classList.remove('fa-eye-slash');
      icon.classList.add('fa-eye');
    }
  }

  /* Export to global scope */
  global.Core = {
    $, esc, money, fmtDate, todayISO, initials, logoImg,
    toast, getApiBase, apiUrl, api, apiQuery, apiForm, uploadLogo, isImageFile,
    openModal, closeModal, closeActiveModal,
    statusBadge, pill, invoiceStatus, metricCard, emptyRow, emptyState, portalLabel,
    getPathPrefix, redirectToPortal, checkSession, requireAuth, setupUserProfileUI, logout,
    drawBarChart, drawLineChart, downloadReportCsv, togglePassword
  };

  /* Also expose togglePassword as a global function for inline onclick handlers */
  global.togglePassword = togglePassword;

})(window);
