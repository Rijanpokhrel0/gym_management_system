/* ==========================================================================
   FITPULSE - SUPERADMIN DASHBOARD MODULE
   ========================================================================== */

(function () {
  'use strict';

  const {
    $, esc, money, api
  } = window.Core;

  async function loadSuperadminDashboard() {
    try {
      const d = await api('api/superadmin/metrics.php');
      const cards = [
        ['fa-user-shield', 'icon-blue',    d.admins,         'Total Admins',    d.active_admins + ' active'],
        ['fa-user-plus',   'icon-amber',   d.pending_admins, 'Pending Regs',    'Awaiting approval'],
        ['fa-users',       'icon-emerald', d.users,          'Total Members',   'Across all gyms'],
        ['fa-user-ninja',  'icon-purple',  d.trainers,       'Total Trainers',  'Across all gyms'],
        ['fa-box-open',    'icon-orange',  d.products,       'Total Products',  'Across all gyms'],
        ['fa-coins',       'icon-teal',    'Rs. ' + money(d.total_revenue), 'Total Revenue', 'All time collected'],
        ['fa-clock',       'icon-amber',   d.pending_payments, 'Pending Payments', 'Awaiting review'],
        ['fa-calendar-check', 'icon-blue', d.attendance_today, 'Check-ins Today', 'System-wide'],
      ];

      const grid = $('sa-metrics-grid');
      if (grid) {
        grid.innerHTML = cards.map(([icon, color, val, label, sub]) => `
          <div class="metric-card">
            <div class="metric-header">
              <div class="metric-icon ${color}"><i class="fa-solid ${icon}"></i></div>
              <span class="trend trend-neutral">${esc(sub)}</span>
            </div>
            <div class="metric-body"><h3>${Number(val || 0)}</h3><p>${esc(label)}</p></div>
          </div>`).join('');
      }
    } catch (err) {
      const grid = $('sa-metrics-grid');
      if (grid) grid.innerHTML = '<p class="text-muted">' + esc(err.message) + '</p>';
    }
  }

  window.SuperadminApp.registerLoader('tab-sa-dashboard', loadSuperadminDashboard);
})();
