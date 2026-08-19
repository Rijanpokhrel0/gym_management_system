/* ==========================================================================
   FITPULSE - ADMIN MEMBER PROGRESS MODULE
   ========================================================================== */

(function () {
  'use strict';

  const {
    $, esc, fmtDate, todayISO, toast, api, apiQuery, openModal, closeModal, metricCard, emptyRow
  } = window.Core;

  async function loadAdminProgress() {
    try {
      await window.AdminApp.fillAdminMemberSelects(['admin-progress-user', 'progress-user']);
      const sel = $('admin-progress-user');
      if (!sel || !sel.value) {
        const tbody = $('admin-progress-tbody');
        if (tbody) tbody.innerHTML = emptyRow('Select a member above to see their progress.', 9);
        const summary = $('admin-progress-summary');
        if (summary) summary.innerHTML = '';
        return;
      }

      const d = await api(apiQuery('api/admin/progress.php', { user_id: sel.value }));
      const entries = d.progress || [];
      $('admin-progress-tbody').innerHTML = entries.map((e) => `
        <tr>
          <td>${fmtDate(e.recorded_at)}</td>
          <td>${e.weight ?? '-'}</td>
          <td>${e.body_fat ?? '-'}</td>
          <td>${e.bmi ?? '-'}</td>
          <td>${e.chest ?? '-'}</td>
          <td>${e.waist ?? '-'}</td>
          <td>${e.arms ?? '-'}</td>
          <td class="text-muted text-sm">${esc(e.notes || '')}</td>
          <td class="text-right">
            <button class="btn btn-outline btn-sm" onclick="window.gm.editProgress(${e.id})"><i class="fa-solid fa-pen"></i></button>
            <button class="btn btn-outline btn-sm btn-danger" onclick="window.gm.deleteProgress(${e.id})"><i class="fa-solid fa-trash"></i></button>
          </td>
        </tr>`).join('') || emptyRow('No progress records for this member yet.', 9);

      const last = entries[0] || {};
      $('admin-progress-summary').innerHTML =
        metricCard('fa-weight-scale', 'icon-orange', last.weight ?? '-', 'Weight (kg)', 'Latest entry') +
        metricCard('fa-percent', 'icon-blue', last.body_fat ?? '-', 'Body Fat (%)', 'Latest entry') +
        metricCard('fa-heart-pulse', 'icon-emerald', last.bmi ?? '-', 'BMI', 'Latest entry') +
        metricCard('fa-arrow-trend-up', 'icon-purple', entries.length, 'Total Entries', 'Recorded');
    } catch (err) {
      const tbody = $('admin-progress-tbody');
      if (tbody) tbody.innerHTML = emptyRow(err.message, 9);
    }
  }

  function openProgressModal(entry) {
    $('modal-progress-title').textContent = entry ? 'Edit Progress Record' : 'Add Progress Record';
    $('progress-id').value = entry ? entry.id : '';
    $('progress-user').value = entry ? entry.user_id : ($('admin-progress-user').value || '');
    $('progress-date').value = entry ? fmtDate(entry.recorded_at) : todayISO();
    $('progress-weight').value = entry ? entry.weight : '';
    $('progress-bodyfat').value = entry ? entry.body_fat : '';
    $('progress-bmi').value = entry ? entry.bmi : '';
    $('progress-chest').value = entry ? entry.chest : '';
    $('progress-waist').value = entry ? entry.waist : '';
    $('progress-arms').value = entry ? entry.arms : '';
    $('progress-notes').value = entry ? entry.notes : '';
    openModal('modal-progress');
  }

  // Global actions for progress
  window.gm = window.gm || {};
  window.gm.editProgress = async (id) => {
    try {
      const sel = $('admin-progress-user');
      const d = await api(apiQuery('api/admin/progress.php', { user_id: sel.value }));
      const entry = (d.progress || []).find((e) => String(e.id) === String(id));
      if (!entry) throw new Error('Progress record not found.');
      openProgressModal(entry);
    } catch (e) { toast(e.message, 'error'); }
  };

  window.gm.deleteProgress = async (id) => {
    if (!confirm('Delete this progress record?')) return;
    try {
      await api('api/admin/progress.php', { method: 'DELETE', body: { id } });
      toast('Progress record deleted.');
      loadAdminProgress();
    } catch (err) { toast(err.message, 'error'); }
  };

  document.addEventListener('DOMContentLoaded', () => {
    const btnAdd = $('btn-add-progress');
    if (btnAdd) btnAdd.addEventListener('click', () => openProgressModal(null));

    const userSelect = $('admin-progress-user');
    if (userSelect) userSelect.addEventListener('change', loadAdminProgress);

    const formProgress = $('form-progress');
    if (formProgress) {
      formProgress.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = $('progress-id').value;
        const payload = {
          user_id: $('progress-user').value,
          recorded_at: $('progress-date').value,
          weight: $('progress-weight').value || null,
          body_fat: $('progress-bodyfat').value || null,
          bmi: $('progress-bmi').value || null,
          chest: $('progress-chest').value || null,
          waist: $('progress-waist').value || null,
          arms: $('progress-arms').value || null,
          notes: $('progress-notes').value.trim(),
        };
        try {
          await api('api/admin/progress.php', { method: id ? 'PUT' : 'POST', body: id ? { id, ...payload } : payload });
          closeModal('modal-progress');
          toast(id ? 'Progress record updated.' : 'Progress record added.');
          loadAdminProgress();
        } catch (err) { toast(err.message, 'error'); }
      });
    }
  });

  window.AdminApp.registerLoader('tab-admin-progress', loadAdminProgress);
})();
