/* ==========================================================================
   FITPULSE - REGISTRATION PAGE LOGIC
   ========================================================================== */

document.addEventListener('DOMContentLoaded', async () => {
  const { $, esc, api, toast, redirectToPortal, checkSession } = window.Core;

  // If already logged in, redirect straight to their portal
  const user = await checkSession();
  if (user && user.portal) {
    redirectToPortal(user.portal);
    return;
  }

  let registrationType = 'member'; // 'member' or 'owner'

  // Toggle registration type
  const btnMember = $('btn-type-member');
  const btnOwner = $('btn-type-owner');
  const infoMember = $('info-member');
  const infoOwner = $('info-owner');
  const memberGymField = $('member-gym-field');
  const ownerFields = $('owner-fields');
  const goalField = document.querySelector('#reg-goal')?.closest('.form-group');

  function setRegistrationType(type) {
    registrationType = type;
    if (type === 'member') {
      btnMember.classList.remove('btn-outline');
      btnMember.classList.add('btn-primary');
      btnOwner.classList.remove('btn-primary');
      btnOwner.classList.add('btn-outline');
      infoMember.style.display = '';
      infoOwner.style.display = 'none';
      memberGymField.style.display = '';
      if (goalField) goalField.style.display = '';
      ownerFields.style.display = 'none';
    } else {
      btnOwner.classList.remove('btn-outline');
      btnOwner.classList.add('btn-primary');
      btnMember.classList.remove('btn-primary');
      btnMember.classList.add('btn-outline');
      infoMember.style.display = 'none';
      infoOwner.style.display = '';
      memberGymField.style.display = 'none';
      if (goalField) goalField.style.display = 'none';
      ownerFields.style.display = '';
    }
  }

  if (btnMember) btnMember.addEventListener('click', () => setRegistrationType('member'));
  if (btnOwner) btnOwner.addEventListener('click', () => setRegistrationType('owner'));

  // Populate Gym select list (for member registration)
  async function loadGyms() {
    const gymSelect = $('reg-gym');
    if (!gymSelect) return;
    try {
      const data = await api('api/public/gyms.php');
      const gyms = data.gyms || [];
      if (!gyms.length) {
        gymSelect.innerHTML = '<option value="">No active gyms found</option>';
        return;
      }
      gymSelect.innerHTML = '<option value="">Choose a gym...</option>' + gyms.map((g) =>
        `<option value="${g.id}">${esc(g.gym_name)}</option>`).join('');
    } catch (err) {
      gymSelect.innerHTML = '<option value="">Could not load gyms</option>';
      toast(err.message, 'error');
    }
  }

  loadGyms();

  const form = $('form-register');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = $('reg-name').value.trim();
    const email = $('reg-email').value.trim();
    const password = $('reg-password').value;
    const phone = $('reg-phone').value.trim();
    const btn = $('btn-submit-register');

    if (!name || !email || !password) {
      toast('Please fill in all required fields.', 'error');
      return;
    }

    if (btn) btn.disabled = true;

    try {
      let d;
      if (registrationType === 'owner') {
        const gymName = $('reg-gym-name').value.trim();
        const address = $('reg-address').value.trim();
        const description = $('reg-description').value.trim();

        if (!gymName) {
          toast('Please enter your gym name.', 'error');
          if (btn) btn.disabled = false;
          return;
        }

        d = await api('api/auth/register-owner.php', {
          method: 'POST',
          body: { name, email, password, phone, gym_name: gymName, address, description }
        });
      } else {
        const gymId = $('reg-gym').value;
        const goal = $('reg-goal').value;

        if (!gymId) {
          toast('Please select your gym.', 'error');
          if (btn) btn.disabled = false;
          return;
        }

        d = await api('api/auth/register.php', {
          method: 'POST',
          body: { name, email, password, phone, goal, admin_id: gymId }
        });
      }

      toast(d.message || 'Account created successfully.');

      if (d.portal) {
        setTimeout(() => {
          redirectToPortal(d.portal);
        }, 600);
      } else {
        setTimeout(() => {
          window.location.href = 'verify-email.html?email=' + encodeURIComponent(email);
        }, 1200);
      }
    } catch (err) {
      if (btn) btn.disabled = false;
      toast(err.message, 'error');
    }
  });
});
