/**
 * Sub-Users & Team Management Service
 */

import { state } from '../state/app-state.js';
import { saveUserToFirestore, updateUserStatusInFirestore, deleteUserFromFirestore, fetchUsersFromFirestore } from '../../firebase-config.js';

export const DEFAULT_PERMISSIONS = {
  super_admin: {
    canAddLead: true,
    canDeleteLead: true,
    canSendMessage: true,
    canAddNote: true,
    canExportExcel: true,
    canAssignLead: true,
    canViewLogs: true,
    canViewTeams: true,
    canChangePassword: true,
    canManagePermissions: true
  },
  sub_admin: {
    canAddLead: true,
    canDeleteLead: true,
    canSendMessage: true,
    canAddNote: true,
    canExportExcel: true,
    canAssignLead: true,
    canViewLogs: true,
    canViewTeams: true,
    canChangePassword: true,
    canManagePermissions: true
  },
  maker: {
    canAddLead: true,
    canDeleteLead: false,
    canSendMessage: true,
    canAddNote: true,
    canExportExcel: false,
    canAssignLead: false,
    canViewLogs: false,
    canViewTeams: false,
    canChangePassword: true,
    canManagePermissions: false
  }
};

export const DEFAULT_TEAM_MEMBERS = [
  {
    id: "usr_admin",
    name: "Super Admin",
    email: "admin@goldcash.com",
    password: "admin123",
    role: "super_admin",
    status: "active",
    permissions: { ...DEFAULT_PERMISSIONS.super_admin },
    createdAt: new Date().toISOString()
  },
  {
    id: "usr_subadmin_demo",
    name: "Sub Admin Demo",
    email: "subadmin@goldcash.com",
    password: "123",
    role: "sub_admin",
    status: "active",
    permissions: { ...DEFAULT_PERMISSIONS.sub_admin },
    createdAt: new Date().toISOString()
  },
  {
    id: "usr_maker_demo",
    name: "Maker Demo",
    email: "maker@goldcash.com",
    password: "123",
    role: "maker",
    status: "active",
    permissions: { ...DEFAULT_PERMISSIONS.maker },
    createdAt: new Date().toISOString()
  }
];

/**
 * Get effective permissions for a user (falls back to role defaults)
 */
export function getUserPermissions(user) {
  if (!user) return { ...DEFAULT_PERMISSIONS.maker };
  const role = user.role || 'maker';
  const roleDefaults = DEFAULT_PERMISSIONS[role] || DEFAULT_PERMISSIONS.maker;
  return {
    ...roleDefaults,
    ...(user.permissions || {})
  };
}

/**
 * Check if the active user (or specified user) has a given permission
 * Super Admin ALWAYS has all permissions (full access).
 */
export function hasPermission(permissionKey, user = state.currentUser) {
  if (!user) return false;
  if (user.role === 'super_admin' || user.role === 'admin') {
    return true; // Super Admin has unrestricted full control
  }
  const perms = getUserPermissions(user);
  return perms[permissionKey] === true;
}

/**
 * Update permissions for a specific user (Super Admin only action)
 */
export async function updateUserPermissions(userId, newPermissions) {
  const performerRole = state.currentUser ? state.currentUser.role : 'super_admin';
  const isSuperAdmin = performerRole === 'super_admin' || performerRole === 'admin';
  const isSubAdmin = performerRole === 'sub_admin';
  const canManage = isSuperAdmin || (isSubAdmin && hasPermission('canManagePermissions'));

  if (!canManage) {
    throw new Error('Permission denied: You do not have permission to modify user permissions.');
  }

  const user = state.teamMembers.find(u => u.id === userId);
  if (!user) {
    throw new Error('User not found.');
  }

  if (user.role === 'super_admin' || user.role === 'admin') {
    throw new Error('Super Admin permissions cannot be modified.');
  }

  if (isSubAdmin && user.role !== 'maker' && user.role !== 'agent') {
    throw new Error('Permission denied: Sub Admins can only configure permissions for Makers.');
  }

  user.permissions = {
    ...getUserPermissions(user),
    ...newPermissions
  };

  saveTeamMembers();

  if (!state.demoMode) {
    try {
      await saveUserToFirestore(user);
      console.log(`🛡️ [Permissions] Updated permissions for user [${userId}] in Firestore`);
    } catch (err) {
      console.warn('Firestore user permissions save warning:', err);
    }
  }

  return user;
}

