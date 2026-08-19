/* ==========================================================================
   FITPULSE - ADMIN TRAINERS MODULE
   ========================================================================== */

(function () {
  'use strict';

  const {
    $, esc, money, toast, api, openModal, closeModal, statusBadge, emptyRow
  } = window.Core;

  async function loadAdminTrainers() {
    try {
      const d = await api('api/admin/trainers.php');
      const tbody = $('admin-trainers-tbody');
      if (tbody) {
        tbody.innerHTML = (d.trainers || []).map((t) => `
          <tr>
            <td><strong>${esc(t.name)}</strong><br><span class="text-muted text-sm">${esc(t.certifications || '')}</span></td>
            <td>${esc(t.email)}</td>
            <td>${esc(t.specialization) || '-'}</td>
            <td>${t.experience} yrs</td>
            <td>${money(t.salary)}</td>
            <td>${statusBadge(t.status)}</td>
            <td class="text-right">
              <button class="btn btn-outline btn-sm" onclick="window.gm.editAdminTrainer(${t.id})"><i class="fa-solid fa-pen"></i></button>
              <button class="btn btn-outline btn-sm btn-danger" onclick="window.gm.deleteTrainer(${t.id})"><i class="fa-solid fa-trash"></i></button>
            </td>
          </tr>`).join('') || emptyRow('No trainers yet. Add them with a login account.', 7);
      }
    } catch (err) {
      const tbody = $('admin-trainers-tbody');
      if (tbody) tbody.innerHTML = emptyRow(err.message, 7);
    }
  }

  function openTrainerModal(trainer) {
    $('modal-trainer-title').textContent = trainer ? 'Edit Trainer' : 'Add Trainer';
    $('trainer-id').value = trainer ? trainer.id : '';
    $('trainer-name').value = trainer ? trainer.name : '';
    $('trainer-email').value = trainer ? trainer.email : '';
    $('trainer-pass').value = '';
    $('trainer-pass').required = !trainer;
    $('trainer-pass').placeholder = trainer ? 'Leave blank to keep current' : 'Min. 6 characters';
    $('trainer-spec').value = trainer ? trainer.specialization : '';
    $('trainer-exp').value = trainer ? trainer.experience : 1;
    $('trainer-phone').value = trainer ? trainer.phone : '';
    $('trainer-salary').value = trainer ? trainer.salary : 0;
    $('trainer-certs').value = trainer ? trainer.certifications : '';
    $('trainer-status').value = trainer ? trainer.status : 'active';
    openModal('modal-trainer');
  }

  // Global gm actions
  window.gm = window.gm || {};
  window.gm.editAdminTrainer = (id) => api('api/admin/trainers.php').then((d) => openTrainerModal((d.trainers || []).find((t) => t.id === id))).catch((e) => toast(e.message, 'error'));
  window.gm.deleteTrainer = async (id) => {
    if (!confirm('Delete this trainer and their login account?')) return;
    try {
      await api('api/admin/trainers.php', { method: 'DELETE', body: { id } });
      toast('Trainer removed.');
      loadAdminTrainers();
    } catch (err) { toast(err.message, 'error'); }
  };

  document.addEventListener('DOMContentLoaded', () => {
    const btnAdd = $('btn-add-admin-trainer');
    if (btnAdd) btnAdd.addEventListener('click', () => openTrainerModal(null));

    const formTrainer = $('form-trainer');
    if (formTrainer) {
      formTrainer.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = $('trainer-id').value;
        const payload = {
          name: $('trainer-name').value.trim(),
          email: $('trainer-email').value.trim(),
          specialization: $('trainer-spec').value.trim(),
          experience: $('trainer-exp').value,
          phone: $('trainer-phone').value.trim(),
          salary: $('trainer-salary').value,
          certifications: $('trainer-certs').value.trim(),
          status: $('trainer-status').value,
        };
        if ($('trainer-pass').value) payload.password = $('trainer-pass').value;
        try {
          await api('api/admin/trainers.php', { method: id ? 'PUT' : 'POST', body: id ? { id, ...payload } : payload });
          closeModal('modal-trainer');
          toast(id ? 'Trainer updated.' : 'Trainer added with login access.');
          loadAdminTrainers();
        } catch (err) { toast(err.message, 'error'); }
      });
    }
  });

  window.AdminApp.registerLoader('tab-admin-trainers', loadAdminTrainers);
})();
