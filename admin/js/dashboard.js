/* ==========================================================================
   FITPULSE - ADMIN DASHBOARD MODULE
   ========================================================================== */

(function () {
  'use strict';

  async function loadAdminDashboard() {
    const { $, esc, money, api } = window.Core;
    const grid = $('admin-metrics-grid');
    if (!grid) return;

    try {
      const d = await api('api/admin/dashboard.php');
      const gymName = window.AdminApp.state.user && window.AdminApp.state.user.gym_name;
      const titleEl = $('admin-dash-title');
      if (titleEl) {
        titleEl.textContent = gymName ? 'Dashboard - ' + gymName : 'Admin Dashboard';
      }

      const cards = [
        ['fa-box-open', 'icon-orange', d.products, 'Products', d.active_products + ' active'],
        ['fa-users', 'icon-blue', d.users, 'Gym Users', 'Registered members'],
        ['fa-user-ninja', 'icon-purple', d.trainers, 'Trainers', d.active_trainers + ' active'],
        ['fa-coins', 'icon-emerald', money(d.inventory_value), 'Inventory Value', 'Stock x price'],
      ];

      grid.innerHTML = cards.map(([icon, color, val, label, sub]) => `
        <div class="metric-card">
          <div class="metric-header">
            <div class="metric-icon ${color}"><i class="fa-solid ${icon}"></i></div>
            <span class="trend trend-neutral">${esc(sub)}</span>
          </div>
          <div class="metric-body"><h3>${val}</h3><p>${esc(label)}</p></div>
        </div>`).join('');
    } catch (err) {
      grid.innerHTML = '<p class="text-muted">' + esc(err.message) + '</p>';
    }
  }

  window.AdminApp.registerLoader('tab-admin-dashboard', loadAdminDashboard);
})();
