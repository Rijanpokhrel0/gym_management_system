/* ==========================================================================
   FITPULSE - TRAINER ATTENDANCE MODULE
   ========================================================================== */

(function () {
  'use strict';

  const {
    $, esc, todayISO, toast, api, apiQuery, openModal, closeModal, emptyRow
  } = window.Core;

  async function loadTrainerAttendance() {
    try {
      const date = $('trainer-att-date').value || todayISO();
      $('trainer-att-date').value = date;
      const d = await api(apiQuery('api/trainer/attendance.php', { date }));
      const log = d.attendance || [];
      const tbody = $('trainer-attendance-tbody');
      if (tbody) {
        tbody.innerHTML = log.map((r) => `
          <tr>
            <td><strong>${esc(r.user_name)}</strong></td>
            <td>${esc(r.member_code || '-')}</td>
            <td>${esc(r.check_in_at || '-')}</td>
            <td>${esc(r.checked_in_by || 'staff')}</td>
          </tr>`).join('') || emptyRow('No check-ins found for this date.', 4);
      }
    } catch (err) {
      const tbody = $('trainer-attendance-tbody');
      if (tbody) tbody.innerHTML = emptyRow(err.message, 4);
    }
  }

  async function openCheckinModal() {
    try {
      const users = await window.TrainerApp.getTrainerMembers(true);
      const sel = $('checkin-user');
      if (sel) {
        sel.innerHTML = '<option value="">-- Select member --</option>' + users.map((u) =>
          '<option value="' + u.id + '">' + esc(u.name) + (u.member_code ? ' &middot; ' + esc(u.member_code) : '') + '</option>').join('');
      }
      $('checkin-code').value = '';
      $('checkin-user').value = '';
      openModal('modal-checkin');
    } catch (err) { toast(err.message, 'error'); }
  }

  document.addEventListener('DOMContentLoaded', () => {
    const btnCheckin = $('btn-trainer-checkin');
    if (btnCheckin) btnCheckin.addEventListener('click', openCheckinModal);

    const btnDo = $('btn-do-checkin');
    if (btnDo) {
      btnDo.addEventListener('click', async () => {
        const code = $('checkin-code').value.trim().toUpperCase();
        const uid = $('checkin-user').value;
        if (!code && !uid) { toast('Enter a member code or pick a member.', 'error'); return; }
        try {
          await api('api/trainer/attendance.php', { method: 'POST', body: code ? { member_code: code } : { user_id: uid } });
          toast('Check-in recorded.');
          closeModal('modal-checkin');
          loadTrainerAttendance();
        } catch (err) { toast(err.message, 'error'); }
      });
    }

    const dateFilter = $('trainer-att-date');
    if (dateFilter) dateFilter.addEventListener('change', loadTrainerAttendance);
  });

  window.TrainerApp.registerLoader('tab-trainer-attendance', loadTrainerAttendance);
})();
