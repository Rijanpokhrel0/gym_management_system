/* ==========================================================================
   FITPULSE - MEMBER ATTENDANCE & CHECK-IN MODULE
   ========================================================================== */

(function () {
  'use strict';

  const {
    $, esc, toast, api, emptyRow
  } = window.Core;

  async function loadUserAttendance() {
    try {
      const [d, db] = await Promise.all([
        api('api/user/checkin.php'),
        api('api/user/dashboard.php'),
      ]);
      const code = db.member_code;
      const codeBox = $('user-member-code-box');
      if (codeBox) {
        codeBox.innerHTML = code
          ? '<div class="member-code-box"><div><i class="fa-solid fa-id-card"></i></div><div><span class="text-muted text-sm">Show this code at the gym reception</span><h3 style="margin:2px 0 0;letter-spacing:2px;">' + esc(code) + '</h3></div></div>'
          : '<p class="text-muted">No member code assigned yet. Contact your gym administrator.</p>';
      }

      const log = d.attendance || [];
      const tbody = $('user-attendance-tbody');
      if (tbody) {
        tbody.innerHTML = log.map((r) => `
          <tr>
            <td><strong>${esc(r.gym_name || 'My Gym')}</strong></td>
            <td>${esc(r.check_in_at || '-')}</td>
            <td>${esc(r.checked_in_by || 'check-in')}</td>
          </tr>`).join('') || emptyRow('No check-ins yet. Check in when you arrive.', 3);
      }
    } catch (err) {
      const tbody = $('user-attendance-tbody');
      if (tbody) tbody.innerHTML = emptyRow(err.message, 3);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    const btnCheckin = $('btn-user-checkin');
    if (btnCheckin) {
      btnCheckin.addEventListener('click', async () => {
        try {
          await api('api/user/checkin.php', { method: 'POST', body: {} });
          toast('Checked in! Welcome to the gym.');
          loadUserAttendance();
        } catch (err) { toast(err.message, 'error'); }
      });
    }
  });

  window.UserApp.registerLoader('tab-user-attendance', loadUserAttendance);
})();
