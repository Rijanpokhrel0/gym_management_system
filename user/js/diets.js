/* ==========================================================================
   FITPULSE - MEMBER DIET PLANS MODULE
   ========================================================================== */

(function () {
  'use strict';

  const {
    $, esc, api, emptyState
  } = window.Core;

  function userDietCard(p) {
    const meals = p.meals || [];
    return `
      <div class="plan-card">
        <div>
          <span class="plan-cat">${esc(p.goal || 'Nutrition')} &middot; ${Number(p.target_calories || 0)} kcal</span>
          <h4 style="margin:4px 0 8px;">${esc(p.title)}</h4>
          ${p.description ? '<p class="text-muted text-sm">' + esc(p.description) + '</p>' : ''}
          <div class="meal-list">
            ${meals.slice(0, 5).map((m) => '<div class="meal-row"><i class="fa-solid fa-utensils"></i> <strong>' + esc(m.name) + '</strong> <span class="text-muted text-sm">' + esc(m.day_label || '') + ' &middot; ' + esc(m.meal_type || '') + ' &middot; ' + Number(m.calories || 0) + ' kcal</span></div>').join('')}
            ${meals.length > 5 ? '<p class="text-muted text-sm">+' + (meals.length - 5) + ' more meals</p>' : ''}
          </div>
        </div>
      </div>`;
  }

  async function loadUserDiets() {
    try {
      const d = await api('api/user/diets.php');
      const grid = $('user-diets-grid');
      if (grid) {
        grid.innerHTML = (d.plans || []).map(userDietCard).join('') || emptyState('No diet plans assigned to you yet.');
      }
    } catch (err) {
      const grid = $('user-diets-grid');
      if (grid) grid.innerHTML = emptyState(err.message);
    }
  }

  window.UserApp.registerLoader('tab-user-diets', loadUserDiets);
})();
