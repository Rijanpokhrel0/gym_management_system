/* ==========================================================================
   FITPULSE - TRAINER CLASSES & ROSTER MODULE
   ========================================================================== */

(function () {
  'use strict';

  const {
    $, esc, toast, api, openModal, closeModal, pill, emptyRow, emptyState
  } = window.Core;

  let currentRosterClass = null;

  function classCard(c) {
    return `
      <div class="class-card">
        <div class="class-card-header">
          <span class="class-category">${esc(c.day_of_week || '')}</span>
          ${pill(c.status)}
        </div>
        <h4 class="class-card-title">${esc(c.name)}</h4>
        <div class="class-info-item"><i class="fa-solid fa-clock"></i> ${esc(c.start_time || '')} - ${esc(c.end_time || '')}</div>
        <div class="class-info-item"><i class="fa-solid fa-location-dot"></i> ${esc(c.location || 'Studio')}</div>
        <div class="class-info-item"><i class="fa-solid fa-users"></i> ${c.booked_count || 0} / ${c.capacity || 15} booked</div>
        <div class="admin-plan-actions">
          <button class="btn btn-outline btn-sm" onclick="window.gm.rosterClass(${c.id})"><i class="fa-solid fa-users"></i> Roster</button>
          <button class="btn btn-outline btn-sm" onclick="window.gm.editClass(${c.id})"><i class="fa-solid fa-pen"></i></button>
          <button class="btn btn-outline btn-sm btn-danger" onclick="window.gm.deleteClass(${c.id})"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>`;
  }

  async function loadTrainerClasses() {
    try {
      const d = await api('api/trainer/classes.php');
      const grid = $('trainer-classes-grid');
      if (grid) {
        grid.innerHTML = (d.classes || []).map(classCard).join('') || emptyState('No classes scheduled yet.');
      }
    } catch (err) {
      const grid = $('trainer-classes-grid');
      if (grid) grid.innerHTML = emptyState(err.message);
    }
  }

  function openClassModal(cls) {
    $('modal-class-title').textContent = cls ? 'Edit Class' : 'New Class';
    $('class-id').value = cls ? cls.id : '';
    $('class-name').value = cls ? cls.name : '';
    $('class-day').value = cls ? cls.day_of_week : 'Monday';
    $('class-location').value = cls ? cls.location : '';
    $('class-start').value = cls ? cls.start_time : '';
    $('class-end').value = cls ? cls.end_time : '';
    $('class-capacity').value = cls ? cls.capacity : 15;
    $('class-status').value = cls ? cls.status : 'active';
    $('class-desc').value = cls ? cls.description : '';
    openModal('modal-class');
  }

  async function renderRoster() {
    try {
      const d = await api('api/trainer/classes.php', { method: 'POST', body: { action: 'roster', class_id: currentRosterClass.id } });
      const tbody = $('roster-tbody');
      if (tbody) {
        tbody.innerHTML = (d.bookings || []).map((m) => `
          <tr>
            <td><strong>${esc(m.name)}</strong></td>
            <td>${esc(m.member_code || '-')}</td>
            <td class="text-right">
              <button class="btn btn-outline btn-sm btn-danger" onclick="window.gm.removeFromRoster(${m.user_id || m.id})"><i class="fa-solid fa-user-minus"></i></button>
            </td>
          </tr>`).join('') || emptyRow('No members booked in this class yet.', 3);
      }
    } catch (err) {
      const tbody = $('roster-tbody');
      if (tbody) tbody.innerHTML = emptyRow(err.message, 3);
    }
  }

  async function openRoster(cls) {
    currentRosterClass = cls;
    $('modal-roster-title').textContent = 'Class Roster - ' + (cls ? cls.name : '');
    const users = await window.TrainerApp.getTrainerMembers();
    $('roster-add-user').innerHTML = '<option value="">-- Add member --</option>' + users.map((u) => '<option value="' + u.id + '">' + esc(u.name) + '</option>').join('');
    renderRoster();
    openModal('modal-roster');
  }

  // Global gm actions
  window.gm = window.gm || {};
  window.gm.editClass = async (id) => {
    try {
      const d = await api('api/trainer/classes.php');
      const cls = (d.classes || []).find((c) => String(c.id) === String(id));
      if (!cls) throw new Error('Class not found.');
      openClassModal(cls);
    } catch (e) { toast(e.message, 'error'); }
  };

  window.gm.deleteClass = async (id) => {
    if (!confirm('Delete this class and its bookings?')) return;
    try {
      await api('api/trainer/classes.php', { method: 'DELETE', body: { id } });
      toast('Class deleted.');
      loadTrainerClasses();
    } catch (err) { toast(err.message, 'error'); }
  };

  window.gm.rosterClass = async (id) => {
    try {
      const d = await api('api/trainer/classes.php');
      const cls = (d.classes || []).find((c) => String(c.id) === String(id));
      if (!cls) throw new Error('Class not found.');
      openRoster(cls);
    } catch (e) { toast(e.message, 'error'); }
  };

  window.gm.removeFromRoster = async (uid) => {
    if (!currentRosterClass) return;
    try {
      await api('api/trainer/classes.php', { method: 'POST', body: { action: 'cancel', class_id: currentRosterClass.id, user_id: uid } });
      toast('Member removed from class.');
      renderRoster();
    } catch (err) { toast(err.message, 'error'); }
  };

  document.addEventListener('DOMContentLoaded', () => {
    const btnAdd = $('btn-trainer-add-class');
    if (btnAdd) btnAdd.addEventListener('click', () => openClassModal(null));

    const formClass = $('form-class');
    if (formClass) {
      formClass.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = $('class-id').value;
        const payload = {
          name: $('class-name').value.trim(),
          day_of_week: $('class-day').value,
          location: $('class-location').value.trim(),
          start_time: $('class-start').value,
          end_time: $('class-end').value,
          capacity: $('class-capacity').value,
          status: $('class-status').value,
          description: $('class-desc').value.trim(),
        };
        try {
          await api('api/trainer/classes.php', { method: id ? 'PUT' : 'POST', body: id ? { id, ...payload } : payload });
          closeModal('modal-class');
          toast(id ? 'Class updated.' : 'Class created.');
          loadTrainerClasses();
        } catch (err) { toast(err.message, 'error'); }
      });
    }

    const btnRosterAdd = $('btn-roster-add');
    if (btnRosterAdd) {
      btnRosterAdd.addEventListener('click', async () => {
        const uid = $('roster-add-user').value;
        if (!uid || !currentRosterClass) { toast('Select a member to add.', 'error'); return; }
        try {
          await api('api/trainer/classes.php', { method: 'POST', body: { action: 'book', class_id: currentRosterClass.id, user_id: uid } });
          toast('Member added to class.');
          renderRoster();
        } catch (err) { toast(err.message, 'error'); }
      });
    }
  });

  window.TrainerApp.registerLoader('tab-trainer-classes', loadTrainerClasses);
})();
