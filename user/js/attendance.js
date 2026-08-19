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

  async function loadQRCode() {
    const qrBox = $('user-qr-box');
    if (!qrBox) return;
    try {
      qrBox.innerHTML = '<div class="loading-spinner" style="display:inline-block;"><div class="spinner"></div> Generating QR code...</div>';
      const data = await api('api/user/qr-checkin.php');
      if (data.qr_code) {
        qrBox.innerHTML = `
          <div style="display:flex;flex-direction:column;align-items:center;gap:12px;">
            <img src="${data.qr_code}" alt="Check-in QR Code" style="width:220px;height:220px;border:3px solid var(--c-primary);border-radius:12px;">
            <p class="text-muted text-sm">Show this QR code at the gym reception to check in</p>
            <p style="font-size:13px;color:var(--c-muted);">Member Code: <strong>${esc(data.member_code || '')}</strong></p>
          </div>`;
      } else {
        qrBox.innerHTML = '<p class="text-muted">Unable to generate QR code. Contact your gym administrator.</p>';
      }
    } catch (err) {
      qrBox.innerHTML = '<p class="text-muted">Error loading QR code. Please try again.</p>';
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

    const btnLoadQR = $('btn-load-qr');
    if (btnLoadQR) {
      btnLoadQR.addEventListener('click', loadQRCode);
    }
  });

  window.UserApp.registerLoader('tab-user-attendance', loadUserAttendance);
})();
