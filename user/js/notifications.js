/* ==========================================================================
   FITPULSE - MEMBER NOTIFICATIONS MODULE
   ========================================================================== */

(function () {
  'use strict';

  const {
    $, esc, fmtDate, toast, api, emptyState
  } = window.Core;

  function notifIcon(t) { return t === 'class' ? 'fa-calendar-day' : t === 'invoice' ? 'fa-file-invoice' : 'fa-bullhorn'; }
  function notifIconClass(t) { return t === 'class' ? 'icon-blue' : t === 'invoice' ? 'icon-emerald' : 'icon-orange'; }

  async function loadUserNotifications() {
    try {
      const d = await api('api/user/notifications.php');
      const list = d.notifications || [];
      const listEl = $('user-notifications-list');
      if (listEl) {
        listEl.innerHTML = list.map((n) => `
          <div class="notification-card ${n.is_read ? '' : 'unread'}">
            <div class="notification-icon ${notifIconClass(n.type)}"><i class="fa-solid ${notifIcon(n.type)}"></i></div>
            <div class="notification-body">
              <div class="notification-head">
                <h4>${esc(n.title || '')}</h4>
                <span class="text-muted text-sm">${fmtDate(n.created_at)}</span>
              </div>
              <p class="text-muted">${esc(n.body || '')}</p>
            </div>
            ${n.is_read ? '' : '<button class="btn btn-ghost btn-sm" onclick="window.gm.markRead(' + n.id + ')">Mark read</button>'}
          </div>`).join('') || emptyState('You are all caught up! No notifications.');
      }
    } catch (err) {
      const listEl = $('user-notifications-list');
      if (listEl) listEl.innerHTML = emptyState(err.message);
    }
  }

  // Global gm actions
  window.gm = window.gm || {};
  window.gm.markRead = async (id) => {
    try {
      await api('api/user/notifications.php', { method: 'POST', body: { action: 'read', id } });
      loadUserNotifications();
    } catch (err) { toast(err.message, 'error'); }
  };

  document.addEventListener('DOMContentLoaded', () => {
    const btnMarkAll = $('btn-mark-all-read');
    if (btnMarkAll) {
      btnMarkAll.addEventListener('click', async () => {
        try {
          await api('api/user/notifications.php', { method: 'POST', body: { action: 'read_all' } });
          toast('All notifications marked as read.');
          loadUserNotifications();
        } catch (err) { toast(err.message, 'error'); }
      });
    }
  });

  window.UserApp.registerLoader('tab-user-notifications', loadUserNotifications);
})();
