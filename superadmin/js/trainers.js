/* ==========================================================================
   FITPULSE - SUPERADMIN TRAINER MANAGEMENT MODULE
   ========================================================================== */

(function () {
  'use strict';

  const { $, esc, api, toast, openModal, closeModal, statusBadge, emptyRow } = window.Core;

  let allTrainers = [];
  let allAdmins = [];

  async function loadAllTrainers() {
    try {
      const [tD, aD] = await Promise.all([
        api('api/superadmin/trainers.php'),
        api('api/superadmin/admins.php')
      ]);
      allTrainers = tD.trainers || [];
      allAdmins = aD.admins || [];
      renderTrainers(allTrainers);
    } catch (err) {
      const tbody = $('sa-trainers-tbody');
      if (tbody) tbody.innerHTML = emptyRow(err.message, 5);
    }
  }

  function renderTrainers(trainers) {
    const tbody = $('sa-trainers-tbody');
    if (!tbody) return;
    tbody.innerHTML = trainers.map((t) => `
      <tr>
        <td>
          <div class="cell-user">
            <div>
              <strong>${esc(t.name)}</strong>
              <br><span class="text-muted text-sm">${esc(t.email)}</span>
            </div>
          </div>
        </td>
        <td>${esc(t.gym_name) || '<span class="text-muted">No gym</span>'}</td>
        <td class="text-sm">${esc(t.specialization) || '-'}<br>${t.experience ? t.experience + ' yrs exp.' : ''}</td>
        <td>${statusBadge(t.status)}</td>
        <td class="text-right">
          <button class="btn btn-outline btn-sm" onclick="window.saTrainers.edit(${t.id})" title="Edit"><i class="fa-solid fa-pen"></i></button>
          <button class="btn btn-outline btn-sm" onclick="window.saTrainers.toggle(${t.id},'${t.status === 'active' ? 'inactive' : 'active'}')" title="${t.status === 'active' ? 'Deactivate' : 'Activate'}"><i class="fa-solid ${t.status === 'active' ? 'fa-ban' : 'fa-play'}"></i></button>
          <button class="btn btn-outline btn-sm btn-danger" onclick="window.saTrainers.remove(${t.id})" title="Delete"><i class="fa-solid fa-trash"></i></button>
        </td>
      </tr>`).join('') || emptyRow('No trainers found.', 5);
  }

  window.saTrainers = window.saTrainers || {};

  window.saTrainers.edit = (id) => {
    const t = allTrainers.find((x) => x.id === id);
    if (!t) return;
    $('sa-trainer-id').value = t.id;
    $('sa-trainer-name').value = t.name;
    $('sa-trainer-email').value = t.email;
    $('sa-trainer-spec').value = t.specialization || '';
    $('sa-trainer-exp').value = t.experience || 0;
    $('sa-trainer-phone').value = t.phone || '';
    $('sa-trainer-salary').value = t.salary || 0;
    $('sa-trainer-pass').value = '';
    $('sa-trainer-pass').placeholder = 'Leave blank to keep current';

    const gymSelect = $('sa-trainer-gym');
    gymSelect.innerHTML = allAdmins.map((a) =>
      `<option value="${a.id}" ${a.id == t.admin_id ? 'selected' : ''}>${esc(a.gym_name || a.name)}</option>`
    ).join('');

    openModal('modal-sa-trainer');
  };

  window.saTrainers.toggle = async (id, status) => {
    if (!confirm(status === 'inactive' ? 'Deactivate this trainer?' : 'Activate this trainer?')) return;
    try {
      await api('api/superadmin/trainers.php', { method: 'PUT', body: { id, status } });
      toast('Trainer ' + status + '.');
      loadAllTrainers();
    } catch (err) { toast(err.message, 'error'); }
  };

  window.saTrainers.remove = async (id) => {
    if (!confirm('Delete this trainer? This cannot be undone.')) return;
    try {
      await api('api/superadmin/trainers.php', { method: 'DELETE', body: { id } });
      toast('Trainer removed.');
      loadAllTrainers();
    } catch (err) { toast(err.message, 'error'); }
  };

  document.addEventListener('DOMContentLoaded', () => {
    const form = $('form-sa-trainer');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = $('sa-trainer-id').value;
        const payload = {
          id: parseInt(id),
          name: $('sa-trainer-name').value.trim(),
          email: $('sa-trainer-email').value.trim(),
          specialization: $('sa-trainer-spec').value.trim(),
          experience: parseInt($('sa-trainer-exp').value) || 0,
          phone: $('sa-trainer-phone').value.trim(),
          salary: parseFloat($('sa-trainer-salary').value) || 0,
          admin_id: parseInt($('sa-trainer-gym').value),
        };
        if ($('sa-trainer-pass').value) payload.password = $('sa-trainer-pass').value;
        try {
          await api('api/superadmin/trainers.php', { method: 'PUT', body: payload });
          closeModal('modal-sa-trainer');
          toast('Trainer updated.');
          loadAllTrainers();
        } catch (err) { toast(err.message, 'error'); }
      });
    }
  });

  window.SuperadminApp.registerLoader('tab-sa-trainers', loadAllTrainers);
})();
