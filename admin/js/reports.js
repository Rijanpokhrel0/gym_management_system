/* ==========================================================================
   FITPULSE - ADMIN REPORTS & ANALYTICS MODULE
   ========================================================================== */

(function () {
  'use strict';

  const {
    $, esc, money, api, apiQuery, metricCard, drawBarChart, downloadReportCsv, emptyRow
  } = window.Core;

  async function loadAdminReports() {
    try {
      const [o, c] = await Promise.all([
        api(apiQuery('api/admin/reports.php', { report: 'overview' })),
        api(apiQuery('api/admin/reports.php', { report: 'classes' })),
      ]);
      const k = o.kpis || {};
      const kpisEl = $('admin-reports-kpis');
      if (kpisEl) {
        kpisEl.innerHTML =
          metricCard('fa-coins', 'icon-emerald', money(k.revenue_collected), 'Collected Revenue', 'All time') +
          metricCard('fa-users', 'icon-blue', k.members || 0, 'Total Members', 'Registered') +
          metricCard('fa-fingerprint', 'icon-orange', k.attendance_today || 0, 'Check-ins Today', 'Today') +
          metricCard('fa-calendar-day', 'icon-purple', k.classes || 0, 'Classes', 'Scheduled');
      }

      const rev = o.monthly_revenue || [];
      const att = o.attendance_trend || [];
      const mem = o.member_growth || [];
      drawBarChart('chart-revenue', rev.map((r) => r.label), rev.map((r) => Number(r.v || 0)), 'orange');
      drawBarChart('chart-attendance', att.map((r) => r.label), att.map((r) => Number(r.v || 0)), 'blue');
      drawBarChart('chart-members', mem.map((r) => r.label), mem.map((r) => Number(r.v || 0)), 'emerald');

      const classes = c.rows || [];
      const classTbody = $('admin-reports-classes-tbody');
      if (classTbody) {
        classTbody.innerHTML = classes.map((cl) => {
          const fill = Math.round((Number(cl.booked || 0) / Math.max(1, Number(cl.capacity || 1))) * 100);
          return '<tr>' +
            '<td><strong>' + esc(cl.name) + '</strong></td>' +
            '<td>' + esc(cl.day_of_week || '') + ' ' + esc(cl.start_time || '') + '</td>' +
            '<td>' + (cl.capacity || 0) + '</td>' +
            '<td>' + (cl.booked || 0) + '</td>' +
            '<td><div class="fill-bar"><div class="fill-bar-inner" style="width:' + Math.min(fill, 100) + '%"></div></div><span class="text-muted text-sm">' + fill + '%</span></td>' +
            '</tr>';
        }).join('') || emptyRow('No classes yet.', 5);
      }
    } catch (err) {
      const kpisEl = $('admin-reports-kpis');
      if (kpisEl) kpisEl.innerHTML = '';
      const classTbody = $('admin-reports-classes-tbody');
      if (classTbody) classTbody.innerHTML = emptyRow(err.message, 5);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    const btnCsvRev = $('btn-csv-revenue');
    if (btnCsvRev) btnCsvRev.addEventListener('click', () => downloadReportCsv('revenue'));

    const btnCsvAtt = $('btn-csv-attendance');
    if (btnCsvAtt) btnCsvAtt.addEventListener('click', () => downloadReportCsv('attendance'));
  });

  window.AdminApp.registerLoader('tab-admin-reports', loadAdminReports);
})();
