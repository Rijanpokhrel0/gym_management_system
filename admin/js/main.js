/* ==========================================================================
   FITPULSE - ADMIN CORE (MAIN) MODULE
   Handles auth protection, state, tab routing, profile modal, and global gm actions.
   ========================================================================== */

window.AdminApp = window.AdminApp || {
  state: { user: null },
  loaders: {},
  caches: { users: [] },
  
  registerLoader(tabId, loaderFn) {
    this.loaders[tabId] = loaderFn;
  },

  async getAdminUsers(refresh = false) {
    if (refresh || !this.caches.users.length) {
      const d = await window.Core.api('api/admin/users.php');
      this.caches.users = d.users || [];
    }
    return this.caches.users;
  },

  async fillAdminMemberSelects(selectIds) {
    const { $, esc } = window.Core;
    const users = await this.getAdminUsers();
    const opts = users.map((u) => '<option value="' + u.id + '">' + esc(u.name) + '</option>').join('');
    (selectIds || ['admin-att-user', 'admin-progress-user', 'progress-user', 'invoice-user']).forEach((id) => {
      const sel = $(id);
      if (!sel) return;
      const prev = sel.value;
      const prefix = id === 'admin-att-user' ? '<option value="">All Members</option>' : '<option value="">-- Select member --</option>';
      sel.innerHTML = prefix + opts;
      sel.value = prev;
    });
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
  const {
    $, esc, initials, toast, api, uploadLogo, isImageFile, openModal, closeModal, requireAuth
  } = window.Core;

  // Protect Admin Portal
  const user = await requireAuth('admin');
  if (!user) return;

  window.AdminApp.state.user = user;

  // Navigation Tabs Event Listeners
  document.querySelectorAll('#sidebar-menu-list .nav-item').forEach((item) => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      window.AdminApp.showSection(item.dataset.tab);
    });
  });

  /* -------------------------- Gym Profile Logic -------------------------- */
  const btnProfile = $('btn-admin-profile');
  if (btnProfile) {
    btnProfile.addEventListener('click', async () => {
      try {
        const d = await api('api/auth/me.php');
        $('ap-gym-name').value = d.gym_name || '';
        $('ap-logo').value = d.logo_url || '';
        $('ap-logo-file').value = '';
        $('ap-phone').value = d.phone || '';
        $('ap-address').value = d.address || '';
        $('ap-description').value = d.description || '';
        updateLogoPreview();
        openModal('modal-admin-profile');
      } catch (err) { toast(err.message, 'error'); }
    });
  }

  function updateLogoPreview() {
    const url = $('ap-logo').value.trim();
    const gymName = $('ap-gym-name').value.trim();
    const previewEl = $('ap-logo-preview-label');
    if (previewEl) {
      previewEl.innerHTML = url
        ? '<img class="gym-logo gym-logo-sm" src="' + esc(url) + '" alt="logo preview"> Logo preview (shown on your portal).'
        : '<div class="gym-logo gym-logo-sm gym-logo-fallback">' + esc(initials(gymName || 'Gym')) + '</div> Preview: initials used if no logo uploaded.';
    }
  }

  const apGymName = $('ap-gym-name');
  if (apGymName) apGymName.addEventListener('input', updateLogoPreview);

  const apLogoFile = $('ap-logo-file');
  if (apLogoFile) {
    apLogoFile.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (!isImageFile(file)) { toast('Please choose an image file (PNG, JPG, WEBP or GIF).', 'error'); e.target.value = ''; return; }
      if (file.size > 2 * 1024 * 1024) { toast('Image must be smaller than 2 MB.', 'error'); e.target.value = ''; return; }
      try {
        const url = await uploadLogo(file);
        $('ap-logo').value = url;
        updateLogoPreview();
        toast('Logo uploaded.');
      } catch (err) { toast(err.message, 'error'); e.target.value = ''; }
    });
  }

  const formProfile = $('form-admin-profile');
  if (formProfile) {
    formProfile.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        gym_name: $('ap-gym-name').value.trim(),
        logo_url: $('ap-logo').value.trim(),
        phone: $('ap-phone').value.trim(),
        address: $('ap-address').value.trim(),
        description: $('ap-description').value.trim(),
      };
      try {
        await api('api/admin/profile.php', { method: 'PUT', body: payload });
        closeModal('modal-admin-profile');
        window.AdminApp.state.user = { ...window.AdminApp.state.user, ...payload };
        toast('Gym profile updated.');
        if (window.AdminApp.loaders['tab-admin-dashboard']) {
          window.AdminApp.loaders['tab-admin-dashboard']();
        }
      } catch (err) { toast(err.message, 'error'); }
    });
  }

  // Trigger initial dashboard load once other modules have registered
  setTimeout(() => {
    if (window.AdminApp.loaders['tab-admin-dashboard']) {
      window.AdminApp.loaders['tab-admin-dashboard']();
    }
  }, 0);
});
