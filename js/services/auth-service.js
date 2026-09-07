/**
 * Authentication & Session Management Service
 */

import { state } from '../state/app-state.js';
import { elements } from '../dom/elements.js';
import { loadTeamMembers, saveTeamMembers, syncUsersFromFirestore, syncRolesFromFirestore } from './user-service.js';
import { showToast } from '../utils/notifications.js';
import { addAuditLog } from './logging-service.js';
import { initializeFirebase, firebaseSignInWithEmail, firebaseCreateAuthUser, firebaseSignOutUser, onFirebaseAuthStateChanged, getCurrentAuthUser, saveUserToFirestore, fetchUsersFromFirestore } from '../../firebase-config.js';

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
  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanPass = (password || '').trim();

  if (!cleanEmail || !cleanPass) {
    throw new Error('Please enter both Email and Password');
  }

  try {
    initializeFirebase();
  } catch (e) {}

  loadTeamMembers();

  // 1. Attempt Native Firebase Authentication FIRST
  let firebaseAuthSuccess = false;
  let authError = null;

  try {
    const cred = await firebaseSignInWithEmail(cleanEmail, cleanPass);
    if (cred && cred.user) {
      firebaseAuthSuccess = true;
    }
  } catch (fbErr) {
    authError = fbErr;
    console.warn("Firebase Native Auth attempt:", fbErr.code || fbErr.message);
  }

  // Fallback bootstrap for root admin if not registered yet in Firebase Auth
  if (!firebaseAuthSuccess) {
    if (cleanEmail === 'admin@goldcash.com' && cleanPass === 'admin123') {
      try {
        await firebaseCreateAuthUser(cleanEmail, cleanPass);
        firebaseAuthSuccess = true;
      } catch (createErr) {
        if (createErr.code === 'auth/email-already-in-use') {
          throw new Error('Invalid Password for Firebase Account');
        }
        throw createErr;
      }
    } else {
      const msg = authError?.code === 'auth/invalid-credential' || authError?.code === 'auth/wrong-password' || authError?.code === 'auth/user-not-found'
        ? 'Invalid Email or Password'
        : (authError?.message || 'Invalid Email or Password');
      throw new Error(msg);
    }
  }

  // 2. Fetch latest team members from Firestore to verify user is active and has not been deleted
  let membersList = state.teamMembers || [];
  try {
    const fUsers = await fetchUsersFromFirestore();
    if (fUsers && fUsers.length > 0) {
      membersList = fUsers;
      state.teamMembers = fUsers;
      saveTeamMembers();
    }
  } catch (e) {}

  let user = membersList.find(u => (u.email || '').trim().toLowerCase() === cleanEmail);

  // 3. For sub-users (non-root admin), if deleted from Firestore / Team, BLOCK LOGIN immediately
  if (cleanEmail !== 'admin@goldcash.com') {
    if (!user) {
      // User was deleted by admin! Sign out from Firebase Auth and reject
      await firebaseSignOutUser();
      throw new Error('Your account has been deleted by Admin. Please contact support.');
    }

    if (user.status === 'disabled') {
      await firebaseSignOutUser();
      throw new Error('Your account has been disabled by Admin. Please contact support.');
    }
  } else {
    // Root Super Admin profile
    if (!user) {
      user = {
        id: 'usr_admin',
        name: 'Super Admin',
        email: cleanEmail,
        role: 'super_admin',
        status: 'active'
      };
      state.teamMembers.push(user);
      saveTeamMembers();
    }
  }

  // 4. Save Super Admin doc under Firebase UID and sync roles/users
  try {
    const authUser = getCurrentAuthUser();
    if (authUser && user && cleanEmail === 'admin@goldcash.com') {
      user.firebaseUid = authUser.uid;
      await saveUserToFirestore({
        ...user,
        id: authUser.uid,
        email: cleanEmail,
        role: 'super_admin',
        status: 'active'
      });
    }
    await syncRolesFromFirestore();
    await syncUsersFromFirestore();
  } catch (err) {
    console.warn("Post-login Firestore sync note:", err);
  }

  // Authentication Success
  state.currentUser = user;
  saveAuthSession(user);
  document.documentElement.className = 'is-authenticated';
  addAuditLog('user_login', '', user.name, `User ${user.name} logged into CRM as ${(user.role || 'user').toUpperCase()}`);

  return user;
}

