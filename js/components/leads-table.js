/**
 * Leads Dashboard Table Renderer & Actions Handler
 */

import { updateLeadStatus, updateLeadAssignee } from '../../firebase-config.js';
import { state } from '../state/app-state.js';
import { elements } from '../dom/elements.js';
import { escapeHtml, getInitials, formatFullDateTime } from '../utils/formatters.js';
import { showToast } from '../utils/notifications.js';
import { getUserFirstQuery } from '../utils/export-excel.js';
import { addAuditLog } from '../services/logging-service.js';

export function setupLeadsHandlers(renderConversationsView, openLeadChat) {
  // Search input
  if (elements.leadsSearchInput) {
    elements.leadsSearchInput.addEventListener('input', (e) => {
      state.leadsSearchQuery = e.target.value.trim().toLowerCase();
      renderLeadsView(renderConversationsView, openLeadChat);
    });
  }

  // Filter Pills
  document.querySelectorAll('.lead-filter-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.lead-filter-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      state.leadsFilter = pill.dataset.filter;
      renderLeadsView(renderConversationsView, openLeadChat);
    });
  });

  // Delete Confirmation Modal
  if (elements.closeDeleteModalBtn) {
    elements.closeDeleteModalBtn.addEventListener('click', () => {
      if (elements.deleteConfirmModal) elements.deleteConfirmModal.style.display = 'none';
      state.pendingDeleteLeadId = null;
    });
  }

  if (elements.cancelDeleteModalBtn) {
    elements.cancelDeleteModalBtn.addEventListener('click', () => {
      if (elements.deleteConfirmModal) elements.deleteConfirmModal.style.display = 'none';
      state.pendingDeleteLeadId = null;
    });
  }

  if (elements.deleteConfirmModal) {
    elements.deleteConfirmModal.addEventListener('click', (e) => {
      if (e.target === elements.deleteConfirmModal) {
        elements.deleteConfirmModal.style.display = 'none';
        state.pendingDeleteLeadId = null;
      }
    });
  }

  if (elements.confirmDeleteModalBtn) {
    elements.confirmDeleteModalBtn.addEventListener('click', async () => {
      const leadId = state.pendingDeleteLeadId;
      if (!leadId) return;

      if (elements.deleteConfirmModal) elements.deleteConfirmModal.style.display = 'none';
      state.pendingDeleteLeadId = null;

      const lead = state.leads.find(l => l.id === leadId);
      try {
        if (!state.demoMode) {
          await updateLeadStatus(leadId, 'deleted');
        } else if (lead) {
          lead.status = 'deleted';
        }

        if (state.activeLeadId === leadId) {
          state.activeLeadId = null;
          if (elements.activeChatView) elements.activeChatView.style.display = 'none';
          if (elements.chatPlaceholder) elements.chatPlaceholder.style.display = 'flex';
        }

        addAuditLog('delete_lead', leadId, lead ? lead.name : leadId, 'Deleted lead and moved to Deleted status', 'Admin User');

        renderLeadsView(renderConversationsView, openLeadChat);
        if (renderConversationsView) renderConversationsView();
        showToast('Lead moved to Deleted', 'info');
      } catch (err) {
        showToast(`Failed to delete lead: ${err.message}`, 'error');
      }
    });
  }
}

