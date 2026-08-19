/* ==========================================================================
   FITPULSE - SUPERADMIN ADMINS MANAGEMENT MODULE
   ========================================================================== */

(function () {
  'use strict';

  const {
    $, esc, initials, logoImg, toast, api, uploadLogo, isImageFile, openModal, closeModal, statusBadge, emptyRow
  } = window.Core;

  async function loadSuperadminAdmins() {
    try {
      const d = await api('api/superadmin/admins.php');
      const admins = d.admins || [];
      const tbody = $('sa-admins-tbody');
      if (tbody) {
        tbody.innerHTML = admins.map((a) => `
          <tr>
            <td>
              <div class="cell-user">
                ${logoImg(a.logo_url, a.gym_name)}
                <div>
                  <strong>${esc(a.name)}</strong>
                  <br><span class="text-muted text-sm">${esc(a.email)}</span>
                </div>
              </div>
            </td>
            <td>${esc(a.gym_name) || '-'}</td>
            <td class="text-sm">${esc(a.phone) || '-'}<br>${esc(a.address) || ''}</td>
            <td>${statusBadge(a.status)}</td>
            <td class="text-right">
              <button class="btn btn-outline btn-sm" onclick="window.gm.editAdmin(${a.id})" title="Edit Admin"><i class="fa-solid fa-pen"></i></button>
              <button class="btn btn-outline btn-sm" onclick="window.gm.toggleAdmin(${a.id},'${a.status === 'active' ? 'suspended' : 'active'}')" title="${a.status === 'active' ? 'Suspend' : 'Reactivate'}"><i class="fa-solid ${a.status === 'active' ? 'fa-ban' : 'fa-play'}"></i></button>
              <button class="btn btn-outline btn-sm btn-danger" onclick="window.gm.deleteAdmin(${a.id})" title="Delete Admin"><i class="fa-solid fa-trash"></i></button>
            </td>
          </tr>`).join('') || emptyRow('No admins found in system.', 5);
      }
    } catch (err) {
      const tbody = $('sa-admins-tbody');
      if (tbody) tbody.innerHTML = emptyRow(err.message, 5);
    }
  }

  function renderLogoPreview(containerId, url, gymName) {
    const c = $(containerId);
    if (!c) return;
    c.innerHTML = url
      ? '<img class="gym-logo gym-logo-lg" src="' + esc(url) + '" alt="logo preview"> <span class="text-muted text-sm">Logo preview (used everywhere the gym appears).</span>'
      : '<div class="gym-logo gym-logo-lg gym-logo-fallback">' + esc(initials(gymName || 'Gym')) + '</div> <span class="text-muted text-sm">No logo uploaded &mdash; initials will be used.</span>';
  }

  function openAdminModal(admin) {
    $('modal-sa-admin-title').textContent = admin ? 'Edit Admin' : 'Add Admin';
    $('sa-admin-id').value = admin ? admin.id : '';
    $('sa-admin-name').value = admin ? admin.name : '';
    $('sa-admin-gym').value = admin ? admin.gym_name : '';
    $('sa-admin-email').value = admin ? admin.email : '';
    $('sa-admin-pass').value = '';
    $('sa-admin-pass').required = !admin;
    $('sa-admin-pass').placeholder = admin ? 'Leave blank to keep current' : 'Min. 6 characters';
    $('sa-admin-phone').value = admin ? admin.phone : '';
    $('sa-admin-address').value = admin ? admin.address : '';
    $('sa-admin-logo').value = admin ? admin.logo_url : '';
    $('sa-admin-logo-file').value = '';
    $('sa-admin-logo-file').required = !admin;
    renderLogoPreview('sa-admin-logo-preview', admin ? admin.logo_url : '', admin ? admin.gym_name : '');
    $('sa-admin-desc').value = admin ? admin.description : '';
    $('sa-admin-status').value = admin ? admin.status : 'active';
    openModal('modal-sa-admin');
  }

  // Global gm actions
  window.gm = window.gm || {};
  window.gm.editAdmin = (id) => api('api/superadmin/admins.php')
    .then((d) => openAdminModal((d.admins || []).find((a) => a.id === id)))
    .catch((e) => toast(e.message, 'error'));

  window.gm.toggleAdmin = async (id, status) => {
    if (!confirm(status === 'suspended' ? 'Suspend this admin?' : 'Reactivate this admin?')) return;
    try {
      await api('api/superadmin/admins.php', { method: 'PUT', body: { id, status } });
      toast('Admin ' + status + '.');
      loadSuperadminAdmins();
    } catch (err) { toast(err.message, 'error'); }
  };

  window.gm.deleteAdmin = async (id) => {
    if (!confirm('Delete this admin and all their gym data? This cannot be undone.')) return;
    try {
      await api('api/superadmin/admins.php', { method: 'DELETE', body: { id } });
      toast('Admin removed.');
      loadSuperadminAdmins();
    } catch (err) { toast(err.message, 'error'); }
  };

  document.addEventListener('DOMContentLoaded', () => {
    const btnAdd = $('btn-add-admin');
    if (btnAdd) btnAdd.addEventListener('click', () => openAdminModal(null));

    const logoInput = $('sa-admin-logo-file');
    if (logoInput) {
      logoInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (!isImageFile(file)) {
          toast('Please choose an image file (PNG, JPG, WEBP or GIF).', 'error');
          e.target.value = '';
          return;
        }
        if (file.size > 2 * 1024 * 1024) {
          toast('Image must be smaller than 2 MB.', 'error');
          e.target.value = '';
          return;
        }
        try {
          const url = await uploadLogo(file);
          $('sa-admin-logo').value = url;
          renderLogoPreview('sa-admin-logo-preview', url, $('sa-admin-gym').value);
          toast('Logo uploaded.');
        } catch (err) {
          toast(err.message, 'error');
          e.target.value = '';
        }
      });
    }

    const gymInput = $('sa-admin-gym');
    if (gymInput) {
      gymInput.addEventListener('input', () => {
        renderLogoPreview('sa-admin-logo-preview', $('sa-admin-logo').value, $('sa-admin-gym').value);
      });
    }

    const formAdmin = $('form-sa-admin');
    if (formAdmin) {
      formAdmin.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = $('sa-admin-id').value;
        if (!id && !$('sa-admin-logo').value) {
          toast('Please upload a gym logo (required).', 'error');
          return;
        }
        const payload = {
          name: $('sa-admin-name').value.trim(),
          gym_name: $('sa-admin-gym').value.trim(),
          email: $('sa-admin-email').value.trim(),
          phone: $('sa-admin-phone').value.trim(),
          address: $('sa-admin-address').value.trim(),
          logo_url: $('sa-admin-logo').value.trim(),
          description: $('sa-admin-desc').value.trim(),
          status: $('sa-admin-status').value,
        };
        if ($('sa-admin-pass').value) payload.password = $('sa-admin-pass').value;

        try {
          await api('api/superadmin/admins.php', {
            method: id ? 'PUT' : 'POST',
            body: id ? { id, ...payload } : payload
          });
          closeModal('modal-sa-admin');
          toast(id ? 'Admin updated.' : 'Admin account created.');
          loadSuperadminAdmins();
        } catch (err) { toast(err.message, 'error'); }
      });
    }
  });

  window.SuperadminApp.registerLoader('tab-sa-admins', loadSuperadminAdmins);
})();
