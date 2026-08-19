/* ==========================================================================
   FITPULSE - ADMIN ATTENDANCE MODULE
   ========================================================================== */

(function () {
  'use strict';

  const {
    $, esc, todayISO, toast, api, apiQuery, openModal, closeModal, metricCard, emptyRow
  } = window.Core;

  let qrStream = null;
  let qrScannerInterval = null;

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

  async function scanQRMember(qrData) {
    const resultBox = $('qr-result');
    try {
      if (resultBox) resultBox.innerHTML = '<div class="loading-spinner" style="display:inline-block;"><div class="spinner"></div> Processing...</div>';
      const result = await api('api/admin/qr-scan.php', { method: 'POST', body: { qr_data: qrData } });
      if (resultBox) resultBox.innerHTML = '<div class="alert alert-success"><i class="fa-solid fa-check-circle"></i> ' + esc(result.message) + '</div>';
      toast(result.message);
      loadAdminAttendance();
    } catch (err) {
      if (resultBox) resultBox.innerHTML = '<div class="alert alert-danger"><i class="fa-solid fa-times-circle"></i> ' + esc(err.message) + '</div>';
      toast(err.message, 'error');
    }
  }

  async function manualCheckin() {
    const code = $('manual-member-code').value.trim().toUpperCase();
    if (!code) { toast('Enter a member code.', 'error'); return; }
    const resultBox = $('qr-result');
    try {
      if (resultBox) resultBox.innerHTML = '<div class="loading-spinner" style="display:inline-block;"><div class="spinner"></div> Processing...</div>';
      const result = await api('api/admin/qr-scan.php', { method: 'POST', body: { member_code: code } });
      if (resultBox) resultBox.innerHTML = '<div class="alert alert-success"><i class="fa-solid fa-check-circle"></i> ' + esc(result.message) + '</div>';
      toast(result.message);
      $('manual-member-code').value = '';
      loadAdminAttendance();
    } catch (err) {
      if (resultBox) resultBox.innerHTML = '<div class="alert alert-danger"><i class="fa-solid fa-times-circle"></i> ' + esc(err.message) + '</div>';
      toast(err.message, 'error');
    }
  }

  function startScanner() {
    const video = $('qr-video');
    const btnStart = $('btn-start-scanner');
    const btnStop = $('btn-stop-scanner');
    if (!video || !navigator.mediaDevices) {
      toast('Camera not available. Use manual code entry.', 'error');
      return;
    }
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      .then((stream) => {
        qrStream = stream;
        video.srcObject = stream;
        video.style.display = 'block';
        btnStart.style.display = 'none';
        btnStop.style.display = '';
        // Scan every 500ms
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        qrScannerInterval = setInterval(() => {
          if (video.readyState === video.HAVE_ENOUGH_DATA) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            // Use BarcodeDetector API if available
            if ('BarcodeDetector' in window) {
              const detector = new BarcodeDetector({ formats: ['qr_code'] });
              detector.detect(canvas).then((barcodes) => {
                if (barcodes.length > 0) {
                  scanQRMember(barcodes[0].rawValue);
                  stopScanner();
                }
              }).catch(() => {});
            }
          }
        }, 500);
      })
      .catch(() => {
        toast('Could not access camera. Use manual code entry.', 'error');
      });
  }

  function stopScanner() {
    const video = $('qr-video');
    const btnStart = $('btn-start-scanner');
    const btnStop = $('btn-stop-scanner');
    if (qrStream) {
      qrStream.getTracks().forEach(t => t.stop());
      qrStream = null;
    }
    if (qrScannerInterval) {
      clearInterval(qrScannerInterval);
      qrScannerInterval = null;
    }
    if (video) {
      video.style.display = 'none';
      video.srcObject = null;
    }
    if (btnStart) btnStart.style.display = '';
    if (btnStop) btnStop.style.display = 'none';
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

    const btnStartScanner = $('btn-start-scanner');
    if (btnStartScanner) btnStartScanner.addEventListener('click', startScanner);

    const btnStopScanner = $('btn-stop-scanner');
    if (btnStopScanner) btnStopScanner.addEventListener('click', stopScanner);

    const btnManualCheckin = $('btn-manual-checkin');
    if (btnManualCheckin) btnManualCheckin.addEventListener('click', manualCheckin);
  });

  window.AdminApp.registerLoader('tab-admin-attendance', loadAdminAttendance);
})();