export function loadTeamMembers() {
  try {
    const saved = localStorage.getItem('crm_team_members_v1');
    if (saved) {
      const parsed = JSON.parse(saved);
      // Filter out legacy dummy agents if present
      const cleaned = parsed.filter(u => u.id === 'usr_admin' || !['usr_priya', 'usr_rahul'].includes(u.id));
      
      // If only Super Admin exists, include default Sub Admin & Maker for testing
      const hasSubUsers = cleaned.some(u => u.role !== 'super_admin' && u.role !== 'admin');
      const baseList = hasSubUsers ? cleaned : [...cleaned, ...DEFAULT_TEAM_MEMBERS.filter(d => d.id !== 'usr_admin')];

      state.teamMembers = baseList.map(user => {
        const def = DEFAULT_TEAM_MEMBERS.find(d => d.id === user.id || d.email === user.email);
        if (def && !user.password) user.password = def.password;
        // Migrate legacy admin role for admin@goldcash.com to super_admin
        if (user.email === 'admin@goldcash.com' || user.id === 'usr_admin') {
          user.role = 'super_admin';
          if (user.name === 'Admin User') user.name = 'Super Admin';
        }
        // Migrate legacy role strings
        if (user.role === 'admin') user.role = 'super_admin';
        if (user.role === 'agent') user.role = 'maker';
        return user;
      });
      saveTeamMembers();
    } else {
      state.teamMembers = [...DEFAULT_TEAM_MEMBERS];
      saveTeamMembers();
    }
  } catch (e) {
    state.teamMembers = [...DEFAULT_TEAM_MEMBERS];
  }

  // Ensure default currentUser is set
  const savedCurrentId = localStorage.getItem('crm_current_user_id');
  if (savedCurrentId) {
    const found = state.teamMembers.find(u => u.id === savedCurrentId);
    if (found) state.currentUser = found;
  }
  if (!state.currentUser) {
    state.currentUser = state.teamMembers[0] || DEFAULT_TEAM_MEMBERS[0];
  }

  // Asynchronously sync users from Firestore if connected
  syncUsersFromFirestore();
}

export async function syncUsersFromFirestore() {
  if (state.demoMode) return;
  try {
    const fUsers = await fetchUsersFromFirestore();
    if (fUsers && Array.isArray(fUsers) && fUsers.length > 0) {
      const hasAdmin = fUsers.some(u => u.id === 'usr_admin' || u.email === 'admin@goldcash.com');
      const baseList = hasAdmin ? fUsers : [...DEFAULT_TEAM_MEMBERS, ...fUsers];

      state.teamMembers = baseList.map(fUser => {
        const existing = state.teamMembers.find(m => m.id === fUser.id);
        return {
          ...fUser,
          password: fUser.password || (existing ? existing.password : '123')
        };
      });
      saveTeamMembers();
    }
  } catch (err) {
    console.warn("Firestore users sync warning:", err);
  }
}

export function saveTeamMembers() {
  try {
    localStorage.setItem('crm_team_members_v1', JSON.stringify(state.teamMembers));
  } catch (e) {}
}

export function switchActiveUser(userId) {
  const user = state.teamMembers.find(u => u.id === userId);
  if (!user) return;

  state.currentUser = user;
  try {
    localStorage.setItem('crm_current_user_id', user.id);
  } catch (e) {}
}

export async function syncAllUsersToFirestore() {
  // Only seed default admin if firestore is completely empty
  if (state.demoMode) return;
  try {
    const existing = await fetchUsersFromFirestore();
    if (!existing || existing.length === 0) {
      for (const user of DEFAULT_TEAM_MEMBERS) {
        await saveUserToFirestore(user);
      }
    }
  } catch (err) {
    console.warn("Seeding default admin error:", err);
  }
}

export function addSubUser(name, email, password = '123', role = 'maker') {
  const performerRole = state.currentUser ? state.currentUser.role : 'super_admin';

  // Permission Check: Sub Admin can only create Maker; Super Admin can create Sub Admin or Maker
  let validRole = role;
  if (performerRole === 'sub_admin' && role !== 'maker') {
    validRole = 'maker';
  }

  const newUser = {
    id: 'usr_' + Date.now(),
    name: name.trim(),
    email: email.trim().toLowerCase(),
    password: password.trim() || '123',
    role: validRole,
    status: 'active',
    permissions: { ...(DEFAULT_PERMISSIONS[validRole] || DEFAULT_PERMISSIONS.maker) },
    createdAt: new Date().toISOString()
  };

  state.teamMembers.push(newUser);
  saveTeamMembers();

  saveUserToFirestore(newUser).catch(err => {
    console.warn('Firestore user save warning:', err);
  });

  return newUser;
}

