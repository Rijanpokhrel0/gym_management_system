/* ==========================================================================
   FITPULSE - FORGOT PASSWORD LOGIC
   ========================================================================== */

document.addEventListener('DOMContentLoaded', async () => {
  const { $, esc, api } = window.Core;

  try {
    const data = await api('api/auth/forgot.php', { method: 'POST', body: {} });
    const emailEl = $('forgot-sa-email');
    if (emailEl) {
      emailEl.innerHTML = data.superadmin_email
        ? esc(data.superadmin_name) + ' &middot; <a href="mailto:' + esc(data.superadmin_email) + '" class="text-orange">' + esc(data.superadmin_email) + '</a>'
        : 'Contact the Superadmin through the administration office.';
    }
  } catch (err) {
    const emailEl = $('forgot-sa-email');
    if (emailEl) emailEl.textContent = err.message || 'Unable to load Superadmin contact.';
  }
});
