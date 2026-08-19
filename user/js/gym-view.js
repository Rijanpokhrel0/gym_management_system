/* ==========================================================================
   FITPULSE - MEMBER READ-ONLY PUBLIC GYM DASHBOARD MODULE
   ========================================================================== */

(function () {
  'use strict';

  const {
    $, esc, money, fmtDate, logoImg, api, apiQuery, pill, emptyState
  } = window.Core;

  const GYM_SUB_LOADERS = {
    'gym-overview': loadGymOverview,
    'gym-classes': loadGymClasses,
    'gym-workouts': loadGymWorkouts,
    'gym-diets': loadGymDiets,
    'gym-equipment': loadGymEquipment,
    'gym-trainers': loadGymTrainers,
    'gym-products': loadGymProducts,
    'gym-announcements': loadGymAnnouncements,
  };

  function showGymSub(id) {
    document.querySelectorAll('.gym-sub-view').forEach((s) => s.classList.remove('active'));
    const view = $(id);
    if (!view) return;
    view.classList.add('active');
    document.querySelectorAll('.gym-sub-tab').forEach((b) => b.classList.toggle('active', b.dataset.gymTab === id));
    if (GYM_SUB_LOADERS[id]) GYM_SUB_LOADERS[id]();
  }

  async function viewGym(adminId) {
    window.UserApp.state.viewGym = adminId;
    const g = (window.UserApp.state.gyms || []).find((x) => String(x.id) === String(adminId));
    const titleEl = $('gym-dash-title');
    if (titleEl) titleEl.textContent = g ? g.gym_name : 'Gym Dashboard';
    const subEl = $('gym-dash-sub');
    if (subEl) {
      subEl.textContent = g
        ? 'Read-only view of ' + g.gym_name + ' &middot; managed by ' + g.name + '.'
        : 'Read-only view of this gym.';
    }
    window.UserApp.showSection('tab-gym-dashboard');
    showGymSub('gym-overview');
  }

  async function loadGymOverview() {
    try {
      const d = await api(apiQuery('api/public/gym-dashboard.php', { gym_id: window.UserApp.state.viewGym }));
      const g = d.gym || {};
      const infoEl = $('gym-overview-info');
      if (infoEl) {
        infoEl.innerHTML = `
          <div class="cell-user">
            ${logoImg(g.logo_url, g.gym_name)}
            <div>
              <p><strong>${esc(g.gym_name)}</strong> &mdash; managed by ${esc(g.name)}</p>
              <span class="text-muted text-sm">${esc(g.address || '')}${g.phone ? ' &middot; ' + esc(g.phone) : ''}</span>
              ${g.description ? '<p class="text-muted text-sm" style="margin-top:6px;">' + esc(g.description) + '</p>' : ''}
            </div>
          </div>`;
      }

      const s = g.stats || {};
      const cards = [
        ['fa-calendar-day',   'icon-blue',     s.classes,        'Classes',        'Scheduled sessions'],
        ['fa-person-running', 'icon-orange',   s.workout_plans,  'Workout Plans',  'Available routines'],
        ['fa-utensils',       'icon-emerald',  s.diet_plans,     'Diet Plans',     'Nutrition programs'],
        ['fa-dumbbell',       'icon-purple',   s.equipment,      'Equipment',      'Machines & tools'],
        ['fa-user-ninja',     'icon-teal',     s.trainers,       'Trainers',       'Active coaches'],
        ['fa-box-open',       'icon-orange',   s.products,       'Products',       'For sale'],
        ['fa-bullhorn',       'icon-blue',     s.announcements,  'Announcements',  'Gym updates'],
        ['fa-users',          'icon-emerald',  s.users,          'Members',        'Registered users'],
      ];
      const metricsEl = $('gym-overview-metrics');
      if (metricsEl) {
        metricsEl.innerHTML = cards.map(([icon, color, val, label, sub]) => `
          <div class="metric-card">
            <div class="metric-header">
              <div class="metric-icon ${color}"><i class="fa-solid ${icon}"></i></div>
              <span class="trend trend-neutral">${esc(sub)}</span>
            </div>
            <div class="metric-body"><h3>${Number(val || 0)}</h3><p>${esc(label)}</p></div>
          </div>`).join('');
      }
    } catch (err) {
      const metricsEl = $('gym-overview-metrics');
      if (metricsEl) metricsEl.innerHTML = emptyState(err.message);
    }
  }

  async function loadGymClasses() {
    try {
      const d = await api(apiQuery('api/public/classes.php', { gym_id: window.UserApp.state.viewGym }));
      const grid = $('gym-classes-grid');
      if (grid) {
        grid.innerHTML = (d.classes || []).map((c) => `
          <div class="class-card">
            <div class="class-card-header"><span class="class-category">${esc(c.day_of_week || '')}</span>${pill(c.status)}</div>
            <h4 class="class-card-title">${esc(c.name)}</h4>
            <div class="class-info-item"><i class="fa-solid fa-clock"></i> ${esc(c.start_time || '')} - ${esc(c.end_time || '')}</div>
            <div class="class-info-item"><i class="fa-solid fa-location-dot"></i> ${esc(c.location || 'Studio')}</div>
            <div class="class-info-item"><i class="fa-solid fa-user-ninja"></i> ${esc(c.trainer_name || 'Any trainer')}</div>
            <div class="class-info-item"><i class="fa-solid fa-users"></i> ${c.booked_count || 0} / ${c.capacity || 15} booked</div>
          </div>`).join('') || emptyState('No classes scheduled.');
      }
    } catch (err) {
      const grid = $('gym-classes-grid');
      if (grid) grid.innerHTML = emptyState(err.message);
    }
  }

  async function loadGymWorkouts() {
    try {
      const d = await api(apiQuery('api/public/workouts.php', { gym_id: window.UserApp.state.viewGym }));
      const grid = $('gym-workouts-grid');
      if (grid) {
        grid.innerHTML = (d.plans || []).map((p) => {
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
        }).join('') || emptyState('No workout plans available.');
      }
    } catch (err) {
      const grid = $('gym-workouts-grid');
      if (grid) grid.innerHTML = emptyState(err.message);
    }
  }

  async function loadGymDiets() {
    try {
      const d = await api(apiQuery('api/public/diets.php', { gym_id: window.UserApp.state.viewGym }));
      const grid = $('gym-diets-grid');
      if (grid) {
        grid.innerHTML = (d.plans || []).map((p) => {
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
        }).join('') || emptyState('No diet plans available.');
      }
    } catch (err) {
      const grid = $('gym-diets-grid');
      if (grid) grid.innerHTML = emptyState(err.message);
    }
  }

  async function loadGymEquipment() {
    try {
      const d = await api(apiQuery('api/public/equipment.php', { gym_id: window.UserApp.state.viewGym }));
      const catIcon = { Cardio: 'fa-heart-pulse', Strength: 'fa-dumbbell', Functional: 'fa-bolt', Flexibility: 'fa-person-walking', Machines: 'fa-gears', Recovery: 'fa-spa' };
      const grid = $('gym-equipment-grid');
      if (grid) {
        grid.innerHTML = (d.equipment || []).map((e) => `
          <div class="product-card">
            <div class="product-card-img"><i class="fa-solid ${catIcon[e.category] || 'fa-dumbbell'}"></i></div>
            <div class="product-card-body">
              <span class="product-card-cat">${esc(e.category) || 'Equipment'}</span>
              <h4>${esc(e.name)}</h4>
              <div class="product-card-foot">
                <span class="product-price"><i class="fa-solid fa-layer-group"></i> ${Number(e.quantity || 1)} unit${Number(e.quantity || 1) > 1 ? 's' : ''}</span>
              </div>
            </div>
          </div>`).join('') || emptyState('No equipment listed.');
      }
    } catch (err) {
      const grid = $('gym-equipment-grid');
      if (grid) grid.innerHTML = emptyState(err.message);
    }
  }

  async function loadGymTrainers() {
    try {
      const d = await api(apiQuery('api/public/trainers.php', { gym_id: window.UserApp.state.viewGym }));
      const grid = $('gym-trainers-grid');
      if (grid) {
        grid.innerHTML = (d.trainers || []).map((t) => `
          <div class="gym-card">
            <div class="gym-card-head">
              <h3><i class="fa-solid fa-user-ninja text-orange"></i> ${esc(t.name)}</h3>
              <span class="badge badge-emerald">Active</span>
            </div>
            <div class="class-info-item"><i class="fa-solid fa-bolt"></i> ${esc(t.specialization || 'General Fitness')}</div>
            <div class="class-info-item"><i class="fa-solid fa-calendar-days"></i> ${t.experience} yrs exp</div>
            <div class="class-info-item"><i class="fa-solid fa-phone"></i> ${esc(t.phone || '-')}</div>
          </div>`).join('') || emptyState('No trainers at this gym.');
      }
    } catch (err) {
      const grid = $('gym-trainers-grid');
      if (grid) grid.innerHTML = emptyState(err.message);
    }
  }

  async function loadGymProducts() {
    try {
      const d = await api(apiQuery('api/public/products.php', { gym_id: window.UserApp.state.viewGym }));
      const catIcon = { Supplement: 'fa-capsules', Merchandise: 'fa-shirt', Membership: 'fa-id-card', Service: 'fa-handshake' };
      const grid = $('gym-products-grid');
      if (grid) {
        grid.innerHTML = (d.products || []).map((p) => `
          <div class="product-card">
            <div class="product-card-img"><i class="fa-solid ${catIcon[p.category] || 'fa-box-open'}"></i></div>
            <div class="product-card-body">
              <span class="product-card-cat">${esc(p.category)}</span>
              <h4>${esc(p.name)}</h4>
              <div class="product-card-foot">
                <span class="product-price">${money(p.price)}</span>
                <span class="product-stock">Stock: ${p.stock}</span>
              </div>
            </div>
          </div>`).join('') || emptyState('No products listed.');
      }
    } catch (err) {
      const grid = $('gym-products-grid');
      if (grid) grid.innerHTML = emptyState(err.message);
    }
  }

  async function loadGymAnnouncements() {
    try {
      const d = await api(apiQuery('api/public/announcements.php', { gym_id: window.UserApp.state.viewGym }));
      const listEl = $('gym-announcements-list');
      if (listEl) {
        listEl.innerHTML = (d.announcements || []).map((a) => `
          <div class="announcement-card ${a.priority === 'urgent' ? 'ann-urgent' : a.priority === 'important' ? 'ann-important' : ''}">
            <div class="announcement-head">
              <h4>${esc(a.title)}</h4>
              ${pill(a.priority)}
            </div>
            <p class="text-muted">${esc(a.body || '')}</p>
            <div class="announcement-meta">
              <span><i class="fa-solid fa-calendar-days"></i> ${fmtDate(a.created_at)}</span>
            </div>
          </div>`).join('') || emptyState('No announcements.');
      }
    } catch (err) {
      const listEl = $('gym-announcements-list');
      if (listEl) listEl.innerHTML = emptyState(err.message);
    }
  }

  // Global gm actions
  window.gm = window.gm || {};
  window.gm.viewGym = viewGym;

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.gym-sub-tab').forEach((btn) => {
      btn.addEventListener('click', () => showGymSub(btn.dataset.gymTab));
    });

    const btnBack = $('btn-back-to-dashboard');
    if (btnBack) {
      btnBack.addEventListener('click', () => window.UserApp.showSection('tab-user-dashboard'));
    }
  });
})();