export async function deleteSubUser(userId) {
  const userIndex = state.teamMembers.findIndex(u => u.id === userId);
  if (userIndex === -1) return null;

  const deletedUser = state.teamMembers[userIndex];
  const performerRole = state.currentUser ? state.currentUser.role : 'super_admin';

  // Security check: Super Admin cannot be deleted by anyone
  if (deletedUser.role === 'super_admin' || deletedUser.role === 'admin') return null;

  // Sub Admin cannot delete another Sub Admin
  if (performerRole === 'sub_admin' && deletedUser.role === 'sub_admin') return null;

  // Maker cannot delete anyone
  if (performerRole === 'maker') return null;

  state.teamMembers.splice(userIndex, 1);
  saveTeamMembers();

  if (!state.demoMode) {
    try {
      await deleteUserFromFirestore(userId);
      console.log(`✅ [User Service] User ${userId} successfully deleted from Firestore`);
    } catch (err) {
      console.error('❌ [User Service] Firestore user delete failed:', err);
      // Rollback local deletion if Firestore database rejected the operation
      state.teamMembers.splice(userIndex, 0, deletedUser);
      saveTeamMembers();
      throw err;
    }
  }

  return deletedUser;
}

export function toggleUserStatus(userId) {
  const user = state.teamMembers.find(u => u.id === userId);
  if (!user) return;

  const performerRole = state.currentUser ? state.currentUser.role : 'super_admin';

  // Security check: Super Admin status cannot be toggled
  if (user.role === 'super_admin' || user.role === 'admin') return;

  // Sub Admin cannot toggle another Sub Admin
  if (performerRole === 'sub_admin' && user.role === 'sub_admin') return;

  // Maker cannot toggle status
  if (performerRole === 'maker') return;

  user.status = user.status === 'active' ? 'disabled' : 'active';
  saveTeamMembers();

  if (!state.demoMode) {
    updateUserStatusInFirestore(userId, user.status).catch(() => {});
  }
}

/**
 * Change the password of the currently logged-in user (Requires mandatory Old Password verification)
 * Available to ALL roles: Super Admin, Sub Admin, Maker
 */
export async function changeOwnPassword(oldPassword, newPassword) {
  if (!state.currentUser) {
    throw new Error('No user is currently logged in.');
  }

  const cleanOld = (oldPassword || '').trim();
  const cleanNew = (newPassword || '').trim();

  if (!cleanOld) {
    throw new Error('Current (Old) Password is mandatory.');
  }

  if (!cleanNew) {
    throw new Error('New Password cannot be empty.');
  }

  if (cleanNew.length < 6) {
    throw new Error('New Password must be at least 6 characters long.');
  }

  const currentStoredPass = (state.currentUser.password || '').trim();
  if (currentStoredPass !== cleanOld) {
    throw new Error('Incorrect Current (Old) Password. Please try again.');
  }

  if (cleanOld === cleanNew) {
    throw new Error('New Password must be different from your Current Password.');
  }

  // Update in state
  state.currentUser.password = cleanNew;

  // Update in team members array
  const memberIdx = state.teamMembers.findIndex(u => u.id === state.currentUser.id || (u.email && state.currentUser.email && u.email.toLowerCase() === state.currentUser.email.toLowerCase()));
  if (memberIdx !== -1) {
    state.teamMembers[memberIdx].password = cleanNew;
  }

  saveTeamMembers();

  // Sync to Firestore
  if (!state.demoMode) {
    try {
      await saveUserToFirestore(state.currentUser);
    } catch (err) {
      console.warn('Firestore user password sync warning:', err);
    }
  }

  return state.currentUser;
}

/**
 * Reset a user's password directly (Restricted strictly to Super Admin only)
 * Super Admin can reset password of Sub Admin or Maker without needing their old password.
 */
export function resetUserPassword(userId, newPassword) {
  const user = state.teamMembers.find(u => u.id === userId);
  if (!user) return null;

  const performerRole = state.currentUser ? state.currentUser.role : 'super_admin';
  const isSuperAdmin = performerRole === 'super_admin' || performerRole === 'admin';

  // Strict Rule: ONLY Super Admin can reset passwords of other team members
  if (!isSuperAdmin) {
    console.warn('Permission denied: Only Super Admin can reset passwords of sub admin or maker.');
    return null;
  }

  user.password = newPassword.trim();
  saveTeamMembers();

  if (!state.demoMode) {
    saveUserToFirestore(user).catch(err => {
      console.warn('Firestore user password update warning:', err);
    });
  }

  return user;
}
