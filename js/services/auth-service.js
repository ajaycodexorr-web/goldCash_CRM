/**
 * Authentication & Session Management Service
 */

import { state } from '../state/app-state.js';
import { elements } from '../dom/elements.js';
import { loadTeamMembers, saveTeamMembers, syncUsersFromFirestore, syncRolesFromFirestore } from './user-service.js';
import { showToast } from '../utils/notifications.js';
import { addAuditLog } from './logging-service.js';
import { initializeFirebase, firebaseSignInWithEmail, firebaseCreateAuthUser, firebaseSignOutUser, onFirebaseAuthStateChanged, getCurrentAuthUser, saveUserToFirestore } from '../../firebase-config.js';

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

  // 2. Check local/Firestore team member profile
  let user = state.teamMembers.find(u => (u.email || '').trim().toLowerCase() === cleanEmail);

  // If user authenticated via Firebase but doesn't exist in teamMembers list, auto-create profile
  if (firebaseAuthSuccess && !user) {
    user = {
      id: 'usr_' + Date.now(),
      name: cleanEmail.split('@')[0],
      email: cleanEmail,
      role: cleanEmail.includes('admin') ? 'super_admin' : 'maker',
      status: 'active'
    };
    state.teamMembers.push(user);
    saveTeamMembers();
  }

  // Fallback verification if not registered in Firebase Auth yet (during migration / bootstrap)
  if (!firebaseAuthSuccess) {
    if (!user) {
      if (cleanEmail === 'admin@goldcash.com' && cleanPass === 'admin123') {
        try {
          await firebaseCreateAuthUser(cleanEmail, cleanPass);
          firebaseAuthSuccess = true;
          user = {
            id: 'usr_admin',
            name: 'Super Admin',
            email: cleanEmail,
            role: 'super_admin',
            status: 'active'
          };
          state.teamMembers.push(user);
          saveTeamMembers();
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
    } else {
      const storedPass = (user.password || '').trim();
      const isPassValid = !storedPass || storedPass === cleanPass || storedPass.toLowerCase() === cleanPass.toLowerCase();

      if (!isPassValid) {
        throw new Error('Invalid Email or Password');
      }

      // Auto-register into Firebase Auth if password matched locally
      try {
        await firebaseCreateAuthUser(cleanEmail, cleanPass);
        console.log(`✅ [Firebase Auth] Auto-registered ${cleanEmail} into Firebase Auth`);
        firebaseAuthSuccess = true;
      } catch (createErr) {
        if (createErr.code === 'auth/email-already-in-use') {
          throw new Error('Invalid Password for Firebase Account');
        }
      }
    }
  }

  if (user && user.status === 'disabled') {
    throw new Error('Your account has been disabled by Admin. Please contact support.');
  }

  // 3. Now that Firebase Auth is authenticated, save user document under Firebase UID and sync roles & users from Firestore
  try {
    const authUser = getCurrentAuthUser();
    if (authUser && user) {
      user.firebaseUid = authUser.uid;
      await saveUserToFirestore({
        ...user,
        id: authUser.uid,
        email: cleanEmail,
        role: user.role || (cleanEmail.includes('admin') ? 'super_admin' : 'maker'),
        status: user.status || 'active'
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
  onFirebaseAuthStateChanged((fbUser) => {
    if (fbUser && fbUser.email) {
      const email = fbUser.email.toLowerCase();
      let user = state.teamMembers.find(u => (u.email && u.email.toLowerCase() === email));
      if (!user) {
        user = {
          id: fbUser.uid || ('usr_' + Date.now()),
          name: email.split('@')[0],
          email: email,
          role: email.includes('admin') ? 'super_admin' : 'maker',
          status: 'active'
        };
        state.teamMembers.push(user);
        saveTeamMembers();
      }

      if (user.status !== 'disabled') {
        state.currentUser = user;
        saveAuthSession(user);
        document.documentElement.className = 'is-authenticated';
        saveUserToFirestore({
          ...user,
          id: fbUser.uid,
          email: email,
          role: user.role || (email.includes('admin') ? 'super_admin' : 'maker'),
          status: user.status || 'active'
        }).catch(() => {});
        if (onAuthenticated) onAuthenticated(user);
        return;
      }
    }

    // Unauthenticated or disabled user -> enforce login screen
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
