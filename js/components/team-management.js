/**
 * Team Sub-Users Management Modal Component
 */

import { state } from '../state/app-state.js';
import { elements } from '../dom/elements.js';
import { escapeHtml, getInitials } from '../utils/formatters.js';
import { showToast } from '../utils/notifications.js';
import { addSubUser, toggleUserStatus, deleteSubUser } from '../services/user-service.js';
import { addAuditLog } from '../services/logging-service.js';

export function setupTeamManagement(onTeamUpdated) {
  const openBtn = document.getElementById('openTeamModalBtn');
  const modal = document.getElementById('teamManagementModal');
  const closeBtn = document.getElementById('closeTeamModalBtn');
  const form = document.getElementById('addTeamMemberForm');

  if (openBtn) {
    openBtn.addEventListener('click', () => {
      renderTeamList(onTeamUpdated);
      if (modal) modal.style.display = 'flex';
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      if (modal) modal.style.display = 'none';
    });
  }

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.style.display = 'none';
    });
  }

  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const nameInput = document.getElementById('newMemberName');
      const emailInput = document.getElementById('newMemberEmail');
      const passwordInput = document.getElementById('newMemberPassword');
      const roleSelect = document.getElementById('newMemberRole');

      const name = nameInput ? nameInput.value.trim() : '';
      const email = emailInput ? emailInput.value.trim() : '';
      const password = passwordInput ? passwordInput.value.trim() : '';
      const role = roleSelect ? roleSelect.value : 'agent';

      if (!name || !email || !password) {
        showToast('Please fill in Name, Email, and Password', 'warning');
        return;
      }

      const newUser = addSubUser(name, email, password, role);
      addAuditLog('user_created', '', name, `Added sub-user ${name} (${role.toUpperCase()})`);
      showToast(`Added sub-user ${name} (${role.toUpperCase()})`, 'info');

      if (nameInput) nameInput.value = '';
      if (emailInput) emailInput.value = '';
      if (passwordInput) passwordInput.value = '';

      renderTeamList(onTeamUpdated);
      if (onTeamUpdated) onTeamUpdated();
    });
  }
}

export function renderTeamList(onTeamUpdated) {
  const container = document.getElementById('teamMembersListTable');
  const countEl = document.getElementById('teamMemberCount');
  if (!container) return;

  const users = state.teamMembers || [];
  if (countEl) countEl.textContent = users.length;

  container.innerHTML = users.map(user => {
    const initials = getInitials(user.name);
    const isAdmin = user.role === 'admin';
    const isCurrent = user.id === (state.currentUser ? state.currentUser.id : '');
    const statusClass = user.status === 'active' ? 'status-active' : 'status-disabled';

    return `
      <div class="team-user-row">
        <div class="team-user-profile">
          <div class="user-avatar-initials ${user.role === 'agent' ? 'agent-avatar' : ''}">${escapeHtml(initials)}</div>
          <div class="team-user-names">
            <strong>${escapeHtml(user.name)} ${isCurrent ? '<span class="you-badge">(You)</span>' : ''}</strong>
            <span>${escapeHtml(user.email)}</span>
          </div>
        </div>
        <div class="team-user-role">
          <span class="user-role-badge ${user.role}">${user.role.toUpperCase()}</span>
        </div>
        <div class="team-user-status">
          <span class="status-pill ${statusClass}">${user.status === 'active' ? '● Active' : '○ Disabled'}</span>
        </div>
        <div class="team-user-actions" style="display: flex; gap: 6px; align-items: center;">
          ${isAdmin ? '<span class="admin-lock"><i class="fa-solid fa-lock"></i> Protected</span>' : `
            <button type="button" class="btn-toggle-status ${user.status === 'active' ? 'btn-disable' : 'btn-enable'}" data-user-id="${user.id}">
              ${user.status === 'active' ? 'Disable' : 'Enable'}
            </button>
            <button type="button" class="btn-delete-team-user" data-user-id="${user.id}" title="Delete User">
              <i class="fa-regular fa-trash-can"></i>
            </button>
          `}
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.btn-toggle-status').forEach(btn => {
    btn.addEventListener('click', () => {
      const userId = btn.dataset.userId;
      toggleUserStatus(userId);
      renderTeamList(onTeamUpdated);
      if (onTeamUpdated) onTeamUpdated();
    });
  });

  container.querySelectorAll('.btn-delete-team-user').forEach(btn => {
    btn.addEventListener('click', () => {
      const userId = btn.dataset.userId;
      const deleted = deleteSubUser(userId);
      if (deleted) {
        addAuditLog('user_deleted', '', deleted.name, `Deleted sub-user ${deleted.name} (${deleted.role.toUpperCase()})`);
        showToast(`Deleted sub-user ${deleted.name}`, 'info');
      }
      renderTeamList(onTeamUpdated);
      if (onTeamUpdated) onTeamUpdated();
    });
  });
}
