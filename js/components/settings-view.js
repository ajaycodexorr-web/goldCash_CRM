/**
 * Settings, Change Password & Role-Based Permissions Component
 * Super Admin has full control and manages Sub Admin & Maker permissions.
 */

import { state } from '../state/app-state.js';
import { elements } from '../dom/elements.js';
import { escapeHtml, getInitials } from '../utils/formatters.js';
import { showToast } from '../utils/notifications.js';
import { changeOwnPassword, updateUserPermissions, getUserPermissions, hasPermission, DEFAULT_PERMISSIONS } from '../services/user-service.js';
import { addAuditLog } from '../services/logging-service.js';

let isSubmittingPassword = false;
let isSavingPermissions = false;
let selectedPermUserId = null;

const PERMISSION_KEYS = [
  'canAddLead',
  'canDeleteLead',
  'canSendMessage',
  'canAddNote',
  'canExportExcel',
  'canAssignLead',
  'canViewLogs',
  'canViewTeams',
  'canChangePassword',
  'canManagePermissions'
];

export function setupSettingsView(onUserUpdated) {
  setupTabs();
  setupPasswordToggleListeners();
  setupPasswordFormListeners(onUserUpdated);
  setupPermissionsTabListeners(onUserUpdated);
  renderSettingsView();
}

/**
 * Switch tabs between Account & Security and User Permissions
 */
function setupTabs() {
  const tabBtnAccount = document.getElementById('settingsTabBtnAccount');
  const tabBtnPermissions = document.getElementById('settingsTabBtnPermissions');
  const paneAccount = document.getElementById('settingsAccountTabPane');
  const panePermissions = document.getElementById('settingsPermissionsTabPane');

  const switchSettingsTab = (tabName) => {
    if (tabBtnAccount) {
      const isAccount = tabName === 'account';
      tabBtnAccount.classList.toggle('active', isAccount);
      tabBtnAccount.style.color = isAccount ? 'var(--crm-primary)' : '#64748b';
      tabBtnAccount.style.borderBottomColor = isAccount ? 'var(--crm-primary)' : 'transparent';
    }

    if (tabBtnPermissions) {
      const isPerm = tabName === 'permissions';
      tabBtnPermissions.classList.toggle('active', isPerm);
      tabBtnPermissions.style.color = isPerm ? 'var(--crm-primary)' : '#64748b';
      tabBtnPermissions.style.borderBottomColor = isPerm ? 'var(--crm-primary)' : 'transparent';
    }

    if (paneAccount) paneAccount.style.display = tabName === 'account' ? 'block' : 'none';
    if (panePermissions) {
      panePermissions.style.display = tabName === 'permissions' ? 'block' : 'none';
      if (tabName === 'permissions') {
        renderPermissionsTab();
      }
    }
  };

  if (tabBtnAccount) tabBtnAccount.addEventListener('click', () => switchSettingsTab('account'));
  if (tabBtnPermissions) tabBtnPermissions.addEventListener('click', () => switchSettingsTab('permissions'));
}

/**
 * Render Current User Details into Settings Profile Card
 */
