/* ==========================================================================
   FITPULSE - ADMIN ATTENDANCE MODULE
   ========================================================================== */

(function () {
  'use strict';

  const {
    $, esc, todayISO, toast, api, apiQuery, openModal, closeModal, metricCard, emptyRow
  } = window.Core;

  async function loadAdminAttendance() {
    try {
      await window.AdminApp.fillAdminMemberSelects(['admin-att-user']);
      const date = $('admin-att-date').value || todayISO();
      $('admin-att-date').value = date;
      const d = await api(apiQuery('api/admin/attendance.php', {
        date,
        user_id: $('admin-att-user').value || undefined
      }));
      const log = d.attendance || [];
      $('admin-attendance-tbody').innerHTML = log.map((r) => `
        <tr>
          <td><strong>${esc(r.user_name)}</strong></td>
          <td>${esc(r.member_code || '-')}</td>
          <td>${esc(r.check_in_at || '-')}</td>
          <td>${esc(r.checked_in_by || 'staff')}</td>
        </tr>`).join('') || emptyRow('No check-ins found for this date.', 4);

      const unique = new Set(log.map((r) => r.user_id || r.member_id)).size;
      const stats = d.stats || {};
      $('admin-att-stats-grid').innerHTML =
        metricCard('fa-fingerprint', 'icon-blue', stats.checks_today !== undefined ? stats.checks_today : log.length, 'Check-ins Today', 'On ' + date) +
        metricCard('fa-users', 'icon-emerald', stats.members_today !== undefined ? stats.members_today : unique, 'Members Checked In', 'On this date') +
        metricCard('fa-calendar-check', 'icon-orange', log.length, 'Records Shown', 'Filtered log');
    } catch (err) {
      const tbody = $('admin-attendance-tbody');
      if (tbody) tbody.innerHTML = emptyRow(err.message, 4);
    }
  }

  async function openCheckinModal() {
    try {
      const users = await window.AdminApp.getAdminUsers(true);
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
    const btnCheckin = $('btn-admin-checkin');
    if (btnCheckin) btnCheckin.addEventListener('click', openCheckinModal);

    const btnDoCheckin = $('btn-do-checkin');
    if (btnDoCheckin) {
      btnDoCheckin.addEventListener('click', async () => {
        const code = $('checkin-code').value.trim().toUpperCase();
        const uid = $('checkin-user').value;
        if (!code && !uid) { toast('Enter a member code or pick a member.', 'error'); return; }
        try {
          await api('api/admin/attendance.php', { method: 'POST', body: code ? { member_code: code } : { user_id: uid } });
          toast('Check-in recorded.');
          closeModal('modal-checkin');
          loadAdminAttendance();
        } catch (err) { toast(err.message, 'error'); }
      });
    }

    const dateFilter = $('admin-att-date');
    if (dateFilter) dateFilter.addEventListener('change', loadAdminAttendance);

    const userFilter = $('admin-att-user');
    if (userFilter) userFilter.addEventListener('change', loadAdminAttendance);
  });

  window.AdminApp.registerLoader('tab-admin-attendance', loadAdminAttendance);
})();
