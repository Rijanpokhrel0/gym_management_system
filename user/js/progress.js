/* ==========================================================================
   FITPULSE - MEMBER PROGRESS LOGGING & CHARTS MODULE
   ========================================================================== */

(function () {
  'use strict';

  const {
    $, esc, fmtDate, todayISO, toast, api, openModal, closeModal, metricCard, drawLineChart, emptyRow
  } = window.Core;

  async function loadUserProgress() {
    try {
      const d = await api('api/user/progress.php');
      const entries = d.progress || [];
      const tbody = $('user-progress-tbody');
      if (tbody) {
        tbody.innerHTML = entries.map((e) => `
          <tr>
            <td>${fmtDate(e.recorded_at)}</td>
            <td>${e.weight ?? '-'}</td>
            <td>${e.body_fat ?? '-'}</td>
            <td>${e.bmi ?? '-'}</td>
            <td>${e.chest ?? '-'}</td>
            <td>${e.waist ?? '-'}</td>
            <td>${e.arms ?? '-'}</td>
            <td class="text-muted text-sm">${esc(e.notes || '')}</td>
          </tr>`).join('') || emptyRow('No progress logged yet. Log your first measurement.', 8);
      }

      const last = entries[0] || {};
      const summary = $('user-progress-summary');
      if (summary) {
        summary.innerHTML =
          metricCard('fa-weight-scale', 'icon-orange', last.weight ?? '-', 'Current Weight (kg)', 'Latest entry') +
          metricCard('fa-percent', 'icon-blue', last.body_fat ?? '-', 'Body Fat (%)', 'Latest entry') +
          metricCard('fa-arrow-trend-up', 'icon-emerald', entries.length, 'Entries Logged', 'All time');
      }

      drawLineChart('chart-user-progress', entries.map((e) => e.recorded_at).reverse(), entries.map((e) => Number(e.weight)).reverse());
    } catch (err) {
      const tbody = $('user-progress-tbody');
      if (tbody) tbody.innerHTML = emptyRow(err.message, 8);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    const btnAdd = $('btn-add-my-progress');
    if (btnAdd) {
      btnAdd.addEventListener('click', () => {
        $('myprogress-date').value = todayISO();
        ['myprogress-weight', 'myprogress-bodyfat', 'myprogress-bmi', 'myprogress-chest', 'myprogress-waist', 'myprogress-arms'].forEach((id) => {
          const el = $(id);
          if (el) el.value = '';
        });
        $('myprogress-notes').value = '';
        openModal('modal-my-progress');
      });
    }

    const formProgress = $('form-my-progress');
    if (formProgress) {
      formProgress.addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
          recorded_at: $('myprogress-date').value,
          weight: $('myprogress-weight').value || null,
          body_fat: $('myprogress-bodyfat').value || null,
          bmi: $('myprogress-bmi').value || null,
          chest: $('myprogress-chest').value || null,
          waist: $('myprogress-waist').value || null,
          arms: $('myprogress-arms').value || null,
          notes: $('myprogress-notes').value.trim(),
        };
        try {
          await api('api/user/progress.php', { method: 'POST', body: payload });
          closeModal('modal-my-progress');
          toast('Progress logged successfully.');
          loadUserProgress();
        } catch (err) { toast(err.message, 'error'); }
      });
    }
  });

  window.UserApp.registerLoader('tab-user-progress', loadUserProgress);
})();
