/* ==========================================================================
   FITPULSE - LOGIN PAGE LOGIC
   ========================================================================== */

document.addEventListener('DOMContentLoaded', async () => {
  const { $, api, toast, redirectToPortal, checkSession } = window.Core;

  // Check URL parameters for redirects
  const params = new URLSearchParams(window.location.search);
  const verify = params.get('verify');
  const reset = params.get('reset');
  if (verify) {
    window.location.href = 'verify-email.html?verify=' + encodeURIComponent(verify);
    return;
  }
  if (reset) {
    window.location.href = 'reset-password.html?reset=' + encodeURIComponent(reset);
    return;
  }

  // If already logged in, redirect straight to their portal
  const user = await checkSession();
  if (user && user.portal) {
    redirectToPortal(user.portal);
    return;
  }

  const form = $('form-login');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $('login-email').value.trim();
    const password = $('login-password').value;
    const btn = $('btn-submit-login');

    if (!email || !password) {
      toast('Please enter your email and password.', 'error');
      return;
    }

    if (btn) btn.disabled = true;

    try {
      const data = await api('api/auth/login.php', {
        method: 'POST',
        body: { email, password }
      });

      toast('Welcome back, ' + data.name + '!');
      setTimeout(() => {
        redirectToPortal(data.portal);
      }, 500);
    } catch (err) {
      if (btn) btn.disabled = false;
      if (/verify your email/i.test(err.message || '')) {
        setTimeout(() => {
          window.location.href = 'verify-email.html?email=' + encodeURIComponent(email);
        }, 1200);
      }
      toast(err.message, 'error');
    }
  });
});