export function renderLeadsView(renderConversationsView, openLeadChat) {
  const { leads, leadsSearchQuery, leadsFilter, currentUser, teamMembers } = state;
  const isAgent = currentUser && currentUser.role === 'agent';
  const isDisabledUser = currentUser && currentUser.status === 'disabled';

  // Filter leads: Customer-initiated leads ONLY (isLead === true)
  let leadsOnly = leads.filter(l => l.isLead === true || (l.isLead !== false && l.initiatedBy !== 'crm' && l.category !== 'conversation'));

  // Strict Agent Filter: Agents ONLY see leads assigned to them ("Show only assign")
  if (isAgent) {
    leadsOnly = leadsOnly.filter(l => l.assigneeId === currentUser.id);
  }

  const activeLeadsOnly = leadsOnly.filter(l => (l.status || '').toLowerCase() !== 'deleted');
  const deletedLeadsOnly = leadsOnly.filter(l => (l.status || '').toLowerCase() === 'deleted');

  const filtered = leadsOnly.filter(lead => {
    const displayName = (lead.name || lead.phone || '').toLowerCase();
    const phone = (lead.phone || '').toLowerCase();
    const lastMsg = (lead.lastMessage || '').toLowerCase();

    const matchesSearch = !leadsSearchQuery ||
      displayName.includes(leadsSearchQuery) ||
      phone.includes(leadsSearchQuery) ||
      lastMsg.includes(leadsSearchQuery);

    const status = (lead.status || 'new').toLowerCase();
    let matchesFilter = false;

    if (leadsFilter === 'all') {
      matchesFilter = status !== 'deleted';
    } else if (leadsFilter === 'deleted') {
      matchesFilter = status === 'deleted';
    } else {
      matchesFilter = status === leadsFilter;
    }

    return matchesSearch && matchesFilter;
  });

  // Update counters
  const activeCount = activeLeadsOnly.length;
  const deletedCount = deletedLeadsOnly.length;
  const newCount = activeLeadsOnly.filter(l => (l.status || 'new').toLowerCase() === 'new').length;
  const contactedCount = activeLeadsOnly.filter(l => (l.status || '').toLowerCase() === 'contacted').length;
  const noAnswerCount = activeLeadsOnly.filter(l => (l.status || '').toLowerCase() === 'no_answer').length;
  const followUpCount = activeLeadsOnly.filter(l => (l.status || '').toLowerCase() === 'follow_up').length;
  const convertedCount = activeLeadsOnly.filter(l => (l.status || '').toLowerCase() === 'converted').length;
  const lostCount = activeLeadsOnly.filter(l => (l.status || '').toLowerCase() === 'lost').length;
  let activeConversations = leads.filter(l => (l.status || '').toLowerCase() !== 'deleted');
  if (isAgent) {
    activeConversations = activeConversations.filter(l => l.assigneeId === currentUser.id);
  }
  const activeUnreadCount = activeConversations.filter(l => (l.unreadCount || 0) > 0).length;

  if (elements.navLeadsCount) elements.navLeadsCount.textContent = activeCount;
  if (elements.navConversationsCount) elements.navConversationsCount.textContent = activeUnreadCount || activeConversations.length;

  if (elements.countAllLeads) elements.countAllLeads.textContent = activeCount;
  if (elements.countNewLeads) elements.countNewLeads.textContent = newCount;
  if (elements.countContactedLeads) elements.countContactedLeads.textContent = contactedCount;
  if (elements.countNoAnswerLeads) elements.countNoAnswerLeads.textContent = noAnswerCount;
  if (elements.countFollowUpLeads) elements.countFollowUpLeads.textContent = followUpCount;
  if (elements.countConvertedLeads) elements.countConvertedLeads.textContent = convertedCount;
  if (elements.countLostLeads) elements.countLostLeads.textContent = lostCount;
  if (elements.countDeletedLeads) elements.countDeletedLeads.textContent = deletedCount;

  // Sync active class on filter pill tabs
  document.querySelectorAll('.lead-filter-pill').forEach(pill => {
    if (pill.dataset.filter === leadsFilter) {
      pill.classList.add('active');
    } else {
      pill.classList.remove('active');
    }
  });

  if (elements.leadsLoadingState) elements.leadsLoadingState.style.display = 'none';

  if ((activeCount === 0 && deletedCount === 0) || filtered.length === 0) {
    if (elements.leadsEmptyState) elements.leadsEmptyState.style.display = 'flex';
    if (elements.leadsCardsList) elements.leadsCardsList.innerHTML = '';
    renderLeadsPagination(0, 1, renderConversationsView, openLeadChat);
    return;
  }

  if (elements.leadsEmptyState) elements.leadsEmptyState.style.display = 'none';

  if (!elements.leadsCardsList) return;

  // Pagination Calculations (10 records per page)
  const pageSize = state.leadsPageSize || 10;
  const totalRecords = filtered.length;
  const totalPages = Math.ceil(totalRecords / pageSize) || 1;

  if (state.leadsCurrentPage > totalPages) state.leadsCurrentPage = totalPages;
  if (state.leadsCurrentPage < 1) state.leadsCurrentPage = 1;

  const startIndex = (state.leadsCurrentPage - 1) * pageSize;
  const pageRecords = filtered.slice(startIndex, startIndex + pageSize);

  // Render Lead Cards matching UI design
  elements.leadsCardsList.innerHTML = pageRecords.map(lead => {
    const displayName = lead.name && lead.name.trim() ? lead.name.trim() : (lead.phone || lead.id);
    const subtitle = lead.company || '';
    const handle = lead.handle || lead.phone || lead.id;
    const userFirstQuery = getUserFirstQuery(lead);
    const createdDateTime = formatFullDateTime(lead.createdAt || lead.lastMessageAt);
    const currentStatus = (lead.status || 'new').toLowerCase();
    const isDeleted = currentStatus === 'deleted';
    const currentAssigneeId = lead.assigneeId || '';
    const currentAssigneeName = lead.assigneeName || 'Unassigned';

    return `
      <div class="lead-card-row ${isDisabledUser ? 'row-disabled' : ''}" data-lead-id="${escapeHtml(lead.id)}">
        <!-- 1. Name -->
        <div class="lead-profile-col">
          <div class="lead-name-box">
            <span class="lead-name-title" title="${escapeHtml(displayName)}">${escapeHtml(displayName)}</span>
            ${subtitle ? `<span class="lead-subtitle" title="${escapeHtml(subtitle)}">${escapeHtml(subtitle)}</span>` : ''}
          </div>
        </div>

        <!-- 2. Phone number -->
        <div class="lead-handle-col">
          <span>${escapeHtml(handle)}</span>
        </div>

        <!-- 3. User Query -->
        <div class="lead-message-col">
          <div class="lead-quote-bubble" title="${escapeHtml(userFirstQuery)}">
            ${escapeHtml(userFirstQuery)}
          </div>
        </div>

        <!-- 4. Platform -->
        <div class="lead-channel-col">
          <span class="channel-pill whatsapp"><i class="fa-brands fa-whatsapp"></i> WhatsApp</span>
        </div>

        <!-- 5. Assigned -->
        <div class="lead-assignee-col">
          ${isAgent ? `
            <span class="assignee-badge-pill" title="Assigned Agent: ${escapeHtml(currentAssigneeName)}">
              <i class="fa-solid fa-user-check"></i> ${escapeHtml(currentAssigneeName)}
            </span>
          ` : `
            <select class="lead-assignee-select" data-lead-id="${escapeHtml(lead.id)}" ${isDeleted || isDisabledUser ? 'disabled' : ''}>
              <option value="" ${!currentAssigneeId ? 'selected' : ''}>Unassigned</option>
              ${teamMembers.map(user => `
                <option value="${user.id}" ${currentAssigneeId === user.id ? 'selected' : ''}>
                  ${user.role === 'admin' ? '🛡️' : '👤'} ${escapeHtml(user.name)}
                </option>
              `).join('')}
            </select>
          `}
        </div>

        <!-- 5. Status -->
        <div class="lead-status-col">
          <select class="lead-status-select status-${currentStatus}" data-lead-id="${escapeHtml(lead.id)}" ${isDeleted || isDisabledUser ? 'disabled' : ''}>
            ${isDeleted ? `<option value="deleted" selected disabled>Deleted</option>` : ''}
            <option value="new" ${currentStatus === 'new' ? 'selected' : ''}>New</option>
            <option value="contacted" ${currentStatus === 'contacted' ? 'selected' : ''}>Contacted</option>
            <option value="no_answer" ${currentStatus === 'no_answer' ? 'selected' : ''}>No Answer</option>
            <option value="follow_up" ${currentStatus === 'follow_up' ? 'selected' : ''}>Follow Up</option>
            <option value="converted" ${currentStatus === 'converted' ? 'selected' : ''}>Converted</option>
            <option value="lost" ${currentStatus === 'lost' ? 'selected' : ''}>Lost</option>
          </select>
        </div>

        <!-- 6. Created Date with Time -->
        <div class="lead-time-col">
          <span>${createdDateTime}</span>
        </div>

        <!-- 7. Action -->
        <div class="lead-actions-col">
          ${isDeleted || isDisabledUser ? '' : `
            <button class="btn-lead-delete" data-action="delete" data-lead-id="${escapeHtml(lead.id)}" title="Delete lead">
              <i class="fa-regular fa-trash-can"></i>
            </button>
          `}
        </div>
      </div>
    `;
  }).join('');

  // Attach card event listeners
  elements.leadsCardsList.querySelectorAll('.btn-lead-delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (state.currentUser && state.currentUser.status === 'disabled') {
        showToast("Your account is disabled. You cannot perform actions.", "error");
        return;
      }
      const leadId = btn.dataset.leadId;
      handleDeleteLead(leadId);
    });
  });

  elements.leadsCardsList.querySelectorAll('.lead-status-select').forEach(select => {
    select.addEventListener('change', async (e) => {
      e.stopPropagation();
      if (state.currentUser && state.currentUser.status === 'disabled') {
        showToast("Your account is disabled. You cannot perform actions.", "error");
        return;
      }
      const leadId = select.dataset.leadId;
      const newStatus = select.value;
      try {
        const lead = state.leads.find(l => l.id === leadId);
        if (!state.demoMode) {
          await updateLeadStatus(leadId, newStatus);
        } else {
          if (lead) lead.status = newStatus;
        }
        addAuditLog('status_change', leadId, lead ? lead.name : leadId, `Updated lead status to ${newStatus.toUpperCase()}`);
        showToast(`Lead status updated to ${newStatus}`, 'info');
      } catch (err) {
        showToast(`Failed to update status: ${err.message}`, 'error');
      }
    });
  });

  // Assignee Select Listener
  elements.leadsCardsList.querySelectorAll('.lead-assignee-select').forEach(select => {
    select.addEventListener('change', async (e) => {
      e.stopPropagation();
      if (state.currentUser && state.currentUser.status === 'disabled') {
        showToast("Your account is disabled. You cannot perform actions.", "error");
        return;
      }
      const leadId = select.dataset.leadId;
      const newAssigneeId = select.value;
      const assignedUser = teamMembers.find(u => u.id === newAssigneeId);
      const assigneeName = assignedUser ? assignedUser.name : 'Unassigned';

      const lead = state.leads.find(l => l.id === leadId);
      if (lead) {
        lead.assigneeId = newAssigneeId || null;
        lead.assigneeName = assigneeName;
        lead.assignedAt = new Date().toISOString();
      }

      if (!state.demoMode) {
        try {
          await updateLeadAssignee(leadId, newAssigneeId, assigneeName);
        } catch (err) {
          console.warn("Assignee update error:", err);
        }
      }

      addAuditLog('assignee_change', leadId, lead ? lead.name : leadId, `Assigned lead to ${assigneeName}`);
      showToast(`Assigned lead to ${assigneeName}`, 'info');
      renderLeadsView(renderConversationsView, openLeadChat);
    });
  });

  renderLeadsPagination(totalRecords, totalPages, renderConversationsView, openLeadChat);
}

