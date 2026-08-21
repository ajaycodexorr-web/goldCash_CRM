/**
 * User Profile Card & Session Control (Sidebar Footer)
 */

import { state } from '../state/app-state.js';
import { elements } from '../dom/elements.js';
import { getInitials, escapeHtml } from '../utils/formatters.js';
import { showToast } from '../utils/notifications.js';
import { updateComposerDisabledState } from './composer.js';
import { updateExportBtnDisabledState } from '../utils/export-excel.js';
import { logoutUser } from '../services/auth-service.js';

export function setupUserSwitcher(onUserSwitch) {
  const container = document.getElementById('userProfileCardWrap');
  if (!container) return;

  renderUserSwitcher(container, onUserSwitch);
}

export function renderUserSwitcher(container, onUserSwitch) {
  if (!container) return;

  // Security Check: If current active user was deleted, trigger immediate logout
  if (state.currentUser && state.currentUser.role !== 'admin' && !state.teamMembers.some(u => u.id === state.currentUser.id)) {
    logoutUser(() => {
      showToast("Your account has been deleted by Admin.", "error");
      if (onUserSwitch) onUserSwitch(null);
    });
    return;
  }

  const current = state.currentUser || { id: 'usr_admin', name: 'Admin User', role: 'admin' };
  const initials = getInitials(current.name);
  const isAgent = current.role === 'agent';
  const isDisabled = current.status === 'disabled';
  const roleLabel = isDisabled ? 'DISABLED' : (current.role ? current.role.toUpperCase() : 'ADMIN');

  const openTeamBtn = document.getElementById('openTeamModalBtn');
  if (openTeamBtn) {
    openTeamBtn.style.display = (current.role === 'admin' && !isDisabled) ? 'flex' : 'none';
  }

  // Update composer and export button locking for disabled status
  updateComposerDisabledState();
  updateExportBtnDisabledState();

  container.innerHTML = `
    <div class="user-profile-switcher-card ${isDisabled ? 'card-disabled' : ''}">
      <div class="user-avatar-initials ${isAgent ? 'agent-avatar' : ''} ${isDisabled ? 'disabled-avatar' : ''}">${escapeHtml(initials)}</div>
      <div class="user-info-switcher">
        <div class="user-name-switcher" title="${escapeHtml(current.name)}">${escapeHtml(current.name)}</div>
        <div class="user-role-select-row">
          <span class="user-role-badge ${isDisabled ? 'disabled' : current.role}">${escapeHtml(roleLabel)}</span>
        </div>
      </div>
      <button type="button" id="logoutBtn" class="btn-logout" title="Sign Out">
        <i class="fa-solid fa-right-from-bracket"></i>
      </button>
    </div>
  `;

  const logoutBtn = container.querySelector('#logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      logoutUser(() => {
        if (onUserSwitch) onUserSwitch(null);
      });
    });
  }
}
