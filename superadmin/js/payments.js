/* ==========================================================================
   FITPULSE - SUPERADMIN PAYMENT OVERSIGHT MODULE
   ========================================================================== */

(function () {
  'use strict';

  const { $, esc, money, fmtDate, api, toast, emptyRow } = window.Core;

  let currentFilter = '';

  async function loadSuperadminPayments(status) {
    currentFilter = status || '';
    try {
      const url = currentFilter ? `api/superadmin/payments.php?status=${currentFilter}` : 'api/superadmin/payments.php';
      const d = await api(url);
      const payments = d.payments || [];
      const stats = d.stats || {};

      // Update stats
      const statsEl = $('sa-pay-stats');
      if (statsEl) {
        statsEl.innerHTML = `
          <div class="metric-card metric-card-sm">
            <div class="metric-body"><h3>${stats.total || 0}</h3><p>Total Payments</p></div>
          </div>
          <div class="metric-card metric-card-sm">
            <div class="metric-body"><h3 class="text-amber">${stats.pending || 0}</h3><p>Pending</p></div>
          </div>
          <div class="metric-card metric-card-sm">
            <div class="metric-body"><h3 class="text-emerald">${stats.verified || 0}</h3><p>Verified</p></div>
          </div>
          <div class="metric-card metric-card-sm">
            <div class="metric-body"><h3 class="text-rose">${stats.rejected || 0}</h3><p>Rejected</p></div>
          </div>
          <div class="metric-card metric-card-sm">
            <div class="metric-body"><h3>Rs. ${money(stats.verified_amount || 0)}</h3><p>Total Collected</p></div>
          </div>`;
      }

      // Filter buttons
      document.querySelectorAll('.sa-pay-filter').forEach((btn) => {
        btn.classList.toggle('btn-primary', btn.dataset.status === currentFilter);
        btn.classList.toggle('btn-outline', btn.dataset.status !== currentFilter);
      });

      const tbody = $('sa-payments-tbody');
      if (tbody) {
        tbody.innerHTML = payments.map((p) => `
          <tr>
            <td>
              <div class="cell-user">
                <div>
                  <strong>${esc(p.user_name)}</strong>
                  <br><span class="text-muted text-sm">${esc(p.user_email)}</span>
                </div>
              </div>
            </td>
            <td>${esc(p.gym_name) || '-'}</td>
            <td class="text-sm">${esc(p.invoice_no)}<br>${esc(p.invoice_title)}</td>
            <td><strong>Rs. ${money(p.amount)}</strong></td>
            <td class="text-sm">${esc(p.method).toUpperCase()}<br>${esc(p.transaction_id) || '-'}</td>
            <td>${statusBadge(p.status)}</td>
            <td class="text-sm">${fmtDate(p.created_at)}</td>
            <td class="text-right">
              ${p.status === 'pending' ? `
                <button class="btn btn-outline btn-sm btn-success" onclick="window.saPay.verify(${p.id})" title="Verify"><i class="fa-solid fa-check"></i></button>
                <button class="btn btn-outline btn-sm btn-danger" onclick="window.saPay.reject(${p.id})" title="Reject"><i class="fa-solid fa-times"></i></button>
              ` : ''}
              ${p.proof_image ? `<button class="btn btn-outline btn-sm" onclick="window.open('${esc(p.proof_image)}','_blank')" title="View Proof"><i class="fa-solid fa-image"></i></button>` : ''}
            </td>
          </tr>`).join('') || emptyRow('No payments found.', 8);
      }
    } catch (err) {
      const tbody = $('sa-payments-tbody');
      if (tbody) tbody.innerHTML = emptyRow(err.message, 8);
    }
  }

  function statusBadge(status) {
    const map = {
      pending: 'badge-amber',
      verified: 'badge-emerald',
      rejected: 'badge-rose',
    };
    return `<span class="badge ${map[status] || 'badge-neutral'}">${esc(status)}</span>`;
  }

  window.saPay = window.saPay || {};

  window.saPay.verify = async (id) => {
    if (!confirm('Verify this payment? The invoice will be marked as paid.')) return;
    try {
      await api('api/superadmin/payments.php', { method: 'POST', body: { id, action: 'verified' } });
      toast('Payment verified.');
      loadSuperadminPayments(currentFilter);
    } catch (err) { toast(err.message, 'error'); }
  };

  window.saPay.reject = async (id) => {
    const reason = prompt('Rejection reason (optional):');
    if (reason === null) return;
    try {
      await api('api/superadmin/payments.php', { method: 'POST', body: { id, action: 'rejected', rejection_reason: reason } });
      toast('Payment rejected.');
      loadSuperadminPayments(currentFilter);
    } catch (err) { toast(err.message, 'error'); }
  };

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.sa-pay-filter').forEach((btn) => {
      btn.addEventListener('click', () => loadSuperadminPayments(btn.dataset.status));
    });
  });

  window.SuperadminApp.registerLoader('tab-sa-payments', () => loadSuperadminPayments(''));
})();
