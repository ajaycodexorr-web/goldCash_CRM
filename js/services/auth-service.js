/**
 * Authentication & Session Management Service
 */

import { state } from '../state/app-state.js';
import { elements } from '../dom/elements.js';
import { loadTeamMembers, saveTeamMembers, syncUsersFromFirestore } from './user-service.js';
import { showToast } from '../utils/notifications.js';
import { addAuditLog } from './logging-service.js';

const SESSION_KEY = 'crm_auth_session_v1';

export function getAuthSession() {
  try {
    const sessionSaved = sessionStorage.getItem(SESSION_KEY);
    if (sessionSaved) return JSON.parse(sessionSaved);
    const localSaved = localStorage.getItem(SESSION_KEY);
    return localSaved ? JSON.parse(localSaved) : null;
  } catch (e) {
    return null;
  }
}

export function saveAuthSession(user) {
  try {
    const sessionData = {
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      loggedInAt: new Date().toISOString()
    };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
    sessionStorage.setItem('crm_current_user_id', user.id);
    localStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
    localStorage.setItem('crm_current_user_id', user.id);
  } catch (e) {}
}

export function clearAuthSession() {
  try {
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem('crm_current_user_id');
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem('crm_current_user_id');
  } catch (e) {}
}

export async function loginUser(email, password) {
  loadTeamMembers();
  try {
    await syncUsersFromFirestore();
  } catch (err) {}

  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanPass = (password || '').trim();

  if (!cleanEmail || !cleanPass) {
    throw new Error('Please enter both Email and Password');
  }

  const user = state.teamMembers.find(u => (u.email || '').trim().toLowerCase() === cleanEmail);

  if (!user) {
    throw new Error('Invalid Email or Password');
  }

  const storedPass = (user.password || '').trim();
  if (storedPass && storedPass !== cleanPass && storedPass.toLowerCase() !== cleanPass.toLowerCase()) {
    throw new Error('Invalid Email or Password');
  }

  if (user.status === 'disabled') {
    throw new Error('Your account has been disabled by Admin. Please contact support.');
  }

  // Authentication Success
  state.currentUser = user;
  saveAuthSession(user);
  addAuditLog('user_login', '', user.name, `User ${user.name} logged into CRM as ${(user.role || 'user').toUpperCase()}`);

  return user;
}

export function logoutUser(onLoggedOut) {
  if (state.currentUser) {
    addAuditLog('user_logout', '', state.currentUser.name, `User ${state.currentUser.name} logged out`);
  }

  clearAuthSession();
  state.currentUser = null;

  // Show Auth Overlay & Hide Main CRM App
  const authOverlay = document.getElementById('authOverlay');
  const mainApp = document.querySelector('.app-container');

  if (authOverlay) authOverlay.style.display = 'flex';
  if (mainApp) mainApp.style.display = 'none';

  showToast('Logged out successfully', 'info');

  if (onLoggedOut) onLoggedOut();
}

export function initAuthCheck(onAuthenticated) {
  loadTeamMembers();
  const session = getAuthSession();

  const authOverlay = document.getElementById('authOverlay');
  const mainApp = document.querySelector('.app-container');

  if (session && session.userId) {
    const user = state.teamMembers.find(u => u.id === session.userId);
    if (user && user.status !== 'disabled') {
      state.currentUser = user;
      if (authOverlay) authOverlay.style.display = 'none';
      if (mainApp) mainApp.style.display = 'flex';
      if (onAuthenticated) onAuthenticated(user);
      return true;
    }
  }

  // Not authenticated or disabled -> Show Login Screen
  clearAuthSession();
  if (authOverlay) authOverlay.style.display = 'flex';
  if (mainApp) mainApp.style.display = 'none';
  return false;
}

export function checkUserDisabledAndEnforceLogout() {
  const session = getAuthSession();
  if (!state.currentUser && !session) return false;

  const currentId = state.currentUser ? state.currentUser.id : (session ? session.userId : '');
  const currentEmail = state.currentUser ? state.currentUser.email : (session ? session.email : '');

  let membersList = state.teamMembers || [];
  try {
    const saved = localStorage.getItem('crm_team_members_v1');
    if (saved) {
      membersList = JSON.parse(saved);
    }
  } catch (e) {}

  const latest = membersList.find(u =>
    (currentId && u.id === currentId) ||
    (currentEmail && u.email && u.email.toLowerCase() === currentEmail.toLowerCase())
  );

  const isDisabled = (latest && latest.status === 'disabled') || (state.currentUser && state.currentUser.status === 'disabled');

  if (isDisabled) {
    logoutUser(() => {
      showToast("Your account has been disabled by Admin.", "error");
    });
    return true;
  }
  return false;
}
