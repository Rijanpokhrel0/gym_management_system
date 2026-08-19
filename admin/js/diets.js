/* ==========================================================================
   FITPULSE - ADMIN DIET PLANS MODULE
   ========================================================================== */

(function () {
  'use strict';

  const {
    $, esc, toast, api, openModal, closeModal, pill, emptyState
  } = window.Core;

  let currentAssignIds = [];

  function dietMealRow(m) {
    const x = m || {};
    return '<div class="meal-row-editor form-row" style="margin-bottom:8px;">' +
      '<div class="form-group col-2"><input type="text" class="form-control meal-day" placeholder="Day" value="' + esc(x.day_label || '') + '"></div>' +
      '<div class="form-group col-2"><input type="text" class="form-control meal-type" placeholder="Meal" value="' + esc(x.meal_type || '') + '"></div>' +
      '<div class="form-group col-3"><input type="text" class="form-control meal-name" placeholder="Food" value="' + esc(x.name || '') + '"></div>' +
      '<div class="form-group col-1"><input type="number" class="form-control meal-cals" placeholder="kcal" value="' + (x.calories || '') + '"></div>' +
      '<div class="form-group col-1"><input type="text" class="form-control meal-p" placeholder="P" value="' + (x.protein || '') + '"></div>' +
      '<div class="form-group col-1"><input type="text" class="form-control meal-c" placeholder="C" value="' + (x.carbs || '') + '"></div>' +
      '<div class="form-group col-1"><input type="text" class="form-control meal-f" placeholder="F" value="' + (x.fat || '') + '"></div>' +
      '<div class="form-group col-1"><button type="button" class="btn btn-outline btn-sm btn-danger" onclick="this.closest(\'.meal-row-editor\').remove()"><i class="fa-solid fa-xmark"></i></button></div>' +
      '</div>';
  }

  function adminDietCard(p) {
    const meals = p.meals || [];
    const shown = meals.slice(0, 4);
    return `
      <div class="admin-plan-card">
        <div class="admin-plan-head">
          <div>
            <span class="plan-cat">${esc(p.goal || 'Nutrition')} &middot; ${Number(p.target_calories || 0)} kcal</span>
            <h4 style="margin:4px 0 0;">${esc(p.title)}</h4>
          </div>
          ${pill(p.status)}
        </div>
        ${p.description ? '<p class="text-muted text-sm">' + esc(p.description) + '</p>' : ''}
        <ul class="plan-ex-list">
          ${shown.map((m) => '<li><i class="fa-solid fa-utensils"></i> <strong>' + esc(m.name) + '</strong> <span class="text-muted text-sm">' + esc(m.day_label || '') + ' &middot; ' + esc(m.meal_type || '') + ' &middot; ' + Number(m.calories || 0) + ' kcal</span></li>').join('')}
          ${meals.length > 4 ? '<li class="text-muted text-sm"><i class="fa-solid fa-plus"></i> ' + (meals.length - 4) + ' more meals</li>' : ''}
        </ul>
        <div class="admin-plan-actions">
          <button class="btn btn-outline btn-sm" onclick="window.gm.editDiet(${p.id})"><i class="fa-solid fa-pen"></i></button>
          <button class="btn btn-outline btn-sm" onclick="window.gm.assignDiet(${p.id})"><i class="fa-solid fa-user-plus"></i> ${p.assigned_count || 0}</button>
          <button class="btn btn-outline btn-sm btn-danger" onclick="window.gm.deleteDiet(${p.id})"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>`;
  }

  async function loadAdminDiets() {
    try {
      const d = await api('api/admin/diets.php');
      const grid = $('admin-diets-grid');
      if (grid) {
        grid.innerHTML = (d.plans || []).map(adminDietCard).join('') || emptyState('No diet plans yet. Create one.');
      }
    } catch (err) {
      const grid = $('admin-diets-grid');
      if (grid) grid.innerHTML = emptyState(err.message);
    }
  }

  function openDietModal(plan) {
    $('modal-diet-title').textContent = plan ? 'Edit Diet Plan' : 'New Diet Plan';
    $('diet-id').value = plan ? plan.id : '';
    $('diet-title').value = plan ? plan.title : '';
    $('diet-calories').value = plan ? plan.target_calories : 2000;
    $('diet-goal').value = plan ? plan.goal : '';
    $('diet-status').value = plan ? plan.status : 'active';
    $('diet-desc').value = plan ? plan.description : '';
    const meals = (plan && plan.meals && plan.meals.length) ? plan.meals : [{}];
    $('diet-meals-rows').innerHTML = meals.map(dietMealRow).join('');
    openModal('modal-diet');
  }

  async function openAssignDiet(planId) {
    try {
      const d = await api('api/admin/diets.php');
      const plan = (d.plans || []).find((p) => String(p.id) === String(planId));
      if (!plan) throw new Error('Diet plan not found.');
      $('assign-diet-id').value = planId;
      $('assign-diet-title').textContent = plan.title;
      const users = await window.AdminApp.getAdminUsers();
      currentAssignIds = (plan.assigned_user_ids || []).map(String);
      const assigned = new Set(currentAssignIds);
      $('assign-diet-members').innerHTML = users.map((u) =>
        '<label class="checkbox-item"><input type="checkbox" class="assign-mem" value="' + u.id + '"' + (assigned.has(String(u.id)) ? ' checked' : '') + '> ' + esc(u.name) + ' <span class="text-muted text-sm">' + esc(u.email) + '</span></label>'
      ).join('') || '<p class="text-muted">No members yet. Add members first.</p>';
      openModal('modal-assign-diet');
    } catch (err) { toast(err.message, 'error'); }
  }

  // Global gm actions
  window.gm = window.gm || {};
  window.gm.editDiet = (id) => api('api/admin/diets.php').then((d) => openDietModal((d.plans || []).find((p) => String(p.id) === String(id)))).catch((e) => toast(e.message, 'error'));
  window.gm.assignDiet = (id) => openAssignDiet(id);
  window.gm.deleteDiet = async (id) => {
    if (!confirm('Delete this diet plan?')) return;
    try {
      await api('api/admin/diets.php', { method: 'DELETE', body: { id } });
      toast('Diet plan deleted.');
      loadAdminDiets();
    } catch (err) { toast(err.message, 'error'); }
  };

  document.addEventListener('DOMContentLoaded', () => {
    const btnAdd = $('btn-add-diet');
    if (btnAdd) btnAdd.addEventListener('click', () => openDietModal(null));

    const btnAddMeal = $('btn-add-meal-row');
    if (btnAddMeal) btnAddMeal.addEventListener('click', () => $('diet-meals-rows').insertAdjacentHTML('beforeend', dietMealRow()));

    const formDiet = $('form-diet');
    if (formDiet) {
      formDiet.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = $('diet-id').value;
        const meals = Array.from(document.querySelectorAll('#diet-meals-rows .meal-row-editor')).map((r) => ({
          day_label: r.querySelector('.meal-day').value.trim(),
          meal_type: r.querySelector('.meal-type').value.trim(),
          name: r.querySelector('.meal-name').value.trim(),
          calories: r.querySelector('.meal-cals').value,
          protein: r.querySelector('.meal-p').value,
          carbs: r.querySelector('.meal-c').value,
          fat: r.querySelector('.meal-f').value,
        })).filter((x) => x.name);
        if (!meals.length) { toast('Add at least one meal.', 'error'); return; }
        const payload = {
          title: $('diet-title').value.trim(),
          target_calories: $('diet-calories').value,
          goal: $('diet-goal').value.trim(),
          status: $('diet-status').value,
          description: $('diet-desc').value.trim(),
          meals,
        };
        try {
          await api('api/admin/diets.php', { method: id ? 'PUT' : 'POST', body: id ? { id, ...payload } : payload });
          closeModal('modal-diet');
          toast(id ? 'Diet plan updated.' : 'Diet plan created.');
          loadAdminDiets();
        } catch (err) { toast(err.message, 'error'); }
      });
    }

    const formAssign = $('form-assign-diet');
    if (formAssign) {
      formAssign.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = $('assign-diet-id').value;
        const assignUsers = Array.from(document.querySelectorAll('#assign-diet-members .assign-mem:checked')).map((c) => c.value);
        const prev = new Set(currentAssignIds);
        const next = new Set(assignUsers.map(String));
        const added = assignUsers.filter((u) => !prev.has(String(u)));
        const removed = Array.from(prev).filter((u) => !next.has(u));
        if (!added.length && !removed.length) { closeModal('modal-assign-diet'); toast('No changes to assignments.'); return; }
        try {
          if (added.length) await api('api/admin/diet-assignments.php', { method: 'POST', body: { plan_id: id, user_ids: added } });
          for (const uid of removed) await api('api/admin/diet-assignments.php', { method: 'DELETE', body: { plan_id: id, user_id: uid } });
          closeModal('modal-assign-diet');
          toast('Assignments updated.');
          loadAdminDiets();
        } catch (err) { toast(err.message, 'error'); }
      });
    }
  });

  window.AdminApp.registerLoader('tab-admin-diets', loadAdminDiets);
})();
