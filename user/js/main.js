/* ==========================================================================
   FITPULSE - MEMBER (USER) CORE (MAIN) MODULE
   Handles auth protection, state, gym detection, tab routing, and changepass modal.
   ========================================================================== */

window.UserApp = window.UserApp || {
  state: { user: null, gym: null, gyms: [], viewGym: null },
  loaders: {},

  registerLoader(tabId, loaderFn) {
    this.loaders[tabId] = loaderFn;
  },

  async loadGymData() {
    const d = await window.Core.api('api/public/gyms.php');
    this.state.gyms = d.gyms || [];
  },

  async setupUserGym() {
    if (!this.state.gyms.length) {
      try { await this.loadGymData(); } catch (err) {}
    }
    const homeId = String(this.state.user.admin_id || '');
    this.state.gym = this.state.gyms.find((g) => String(g.id) === homeId) || null;
  },

  showSection(id) {
    const { $ } = window.Core;
    document.querySelectorAll('.tab-content').forEach((s) => s.classList.remove('active'));
    const sec = $(id);
    if (!sec) return;
    sec.classList.add('active');
    document.querySelectorAll('#sidebar-menu-list .nav-item').forEach((n) =>
      n.classList.toggle('active', n.dataset.tab === id));
    if (this.loaders[id]) this.loaders[id]();
  }
};

window.gm = window.gm || {};

document.addEventListener('DOMContentLoaded', async () => {
  const { $, toast, api, openModal, closeModal, requireAuth } = window.Core;

  // Protect Member Portal
  const user = await requireAuth('user');
  if (!user) return;

  window.UserApp.state.user = user;

  // Navigation tab listeners
  document.querySelectorAll('#sidebar-menu-list .nav-item').forEach((item) => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      window.UserApp.showSection(item.dataset.tab);
    });
  });

  /* ---------------------- Change Password Modal ---------------------- */
  const btnChangePass = $('btn-user-changepass');
  if (btnChangePass) {
    btnChangePass.addEventListener('click', () => {
      const emailDisplay = $('cp-email-display');
      if (emailDisplay) emailDisplay.textContent = window.UserApp.state.user.email || '';
      openModal('modal-user-changepass');
    });
  }

  const btnSendCp = $('btn-cp-send');
  if (btnSendCp) {
    btnSendCp.addEventListener('click', async () => {
      btnSendCp.disabled = true;
      try {
        const d = await api('api/user/change-password.php', { method: 'POST', body: {} });
        toast(d.message || 'Verification link sent to your email.');
        closeModal('modal-user-changepass');
      } catch (err) { toast(err.message, 'error'); }
      btnSendCp.disabled = false;
    });
  }

  // Initial load
  setTimeout(() => {
    if (window.UserApp.loaders['tab-user-dashboard']) {
      window.UserApp.loaders['tab-user-dashboard']();
    }
  }, 0);
});
