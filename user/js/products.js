/* ==========================================================================
   FITPULSE - MEMBER PRODUCTS MODULE
   ========================================================================== */

(function () {
  'use strict';

  const {
    $, esc, money, api, apiQuery, emptyState
  } = window.Core;

  async function loadUserProducts() {
    try {
      await window.UserApp.setupUserGym();
      const gym = window.UserApp.state.gym;
      const grid = $('user-products-grid');
      if (!grid) return;

      if (!gym) {
        grid.innerHTML = emptyState('No gym linked to your account.');
        return;
      }

      const d = await api(apiQuery('api/public/products.php', { gym_id: gym.id }));
      const catIcon = { Supplement: 'fa-capsules', Merchandise: 'fa-shirt', Membership: 'fa-id-card', Service: 'fa-handshake' };
      grid.innerHTML = (d.products || []).map((p) => `
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
        </div>`).join('') || emptyState('No products at your gym yet.');
    } catch (err) {
      const grid = $('user-products-grid');
      if (grid) grid.innerHTML = emptyState(err.message);
    }
  }

  window.UserApp.registerLoader('tab-user-products', loadUserProducts);
})();
