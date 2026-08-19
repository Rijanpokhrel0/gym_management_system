/* ==========================================================================
   FITPULSE - ADMIN QR PAYMENT METHODS & VERIFICATION MODULE
   ========================================================================== */

(function () {
  'use strict';

  const {
    $, esc, money, fmtDate, toast, api, uploadLogo, isImageFile, openModal, closeModal, statusBadge, emptyRow, emptyState
  } = window.Core;

  const PROVIDER_NAMES = {
    esewa: 'eSewa',
    khalti: 'Khalti',
    fonepay: 'Fonepay',
    mobile_banking: 'Mobile Banking'
  };

  const PROVIDER_ICONS = {
    esewa: 'fa-wallet',
    khalti: 'fa-mobile-screen-button',
    fonepay: 'fa-qrcode',
    mobile_banking: 'fa-building-columns'
  };

  let paymentMethodsCache = [];

  /* -------------------------- 1. QR Methods Management -------------------- */
  async function loadAdminPaymentMethods() {
    try {
      const d = await api('api/admin/payment-methods.php');
      paymentMethodsCache = d.payment_methods || [];
      const grid = $('admin-qr-methods-grid');
      if (grid) {
        grid.innerHTML = paymentMethodsCache.map((pm) => `
          <div class="metric-card" style="display:flex;flex-direction:column;justify-content:space-between;padding:16px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
              <div style="display:flex;align-items:center;gap:10px;">
                <div class="metric-icon icon-orange"><i class="fa-solid ${PROVIDER_ICONS[pm.provider] || 'fa-qrcode'}"></i></div>
                <div>
                  <h4 style="margin:0;">${esc(PROVIDER_NAMES[pm.provider] || pm.provider)}</h4>
                  <span class="text-muted text-sm">${esc(pm.account_name || 'No account name')}</span>
                </div>
              </div>
              <span class="badge ${pm.is_active ? 'badge-emerald' : 'badge-neutral'}">${pm.is_active ? 'Active' : 'Disabled'}</span>
            </div>
            <div style="text-align:center;background:#141414;padding:12px;border-radius:8px;border:1px solid #282828;margin-bottom:12px;">
              <img src="${esc(pm.qr_image_url)}" alt="QR Code" style="max-height:160px;max-width:100%;border-radius:6px;object-fit:contain;">
              <div style="margin-top:8px;font-family:monospace;font-size:0.9rem;color:#fff;">${esc(pm.account_number || '-')}</div>
            </div>
            <div class="admin-plan-actions" style="margin-top:auto;">
              <button class="btn btn-outline btn-sm" onclick="window.gm.editPaymentMethod(${pm.id})"><i class="fa-solid fa-pen"></i> Edit</button>
              <button class="btn btn-outline btn-sm btn-danger" onclick="window.gm.deletePaymentMethod(${pm.id})"><i class="fa-solid fa-trash"></i> Delete</button>
            </div>
          </div>
        `).join('') || emptyState('No QR payment methods configured yet. Add eSewa, Khalti, or Fonepay QR code.');
      }
    } catch (err) {
      const grid = $('admin-qr-methods-grid');
      if (grid) grid.innerHTML = emptyState(err.message);
    }
  }

  function openPaymentMethodModal(pm) {
    $('modal-pm-title').textContent = pm ? 'Edit QR Payment Method' : 'Add QR Payment Method';
    $('pm-id').value = pm ? pm.id : '';
    $('pm-provider').value = pm ? pm.provider : 'esewa';
    $('pm-provider').disabled = !!pm;
    $('pm-acc-name').value = pm ? pm.account_name || '' : '';
    $('pm-acc-number').value = pm ? pm.account_number || '' : '';
    $('pm-qr-url').value = pm ? pm.qr_image_url : '';
    $('pm-qr-file').value = '';
    $('pm-is-active').value = (pm && !pm.is_active) ? '0' : '1';
    renderQrPreview(pm ? pm.qr_image_url : '');
    openModal('modal-payment-method');
  }

  function renderQrPreview(url) {
    const box = $('pm-qr-preview-box');
    if (!box) return;
    box.innerHTML = url
      ? `<img src="${esc(url)}" alt="QR Preview" style="max-height:140px;border-radius:8px;border:1px solid #333;">`
      : '<p class="text-muted text-sm">Upload a QR image (PNG/JPG) or provide an image link.</p>';
  }

  /* -------------------------- 2. Payment Verifications ------------------- */
  async function loadAdminPendingPayments() {
    try {
      const d = await api('api/admin/payments.php');
      const list = d.payments || [];
      const stats = d.stats || {};

      const countBadge = $('admin-pending-payments-count');
      if (countBadge) {
        countBadge.textContent = stats.pending > 0 ? stats.pending + ' Pending' : '0 Pending';
        countBadge.className = stats.pending > 0 ? 'badge badge-rose' : 'badge badge-neutral';
      }

      const tbody = $('admin-payments-tbody');
      if (tbody) {
        tbody.innerHTML = list.map((p) => {
          const statusBadgeHtml = p.status === 'verified'
            ? '<span class="badge badge-emerald"><i class="fa-solid fa-circle-check"></i> Verified</span>'
            : (p.status === 'rejected'
              ? '<span class="badge badge-rose"><i class="fa-solid fa-circle-xmark"></i> Rejected</span>'
              : '<span class="badge badge-amber"><i class="fa-solid fa-hourglass-half"></i> Pending Review</span>');

          const proofThumb = p.proof_image
            ? `<a href="${esc(p.proof_image)}" target="_blank" title="View screenshot"><img src="${esc(p.proof_image)}" style="height:36px;width:36px;border-radius:4px;object-fit:cover;border:1px solid #444;"></a>`
            : '<span class="text-muted text-sm">None</span>';

          const actions = p.status === 'pending'
            ? `<button class="btn btn-primary btn-sm" onclick="window.gm.reviewPayment(${p.id})"><i class="fa-solid fa-magnifying-glass"></i> Review & Settle</button>`
            : `<button class="btn btn-outline btn-sm" onclick="window.gm.reviewPayment(${p.id})"><i class="fa-solid fa-eye"></i> Details</button>`;

          return `
            <tr>
              <td><strong>${esc(p.invoice_no || ('INV-' + p.invoice_id))}</strong></td>
              <td>${esc(p.user_name)}<br><span class="text-muted text-sm">${esc(p.member_code || p.user_email)}</span></td>
              <td><strong>${money(p.amount)}</strong></td>
              <td><span class="badge badge-blue">${esc(PROVIDER_NAMES[p.method] || p.method.toUpperCase())}</span></td>
              <td><code>${esc(p.transaction_id || '-')}</code></td>
              <td>${proofThumb}</td>
              <td>${statusBadgeHtml}</td>
              <td>${fmtDate(p.created_at)}</td>
              <td class="text-right">${actions}</td>
            </tr>
          `;
        }).join('') || emptyRow('No payment submissions recorded yet.', 9);
      }
    } catch (err) {
      const tbody = $('admin-payments-tbody');
      if (tbody) tbody.innerHTML = emptyRow(err.message, 9);
    }
  }

  async function openReviewPaymentModal(paymentId) {
    try {
      const d = await api('api/admin/payments.php');
      const p = (d.payments || []).find((x) => x.id === paymentId);
      if (!p) throw new Error('Payment record not found.');

      $('vp-payment-id').value = p.id;
      $('vp-user-name').textContent = p.user_name + ' (' + (p.member_code || p.user_email) + ')';
      $('vp-invoice-info').textContent = (p.invoice_no || ('INV-' + p.invoice_id)) + ' - ' + (p.invoice_title || 'Gym Fee');
      $('vp-amount').textContent = money(p.amount);
      $('vp-provider').textContent = (PROVIDER_NAMES[p.method] || p.method.toUpperCase()) + (p.transaction_id ? ' (Ref: ' + p.transaction_id + ')' : '');
      $('vp-date').textContent = fmtDate(p.created_at);
      
      const proofBox = $('vp-proof-box');
      if (proofBox) {
        proofBox.innerHTML = p.proof_image
          ? `<a href="${esc(p.proof_image)}" target="_blank"><img src="${esc(p.proof_image)}" alt="Payment Proof" style="max-height:260px;max-width:100%;border-radius:8px;border:1px solid #444;"></a><p class="text-muted text-sm" style="margin-top:4px;">Click image to view in full resolution</p>`
          : '<p class="text-muted">No screenshot attached. Verification is based on Transaction ID.</p>';
      }

      $('vp-rejection-reason').value = p.rejection_reason || '';
      
      const actionsBox = $('vp-action-buttons');
      if (actionsBox) {
        if (p.status === 'pending') {
          actionsBox.innerHTML = `
            <button type="button" class="btn btn-outline" data-close="modal-verify-payment">Cancel</button>
            <button type="button" class="btn btn-outline btn-danger" id="btn-do-reject-payment"><i class="fa-solid fa-xmark"></i> Reject Payment</button>
            <button type="button" class="btn btn-primary" id="btn-do-approve-payment"><i class="fa-solid fa-check"></i> Approve & Settle Invoice</button>
          `;
          $('btn-do-approve-payment').addEventListener('click', () => submitPaymentVerification(p.id, 'verified'));
          $('btn-do-reject-payment').addEventListener('click', () => submitPaymentVerification(p.id, 'rejected'));
        } else {
          actionsBox.innerHTML = `
            <span class="text-muted text-sm" style="margin-right:auto;">Status: <strong>${p.status.toUpperCase()}</strong> ${p.verified_by ? 'by ' + esc(p.verified_by) : ''}</span>
            <button type="button" class="btn btn-outline" data-close="modal-verify-payment">Close</button>
          `;
        }
      }

      openModal('modal-verify-payment');
    } catch (err) { toast(err.message, 'error'); }
  }

  async function submitPaymentVerification(paymentId, action) {
    const reason = $('vp-rejection-reason').value.trim();
    if (action === 'rejected' && !reason) {
      toast('Please provide a reason for rejecting this payment.', 'error');
      return;
    }
    try {
      const d = await api('api/admin/payments.php', {
        method: 'POST',
        body: { id: paymentId, action, rejection_reason: reason }
      });
      closeModal('modal-verify-payment');
      toast(d.message || 'Payment updated.');
      loadAdminPendingPayments();
      if (window.AdminApp.loaders['tab-admin-invoices']) {
        window.AdminApp.loaders['tab-admin-invoices']();
      }
    } catch (err) { toast(err.message, 'error'); }
  }

  // Global gm actions
  window.gm = window.gm || {};
  window.gm.editPaymentMethod = (id) => {
    const pm = paymentMethodsCache.find((x) => x.id === id);
    if (pm) openPaymentMethodModal(pm);
  };
  window.gm.deletePaymentMethod = async (id) => {
    if (!confirm('Delete this QR payment method?')) return;
    try {
      await api('api/admin/payment-methods.php', { method: 'DELETE', body: { id } });
      toast('Payment method deleted.');
      loadAdminPaymentMethods();
    } catch (err) { toast(err.message, 'error'); }
  };
  window.gm.reviewPayment = (id) => openReviewPaymentModal(id);

  document.addEventListener('DOMContentLoaded', () => {
    const btnAdd = $('btn-add-qr-method');
    if (btnAdd) btnAdd.addEventListener('click', () => openPaymentMethodModal(null));

    const qrInput = $('pm-qr-file');
    if (qrInput) {
      qrInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (!isImageFile(file)) { toast('Please choose an image file (PNG, JPG, WEBP).', 'error'); return; }
        if (file.size > 2 * 1024 * 1024) { toast('Image must be smaller than 2 MB.', 'error'); return; }
        try {
          const url = await uploadLogo(file);
          $('pm-qr-url').value = url;
          renderQrPreview(url);
          toast('QR code uploaded.');
        } catch (err) { toast(err.message, 'error'); }
      });
    }

    const formPm = $('form-payment-method');
    if (formPm) {
      formPm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = $('pm-id').value;
        const payload = {
          provider: $('pm-provider').value,
          account_name: $('pm-acc-name').value.trim(),
          account_number: $('pm-acc-number').value.trim(),
          qr_image_url: $('pm-qr-url').value.trim(),
          is_active: $('pm-is-active').value === '1',
        };
        if (!payload.qr_image_url) {
          toast('Please upload a QR code image.', 'error');
          return;
        }
        try {
          await api('api/admin/payment-methods.php', {
            method: id ? 'PUT' : 'POST',
            body: id ? { id, ...payload } : payload
          });
          closeModal('modal-payment-method');
          toast(id ? 'QR method updated.' : 'QR method added.');
          loadAdminPaymentMethods();
        } catch (err) { toast(err.message, 'error'); }
      });
    }
  });

  async function loadAdminPaymentsTab() {
    await Promise.all([
      loadAdminPaymentMethods(),
      loadAdminPendingPayments()
    ]);
  }

  window.AdminApp.registerLoader('tab-admin-payments', loadAdminPaymentsTab);
})();
