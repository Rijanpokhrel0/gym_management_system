/* ==========================================================================
   FITPULSE - TRAINER DASHBOARD MODULE
   ========================================================================== */

(function () {
  'use strict';

  const {
    $, esc, fmtDate, logoImg, api, emptyRow
  } = window.Core;

  async function loadTrainerDashboard() {
    try {
      const d = await api('api/trainer/dashboard.php');
      const user = window.TrainerApp.state.user;
      const titleEl = $('trainer-dash-title');
      if (titleEl && user) {
        titleEl.textContent = 'Trainer Dashboard - ' + user.name;
      }

      const gymBox = $('trainer-gym-box');
      if (gymBox) {
        gymBox.innerHTML = `
          <div class="cell-user">
            ${logoImg(d.logo_url, d.gym_name)}
            <div>
              <p><strong>${esc(d.gym_name)}</strong></p>
              <span class="text-muted text-sm">${esc(d.address || '')}</span>
            </div>
          </div>
          ${d.gym_description ? '<p class="text-muted text-sm" style="margin-top:10px;">' + esc(d.gym_description) + '</p>' : ''}`;
      }

      const metrics = d.metrics || {};
      const cards = [
        ['fa-users', 'icon-blue', metrics.members, 'Gym Members', 'Registered at your gym'],
        ['fa-box-open', 'icon-orange', metrics.products, 'Active Products', 'Sold by your gym'],
        ['fa-dumbbell', 'icon-emerald', metrics.member_gyms, 'Gym Followers', 'Members following gym'],
      ];

      const grid = $('trainer-metrics-grid');
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

      const tbody = $('trainer-members-tbody');
      if (tbody) {
        tbody.innerHTML = (d.members || []).map((m) => `
          <tr>
            <td><strong>${esc(m.name)}</strong></td>
            <td>${esc(m.email)}</td>
            <td>${esc(m.phone) || '-'}</td>
            <td>${esc(m.goal) || '-'}</td>
            <td>${fmtDate(m.created_at)}</td>
          </tr>`).join('') || emptyRow('No members registered at your gym yet.', 5);
      }
    } catch (err) {
      const gymBox = $('trainer-gym-box');
      if (gymBox) gymBox.innerHTML = '<p class="text-muted">' + esc(err.message) + '</p>';
      const tbody = $('trainer-members-tbody');
      if (tbody) tbody.innerHTML = emptyRow(err.message, 5);
    }
  }

  window.TrainerApp.registerLoader('tab-trainer-dashboard', loadTrainerDashboard);
})();