export function renderSettingsView() {
  const current = state.currentUser || { id: 'usr_admin', name: 'Super Admin', email: 'admin@goldcash.com', role: 'super_admin', status: 'active' };
  const isSuperAdmin = current.role === 'super_admin' || current.role === 'admin';
  const isSubAdmin = current.role === 'sub_admin';
  const canManagePerms = isSuperAdmin || (isSubAdmin && hasPermission('canManagePermissions', current));

  // Toggle Permissions Tab button visibility (Super Admin or authorized Sub Admin)
  const tabBtnPermissions = document.getElementById('settingsTabBtnPermissions');
  if (tabBtnPermissions) {
    tabBtnPermissions.style.display = canManagePerms ? 'flex' : 'none';
    const roleBadge = tabBtnPermissions.querySelector('.user-role-badge');
    if (roleBadge) {
      roleBadge.textContent = isSuperAdmin ? 'Super Admin' : 'Sub Admin';
      roleBadge.className = `user-role-badge ${isSuperAdmin ? 'super_admin' : 'sub_admin'}`;
    }

    if (!canManagePerms) {
      // If user lacks permission, force back to account tab
      const paneAccount = document.getElementById('settingsAccountTabPane');
      const panePermissions = document.getElementById('settingsPermissionsTabPane');
      if (paneAccount) paneAccount.style.display = 'block';
      if (panePermissions) panePermissions.style.display = 'none';
    }
  }

  // Profile Avatar
  const avatarEl = elements.settingsProfileAvatar || document.getElementById('settingsProfileAvatar');
  if (avatarEl) {
    avatarEl.textContent = getInitials(current.name);
    if (current.role === 'maker' || current.role === 'agent') {
      avatarEl.style.background = '#e0f2fe';
      avatarEl.style.color = '#0369a1';
    } else if (current.role === 'sub_admin') {
      avatarEl.style.background = '#fef3c7';
      avatarEl.style.color = '#b45309';
    } else {
      avatarEl.style.background = '#f1f5f9';
      avatarEl.style.color = '#334155';
    }
  }

  // Profile Name & Email
  const nameEl = elements.settingsProfileName || document.getElementById('settingsProfileName');
  const emailEl = elements.settingsProfileEmail || document.getElementById('settingsProfileEmail');
  const hasCustomName = current.name && current.name.trim() !== '' && current.name.toLowerCase() !== 'super admin' && !isSuperAdmin;

  if (nameEl) {
    if (hasCustomName) {
      nameEl.style.display = 'block';
      nameEl.textContent = current.name;
    } else {
      nameEl.style.display = 'none';
      nameEl.textContent = '';
    }
  }

  if (emailEl) {
    emailEl.textContent = current.email || '';
    if (!hasCustomName) {
      emailEl.style.fontSize = '14px';
      emailEl.style.fontWeight = '600';
      emailEl.style.color = 'var(--text-main)';
      emailEl.style.marginBottom = '6px';
    } else {
      emailEl.style.fontSize = '13px';
      emailEl.style.fontWeight = 'normal';
      emailEl.style.color = '#64748b';
      emailEl.style.marginBottom = '6px';
    }
  }

  // Profile Role Badge
  const roleEl = elements.settingsProfileRole || document.getElementById('settingsProfileRole');
  if (roleEl) {
    let roleText = 'MAKER';
    let roleClass = 'maker';
    if (current.role === 'super_admin' || current.role === 'admin') {
      roleText = 'SUPER ADMIN';
      roleClass = 'super_admin';
    } else if (current.role === 'sub_admin') {
      roleText = 'SUB ADMIN';
      roleClass = 'sub_admin';
    }
    roleEl.textContent = roleText;
    roleEl.className = `user-role-badge ${roleClass}`;
  }

  // Profile Status
  const statusEl = elements.settingsProfileStatus || document.getElementById('settingsProfileStatus');
  if (statusEl) {
    const isActive = current.status !== 'disabled';
    statusEl.textContent = isActive ? 'Active' : 'Disabled';
    statusEl.style.color = isActive ? '#10b981' : '#ef4444';
  }

  // Role Description
  const roleDescEl = elements.settingsProfileRoleDesc || document.getElementById('settingsProfileRoleDesc');
  if (roleDescEl) {
    if (current.role === 'super_admin' || current.role === 'admin') {
      roleDescEl.textContent = 'Super Administrator (Full System Control)';
    } else if (current.role === 'sub_admin') {
      roleDescEl.textContent = 'Sub Administrator';
    } else {
      roleDescEl.textContent = 'Maker (Lead & Chat Agent)';
    }
  }

  // Check if current user has permission to change password
  const canChangePass = hasPermission('canChangePassword', current);
  const passNotice = document.getElementById('passwordDisabledNotice');
  const passForm = elements.changePasswordForm || document.getElementById('changePasswordForm');

  if (passNotice) passNotice.style.display = canChangePass ? 'none' : 'block';
  if (passForm) {
    passForm.querySelectorAll('input, button').forEach(el => {
      el.disabled = !canChangePass;
    });
  }

  // If user has access to Permissions tab, refresh permissions view
  if (canManagePerms) {
    renderPermissionsTab();
  }
}

/**
 * Setup Show/Hide Eye toggles for password fields
 */
