/* ==========================================================================
   FITPULSE - ADMIN EQUIPMENT & ASSETS MODULE
   ========================================================================== */

(function () {
  'use strict';

  const {
    $, esc, fmtDate, toast, api, openModal, closeModal, statusBadge, emptyRow
  } = window.Core;

  async function loadAdminEquipment() {
    try {
      const d = await api('api/admin/equipment.php');
      const tbody = $('admin-equipment-tbody');
      if (tbody) {
        tbody.innerHTML = (d.equipment || []).map((e) => `
          <tr>
            <td><strong>${esc(e.name)}</strong><br><span class="text-muted text-sm">${esc(e.description || '')}</span></td>
            <td>${esc(e.category) || '-'}</td>
            <td>${e.quantity}</td>
            <td>${statusBadge(e.status)}</td>
            <td>${fmtDate(e.created_at)}</td>
            <td class="text-right">
              <button class="btn btn-outline btn-sm" onclick="window.gm.editEquipment(${e.id})"><i class="fa-solid fa-pen"></i></button>
              <button class="btn btn-outline btn-sm btn-danger" onclick="window.gm.deleteEquipment(${e.id})"><i class="fa-solid fa-trash"></i></button>
            </td>
          </tr>`).join('') || emptyRow('No equipment yet. Add your gym equipment.', 6);
      }
    } catch (err) {
      const tbody = $('admin-equipment-tbody');
      if (tbody) tbody.innerHTML = emptyRow(err.message, 6);
    }
  }

  function openEquipmentModal(eq) {
    $('modal-equipment-title').textContent = eq ? 'Edit Equipment' : 'Add Equipment';
    $('equipment-id').value = eq ? eq.id : '';
    $('equipment-name').value = eq ? eq.name : '';
    $('equipment-category').value = eq ? eq.category || '' : '';
    $('equipment-quantity').value = eq ? eq.quantity : 1;
    $('equipment-status').value = eq ? eq.status : 'active';
    $('equipment-desc').value = eq ? eq.description : '';
    openModal('modal-equipment');
  }

  // Global gm actions
  window.gm = window.gm || {};
  window.gm.editEquipment = (id) => api('api/admin/equipment.php').then((d) => openEquipmentModal((d.equipment || []).find((e) => e.id === id))).catch((e) => toast(e.message, 'error'));
  window.gm.deleteEquipment = async (id) => {
    if (!confirm('Delete this equipment?')) return;
    try {
      await api('api/admin/equipment.php', { method: 'DELETE', body: { id } });
      toast('Equipment removed.');
      loadAdminEquipment();
    } catch (err) { toast(err.message, 'error'); }
  };

  document.addEventListener('DOMContentLoaded', () => {
    const btnAdd = $('btn-add-equipment');
    if (btnAdd) btnAdd.addEventListener('click', () => openEquipmentModal(null));

    const formEq = $('form-equipment');
    if (formEq) {
      formEq.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = $('equipment-id').value;
        const payload = {
          name: $('equipment-name').value.trim(),
          category: $('equipment-category').value.trim(),
          quantity: $('equipment-quantity').value,
          status: $('equipment-status').value,
          description: $('equipment-desc').value.trim(),
        };
        try {
          await api('api/admin/equipment.php', { method: id ? 'PUT' : 'POST', body: id ? { id, ...payload } : payload });
          closeModal('modal-equipment');
          toast(id ? 'Equipment updated.' : 'Equipment added.');
          loadAdminEquipment();
        } catch (err) { toast(err.message, 'error'); }
      });
    }
  });

  window.AdminApp.registerLoader('tab-admin-equipment', loadAdminEquipment);
})();
