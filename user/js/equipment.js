/* ==========================================================================
   FITPULSE - MEMBER EQUIPMENT DIRECTORY MODULE
   ========================================================================== */

(function () {
  'use strict';

  const {
    $, esc, api, apiQuery, emptyState
  } = window.Core;

  async function loadUserEquipment() {
    try {
      await window.UserApp.setupUserGym();
      const gym = window.UserApp.state.gym;
      const grid = $('user-equipment-grid');
      if (!grid) return;

      if (!gym) {
        grid.innerHTML = emptyState('No gym linked to your account.');
        return;
      }

      const d = await api(apiQuery('api/public/equipment.php', { gym_id: gym.id }));
      const catIcon = { Cardio: 'fa-heart-pulse', Strength: 'fa-dumbbell', Functional: 'fa-bolt', Flexibility: 'fa-person-walking', Machines: 'fa-gears', Recovery: 'fa-spa' };
      grid.innerHTML = (d.equipment || []).map((e) => `
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
        </div>`).join('') || emptyState('No equipment at your gym yet.');
    } catch (err) {
      const grid = $('user-equipment-grid');
      if (grid) grid.innerHTML = emptyState(err.message);
    }
  }

  window.UserApp.registerLoader('tab-user-equipment', loadUserEquipment);
})();
