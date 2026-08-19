/* ==========================================================================
   FITPULSE - MEMBER WORKOUT PLANS MODULE
   ========================================================================== */

(function () {
  'use strict';

  const {
    $, esc, api, emptyState
  } = window.Core;

  function userWorkoutCard(p) {
    const exs = p.exercises || [];
    return `
      <div class="plan-card">
        <div>
          <span class="plan-cat">${esc(p.difficulty || 'General')} &middot; ${Number(p.days_per_week || 0)} days/wk</span>
          <h4 style="margin:4px 0 8px;">${esc(p.title)}</h4>
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
      const grid = $('user-workouts-grid');
      if (grid) {
        grid.innerHTML = (d.plans || []).map(userWorkoutCard).join('') || emptyState('No workout plans assigned to you yet.');
      }
    } catch (err) {
      const grid = $('user-workouts-grid');
      if (grid) grid.innerHTML = emptyState(err.message);
    }
  }

  window.UserApp.registerLoader('tab-user-workouts', loadUserWorkouts);
})();
