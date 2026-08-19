/* ==========================================================================
   FITPULSE - SUPERADMIN USER MANAGEMENT MODULE
   ========================================================================== */

(function () {
  'use strict';

  const { $, esc, api, toast, openModal, closeModal, statusBadge, emptyRow } = window.Core;

  let allUsers = [];
  let allAdmins = [];

  async function loadAllUsers() {
    try {
      const [uD, aD] = await Promise.all([
        api('api/superadmin/users.php'),
        api('api/superadmin/admins.php')
      ]);
      allUsers = uD.users || [];
      allAdmins = aD.admins || [];
      renderUsers(allUsers);
    } catch (err) {
      const tbody = $('sa-users-tbody');
      if (tbody) tbody.innerHTML = emptyRow(err.message, 5);
    }
  }

  function renderUsers(users) {
    const tbody = $('sa-users-tbody');
    if (!tbody) return;
    tbody.innerHTML = users.map((u) => `
      <tr>
        <td>
          <div class="cell-user">
            <div>
              <strong>${esc(u.name)}</strong>
              <br><span class="text-muted text-sm">${esc(u.email)}</span>
            </div>
          </div>
        </td>
        <td>${esc(u.gym_name) || '<span class="text-muted">No gym</span>'}</td>
        <td class="text-sm">${esc(u.phone) || '-'}<br><span class="text-muted">${esc(u.member_code)}</span></td>
        <td class="text-sm">${esc(u.goal) || '-'}</td>
        <td class="text-right">
          <button class="btn btn-outline btn-sm" onclick="window.saUsers.edit(${u.id})" title="Edit"><i class="fa-solid fa-pen"></i></button>
          <button class="btn btn-outline btn-sm btn-danger" onclick="window.saUsers.remove(${u.id})" title="Delete"><i class="fa-solid fa-trash"></i></button>
        </td>
      </tr>`).join('') || emptyRow('No users found.', 5);
  }

  window.saUsers = window.saUsers || {};

  window.saUsers.edit = (id) => {
    const u = allUsers.find((x) => x.id === id);
    if (!u) return;
    $('sa-user-id').value = u.id;
    $('sa-user-name').value = u.name;
    $('sa-user-email').value = u.email;
    $('sa-user-phone').value = u.phone || '';
    $('sa-user-goal').value = u.goal || '';
    $('sa-user-pass').value = '';
    $('sa-user-pass').placeholder = 'Leave blank to keep current';

    const gymSelect = $('sa-user-gym');
    gymSelect.innerHTML = '<option value="">No gym</option>' + allAdmins.map((a) =>
      `<option value="${a.id}" ${a.id == u.admin_id ? 'selected' : ''}>${esc(a.gym_name || a.name)}</option>`
    ).join('');

    openModal('modal-sa-user');
  };

  window.saUsers.remove = async (id) => {
    if (!confirm('Delete this user? This cannot be undone.')) return;
    try {
      await api('api/superadmin/users.php', { method: 'DELETE', body: { id } });
      toast('User removed.');
      loadAllUsers();
    } catch (err) { toast(err.message, 'error'); }
  };

  document.addEventListener('DOMContentLoaded', () => {
    const form = $('form-sa-user');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = $('sa-user-id').value;
        const payload = {
          id: parseInt(id),
          name: $('sa-user-name').value.trim(),
          email: $('sa-user-email').value.trim(),
          phone: $('sa-user-phone').value.trim(),
          goal: $('sa-user-goal').value.trim(),
          admin_id: $('sa-user-gym').value ? parseInt($('sa-user-gym').value) : null,
        };
        if ($('sa-user-pass').value) payload.password = $('sa-user-pass').value;
        try {
          await api('api/superadmin/users.php', { method: 'PUT', body: payload });
          closeModal('modal-sa-user');
          toast('User updated.');
          loadAllUsers();
        } catch (err) { toast(err.message, 'error'); }
      });
    }
  });

  window.SuperadminApp.registerLoader('tab-sa-users', loadAllUsers);
})();
