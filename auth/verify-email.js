/* ==========================================================================
   FITPULSE - EMAIL VERIFICATION LOGIC
   ========================================================================== */

document.addEventListener('DOMContentLoaded', async () => {
  const { $, api, toast, redirectToPortal, restoreSession } = window.Core;

  const params = new URLSearchParams(window.location.search);
  const token = params.get('verify') || params.get('token');
  const emailParam = params.get('email');

  if (emailParam) {
    const emailInput = $('verify-email');
    if (emailInput) emailInput.value = emailParam;
  }

  // Automatic token verification if token is present
  if (token) {
    const loading = $('verify-loading');
    const formWrap = $('verify-form-wrap');
    if (loading) loading.style.display = 'block';
    if (formWrap) formWrap.style.display = 'none';

    try {
      const d = await api('api/auth/verify.php', {
        method: 'POST',
        body: { token }
      });
      toast('Email successfully verified! Signing you in...');
      setTimeout(async () => {
        try {
          const user = await api('api/auth/me.php');
          redirectToPortal(user.portal);
        } catch (e) {
          window.location.href = 'login.html';
        }
      }, 1000);
    } catch (err) {
      if (loading) loading.style.display = 'none';
      if (formWrap) formWrap.style.display = 'block';
      toast(err.message || 'Verification link is invalid or expired.', 'error');
    }
  }

  const form = $('form-verify');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $('verify-email').value.trim();
    const btn = $('btn-submit-verify');

    if (!email) {
      toast('Please enter your email address.', 'error');
      return;
    }

    if (btn) btn.disabled = true;

    try {
      const d = await api('api/auth/resend.php', {
        method: 'POST',
        body: { email }
      });
      toast(d.message || 'Verification link sent. Please check your inbox.');
      if (btn) btn.disabled = false;
    } catch (err) {
      if (btn) btn.disabled = false;
      toast(err.message, 'error');
    }
  });
});
