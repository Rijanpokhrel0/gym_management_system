/* ==========================================================================
   FITPULSE - TRAINER MEMBERS LIST MODULE
   ========================================================================== */

(function () {
  'use strict';

  const {
    $, esc, fmtDate, api, emptyRow
  } = window.Core;

  async function loadTrainerMembers() {
    try {
      const d = await api('api/trainer/members.php');
      window.TrainerApp.caches.members = d.members || [];
      const tbody = $('trainer-members-list-tbody');
      if (tbody) {
        tbody.innerHTML = window.TrainerApp.caches.members.map((m) => `
          <tr>
            <td><strong>${esc(m.name)}</strong></td>
            <td>${esc(m.email)}</td>
            <td>${esc(m.phone) || '-'}</td>
            <td>${esc(m.goal) || '-'}</td>
            <td>${esc(m.member_code || '-')}</td>
            <td>${fmtDate(m.created_at)}</td>
          </tr>`).join('') || emptyRow('No members at your gym yet.', 6);
      }
    } catch (err) {
      const tbody = $('trainer-members-list-tbody');
      if (tbody) tbody.innerHTML = emptyRow(err.message, 6);
    }
  }

  window.TrainerApp.registerLoader('tab-trainer-members', loadTrainerMembers);
})();
