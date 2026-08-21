/**
 * Sub-Users & Team Management Service
 */

import { state } from '../state/app-state.js';
import { saveUserToFirestore, updateUserStatusInFirestore, deleteUserFromFirestore } from '../../firebase-config.js';

export const DEFAULT_TEAM_MEMBERS = [
  {
    id: "usr_admin",
    name: "Admin User",
    email: "admin@goldcash.com",
    password: "admin123",
    role: "admin",
    status: "active",
    createdAt: new Date().toISOString()
  }
];

export function loadTeamMembers() {
  try {
    const saved = localStorage.getItem('crm_team_members_v1');
    if (saved) {
      const parsed = JSON.parse(saved);
      // Filter out legacy dummy agents if present
      const cleaned = parsed.filter(u => u.id === 'usr_admin' || !['usr_priya', 'usr_rahul'].includes(u.id));
      state.teamMembers = cleaned.map(user => {
        const def = DEFAULT_TEAM_MEMBERS.find(d => d.id === user.id || d.email === user.email);
        if (def && !user.password) user.password = def.password;
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

export function addSubUser(name, email, password = '123', role = 'agent') {
  const newUser = {
    id: 'usr_' + Date.now(),
    name: name.trim(),
    email: email.trim().toLowerCase(),
    password: password.trim() || '123',
    role: role,
    status: 'active',
    createdAt: new Date().toISOString()
  };

  state.teamMembers.push(newUser);
  saveTeamMembers();

  if (!state.demoMode) {
    saveUserToFirestore(newUser).catch(err => {
      console.warn('Firestore user save warning:', err);
    });
  }

  return newUser;
}

export function deleteSubUser(userId) {
  const userIndex = state.teamMembers.findIndex(u => u.id === userId);
  if (userIndex === -1) return null;

  const deletedUser = state.teamMembers[userIndex];
  if (deletedUser.role === 'admin') return null;

  state.teamMembers.splice(userIndex, 1);
  saveTeamMembers();

  if (!state.demoMode) {
    deleteUserFromFirestore(userId).catch(err => {
      console.warn('Firestore user delete warning:', err);
    });
  }

  return deletedUser;
}

export function toggleUserStatus(userId) {
  const user = state.teamMembers.find(u => u.id === userId);
  if (!user || user.role === 'admin') return;

  user.status = user.status === 'active' ? 'disabled' : 'active';
  saveTeamMembers();

  if (!state.demoMode) {
    updateUserStatusInFirestore(userId, user.status).catch(() => {});
  }
}
