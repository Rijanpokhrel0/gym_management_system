/* ==========================================================================
   FITPULSE - ADMIN GYM USERS (MEMBERS) MODULE
   ========================================================================== */

(function () {
  'use strict';

  const {
    $, esc, fmtDate, toast, api, openModal, closeModal, emptyRow
  } = window.Core;

  async function loadAdminUsers() {
    try {
      const d = await api('api/admin/users.php');
      window.AdminApp.caches.users = d.users || [];
      const q = $('admin-user-search') ? $('admin-user-search').value.trim().toLowerCase() : '';
      const rows = window.AdminApp.caches.users.filter((u) => !q || (u.name + ' ' + u.email).toLowerCase().includes(q));
      const tbody = $('admin-users-tbody');
      if (tbody) {
        tbody.innerHTML = rows.map((u) => `
          <tr>
            <td><strong>${esc(u.name)}</strong></td>
            <td>${esc(u.email)}</td>
            <td>${esc(u.phone) || '-'}</td>
            <td>${esc(u.goal) || '-'}</td>
            <td>${fmtDate(u.created_at)}</td>
            <td class="text-right">
              <button class="btn btn-outline btn-sm" onclick="window.gm.editAdminUser(${u.id})"><i class="fa-solid fa-pen"></i></button>
              <button class="btn btn-outline btn-sm btn-danger" onclick="window.gm.deleteAdminUser(${u.id})"><i class="fa-solid fa-trash"></i></button>
            </td>
          </tr>`).join('') || emptyRow('No users in your gym yet.', 6);
      }
    } catch (err) {
      const tbody = $('admin-users-tbody');
      if (tbody) tbody.innerHTML = emptyRow(err.message, 6);
    }
  }

  function openUserModal(u) {
    $('modal-user-title').textContent = u ? 'Edit User' : 'Add User';
    $('user-id').value = u ? u.id : '';
    $('user-name').value = u ? u.name : '';
    $('user-email').value = u ? u.email : '';
    $('user-pass').value = '';
    $('user-pass').required = !u;
    $('user-pass').placeholder = u ? 'Leave blank to keep current' : 'Min. 6 characters';
    $('user-phone').value = u ? u.phone : '';
    $('user-goal').value = u ? u.goal || '' : '';
    openModal('modal-user');
  }

  // Global gm actions
  window.gm = window.gm || {};
  window.gm.editAdminUser = (id) => api('api/admin/users.php').then((d) => openUserModal((d.users || []).find((u) => u.id === id))).catch((e) => toast(e.message, 'error'));
  window.gm.deleteAdminUser = async (id) => {
    if (!confirm('Delete this user?')) return;
    try {
      await api('api/admin/users.php', { method: 'DELETE', body: { id } });
      toast('User removed.');
      loadAdminUsers();
    } catch (err) { toast(err.message, 'error'); }
  };

  document.addEventListener('DOMContentLoaded', () => {
    const btnAdd = $('btn-add-admin-user');
    if (btnAdd) btnAdd.addEventListener('click', () => openUserModal(null));

    const searchInput = $('admin-user-search');
    if (searchInput) searchInput.addEventListener('input', loadAdminUsers);

    const formUser = $('form-user');
    if (formUser) {
      formUser.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = $('user-id').value;
        const payload = {
          name: $('user-name').value.trim(),
          email: $('user-email').value.trim(),
          phone: $('user-phone').value.trim(),
          goal: $('user-goal').value.trim(),
        };
        if ($('user-pass').value) payload.password = $('user-pass').value;
        try {
          await api('api/admin/users.php', { method: id ? 'PUT' : 'POST', body: id ? { id, ...payload } : payload });
          closeModal('modal-user');
          toast(id ? 'User updated.' : 'User created.');
          loadAdminUsers();
        } catch (err) { toast(err.message, 'error'); }
      });
    }
  });

  window.AdminApp.registerLoader('tab-admin-users', loadAdminUsers);
})();
