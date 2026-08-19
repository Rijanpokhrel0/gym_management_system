/* ==========================================================================
   FITPULSE - MEMBER INVOICES & QR PAYMENTS MODULE
   ========================================================================== */

(function () {
  'use strict';

  const {
    $, esc, money, fmtDate, toast, api, uploadLogo, isImageFile, openModal, closeModal, invoiceStatus, metricCard, emptyRow, emptyState
  } = window.Core;

  const PROVIDER_NAMES = {
    esewa: 'eSewa',
    khalti: 'Khalti',
    fonepay: 'Fonepay',
    mobile_banking: 'Mobile Banking'
  };

  let gymQrMethods = [];
  let currentPayingInvoice = null;

  async function loadUserInvoices() {
    try {
      const [invData, payData] = await Promise.all([
        api('api/user/invoices.php'),
        api('api/user/payments.php')
      ]);

      const inv = invData.invoices || [];
      const payments = payData.payments || [];
      const pendingMap = {};
      payments.forEach((p) => {
        if (p.status === 'pending') {
          pendingMap[p.invoice_id] = p;
        }
      });

      const tbody = $('user-invoices-tbody');
      if (tbody) {
        tbody.innerHTML = inv.map((i) => {
          const isPending = !!pendingMap[i.id];
          const isPaid = i.status === 'paid';
          const remaining = Math.max(0, Number(i.amount || 0) - Number(i.paid_amount || 0));

          let actionBtn = '';
          if (isPaid) {
            actionBtn = '<span class="badge badge-emerald"><i class="fa-solid fa-check"></i> Paid</span>';
          } else if (isPending) {
            actionBtn = '<span class="badge badge-amber" title="Awaiting admin approval"><i class="fa-solid fa-hourglass-half"></i> Verification Pending</span>';
          } else {
            actionBtn = `<button class="btn btn-primary btn-sm" onclick="window.gm.payInvoiceQr(${i.id})"><i class="fa-solid fa-qrcode"></i> Pay via QR</button>`;
          }

          return `
            <tr>
              <td><strong>${esc(i.invoice_no || ('INV-' + i.id))}</strong></td>
              <td>${esc(i.gym_name || '')}</td>
              <td>${esc(i.title || '')}</td>
              <td>${money(i.amount)}</td>
              <td>${money(i.paid_amount)}</td>
              <td>${invoiceStatus(i)}</td>
              <td>${fmtDate(i.due_date)}</td>
              <td>${fmtDate(i.paid_at)}</td>
              <td class="text-right">${actionBtn}</td>
            </tr>`;
        }).join('') || emptyRow('No invoices found.', 9);
      }

      const billed = inv.reduce((s, i) => s + Number(i.amount || 0), 0);
      const paid = inv.reduce((s, i) => s + Number(i.paid_amount || 0), 0);
      const statsEl = $('user-invoice-stats');
      if (statsEl) {
        statsEl.innerHTML =
          metricCard('fa-file-invoice', 'icon-orange', money(billed), 'Total Billed', 'From your gym') +
          metricCard('fa-circle-check', 'icon-emerald', money(paid), 'Total Paid', 'Cleared') +
          metricCard('fa-hourglass-half', 'icon-blue', money(Math.max(billed - paid, 0)), 'Outstanding', 'Balance due');
      }
    } catch (err) {
      const tbody = $('user-invoices-tbody');
      if (tbody) tbody.innerHTML = emptyRow(err.message, 9);
    }
  }

  async function openPayQrModal(invoiceId) {
    try {
      const invData = await api('api/user/invoices.php');
      const invoice = (invData.invoices || []).find((x) => x.id === invoiceId);
      if (!invoice) throw new Error('Invoice not found.');
      currentPayingInvoice = invoice;

      const due = Math.max(0, Number(invoice.amount || 0) - Number(invoice.paid_amount || 0));

      $('uqr-invoice-no').textContent = invoice.invoice_no || ('INV-' + invoice.id);
      $('uqr-invoice-title').textContent = invoice.title;
      $('uqr-invoice-due').textContent = money(due);
      $('uqr-amount').value = due.toFixed(2);
      $('uqr-txn-id').value = '';
      $('uqr-proof-url').value = '';
      $('uqr-proof-file').value = '';
      $('uqr-proof-preview').innerHTML = '';

      // Load gym QR methods
      const d = await api('api/user/payment-methods.php');
      gymQrMethods = d.payment_methods || [];

      if (!gymQrMethods.length) {
        $('uqr-qr-container').innerHTML = `
          <div class="alert-box alert-danger" style="margin-bottom:12px;">
            <i class="fa-solid fa-triangle-exclamation"></i>
            <span>Your gym administrator has not set up QR payment methods yet. Please contact reception.</span>
          </div>`;
        $('btn-submit-uqr-payment').disabled = true;
      } else {
        $('btn-submit-uqr-payment').disabled = false;
        renderQrTabs(gymQrMethods[0].provider);
      }

      openModal('modal-user-pay-qr');
    } catch (err) { toast(err.message, 'error'); }
  }

  function renderQrTabs(activeProvider) {
    const tabBtns = gymQrMethods.map((m) => `
      <button type="button" class="btn ${m.provider === activeProvider ? 'btn-primary' : 'btn-outline'} btn-sm uqr-prov-tab" data-provider="${m.provider}">
        ${esc(PROVIDER_NAMES[m.provider] || m.provider)}
      </button>
    `).join('');

    const activeMethod = gymQrMethods.find((m) => m.provider === activeProvider) || gymQrMethods[0];
    $('uqr-selected-provider').value = activeMethod.provider;

    const details = `
      <div style="display:flex;gap:8px;margin-bottom:12px;overflow-x:auto;padding-bottom:4px;">
        ${tabBtns}
      </div>
      <div style="background:#141414;border:1px solid #282828;border-radius:10px;padding:16px;text-align:center;">
        <img src="${esc(activeMethod.qr_image_url)}" alt="QR Code" style="max-height:200px;max-width:100%;border-radius:8px;object-fit:contain;background:#fff;padding:8px;">
        <div style="margin-top:12px;">
          <h4 style="margin:0 0 4px;">${esc(activeMethod.account_name || activeMethod.gym_name || 'Gym Account')}</h4>
          <p class="text-muted text-sm" style="margin:0;">Account / ID: <strong style="color:#fff;font-family:monospace;font-size:1rem;">${esc(activeMethod.account_number || '-')}</strong></p>
        </div>
      </div>
    `;

    $('uqr-qr-container').innerHTML = details;

    document.querySelectorAll('.uqr-prov-tab').forEach((b) => {
      b.addEventListener('click', () => renderQrTabs(b.dataset.provider));
    });
  }

  // Global gm actions
  window.gm = window.gm || {};
  window.gm.payInvoiceQr = (id) => openPayQrModal(id);

  document.addEventListener('DOMContentLoaded', () => {
    const proofInput = $('uqr-proof-file');
    if (proofInput) {
      proofInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (!isImageFile(file)) { toast('Please choose an image screenshot (PNG, JPG, WEBP).', 'error'); return; }
        if (file.size > 3 * 1024 * 1024) { toast('Screenshot must be smaller than 3 MB.', 'error'); return; }
        try {
          const url = await uploadLogo(file);
          $('uqr-proof-url').value = url;
          const preview = $('uqr-proof-preview');
          if (preview) {
            preview.innerHTML = `<img src="${esc(url)}" alt="Proof Preview" style="max-height:90px;border-radius:6px;border:1px solid #444;margin-top:6px;">`;
          }
          toast('Payment screenshot uploaded.');
        } catch (err) { toast(err.message, 'error'); }
      });
    }

    const formPay = $('form-user-pay-qr');
    if (formPay) {
      formPay.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!currentPayingInvoice) return;

        const payload = {
          invoice_id: currentPayingInvoice.id,
          method: $('uqr-selected-provider').value,
          amount: $('uqr-amount').value,
          transaction_id: $('uqr-txn-id').value.trim(),
          proof_image: $('uqr-proof-url').value.trim(),
        };

        if (!payload.transaction_id && !payload.proof_image) {
          toast('Please provide a Transaction ID or upload a payment screenshot.', 'error');
          return;
        }

        try {
          const btn = $('btn-submit-uqr-payment');
          if (btn) btn.disabled = true;

          const d = await api('api/user/payments.php', {
            method: 'POST',
            body: payload
          });

          closeModal('modal-user-pay-qr');
          toast(d.message || 'Payment proof submitted! Awaiting gym verification.');
          loadUserInvoices();
        } catch (err) {
          toast(err.message, 'error');
          const btn = $('btn-submit-uqr-payment');
          if (btn) btn.disabled = false;
        }
      });
    }
  });

  window.UserApp.registerLoader('tab-user-invoices', loadUserInvoices);
})();