export function logoutUser(onLoggedOut) {
  if (state.currentUser) {
    addAuditLog('user_logout', '', state.currentUser.name, `User ${state.currentUser.name} logged out`);
  }

  firebaseSignOutUser();
  clearAuthSession();
  state.currentUser = null;
  document.documentElement.className = 'is-unauthenticated';

  showToast('Logged out successfully', 'info');

  if (onLoggedOut) onLoggedOut();
}

export function initAuthCheck(onAuthenticated) {
  try {
    initializeFirebase();
  } catch (e) {}

  loadTeamMembers();

  // Listen to Firebase Auth state
  onFirebaseAuthStateChanged(async (fbUser) => {
    if (fbUser && fbUser.email) {
      const email = fbUser.email.toLowerCase();

      // If not primary super admin, verify user exists in Firestore team members list and is active
      if (email !== 'admin@goldcash.com') {
        let membersList = state.teamMembers || [];
        try {
          const fUsers = await fetchUsersFromFirestore();
          if (fUsers && fUsers.length > 0) {
            membersList = fUsers;
            state.teamMembers = fUsers;
            saveTeamMembers();
          }
        } catch (e) {}

        const user = membersList.find(u => (u.email && u.email.toLowerCase() === email) || u.id === fbUser.uid);

        if (!user || user.status === 'disabled') {
          // Account was deleted or disabled by Admin -> terminate session immediately
          await firebaseSignOutUser();
          clearAuthSession();
          state.currentUser = null;
          document.documentElement.className = 'is-unauthenticated';
          return;
        }

        state.currentUser = user;
        saveAuthSession(user);
        document.documentElement.className = 'is-authenticated';
        if (onAuthenticated) onAuthenticated(user);
        return;
      }

      // Root Super Admin
      let user = state.teamMembers.find(u => (u.email && u.email.toLowerCase() === email));
      if (!user) {
        user = {
          id: fbUser.uid || 'usr_admin',
          name: 'Super Admin',
          email: email,
          role: 'super_admin',
          status: 'active'
        };
        state.teamMembers.push(user);
        saveTeamMembers();
      }

      state.currentUser = user;
      saveAuthSession(user);
      document.documentElement.className = 'is-authenticated';
      saveUserToFirestore({
        ...user,
        id: fbUser.uid,
        email: email,
        role: 'super_admin',
        status: 'active'
      }).catch(() => {});
      if (onAuthenticated) onAuthenticated(user);
      return;
    }

    // Unauthenticated user -> enforce login screen
    clearAuthSession();
    state.currentUser = null;
    document.documentElement.className = 'is-unauthenticated';
  });
}

export function checkUserDisabledAndEnforceLogout() {
  const session = getAuthSession();
  if (!state.currentUser && !session) return false;

  const currentId = state.currentUser ? state.currentUser.id : (session ? session.userId : '');
  const currentEmail = state.currentUser ? state.currentUser.email : (session ? session.email : '');

  let membersList = state.teamMembers || [];
  try {
    const saved = localStorage.getItem('crm_team_members_v3');
    if (saved) {
      membersList = JSON.parse(saved);
    }
  } catch (e) {}

  const latest = membersList.find(u =>
    (currentId && u.id === currentId) ||
    (currentEmail && u.email && u.email.toLowerCase() === currentEmail.toLowerCase())
  );

  const isDeletedOrMissing = !latest && currentEmail && currentEmail !== 'admin@goldcash.com';
  const isDisabled = isDeletedOrMissing || (latest && latest.status === 'disabled') || (state.currentUser && state.currentUser.status === 'disabled');

  if (isDisabled) {
    logoutUser(() => {
      showToast(isDeletedOrMissing ? "Your account has been removed by Admin." : "Your account has been disabled by Admin.", "error");
    });
    return true;
  }
  return false;
}
