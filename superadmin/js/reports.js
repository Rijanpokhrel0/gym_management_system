/* ==========================================================================
   FITPULSE - SUPERADMIN SYSTEM REPORTS MODULE
   ========================================================================== */

(function () {
  'use strict';

  const { $, esc, money, api, toast } = window.Core;

  async function loadSuperadminReports() {
    try {
      const d = await api('api/superadmin/reports.php?report=overview');
      const kpis = d.kpis || {};

      // KPI Cards
      const grid = $('sa-report-metrics');
      if (grid) {
        const cards = [
          ['fa-user-shield', 'icon-blue', kpis.admins || 0, 'Total Admins', (kpis.active_admins || 0) + ' active'],
          ['fa-users', 'icon-emerald', kpis.users || 0, 'Total Members', 'Across all gyms'],
          ['fa-user-ninja', 'icon-purple', kpis.trainers || 0, 'Total Trainers', 'Across all gyms'],
          ['fa-coins', 'icon-orange', 'Rs. ' + money(kpis.revenue || 0), 'Total Revenue', 'All time'],
          ['fa-clock', 'icon-amber', kpis.pending_payments || 0, 'Pending Payments', 'Awaiting review'],
          ['fa-box-open', 'icon-teal', kpis.products || 0, 'Total Products', 'Across all gyms'],
          ['fa-calendar-check', 'icon-blue', kpis.attendance_today || 0, 'Check-ins Today', 'System-wide'],
          ['fa-dumbbell', 'icon-purple', kpis.classes || 0, 'Total Classes', 'Across all gyms'],
        ];
        grid.innerHTML = cards.map(([icon, color, val, label, sub]) => `
          <div class="metric-card">
            <div class="metric-header">
              <div class="metric-icon ${color}"><i class="fa-solid ${icon}"></i></div>
              <span class="trend trend-neutral">${esc(sub)}</span>
            </div>
            <div class="metric-body"><h3>${val}</h3><p>${esc(label)}</p></div>
          </div>`).join('');
      }

      // Revenue chart
      const revChart = $('sa-revenue-chart');
      if (revChart && d.monthly_revenue && d.monthly_revenue.length) {
        drawBarChart(revChart, d.monthly_revenue, 'Revenue');
      }

      // Member growth chart
      const memChart = $('sa-members-chart');
      if (memChart && d.member_growth && d.member_growth.length) {
        drawBarChart(memChart, d.member_growth, 'New Members');
      }
    } catch (err) {
      const grid = $('sa-report-metrics');
      if (grid) grid.innerHTML = '<p class="text-muted">' + esc(err.message) + '</p>';
    }
  }

  function drawBarChart(canvas, data, label) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width = canvas.parentElement.clientWidth;
    const H = canvas.height = 200;
    ctx.clearRect(0, 0, W, H);

    const values = data.map((d) => d.value || 0);
    const max = Math.max(...values, 1);
    const barW = Math.max(20, Math.min(40, (W - 60) / values.length - 8));
    const startX = 50;
    const chartH = H - 40;

    // Y-axis
    ctx.strokeStyle = '#2A2A2A';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(startX, 10);
    ctx.lineTo(startX, chartH);
    ctx.lineTo(W - 10, chartH);
    ctx.stroke();

    // Bars
    values.forEach((v, i) => {
      const barH = (v / max) * (chartH - 20);
      const x = startX + 10 + i * (barW + 8);
      const y = chartH - barH;

      const grad = ctx.createLinearGradient(x, y, x, chartH);
      grad.addColorStop(0, '#E63946');
      grad.addColorStop(1, '#FF4D5A');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(x, y, barW, barH, [4, 4, 0, 0]);
      ctx.fill();

      // Label
      ctx.fillStyle = '#8f8f8f';
      ctx.font = '10px Inter';
      ctx.textAlign = 'center';
      ctx.fillText(data[i].label || '', x + barW / 2, chartH + 14);

      // Value on top
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 10px Inter';
      ctx.fillText(v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v, x + barW / 2, y - 4);
    });
  }

  window.SuperadminApp.registerLoader('tab-sa-reports', loadSuperadminReports);
})();
