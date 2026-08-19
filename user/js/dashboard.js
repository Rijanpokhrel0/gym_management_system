/* ==========================================================================
   FITPULSE - MEMBER DASHBOARD MODULE
   ========================================================================== */

(function () {
  'use strict';

  const {
    $, esc, logoImg, api
  } = window.Core;

  async function loadUserDashboard() {
    try {
      await window.UserApp.setupUserGym();
      const user = window.UserApp.state.user;
      const gym = window.UserApp.state.gym;
      const d = await api('api/user/dashboard.php');

      const titleEl = $('user-dash-title');
      if (titleEl && user) {
        titleEl.textContent = 'Member Dashboard - ' + user.name + (gym ? ' (' + gym.gym_name + ')' : '');
      }

      const cards = [
        ['fa-building', 'icon-orange', '1', 'My Gym', gym ? gym.gym_name : 'Registered gym'],
        ['fa-box-open', 'icon-blue', d.products_count || 0, 'Products Available', 'At your gym'],
        ['fa-dumbbell', 'icon-emerald', d.gyms_available || 0, 'Gyms Online', 'Active on platform'],
      ];

      const grid = $('user-metrics-grid');
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

      const h = gym || d.home_gym;
      const homeGymBox = $('user-home-gym-box');
      if (homeGymBox) {
        homeGymBox.innerHTML = h
          ? `<div class="cell-user">
               ${logoImg(h.logo_url, h.gym_name)}
               <div>
                 <p><strong>${esc(h.gym_name)}</strong> &mdash; your gym</p>
                 <span class="text-muted text-sm">${esc(h.address || '')}${h.phone ? ' &middot; ' + esc(h.phone) : ''}</span>
               </div>
             </div>`
          : '<p class="text-muted">No gym linked to your account. Contact your gym admin.</p>';
      }
    } catch (err) {
      const grid = $('user-metrics-grid');
      if (grid) grid.innerHTML = '<p class="text-muted">' + esc(err.message) + '</p>';
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    const linkViewGym = $('link-view-gym-dashboard');
    if (linkViewGym) {
      linkViewGym.addEventListener('click', (e) => {
        e.preventDefault();
        if (window.UserApp.state.gym && window.gm.viewGym) {
          window.gm.viewGym(window.UserApp.state.gym.id);
        } else {
          window.Core.toast('No gym is linked to your account.', 'error');
        }
      });
    }
  });

  window.UserApp.registerLoader('tab-user-dashboard', loadUserDashboard);
})();
