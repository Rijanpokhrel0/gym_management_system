/* ==========================================================================
   FITPULSE - RESET PASSWORD LOGIC
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  const { $, api, toast } = window.Core;

  const params = new URLSearchParams(window.location.search);
  const token = params.get('reset') || params.get('token');

  if (!token) {
    toast('No reset token found. Contact Superadmin for assistance.', 'error');
  }

  const form = $('form-reset');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const p1 = $('reset-pass').value;
    const p2 = $('reset-pass2').value;
    const btn = $('btn-submit-reset');

    if (!p1 || p1.length < 6) {
      toast('Password must be at least 6 characters.', 'error');
      return;
    }
    if (p1 !== p2) {
      toast('Passwords do not match.', 'error');
      return;
    }
    if (!token) {
      toast('Invalid or missing password reset token.', 'error');
      return;
    }

    if (btn) btn.disabled = true;

    try {
      const d = await api('api/auth/reset.php', {
        method: 'POST',
        body: { token, password: p1 }
      });
      toast(d.message || 'Password updated successfully! Redirecting to login...');
      setTimeout(() => {
        window.location.href = 'login.html';
      }, 1200);
    } catch (err) {
      if (btn) btn.disabled = false;
      toast(err.message, 'error');
    }
  });
});
