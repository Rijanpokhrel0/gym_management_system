/* ==========================================================================
   FITPULSE - ADMIN ANNOUNCEMENTS MODULE
   ========================================================================== */

(function () {
  'use strict';

  const {
    $, esc, fmtDate, toast, api, openModal, closeModal, pill, emptyState
  } = window.Core;

  async function loadAdminAnnouncements() {
    try {
      const d = await api('api/admin/announcements.php');
      const listEl = $('admin-announcements-list');
      if (listEl) {
        listEl.innerHTML = (d.announcements || []).map((a) => `
          <div class="announcement-card ${a.priority === 'urgent' ? 'ann-urgent' : a.priority === 'important' ? 'ann-important' : ''}">
            <div class="announcement-head">
              <h4>${esc(a.title)}</h4>
              ${pill(a.priority)}
            </div>
            <p class="text-muted">${esc(a.body || '')}</p>
            <div class="announcement-meta">
              <span><i class="fa-solid fa-calendar-days"></i> ${fmtDate(a.created_at)}</span>
              ${pill(a.status)}
            </div>
            <div class="admin-plan-actions">
              <button class="btn btn-outline btn-sm btn-danger" onclick="window.gm.deleteAnnouncement(${a.id})"><i class="fa-solid fa-trash"></i> Delete</button>
            </div>
          </div>`).join('') || emptyState('No announcements yet. Post one to notify your members.');
      }
    } catch (err) {
      const listEl = $('admin-announcements-list');
      if (listEl) listEl.innerHTML = emptyState(err.message);
    }
  }

  // Global gm actions
  window.gm = window.gm || {};
  window.gm.deleteAnnouncement = async (id) => {
    if (!confirm('Delete this announcement?')) return;
    try {
      await api('api/admin/announcements.php', { method: 'DELETE', body: { id } });
      toast('Announcement deleted.');
      loadAdminAnnouncements();
    } catch (err) { toast(err.message, 'error'); }
  };

  document.addEventListener('DOMContentLoaded', () => {
    const btnAdd = $('btn-add-announcement');
    if (btnAdd) {
      btnAdd.addEventListener('click', () => {
        $('ann-title').value = '';
        $('ann-priority').value = 'normal';
        $('ann-status').value = 'active';
        $('ann-body').value = '';
        openModal('modal-announcement');
      });
    }

    const formAnn = $('form-announcement');
    if (formAnn) {
      formAnn.addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
          title: $('ann-title').value.trim(),
          priority: $('ann-priority').value,
          status: $('ann-status').value,
          body: $('ann-body').value.trim(),
        };
        try {
          await api('api/admin/announcements.php', { method: 'POST', body: payload });
          closeModal('modal-announcement');
          toast('Announcement posted. Members notified.');
          loadAdminAnnouncements();
        } catch (err) { toast(err.message, 'error'); }
      });
    }
  });

  window.AdminApp.registerLoader('tab-admin-announcements', loadAdminAnnouncements);
})();