function setupPasswordToggleListeners() {
  const attachToggle = (btnId, inputId) => {
    const btn = document.getElementById(btnId);
    const input = document.getElementById(inputId);
    if (!btn || !input) return;

    btn.addEventListener('click', () => {
      const isPassword = input.type === 'password';
      input.type = isPassword ? 'text' : 'password';
      btn.innerHTML = isPassword ? '<i class="fa-solid fa-eye-slash"></i>' : '<i class="fa-solid fa-eye"></i>';
    });
  };

  attachToggle('toggleOldPasswordBtn', 'oldPasswordInput');
  attachToggle('toggleNewSettingsPasswordBtn', 'newSettingsPasswordInput');
  attachToggle('toggleConfirmPasswordBtn', 'confirmNewPasswordInput');
}

/**
 * Setup Password Form Submission and Validation Listeners
 */
function setupPasswordFormListeners(onUserUpdated) {
  const form = elements.changePasswordForm || document.getElementById('changePasswordForm');
  const alertBox = elements.changePasswordAlert || document.getElementById('changePasswordAlert');
  const resetBtn = elements.resetChangePasswordFormBtn || document.getElementById('resetChangePasswordFormBtn');
  const submitBtn = elements.submitChangePasswordBtn || document.getElementById('submitChangePasswordBtn');

  const oldInput = elements.oldPasswordInput || document.getElementById('oldPasswordInput');
  const newInput = elements.newSettingsPasswordInput || document.getElementById('newSettingsPasswordInput');
  const confirmInput = elements.confirmNewPasswordInput || document.getElementById('confirmNewPasswordInput');

  const clearForm = () => {
    if (oldInput) oldInput.value = '';
    if (newInput) newInput.value = '';
    if (confirmInput) confirmInput.value = '';
    if (alertBox) {
      alertBox.style.display = 'none';
      alertBox.textContent = '';
      alertBox.className = '';
    }
  };

  if (resetBtn) {
    resetBtn.addEventListener('click', clearForm);
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (isSubmittingPassword) return;

      const oldPass = oldInput ? oldInput.value.trim() : '';
      const newPass = newInput ? newInput.value.trim() : '';
      const confirmPass = confirmInput ? confirmInput.value.trim() : '';

      // 1. Mandatory Old Password Check
      if (!oldPass) {
        showAlert(alertBox, 'Current (Old) Password is required.', 'error');
        if (oldInput) oldInput.focus();
        return;
      }

      // 2. New Password Checks
      if (!newPass) {
        showAlert(alertBox, 'Please enter a new password.', 'error');
        if (newInput) newInput.focus();
        return;
      }

      if (newPass.length < 6) {
        showAlert(alertBox, 'New password must be at least 6 characters long.', 'error');
        if (newInput) newInput.focus();
        return;
      }

      // 3. Confirm Password Match Check
      if (newPass !== confirmPass) {
        showAlert(alertBox, 'New password and Confirm password do not match.', 'error');
        if (confirmInput) confirmInput.focus();
        return;
      }

      // 4. Check if new password is identical to old password
      if (oldPass === newPass) {
        showAlert(alertBox, 'New password cannot be identical to your old password.', 'warning');
        if (newInput) newInput.focus();
        return;
      }

      try {
        isSubmittingPassword = true;
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Updating...';
        }

        const updatedUser = await changeOwnPassword(oldPass, newPass);

        addAuditLog(
          'password_changed',
          '',
          updatedUser.name,
          `User ${updatedUser.name} (${(updatedUser.role || 'user').toUpperCase()}) changed their account password`
        );

        showAlert(alertBox, 'Password changed successfully!', 'success');
        showToast('Password changed successfully!', 'info');

        clearForm();

        if (onUserUpdated) onUserUpdated(updatedUser);
      } catch (err) {
        showAlert(alertBox, err.message || 'Failed to update password. Please check your old password.', 'error');
        showToast(err.message || 'Failed to update password', 'error');
      } finally {
        isSubmittingPassword = false;
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<i class="fa-solid fa-shield-check"></i> Update Password';
        }
      }
    });
  }
}

/**
 * Setup Permissions Tab Interactivity (Select All, Revoke All, Reset Defaults, Save)
 */
