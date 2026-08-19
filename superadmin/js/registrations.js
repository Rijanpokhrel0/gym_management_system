/* ==========================================================================
   FITPULSE - SUPERADMIN REGISTRATIONS MANAGEMENT MODULE
   ========================================================================== */

(function () {
  'use strict';

  const {
    $, esc, fmtDate, toast, api, openModal, closeModal, statusBadge, emptyRow
  } = window.Core;

  async function loadSuperadminRegistrations() {
    try {
      const d = await api('api/superadmin/registrations.php');
      const regs = d.registrations || [];
      const tbody = $('sa-registrations-tbody');
      if (tbody) {
        tbody.innerHTML = regs.map((r) => `
          <tr>
            <td>
              <div class="cell-user">
                <div>
                  <strong>${esc(r.name)}</strong>
                  <br><span class="text-muted text-sm">${esc(r.email)}</span>
                </div>
              </div>
            </td>
            <td>${esc(r.gym_name) || '-'}</td>
            <td class="text-sm">${esc(r.phone) || '-'}<br>${esc(r.address) || ''}</td>
            <td>Rs. ${parseFloat(r.amount).toFixed(2)}</td>
            <td class="text-sm">${fmtDate(r.created_at)}</td>
            <td class="text-right">
              <button class="btn btn-outline btn-sm btn-success" onclick="window.regm.approveRegistration(${r.id})" title="Approve"><i class="fa-solid fa-check"></i></button>
              <button class="btn btn-outline btn-sm btn-danger" onclick="window.regm.rejectRegistration(${r.id})" title="Reject"><i class="fa-solid fa-times"></i></button>
            </td>
          </tr>`).join('') || emptyRow('No pending registrations.', 6);
      }
    } catch (err) {
      const tbody = $('sa-registrations-tbody');
      if (tbody) tbody.innerHTML = emptyRow(err.message, 6);
    }
  }

  // Global regm actions
  window.regm = window.regm || {};

  window.regm.approveRegistration = async (id) => {
    if (!confirm('Approve this registration? The owner will be able to login with their 14-day trial.')) return;
    try {
      await api('api/superadmin/registrations.php', {
        method: 'POST',
        body: { registration_id: id, action: 'approved' }
      });
      toast('Registration approved.');
      loadSuperadminRegistrations();
    } catch (err) { toast(err.message, 'error'); }
  };

  window.regm.rejectRegistration = async (id) => {
    const reason = prompt('Enter rejection reason (optional):');
    if (reason === null) return; // User cancelled
    try {
      await api('api/superadmin/registrations.php', {
        method: 'POST',
        body: { registration_id: id, action: 'rejected', admin_notes: reason }
      });
      toast('Registration rejected.');
      loadSuperadminRegistrations();
    } catch (err) { toast(err.message, 'error'); }
  };

  window.SuperadminApp.registerLoader('tab-sa-registrations', loadSuperadminRegistrations);
})();
