/* ==========================================================================
   FITPULSE - SUPERADMIN CORE (MAIN) MODULE
   Handles auth protection, state, tab routing, and global delegates.
   ========================================================================== */

window.SuperadminApp = window.SuperadminApp || {
  state: { user: null },
  loaders: {},

  registerLoader(tabId, loaderFn) {
    this.loaders[tabId] = loaderFn;
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
  const { requireAuth } = window.Core;

  // Protect portal
  const user = await requireAuth('superadmin');
  if (!user) return;

  window.SuperadminApp.state.user = user;

  // Navigation Tabs Event Listeners
  document.querySelectorAll('#sidebar-menu-list .nav-item').forEach((item) => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      window.SuperadminApp.showSection(item.dataset.tab);
    });
  });

  // Initial load
  setTimeout(() => {
    if (window.SuperadminApp.loaders['tab-sa-dashboard']) {
      window.SuperadminApp.loaders['tab-sa-dashboard']();
    }
  }, 0);
});
