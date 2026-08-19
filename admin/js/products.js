/* ==========================================================================
   FITPULSE - ADMIN PRODUCTS & INVENTORY MODULE
   ========================================================================== */

(function () {
  'use strict';

  const {
    $, esc, money, fmtDate, toast, api, openModal, closeModal, statusBadge, emptyRow
  } = window.Core;

  async function loadAdminProducts() {
    try {
      const d = await api('api/admin/products.php');
      const cat = $('admin-product-cat-filter').value;
      const rows = (d.products || []).filter((p) => cat === 'all' || p.category === cat);
      const tbody = $('admin-products-tbody');
      if (tbody) {
        tbody.innerHTML = rows.map((p) => `
          <tr>
            <td><strong>${esc(p.name)}</strong><br><span class="text-muted text-sm">${esc(p.description || '')}</span></td>
            <td>${esc(p.category)}</td>
            <td>${money(p.price)}</td>
            <td>${p.stock}</td>
            <td>${statusBadge(p.status)}</td>
            <td>${fmtDate(p.created_at)}</td>
            <td class="text-right">
              <button class="btn btn-outline btn-sm" onclick="window.gm.editProduct(${p.id})"><i class="fa-solid fa-pen"></i></button>
              <button class="btn btn-outline btn-sm btn-danger" onclick="window.gm.deleteProduct(${p.id})"><i class="fa-solid fa-trash"></i></button>
            </td>
          </tr>`).join('') || emptyRow('No products yet. Add your first product.', 7);
      }
    } catch (err) {
      const tbody = $('admin-products-tbody');
      if (tbody) tbody.innerHTML = emptyRow(err.message, 7);
    }
  }

  function openProductModal(product) {
    $('modal-product-title').textContent = product ? 'Edit Product' : 'Add Product';
    $('product-id').value = product ? product.id : '';
    $('product-name').value = product ? product.name : '';
    $('product-category').value = product ? product.category : 'Supplement';
    $('product-price').value = product ? product.price : '';
    $('product-stock').value = product ? product.stock : 1;
    $('product-status').value = product ? product.status : 'active';
    $('product-image').value = product ? product.image_url : '';
    $('product-desc').value = product ? product.description : '';
    openModal('modal-product');
  }

  // Global gm actions
  window.gm = window.gm || {};
  window.gm.editProduct = (id) => api('api/admin/products.php').then((d) => openProductModal((d.products || []).find((p) => p.id === id))).catch((e) => toast(e.message, 'error'));
  window.gm.deleteProduct = async (id) => {
    if (!confirm('Delete this product?')) return;
    try {
      await api('api/admin/products.php', { method: 'DELETE', body: { id } });
      toast('Product removed.');
      loadAdminProducts();
    } catch (err) { toast(err.message, 'error'); }
  };

  document.addEventListener('DOMContentLoaded', () => {
    const btnAdd = $('btn-add-product');
    if (btnAdd) btnAdd.addEventListener('click', () => openProductModal(null));

    const catFilter = $('admin-product-cat-filter');
    if (catFilter) catFilter.addEventListener('change', loadAdminProducts);

    const formProduct = $('form-product');
    if (formProduct) {
      formProduct.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = $('product-id').value;
        const payload = {
          name: $('product-name').value.trim(),
          category: $('product-category').value,
          price: $('product-price').value,
          stock: $('product-stock').value,
          status: $('product-status').value,
          image_url: $('product-image').value.trim(),
          description: $('product-desc').value.trim(),
        };
        try {
          await api('api/admin/products.php', { method: id ? 'PUT' : 'POST', body: id ? { id, ...payload } : payload });
          closeModal('modal-product');
          toast(id ? 'Product updated.' : 'Product added.');
          loadAdminProducts();
        } catch (err) { toast(err.message, 'error'); }
      });
    }
  });

  window.AdminApp.registerLoader('tab-admin-products', loadAdminProducts);
})();