function setupPermissionsTabListeners(onUserUpdated) {
  const userSelect = document.getElementById('permUserSelect');
  const form = document.getElementById('userPermissionsForm');
  const btnSelectAll = document.getElementById('btnPermSelectAll');
  const btnRevokeAll = document.getElementById('btnPermRevokeAll');
  const btnResetDefault = document.getElementById('btnPermResetDefault');
  const saveBtn = document.getElementById('savePermissionsBtn');

  if (userSelect) {
    userSelect.addEventListener('change', () => {
      selectedPermUserId = userSelect.value;
      populateUserPermissionsForm();
    });
  }

  if (btnSelectAll) {
    btnSelectAll.addEventListener('click', () => {
      PERMISSION_KEYS.forEach(key => {
        const checkbox = document.getElementById(`perm_${key}`);
        if (checkbox) checkbox.checked = true;
      });
    });
  }

  if (btnRevokeAll) {
    btnRevokeAll.addEventListener('click', () => {
      PERMISSION_KEYS.forEach(key => {
        const checkbox = document.getElementById(`perm_${key}`);
        if (checkbox) checkbox.checked = false;
      });
    });
  }

  if (btnResetDefault) {
    btnResetDefault.addEventListener('click', () => {
      const targetUser = (state.teamMembers || []).find(u => u.id === selectedPermUserId);
      if (!targetUser) return;
      const role = targetUser.role || 'maker';
      const defaults = DEFAULT_PERMISSIONS[role] || DEFAULT_PERMISSIONS.maker;
      PERMISSION_KEYS.forEach(key => {
        const checkbox = document.getElementById(`perm_${key}`);
        if (checkbox) checkbox.checked = !!defaults[key];
      });
    });
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (isSavingPermissions || !selectedPermUserId) return;

      const targetUser = (state.teamMembers || []).find(u => u.id === selectedPermUserId);
      if (!targetUser) {
        showToast('Please select a valid user first', 'warning');
        return;
      }

      const newPerms = {};
      PERMISSION_KEYS.forEach(key => {
        const checkbox = document.getElementById(`perm_${key}`);
        newPerms[key] = checkbox ? checkbox.checked : false;
      });

      try {
        isSavingPermissions = true;
        if (saveBtn) {
          saveBtn.disabled = true;
          saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
        }

        const updated = await updateUserPermissions(selectedPermUserId, newPerms);

        addAuditLog(
          'permissions_updated',
          '',
          updated.name,
          `Super Admin updated permissions for ${updated.name} (${(updated.role || 'user').toUpperCase()})`
        );

        showToast(`Permissions updated for ${updated.name}!`, 'info');

        if (onUserUpdated) onUserUpdated(updated);
      } catch (err) {
        showToast(err.message || 'Could not save permissions', 'error');
      } finally {
        isSavingPermissions = false;
        if (saveBtn) {
          saveBtn.disabled = false;
          saveBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save Permissions';
        }
      }
    });
  }
}

/**
 * Render the Permissions Tab (Populates user list & current permissions)
 */
