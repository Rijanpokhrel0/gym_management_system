/* ==========================================================================
   FITPULSE - MEMBER TRAINERS DIRECTORY MODULE
   ========================================================================== */

(function () {
  'use strict';

  const {
    $, esc, api, apiQuery, emptyState
  } = window.Core;

  async function loadUserTrainers() {
    try {
      await window.UserApp.setupUserGym();
      const gym = window.UserApp.state.gym;
      const grid = $('user-trainers-grid');
      if (!grid) return;

      if (!gym) {
        grid.innerHTML = emptyState('No gym linked to your account.');
        return;
      }

      const d = await api(apiQuery('api/public/trainers.php', { gym_id: gym.id }));
      grid.innerHTML = (d.trainers || []).map((t) => `
        <div class="gym-card">
          <div class="gym-card-head">
            <h3><i class="fa-solid fa-user-ninja text-orange"></i> ${esc(t.name)}</h3>
            <span class="badge badge-emerald">Active</span>
          </div>
          <div class="class-info-item"><i class="fa-solid fa-bolt"></i> ${esc(t.specialization || 'General Fitness')}</div>
          <div class="class-info-item"><i class="fa-solid fa-calendar-days"></i> ${t.experience} yrs exp</div>
          <div class="class-info-item"><i class="fa-solid fa-phone"></i> ${esc(t.phone || '-')}</div>
          ${t.certifications ? '<p class="text-muted text-sm" style="margin-top:6px;">' + esc(t.certifications) + '</p>' : ''}
        </div>`).join('') || emptyState('No trainers at your gym yet.');
    } catch (err) {
      const grid = $('user-trainers-grid');
      if (grid) grid.innerHTML = emptyState(err.message);
    }
  }

  window.UserApp.registerLoader('tab-user-trainers', loadUserTrainers);
})();