export function handleDeleteLead(leadId) {
  state.pendingDeleteLeadId = leadId;
  const lead = state.leads.find(l => l.id === leadId);
  if (elements.deleteLeadTargetName) {
    elements.deleteLeadTargetName.textContent = lead ? (lead.name || lead.phone || lead.id) : leadId;
  }
  if (elements.deleteConfirmModal) {
    elements.deleteConfirmModal.style.display = 'flex';
  }
}

export function highlightLeadCard(leadId) {
  setTimeout(() => {
    const row = document.querySelector(`.lead-card-row[data-lead-id="${leadId}"]`);
    if (row) {
      row.scrollIntoView({ behavior: 'smooth', block: 'center' });
      row.classList.add('highlight-pulse');
      setTimeout(() => row.classList.remove('highlight-pulse'), 3000);
    }
  }, 150);
}

export function renderLeadsPagination(totalRecords, totalPages, renderConversationsView, openLeadChat) {
  const pageNumEl = document.getElementById('leadsCurrentPageNum');
  const totalPagesEl = document.getElementById('leadsTotalPagesNum');
  const totalRecordsEl = document.getElementById('leadsTotalRecordsNum');
  const prevBtn = document.getElementById('leadsPrevBtn');
  const nextBtn = document.getElementById('leadsNextBtn');
  const pageNumbersWrap = document.getElementById('leadsPageNumbers');

  if (pageNumEl) pageNumEl.textContent = totalRecords === 0 ? 0 : state.leadsCurrentPage;
  if (totalPagesEl) totalPagesEl.textContent = totalPages;
  if (totalRecordsEl) totalRecordsEl.textContent = totalRecords;

  if (prevBtn) {
    prevBtn.disabled = state.leadsCurrentPage <= 1 || totalRecords === 0;
    prevBtn.onclick = () => {
      if (state.leadsCurrentPage > 1) {
        state.leadsCurrentPage--;
        renderLeadsView(renderConversationsView, openLeadChat);
      }
    };
  }

  if (nextBtn) {
    nextBtn.disabled = state.leadsCurrentPage >= totalPages || totalRecords === 0;
    nextBtn.onclick = () => {
      if (state.leadsCurrentPage < totalPages) {
        state.leadsCurrentPage++;
        renderLeadsView(renderConversationsView, openLeadChat);
      }
    };
  }

  if (pageNumbersWrap) {
    if (totalRecords === 0) {
      pageNumbersWrap.innerHTML = '';
      return;
    }
    let html = '';
    const maxVisiblePills = 5;
    let startP = Math.max(1, state.leadsCurrentPage - 2);
    let endP = Math.min(totalPages, startP + maxVisiblePills - 1);
    if (endP - startP < maxVisiblePills - 1) {
      startP = Math.max(1, endP - maxVisiblePills + 1);
    }

    for (let p = startP; p <= endP; p++) {
      html += `<button type="button" class="page-num-pill ${p === state.leadsCurrentPage ? 'active' : ''}" data-page="${p}">${p}</button>`;
    }
    pageNumbersWrap.innerHTML = html;

    pageNumbersWrap.querySelectorAll('.page-num-pill').forEach(btn => {
      btn.onclick = () => {
        state.leadsCurrentPage = parseInt(btn.dataset.page, 10);
        renderLeadsView(renderConversationsView, openLeadChat);
      };
    });
  }
}
