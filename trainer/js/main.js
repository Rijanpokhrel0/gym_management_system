/* ==========================================================================
   FITPULSE - TRAINER CORE (MAIN) MODULE
   Handles auth protection, state, tab routing, and global delegates.
   ========================================================================== */

window.TrainerApp = window.TrainerApp || {
  state: { user: null },
  loaders: {},
  caches: { members: [] },

  registerLoader(tabId, loaderFn) {
    this.loaders[tabId] = loaderFn;
  },

  async getTrainerMembers(refresh = false) {
    if (refresh || !this.caches.members.length) {
      const d = await window.Core.api('api/trainer/members.php');
      this.caches.members = d.members || [];
    }
    return this.caches.members;
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

  // Protect Trainer Portal
  const user = await requireAuth('trainer');
  if (!user) return;

  window.TrainerApp.state.user = user;

  // Navigation tab listeners
  document.querySelectorAll('#sidebar-menu-list .nav-item').forEach((item) => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      window.TrainerApp.showSection(item.dataset.tab);
    });
  });

  // Initial load once modules have registered
  setTimeout(() => {
    if (window.TrainerApp.loaders['tab-trainer-dashboard']) {
      window.TrainerApp.loaders['tab-trainer-dashboard']();
    }
  }, 0);
});