export function renderPermissionsTab() {
  const userSelect = document.getElementById('permUserSelect');
  const emptyState = document.getElementById('permNoUsersEmptyState');
  const controlsContainer = document.getElementById('permControlsContainer');
  if (!userSelect) return;

  const current = state.currentUser || { id: 'usr_admin', name: 'Super Admin', role: 'super_admin' };
  const isSuperAdmin = current.role === 'super_admin' || current.role === 'admin';
  const isSubAdmin = current.role === 'sub_admin';

  // Super Admin can manage both Sub Admins & Makers
  // Sub Admin (with canManagePermissions) can ONLY view and manage Makers (never own self or other sub admins)
  let subUsers = [];
  if (isSuperAdmin) {
    subUsers = (state.teamMembers || []).filter(u => u.role !== 'super_admin' && u.role !== 'admin');
  } else if (isSubAdmin && hasPermission('canManagePermissions', current)) {
    subUsers = (state.teamMembers || []).filter(u => (u.role === 'maker' || u.role === 'agent') && u.id !== current.id);
  }

  const userBadge = document.getElementById('permSelectedUserBadge');
  const emptyTitle = emptyState ? emptyState.querySelector('h3') : null;
  const emptyDesc = emptyState ? emptyState.querySelector('p') : null;

  if (subUsers.length === 0) {
    if (emptyState) emptyState.style.display = 'block';
    if (controlsContainer) controlsContainer.style.display = 'none';
    if (userBadge) userBadge.style.display = 'none';
    if (emptyTitle) {
      emptyTitle.textContent = isSubAdmin ? 'No Makers Created Yet' : 'No Sub-Users Created Yet';
    }
    if (emptyDesc) {
      emptyDesc.textContent = isSubAdmin 
        ? 'As a Sub Admin, you can configure permissions for Makers. Create a Maker in the Team tab to manage their access.'
        : 'Create Sub Admins or Makers in the Team Management tab to configure their permissions.';
    }
    userSelect.innerHTML = isSubAdmin ? '<option value="">No Makers available</option>' : '<option value="">No sub-users available</option>';
    userSelect.disabled = true;
    selectedPermUserId = null;
    return;
  }

  if (emptyState) emptyState.style.display = 'none';
  if (controlsContainer) controlsContainer.style.display = 'block';
  if (userBadge) userBadge.style.display = 'flex';
  userSelect.disabled = false;

  // Populate Select Options
  userSelect.innerHTML = subUsers.map(u => {
    const roleText = u.role === 'sub_admin' ? 'Sub Admin' : 'Maker';
    return `<option value="${escapeHtml(u.id)}">${escapeHtml(u.name)} (${roleText} - ${escapeHtml(u.email)})</option>`;
  }).join('');

  // Default to first user or keep currently selected if still valid in the filtered list
  if (!selectedPermUserId || !subUsers.some(u => u.id === selectedPermUserId)) {
    selectedPermUserId = subUsers[0].id;
  }
  userSelect.value = selectedPermUserId;

  populateUserPermissionsForm();
}

/**
 * Populate checkbox values for the selected user
 */
function populateUserPermissionsForm() {
  const targetUser = (state.teamMembers || []).find(u => u.id === selectedPermUserId);
  if (!targetUser) return;

  // Update User Banner Badge
  const avatarEl = document.getElementById('permUserAvatar');
  const nameEl = document.getElementById('permUserName');
  const roleBadgeEl = document.getElementById('permUserRoleBadge');

  if (avatarEl) {
    avatarEl.textContent = getInitials(targetUser.name);
    avatarEl.className = `user-avatar-initials ${targetUser.role === 'maker' ? 'agent-avatar' : ''}`;
  }

  if (nameEl) nameEl.textContent = targetUser.name || 'User';
  if (roleBadgeEl) {
    const roleText = targetUser.role === 'sub_admin' ? 'SUB ADMIN' : 'MAKER';
    roleBadgeEl.textContent = roleText;
    roleBadgeEl.className = `user-role-badge ${targetUser.role}`;
  }

  // "Can Manage Permissions" is only configurable for Sub Admins (by Super Admin)
  const manageCard = document.getElementById('permCard_canManagePermissions');
  if (manageCard) {
    manageCard.style.display = targetUser.role === 'sub_admin' ? 'flex' : 'none';
  }

  // Populate Checkboxes
  const perms = getUserPermissions(targetUser);
  PERMISSION_KEYS.forEach(key => {
    const checkbox = document.getElementById(`perm_${key}`);
    if (checkbox) {
      checkbox.checked = perms[key] === true;
    }
  });
}

function showAlert(alertBox, message, type = 'error') {
  if (!alertBox) return;

  alertBox.style.display = 'block';
  alertBox.textContent = message;

  if (type === 'error') {
    alertBox.style.background = '#fef2f2';
    alertBox.style.border = '1px solid #fecaca';
    alertBox.style.color = '#b91c1c';
  } else if (type === 'warning') {
    alertBox.style.background = '#fffbeb';
    alertBox.style.border = '1px solid #fde68a';
    alertBox.style.color = '#b45309';
  } else {
    alertBox.style.background = '#ecfdf5';
    alertBox.style.border = '1px solid #a7f3d0';
    alertBox.style.color = '#047857';
  }
}
