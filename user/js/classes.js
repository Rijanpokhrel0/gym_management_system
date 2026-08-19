/* ==========================================================================
   FITPULSE - MEMBER CLASSES MODULE
   ========================================================================== */

(function () {
  'use strict';

  const {
    $, esc, toast, api, apiQuery, pill, emptyState
  } = window.Core;

  function userClassCard(c) {
    const full = Number(c.booked_count || 0) >= Number(c.capacity || 15);
    const mine = c.my_booking === 'booked';
    const action = mine
      ? '<button class="btn btn-outline btn-sm btn-danger" onclick="window.gm.cancelClass(' + c.id + ')"><i class="fa-solid fa-circle-xmark"></i> Cancel Booking</button>'
      : (full
        ? '<span class="badge badge-rose">Full</span>'
        : '<button class="btn btn-primary btn-sm" onclick="window.gm.bookClass(' + c.id + ')"><i class="fa-solid fa-calendar-plus"></i> Book Slot</button>');
    return `
      <div class="class-card">
        <div class="class-card-header">
          <span class="class-category">${esc(c.day_of_week || '')}</span>
          ${pill(c.status)}
        </div>
        <h4 class="class-card-title">${esc(c.name)}</h4>
        <div class="class-info-item"><i class="fa-solid fa-clock"></i> ${esc(c.start_time || '')} - ${esc(c.end_time || '')}</div>
        <div class="class-info-item"><i class="fa-solid fa-location-dot"></i> ${esc(c.location || 'Studio')}</div>
        <div class="class-info-item"><i class="fa-solid fa-user-ninja"></i> ${esc(c.trainer_name || 'Any trainer')}</div>
        <div class="class-info-item"><i class="fa-solid fa-users"></i> ${c.booked_count || 0} / ${c.capacity || 15} booked</div>
        <div class="admin-plan-actions">${action}</div>
      </div>`;
  }

  async function loadUserClasses() {
    try {
      await window.UserApp.setupUserGym();
      const gym = window.UserApp.state.gym;
      const grid = $('user-classes-grid');
      if (!grid) return;

      if (!gym) {
        grid.innerHTML = emptyState('No gym linked to your account.');
        return;
      }

      const d = await api(apiQuery('api/user/classes.php', { admin_id: gym.id }));
      grid.innerHTML = (d.classes || []).map(userClassCard).join('') || emptyState('No classes scheduled at your gym.');
    } catch (err) {
      const grid = $('user-classes-grid');
      if (grid) grid.innerHTML = emptyState(err.message);
    }
  }

  // Global gm actions
  window.gm = window.gm || {};
  window.gm.bookClass = async (id) => {
    try {
      await api('api/user/classes.php', { method: 'POST', body: { class_id: id } });
      toast('Class booked! See you there.');
      loadUserClasses();
    } catch (err) { toast(err.message, 'error'); }
  };

  window.gm.cancelClass = async (id) => {
    try {
      await api('api/user/classes.php', { method: 'DELETE', body: { class_id: id } });
      toast('Booking cancelled.');
      loadUserClasses();
    } catch (err) { toast(err.message, 'error'); }
  };

  window.UserApp.registerLoader('tab-user-classes', loadUserClasses);
})();
