/**
 * ==========================================================================
 * FITPULSE GYM MANAGEMENT SYSTEM - FRONTEND INTERACTION & LOGIC
 * Author: Rijan Pokhrel
 * Description: High-performance, clean vanilla JavaScript logic for gym management
 * ==========================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
  // ------------------------------------------------------------------------
  // 1. APPLICATION INITIAL STATE & SEED DATA
  // ------------------------------------------------------------------------
  const state = {
    members: [
      { id: 1, name: 'Aarav Sharma', email: 'aarav.sharma@example.com', phone: '+977 9841234567', plan: 'Premium VIP', status: 'Active', joinDate: '2026-01-15', expiryDate: '2027-01-15' },
      { id: 2, name: 'Sita Gurung', email: 'sita.g@example.com', phone: '+977 9801987654', plan: 'Standard Fitness', status: 'Active', joinDate: '2026-03-10', expiryDate: '2026-09-10' },
      { id: 3, name: 'Bikash Thapa', email: 'bikash.t@example.com', phone: '+977 9812345678', plan: 'Basic Access', status: 'Expiring', joinDate: '2025-08-01', expiryDate: '2026-08-01' },
      { id: 4, name: 'Pooja Karki', email: 'pooja.karki@example.com', phone: '+977 9851122334', plan: 'Standard Fitness', status: 'Active', joinDate: '2026-05-20', expiryDate: '2026-11-20' },
      { id: 5, name: 'Rohan Adhikari', email: 'rohan.a@example.com', phone: '+977 9860998877', plan: 'Premium VIP', status: 'Inactive', joinDate: '2025-02-10', expiryDate: '2026-02-10' }
    ],

    classes: [
      { id: 101, title: 'Morning Power Yoga', trainer: 'Sujata Rai', day: 'Monday', time: '06:30 AM - 07:30 AM', booked: 14, capacity: 20, category: 'Flexibility' },
      { id: 102, title: 'HIIT Fat Burner', trainer: 'Alex Morgan', day: 'Monday', time: '05:00 PM - 06:00 PM', booked: 18, capacity: 20, category: 'Cardio' },
      { id: 103, title: 'Heavy Powerlifting', trainer: 'Rijan Pokhrel', day: 'Tuesday', time: '07:00 AM - 08:30 AM', booked: 10, capacity: 15, category: 'Strength' },
      { id: 104, title: 'Zumba Cardio Dance', trainer: 'Elena Rostova', day: 'Wednesday', time: '06:00 PM - 07:00 PM', booked: 22, capacity: 25, category: 'Dance' },
      { id: 105, title: 'CrossFit Endurance', trainer: 'Mark Davis', day: 'Thursday', time: '07:00 AM - 08:00 AM', booked: 16, capacity: 20, category: 'CrossFit' },
      { id: 106, title: 'Core & Spin Cycling', trainer: 'Sujata Rai', day: 'Friday', time: '05:30 PM - 06:30 PM', booked: 15, capacity: 18, category: 'Spin' }
    ],

    payments: [
      { id: 'INV-1092', member: 'Aarav Sharma', plan: 'Premium VIP Plan (1 Year)', amount: 900.00, method: 'Credit Card', date: '2026-07-28', status: 'Paid' },
      { id: 'INV-1091', member: 'Sita Gurung', plan: 'Standard Fitness Renewal', amount: 50.00, method: 'eSewa Wallet', date: '2026-07-25', status: 'Paid' },
      { id: 'INV-1090', member: 'Bikash Thapa', plan: 'Basic Access Monthly', amount: 30.00, method: 'Cash', date: '2026-07-20', status: 'Pending' },
      { id: 'INV-1089', member: 'Pooja Karki', plan: 'Standard Fitness Renewal', amount: 50.00, method: 'Bank Transfer', date: '2026-07-15', status: 'Paid' }
    ],

    currentClassDayFilter: 'all'
  };

  // ------------------------------------------------------------------------
  // 2. DOM ELEMENT REFERENCES
  // ------------------------------------------------------------------------
  const elements = {
    sidebar: document.getElementById('sidebar'),
    menuToggle: document.getElementById('menu-toggle'),
    navItems: document.querySelectorAll('.nav-item'),
    tabContents: document.querySelectorAll('.tab-content'),
    globalSearch: document.getElementById('global-search'),

    // Modals & Buttons
    modalMember: document.getElementById('modal-member'),
    modalClass: document.getElementById('modal-class'),
    modalPayment: document.getElementById('modal-payment'),
    
    btnAddMember: document.getElementById('btn-add-member'),
    btnQuickAddMember: document.getElementById('btn-quick-add-member'),
    btnAddClass: document.getElementById('btn-add-class'),
    btnQuickSchedule: document.getElementById('btn-quick-schedule'),
    btnRecordPayment: document.getElementById('btn-record-payment'),
    
    // Forms
    formMember: document.getElementById('form-member'),
    formClass: document.getElementById('form-class'),
    formPayment: document.getElementById('form-payment'),

    // Tables & Lists Containers
    recentMembersTbody: document.getElementById('recent-members-tbody'),
    todayClassesContainer: document.getElementById('today-classes-container'),
    membersTableTbody: document.getElementById('members-table-tbody'),
    classesCardsGrid: document.getElementById('classes-cards-grid'),
    paymentsTableTbody: document.getElementById('payments-table-tbody'),
    selectPayMember: document.getElementById('input-pay-member'),

    // Filtering Controls
    memberSearchInput: document.getElementById('member-search-input'),
    memberStatusFilter: document.getElementById('member-status-filter'),
    memberPlanFilter: document.getElementById('member-plan-filter'),
    memberCountShowing: document.getElementById('member-count-showing'),
    paymentSearchInput: document.getElementById('payment-search-input'),
    dayFilterBar: document.getElementById('day-filter-bar'),

    // Toast Container
    toastContainer: document.getElementById('toast-container')
  };

  // Expose toast function globally for inline handlers if needed
  window.fitPulseApp = {
    showToast
  };

  // ------------------------------------------------------------------------
  // 3. INITIALIZATION & RENDER PIPELINE
  // ------------------------------------------------------------------------
  function initApp() {
    setupNavigation();
    setupModals();
    setupFilters();
    renderAllViews();
    setupKeyboardShortcuts();
  }

  function renderAllViews() {
    renderDashboardOverview();
    renderMembersTable();
    renderClassesGrid();
    renderPaymentsTable();
    populatePaymentMemberSelect();
    updateStatCounts();
  }

  // ------------------------------------------------------------------------
  // 4. NAVIGATION & TAB SWITCHING
  // ------------------------------------------------------------------------
  function setupNavigation() {
    // Mobile Sidebar Toggle
    if (elements.menuToggle) {
      elements.menuToggle.addEventListener('click', () => {
        elements.sidebar.classList.toggle('show');
      });
    }

    // Sidebar Tab Navigation
    elements.navItems.forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const tabTarget = item.getAttribute('data-tab');
        switchTab(tabTarget);
        if (window.innerWidth <= 768) {
          elements.sidebar.classList.remove('show');
        }
      });
    });

    // Handle inline page tab links (e.g., "View All")
    document.querySelectorAll('.switch-tab-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const target = link.getAttribute('data-target');
        switchTab(target);
      });
    });
  }

  function switchTab(tabName) {
    elements.navItems.forEach(nav => nav.classList.remove('active'));
    elements.tabContents.forEach(content => content.classList.remove('active'));

    const activeNav = document.querySelector(`.nav-item[data-tab="${tabName}"]`);
    const activeTabContent = document.getElementById(`tab-${tabName}`);

    if (activeNav) activeNav.classList.add('active');
    if (activeTabContent) activeTabContent.classList.add('active');
  }

  // ------------------------------------------------------------------------
  // 5. DASHBOARD RENDER LOGIC
  // ------------------------------------------------------------------------
  function renderDashboardOverview() {
    // Render Recent Members in Dashboard
    if (!elements.recentMembersTbody) return;

    const recent = state.members.slice(0, 4);
    elements.recentMembersTbody.innerHTML = recent.map(member => `
      <tr>
        <td>
          <div class="member-cell">
            <div class="avatar-chip">${getInitials(member.name)}</div>
            <div>
              <strong>${escapeHtml(member.name)}</strong>
              <div class="text-muted text-sm">${escapeHtml(member.email)}</div>
            </div>
          </div>
        </td>
        <td><span class="badge badge-indigo">${escapeHtml(member.plan)}</span></td>
        <td>${getStatusBadgeHtml(member.status)}</td>
        <td>${member.joinDate}</td>
        <td>
          <button class="action-icon-btn" title="View Profile" onclick="window.fitPulseApp.showToast('Viewing profile for ${escapeHtml(member.name)}', 'info')">
            <i class="fa-solid fa-eye"></i>
          </button>
        </td>
      </tr>
    `).join('');

    // Render Today's Classes List
    if (!elements.todayClassesContainer) return;

    elements.todayClassesContainer.innerHTML = state.classes.slice(0, 3).map(cls => `
      <div class="class-card" style="margin-bottom: 12px; padding: 14px 16px;">
        <div class="class-card-header" style="margin-bottom: 6px;">
          <span class="class-category">${escapeHtml(cls.category)}</span>
          <span class="text-muted text-sm"><i class="fa-regular fa-clock"></i> ${cls.time}</span>
        </div>
        <strong style="font-size: 1rem; display: block; margin-bottom: 4px;">${escapeHtml(cls.title)}</strong>
        <div class="class-info-item">
          <i class="fa-solid fa-user-ninja"></i> Trainer: ${escapeHtml(cls.trainer)}
        </div>
      </div>
    `).join('');
  }

  // ------------------------------------------------------------------------
  // 6. MEMBERS DIRECTORY RENDER & FILTER LOGIC
  // ------------------------------------------------------------------------
  function renderMembersTable() {
    if (!elements.membersTableTbody) return;

    const query = elements.memberSearchInput ? elements.memberSearchInput.value.toLowerCase().trim() : '';
    const statusFilter = elements.memberStatusFilter ? elements.memberStatusFilter.value : 'all';
    const planFilter = elements.memberPlanFilter ? elements.memberPlanFilter.value : 'all';

    const filtered = state.members.filter(m => {
      const matchesSearch = m.name.toLowerCase().includes(query) || 
                            m.email.toLowerCase().includes(query) || 
                            m.phone.includes(query);
      const matchesStatus = statusFilter === 'all' || m.status === statusFilter;
      const matchesPlan = planFilter === 'all' || m.plan === planFilter;

      return matchesSearch && matchesStatus && matchesPlan;
    });

    if (elements.memberCountShowing) {
      elements.memberCountShowing.textContent = filtered.length;
    }

    if (filtered.length === 0) {
      elements.membersTableTbody.innerHTML = `
        <tr>
          <td colspan="7" class="text-center" style="padding: 40px; text-align: center; color: var(--text-muted);">
            <i class="fa-solid fa-user-slash" style="font-size: 2rem; margin-bottom: 10px; display: block;"></i>
            No members matching your search filters.
          </td>
        </tr>
      `;
      return;
    }

    elements.membersTableTbody.innerHTML = filtered.map(m => `
      <tr>
        <td>
          <div class="member-cell">
            <div class="avatar-chip">${getInitials(m.name)}</div>
            <div>
              <strong>${escapeHtml(m.name)}</strong>
              <div class="text-muted text-sm">ID: #MP-${1000 + m.id}</div>
            </div>
          </div>
        </td>
        <td>
          <div>${escapeHtml(m.email)}</div>
          <div class="text-muted text-sm">${escapeHtml(m.phone)}</div>
        </td>
        <td><span class="badge badge-indigo">${escapeHtml(m.plan)}</span></td>
        <td>${getStatusBadgeHtml(m.status)}</td>
        <td>${m.joinDate}</td>
        <td>${m.expiryDate}</td>
        <td class="text-right">
          <div class="action-buttons">
            <button class="action-icon-btn" title="Edit Member" onclick="window.editMember(${m.id})">
              <i class="fa-solid fa-pen-to-square"></i>
            </button>
            <button class="action-icon-btn delete-btn" title="Delete Member" onclick="window.deleteMember(${m.id})">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  // ------------------------------------------------------------------------
  // 7. CLASSES GRID RENDER & FILTER
  // ------------------------------------------------------------------------
  function renderClassesGrid() {
    if (!elements.classesCardsGrid) return;

    const dayFilter = state.currentClassDayFilter;
    const filtered = dayFilter === 'all' ? state.classes : state.classes.filter(c => c.day === dayFilter);

    if (filtered.length === 0) {
      elements.classesCardsGrid.innerHTML = `
        <div style="grid-column: 1 / -1; padding: 40px; text-align: center; color: var(--text-muted); background: white; border-radius: var(--radius-lg); border: 1px solid var(--border-color);">
          <i class="fa-solid fa-calendar-xmark" style="font-size: 2rem; margin-bottom: 10px; display: block;"></i>
          No fitness classes scheduled for ${dayFilter}.
        </div>
      `;
      return;
    }

    elements.classesCardsGrid.innerHTML = filtered.map(c => `
      <div class="class-card">
        <div class="class-card-header">
          <span class="class-category">${escapeHtml(c.category)}</span>
          <span class="badge badge-indigo">${escapeHtml(c.day)}</span>
        </div>
        <h3 class="class-card-title">${escapeHtml(c.title)}</h3>
        
        <div class="class-info-item">
          <i class="fa-regular fa-clock"></i> ${escapeHtml(c.time)}
        </div>
        <div class="class-info-item">
          <i class="fa-solid fa-user-ninja"></i> Trainer: <strong>${escapeHtml(c.trainer)}</strong>
        </div>

        <div class="class-capacity-bar">
          <span class="text-muted text-sm"><i class="fa-solid fa-users"></i> ${c.booked} / ${c.capacity} Booked</span>
          <button class="btn btn-outline btn-sm" onclick="window.fitPulseApp.showToast('Booked spot for ${escapeHtml(c.title)}!', 'success')">
            Book Spot
          </button>
        </div>
      </div>
    `).join('');
  }

  // ------------------------------------------------------------------------
  // 8. PAYMENTS TABLE RENDER
  // ------------------------------------------------------------------------
  function renderPaymentsTable() {
    if (!elements.paymentsTableTbody) return;

    const query = elements.paymentSearchInput ? elements.paymentSearchInput.value.toLowerCase().trim() : '';

    const filtered = state.payments.filter(p => 
      p.member.toLowerCase().includes(query) || 
      p.id.toLowerCase().includes(query) ||
      p.plan.toLowerCase().includes(query)
    );

    elements.paymentsTableTbody.innerHTML = filtered.map(p => `
      <tr>
        <td><strong>${escapeHtml(p.id)}</strong></td>
        <td>${escapeHtml(p.member)}</td>
        <td>${escapeHtml(p.plan)}</td>
        <td><strong>$${p.amount.toFixed(2)}</strong></td>
        <td>${escapeHtml(p.method)}</td>
        <td>${p.date}</td>
        <td>${getPaymentStatusBadge(p.status)}</td>
        <td class="text-right">
          <button class="action-icon-btn" title="Download Receipt" onclick="window.fitPulseApp.showToast('Downloading Receipt #${p.id}...', 'info')">
            <i class="fa-solid fa-file-arrow-down"></i>
          </button>
        </td>
      </tr>
    `).join('');
  }

  function populatePaymentMemberSelect() {
    if (!elements.selectPayMember) return;
    elements.selectPayMember.innerHTML = state.members.map(m => `
      <option value="${escapeHtml(m.name)}">${escapeHtml(m.name)} (${m.plan})</option>
    `).join('');
  }

  // ------------------------------------------------------------------------
  // 9. MODAL & FORM HANDLERS
  // ------------------------------------------------------------------------
  function setupModals() {
    // Open Add Member Modal
    const openMemberModal = () => {
      elements.formMember.reset();
      document.getElementById('member-id').value = '';
      document.getElementById('modal-member-title').textContent = 'Add New Member';
      showModal('modal-member');
    };

    if (elements.btnAddMember) elements.btnAddMember.addEventListener('click', openMemberModal);
    if (elements.btnQuickAddMember) elements.btnQuickAddMember.addEventListener('click', openMemberModal);

    // Open Schedule Class Modal
    const openClassModal = () => {
      elements.formClass.reset();
      showModal('modal-class');
    };

    if (elements.btnAddClass) elements.btnAddClass.addEventListener('click', openClassModal);
    if (elements.btnQuickSchedule) elements.btnQuickSchedule.addEventListener('click', openClassModal);

    // Open Record Payment Modal
    if (elements.btnRecordPayment) {
      elements.btnRecordPayment.addEventListener('click', () => {
        elements.formPayment.reset();
        showModal('modal-payment');
      });
    }

    // Modal Close Buttons
    document.querySelectorAll('[data-close]').forEach(btn => {
      btn.addEventListener('click', () => {
        const modalId = btn.getAttribute('data-close');
        hideModal(modalId);
      });
    });

    // Close Modal when clicking backdrop
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          hideModal(overlay.id);
        }
      });
    });

    // Form Submissions
    if (elements.formMember) {
      elements.formMember.addEventListener('submit', (e) => {
        e.preventDefault();
        saveMember();
      });
    }

    if (elements.formClass) {
      elements.formClass.addEventListener('submit', (e) => {
        e.preventDefault();
        saveClass();
      });
    }

    if (elements.formPayment) {
      elements.formPayment.addEventListener('submit', (e) => {
        e.preventDefault();
        savePayment();
      });
    }
  }

  function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('active');
  }

  function hideModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('active');
  }

  // Member CRUD logic
  function saveMember() {
    const idVal = document.getElementById('member-id').value;
    const name = document.getElementById('input-member-name').value.trim();
    const email = document.getElementById('input-member-email').value.trim();
    const phone = document.getElementById('input-member-phone').value.trim();
    const plan = document.getElementById('input-member-plan').value;
    const status = document.getElementById('input-member-status').value;
    const joinDateInput = document.getElementById('input-member-joindate').value;

    const todayStr = new Date().toISOString().split('T')[0];
    const joinDate = joinDateInput || todayStr;

    if (idVal) {
      // Edit existing member
      const member = state.members.find(m => m.id === parseInt(idVal));
      if (member) {
        member.name = name;
        member.email = email;
        member.phone = phone;
        member.plan = plan;
        member.status = status;
        showToast(`Updated member profile for ${name}`, 'success');
      }
    } else {
      // Create new member
      const newMember = {
        id: Date.now(),
        name,
        email,
        phone,
        plan,
        status,
        joinDate,
        expiryDate: '2027-07-30'
      };
      state.members.unshift(newMember);
      showToast(`New member ${name} added successfully!`, 'success');
    }

    hideModal('modal-member');
    renderAllViews();
  }

  window.editMember = function(id) {
    const member = state.members.find(m => m.id === id);
    if (!member) return;

    document.getElementById('member-id').value = member.id;
    document.getElementById('input-member-name').value = member.name;
    document.getElementById('input-member-email').value = member.email;
    document.getElementById('input-member-phone').value = member.phone;
    document.getElementById('input-member-plan').value = member.plan;
    document.getElementById('input-member-status').value = member.status;
    document.getElementById('modal-member-title').textContent = 'Edit Member Profile';

    showModal('modal-member');
  };

  window.deleteMember = function(id) {
    const index = state.members.findIndex(m => m.id === id);
    if (index !== -1) {
      const name = state.members[index].name;
      if (confirm(`Are you sure you want to delete member ${name}?`)) {
        state.members.splice(index, 1);
        showToast(`Member ${name} removed`, 'info');
        renderAllViews();
      }
    }
  };

  // Class Save logic
  function saveClass() {
    const title = document.getElementById('input-class-name').value.trim();
    const trainer = document.getElementById('input-class-trainer').value.trim();
    const day = document.getElementById('input-class-day').value;
    const time = document.getElementById('input-class-time').value.trim();
    const capacity = parseInt(document.getElementById('input-class-capacity').value) || 20;

    const newClass = {
      id: Date.now(),
      title,
      trainer,
      day,
      time,
      booked: 0,
      capacity,
      category: 'Fitness'
    };

    state.classes.unshift(newClass);
    hideModal('modal-class');
    showToast(`Scheduled class: ${title}`, 'success');
    renderClassesGrid();
  }

  // Payment Save logic
  function savePayment() {
    const member = document.getElementById('input-pay-member').value;
    const amount = parseFloat(document.getElementById('input-pay-amount').value) || 0;
    const method = document.getElementById('input-pay-method').value;
    const desc = document.getElementById('input-pay-desc').value.trim() || 'Membership Fee Payment';

    const newPayment = {
      id: `INV-${Math.floor(1000 + Math.random() * 9000)}`,
      member,
      plan: desc,
      amount,
      method,
      date: new Date().toISOString().split('T')[0],
      status: 'Paid'
    };

    state.payments.unshift(newPayment);
    hideModal('modal-payment');
    showToast(`Recorded payment of $${amount.toFixed(2)} for ${member}`, 'success');
    renderPaymentsTable();
  }

  // ------------------------------------------------------------------------
  // 10. FILTER CONTROLS LISTENERS
  // ------------------------------------------------------------------------
  function setupFilters() {
    if (elements.memberSearchInput) elements.memberSearchInput.addEventListener('input', renderMembersTable);
    if (elements.memberStatusFilter) elements.memberStatusFilter.addEventListener('change', renderMembersTable);
    if (elements.memberPlanFilter) elements.memberPlanFilter.addEventListener('change', renderMembersTable);
    if (elements.paymentSearchInput) elements.paymentSearchInput.addEventListener('input', renderPaymentsTable);

    // Global Topbar Search
    if (elements.globalSearch) {
      elements.globalSearch.addEventListener('input', (e) => {
        const val = e.target.value.toLowerCase().trim();
        if (val) {
          switchTab('members');
          if (elements.memberSearchInput) {
            elements.memberSearchInput.value = val;
            renderMembersTable();
          }
        }
      });
    }

    // Day Chips Filter
    if (elements.dayFilterBar) {
      elements.dayFilterBar.querySelectorAll('.day-chip').forEach(chip => {
        chip.addEventListener('click', () => {
          elements.dayFilterBar.querySelectorAll('.day-chip').forEach(c => c.classList.remove('active'));
          chip.classList.add('active');
          state.currentClassDayFilter = chip.getAttribute('data-day');
          renderClassesGrid();
        });
      });
    }
  }

  // ------------------------------------------------------------------------
  // 11. HELPER UTILITIES & TOASTS
  // ------------------------------------------------------------------------
  function updateStatCounts() {
    const badgeTotal = document.getElementById('badge-total-members');
    const statActive = document.getElementById('stat-active-members');
    
    if (badgeTotal) badgeTotal.textContent = state.members.length;
    if (statActive) statActive.textContent = state.members.filter(m => m.status === 'Active').length;
  }

  function getInitials(name) {
    if (!name) return 'GP';
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  }

  function getStatusBadgeHtml(status) {
    if (status === 'Active') return '<span class="badge badge-emerald"><i class="fa-solid fa-circle" style="font-size: 6px; margin-right: 4px;"></i> Active</span>';
    if (status === 'Expiring') return '<span class="badge badge-amber"><i class="fa-solid fa-clock" style="font-size: 8px; margin-right: 4px;"></i> Expiring Soon</span>';
    return '<span class="badge badge-rose">Inactive</span>';
  }

  function getPaymentStatusBadge(status) {
    if (status === 'Paid') return '<span class="badge badge-emerald">Paid</span>';
    return '<span class="badge badge-amber">Pending</span>';
  }

  function showToast(message, type = 'info') {
    if (!elements.toastContainer) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <i class="fa-solid ${type === 'success' ? 'fa-circle-check' : 'fa-circle-info'}"></i>
      <span>${escapeHtml(message)}</span>
    `;

    elements.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(50px)';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      if (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
        e.preventDefault();
        if (elements.globalSearch) elements.globalSearch.focus();
      }
    });
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, match => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[match]));
  }

  // Initialize Application
  initApp();
});
