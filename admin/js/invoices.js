/* ==========================================================================
   FITPULSE - ADMIN INVOICES & BILLING MODULE
   ========================================================================== */

(function () {
  'use strict';

  const {
    $, esc, money, fmtDate, toast, api, openModal, closeModal, invoiceStatus, metricCard, emptyRow
  } = window.Core;

  async function loadAdminInvoices() {
    try {
      await window.AdminApp.fillAdminMemberSelects(['invoice-user']);
      const d = await api('api/admin/invoices.php');
      const inv = d.invoices || [];
      const tbody = $('admin-invoices-tbody');
      if (tbody) {
        tbody.innerHTML = inv.map((i) => {
          const actions = (i.status !== 'paid'
            ? '<button class="btn btn-outline btn-sm" onclick="window.gm.payInvoice(' + i.id + ')" title="Pay"><i class="fa-solid fa-money-bill-wave"></i></button> '
            : '') +
            '<button class="btn btn-outline btn-sm" onclick="window.gm.editInvoice(' + i.id + ')" title="Edit"><i class="fa-solid fa-pen"></i></button> ' +
            '<button class="btn btn-outline btn-sm btn-danger" onclick="window.gm.deleteInvoice(' + i.id + ')" title="Delete"><i class="fa-solid fa-trash"></i></button>';
          return '<tr>' +
            '<td><strong>' + esc(i.invoice_no || ('INV-' + i.id)) + '</strong></td>' +
            '<td>' + esc(i.user_name || i.name || '') + '</td>' +
            '<td>' + esc(i.title || '') + '</td>' +
            '<td>' + money(i.amount) + '</td>' +
            '<td>' + money(i.paid_amount) + '</td>' +
            '<td>' + invoiceStatus(i) + '</td>' +
            '<td>' + fmtDate(i.due_date) + '</td>' +
            '<td class="text-right">' + actions + '</td>' +
            '</tr>';
        }).join('') || emptyRow('No invoices yet. Issue one to a member.', 8);
      }

      const paid = inv.reduce((s, i) => s + Number(i.paid_amount || 0), 0);
      const billed = inv.reduce((s, i) => s + Number(i.amount || 0), 0);
      const pending = inv.filter((i) => i.status === 'unpaid' || i.status === 'partial').length;
      const statsEl = $('admin-invoice-stats');
      if (statsEl) {
        statsEl.innerHTML =
          metricCard('fa-coins', 'icon-emerald', money(paid), 'Collected', 'Total paid') +
          metricCard('fa-file-invoice', 'icon-orange', money(billed), 'Billed', 'Total invoiced') +
          metricCard('fa-clock', 'icon-blue', pending, 'Pending', 'Unpaid invoices');
      }
    } catch (err) {
      const tbody = $('admin-invoices-tbody');
      if (tbody) tbody.innerHTML = emptyRow(err.message, 8);
    }
  }

  function openInvoiceModal(inv) {
    $('modal-invoice-title').textContent = inv ? 'Edit Invoice' : 'New Invoice';
    $('invoice-id').value = inv ? inv.id : '';
    $('invoice-user').value = inv ? inv.user_id : '';
    $('invoice-title').value = inv ? inv.title : '';
    $('invoice-amount').value = inv ? inv.amount : '';
    $('invoice-due').value = inv ? fmtDate(inv.due_date) : '';
    $('invoice-desc').value = inv ? inv.description : '';
    openModal('modal-invoice');
  }

  function openPayInvoice(inv) {
    $('pay-invoice-id').value = inv.id;
    $('pay-invoice-no').textContent = inv.invoice_no || ('INV-' + inv.id);
    $('pay-invoice-total').textContent = money(inv.amount);
    $('pay-invoice-paid').textContent = money(inv.paid_amount);
    $('pay-amount').value = (Number(inv.amount) - Number(inv.paid_amount)).toFixed(2);
    $('pay-method').value = 'Cash';
    openModal('modal-pay-invoice');
  }

  // Global gm actions
  window.gm = window.gm || {};
  window.gm.editInvoice = (id) => api('api/admin/invoices.php').then((d) => openInvoiceModal((d.invoices || []).find((i) => String(i.id) === String(id)))).catch((e) => toast(e.message, 'error'));
  window.gm.deleteInvoice = async (id) => {
    if (!confirm('Delete this invoice?')) return;
    try {
      await api('api/admin/invoices.php', { method: 'DELETE', body: { id } });
      toast('Invoice deleted.');
      loadAdminInvoices();
    } catch (err) { toast(err.message, 'error'); }
  };
  window.gm.payInvoice = (id) => api('api/admin/invoices.php').then((d) => openPayInvoice((d.invoices || []).find((i) => String(i.id) === String(id)))).catch((e) => toast(e.message, 'error'));

  document.addEventListener('DOMContentLoaded', () => {
    const btnAdd = $('btn-add-invoice');
    if (btnAdd) btnAdd.addEventListener('click', () => openInvoiceModal(null));

    const formInvoice = $('form-invoice');
    if (formInvoice) {
      formInvoice.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = $('invoice-id').value;
        const payload = {
          user_id: $('invoice-user').value,
          title: $('invoice-title').value.trim(),
          amount: $('invoice-amount').value,
          due_date: $('invoice-due').value || null,
          description: $('invoice-desc').value.trim(),
        };
        try {
          await api('api/admin/invoices.php', { method: id ? 'PUT' : 'POST', body: id ? { id, ...payload } : payload });
          closeModal('modal-invoice');
          toast(id ? 'Invoice updated.' : 'Invoice created.');
          loadAdminInvoices();
        } catch (err) { toast(err.message, 'error'); }
      });
    }

    const formPay = $('form-pay-invoice');
    if (formPay) {
      formPay.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
          const id = $('pay-invoice-id').value;
          await api('api/admin/invoices.php', {
            method: 'POST',
            body: { action: 'pay', id, paid_amount: $('pay-amount').value, payment_method: $('pay-method').value },
          });
          closeModal('modal-pay-invoice');
          toast('Payment recorded.');
          loadAdminInvoices();
        } catch (err) { toast(err.message, 'error'); }
      });
    }
  });

  window.AdminApp.registerLoader('tab-admin-invoices', loadAdminInvoices);
})();
