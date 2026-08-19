/* ==========================================================================
   FITPULSE - TRAINER WORKOUTS MODULE
   ========================================================================== */

(function () {
  'use strict';

  const {
    $, esc, toast, api, openModal, closeModal, pill, emptyState
  } = window.Core;

  let currentAssignIds = [];

  function workoutExerciseRow(ex) {
    const e = ex || {};
    return '<div class="ex-row form-row" style="margin-bottom:8px;">' +
      '<div class="form-group col-2"><input type="text" class="form-control wx-day" placeholder="Day" value="' + esc(e.day_label || '') + '"></div>' +
      '<div class="form-group col-3"><input type="text" class="form-control wx-name" placeholder="Exercise name" value="' + esc(e.name || '') + '"></div>' +
      '<div class="form-group col-2"><input type="number" class="form-control wx-sets" placeholder="Sets" value="' + (e.sets || '') + '"></div>' +
      '<div class="form-group col-2"><input type="text" class="form-control wx-reps" placeholder="Reps" value="' + esc(e.reps || '') + '"></div>' +
      '<div class="form-group col-2"><input type="text" class="form-control wx-rest" placeholder="Rest" value="' + esc(e.rest || '') + '"></div>' +
      '<div class="form-group col-1"><button type="button" class="btn btn-outline btn-sm btn-danger" onclick="this.closest(\'.ex-row\').remove()"><i class="fa-solid fa-xmark"></i></button></div>' +
      '</div>';
  }

  function trainerWorkoutCard(p) {
    const exs = p.exercises || [];
    const shown = exs.slice(0, 4);
    return `
      <div class="admin-plan-card">
        <div class="admin-plan-head">
          <div>
            <span class="plan-cat">${esc(p.difficulty || 'General')} &middot; ${p.days_per_week || 0} days/wk</span>
            <h4 style="margin:4px 0 0;">${esc(p.title)}</h4>
          </div>
          ${pill(p.status)}
        </div>
        ${p.description ? '<p class="text-muted text-sm">' + esc(p.description) + '</p>' : ''}
        <ul class="plan-ex-list">
          ${shown.map((e) => '<li><i class="fa-solid fa-dumbbell"></i> <strong>' + esc(e.name) + '</strong> <span class="text-muted text-sm">' + esc(e.day_label || '') + ' &middot; ' + (e.sets || 0) + 'x' + esc(e.reps || 0) + '</span></li>').join('')}
          ${exs.length > 4 ? '<li class="text-muted text-sm"><i class="fa-solid fa-plus"></i> ' + (exs.length - 4) + ' more exercises</li>' : ''}
        </ul>
        <div class="admin-plan-actions">
          <button class="btn btn-outline btn-sm" onclick="window.gm.editWorkout(${p.id})"><i class="fa-solid fa-pen"></i></button>
          <button class="btn btn-outline btn-sm" onclick="window.gm.assignWorkout(${p.id})"><i class="fa-solid fa-user-plus"></i> ${p.assigned_count || 0}</button>
          <button class="btn btn-outline btn-sm btn-danger" onclick="window.gm.deleteWorkout(${p.id})"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>`;
  }

  async function loadTrainerWorkouts() {
    try {
      const d = await api('api/trainer/workouts.php');
      const grid = $('trainer-workouts-grid');
      if (grid) {
        grid.innerHTML = (d.plans || []).map(trainerWorkoutCard).join('') || emptyState('No workout plans yet. Create one.');
      }
    } catch (err) {
      const grid = $('trainer-workouts-grid');
      if (grid) grid.innerHTML = emptyState(err.message);
    }
  }

  function openWorkoutModal(plan) {
    $('modal-workout-title').textContent = plan ? 'Edit Workout Plan' : 'New Workout Plan';
    $('workout-id').value = plan ? plan.id : '';
    $('workout-title').value = plan ? plan.title : '';
    $('workout-days').value = plan ? plan.days_per_week : 3;
    $('workout-difficulty').value = plan ? plan.difficulty : 'Beginner';
    $('workout-status').value = plan ? plan.status : 'active';
    $('workout-desc').value = plan ? plan.description : '';
    const exs = (plan && plan.exercises && plan.exercises.length) ? plan.exercises : [{}];
    $('workout-exercises-rows').innerHTML = exs.map(workoutExerciseRow).join('');
    openModal('modal-workout');
  }

  async function openAssignWorkout(planId) {
    try {
      const d = await api('api/trainer/workouts.php');
      const plan = (d.plans || []).find((p) => String(p.id) === String(planId));
      if (!plan) throw new Error('Workout plan not found.');
      $('assign-workout-id').value = planId;
      $('assign-workout-title').textContent = plan.title;
      const users = await window.TrainerApp.getTrainerMembers();
      currentAssignIds = (plan.assigned_user_ids || []).map(String);
      const assigned = new Set(currentAssignIds);
      $('assign-workout-members').innerHTML = users.map((u) =>
        '<label class="checkbox-item"><input type="checkbox" class="assign-mem" value="' + u.id + '"' + (assigned.has(String(u.id)) ? ' checked' : '') + '> ' + esc(u.name) + ' <span class="text-muted text-sm">' + esc(u.email) + '</span></label>'
      ).join('') || '<p class="text-muted">No members yet.</p>';
      openModal('modal-assign-workout');
    } catch (err) { toast(err.message, 'error'); }
  }

  // Global gm actions
  window.gm = window.gm || {};
  window.gm.editWorkout = (id) => api('api/trainer/workouts.php').then((d) => openWorkoutModal((d.plans || []).find((p) => String(p.id) === String(id)))).catch((e) => toast(e.message, 'error'));
  window.gm.assignWorkout = (id) => openAssignWorkout(id);
  window.gm.deleteWorkout = async (id) => {
    if (!confirm('Delete this workout plan?')) return;
    try {
      await api('api/trainer/workouts.php', { method: 'DELETE', body: { id } });
      toast('Workout plan deleted.');
      loadTrainerWorkouts();
    } catch (err) { toast(err.message, 'error'); }
  };

  document.addEventListener('DOMContentLoaded', () => {
    const btnAdd = $('btn-trainer-add-workout');
    if (btnAdd) btnAdd.addEventListener('click', () => openWorkoutModal(null));

    const btnAddEx = $('btn-add-exercise-row');
    if (btnAddEx) btnAddEx.addEventListener('click', () => $('workout-exercises-rows').insertAdjacentHTML('beforeend', workoutExerciseRow()));

    const formWorkout = $('form-workout');
    if (formWorkout) {
      formWorkout.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = $('workout-id').value;
        const exercises = Array.from(document.querySelectorAll('#workout-exercises-rows .ex-row')).map((r) => ({
          day_label: r.querySelector('.wx-day').value.trim(),
          name: r.querySelector('.wx-name').value.trim(),
          sets: r.querySelector('.wx-sets').value,
          reps: r.querySelector('.wx-reps').value.trim(),
          rest: r.querySelector('.wx-rest').value.trim(),
        })).filter((x) => x.name);
        if (!exercises.length) { toast('Add at least one exercise.', 'error'); return; }
        const payload = {
          title: $('workout-title').value.trim(),
          days_per_week: $('workout-days').value,
          difficulty: $('workout-difficulty').value,
          status: $('workout-status').value,
          description: $('workout-desc').value.trim(),
          exercises,
        };
        try {
          await api('api/trainer/workouts.php', { method: id ? 'PUT' : 'POST', body: id ? { id, ...payload } : payload });
          closeModal('modal-workout');
          toast(id ? 'Workout plan updated.' : 'Workout plan created.');
          loadTrainerWorkouts();
        } catch (err) { toast(err.message, 'error'); }
      });
    }

    const formAssign = $('form-assign-workout');
    if (formAssign) {
      formAssign.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = $('assign-workout-id').value;
        const assignUsers = Array.from(document.querySelectorAll('#assign-workout-members .assign-mem:checked')).map((c) => c.value);
        const prev = new Set(currentAssignIds);
        const next = new Set(assignUsers.map(String));
        const added = assignUsers.filter((u) => !prev.has(String(u)));
        const removed = Array.from(prev).filter((u) => !next.has(u));
        if (!added.length && !removed.length) { closeModal('modal-assign-workout'); toast('No changes.'); return; }
        try {
          if (added.length) await api('api/trainer/workouts.php', { method: 'POST', body: { action: 'assign', plan_id: id, user_ids: added } });
          if (removed.length) await api('api/trainer/workouts.php', { method: 'POST', body: { action: 'unassign', plan_id: id, user_ids: removed } });
          closeModal('modal-assign-workout');
          toast('Assignments updated.');
          loadTrainerWorkouts();
        } catch (err) { toast(err.message, 'error'); }
      });
    }
  });

  window.TrainerApp.registerLoader('tab-trainer-workouts', loadTrainerWorkouts);
})();
