/**
 * Firebase Connection & Real-Time Firestore Synchronization Service
 */

import { initializeFirebase, subscribeToLeads, subscribeToActivityLogs, subscribeToUsers, fetchFirstUserMessage } from '../../firebase-config.js';
import { state } from '../state/app-state.js';
import { elements } from '../dom/elements.js';
import { DEMO_LEADS } from '../constants/demo-data.js';
import { playNotificationPing, showNewLeadNotificationBanner, triggerDesktopNotification, showToast } from '../utils/notifications.js';
import { addLeadNotification, initLeadNotifications } from '../components/notifications-dropdown.js';
import { saveLogsToLocalStorage, updateLogsBadge } from './logging-service.js';
import { normalizePhone } from '../utils/formatters.js';

import { syncAllUsersToFirestore, saveTeamMembers } from './user-service.js';
import { logoutUser } from './auth-service.js';

let connectionTimeoutTimer = null;

export function updateConnectionStatus(status) {
  state.connectionStatus = status;

  if (status === 'connecting') {
    if (elements.connectionModal) elements.connectionModal.style.display = 'flex';
    if (elements.connectingState) elements.connectingState.style.display = 'flex';
    if (elements.connectionFailedState) elements.connectionFailedState.style.display = 'none';
  } else if (status === 'connected') {
    if (elements.connectionModal) elements.connectionModal.style.display = 'none';
  } else {
    // Error, disconnected, or standby failed case
    if (elements.connectionModal) elements.connectionModal.style.display = 'flex';
    if (elements.connectingState) elements.connectingState.style.display = 'none';
    if (elements.connectionFailedState) elements.connectionFailedState.style.display = 'flex';
  }
}

export function connectFirebase(renderLeadsView, renderConversationsView, renderLogsView, updateActiveChatHeader, switchView, highlightLeadCard) {
  updateConnectionStatus('connecting');

  if (connectionTimeoutTimer) {
    clearTimeout(connectionTimeoutTimer);
  }

  // 10-Second Safety Timeout: If Firebase network fails to respond within 10s, trigger error popup
  connectionTimeoutTimer = setTimeout(() => {
    if (state.connectionStatus === 'connecting') {
      console.warn("Firebase connection timed out after 10 seconds.");
      updateConnectionStatus('error');
      const errEl = document.getElementById('connectionErrorMessage');
      if (errEl) {
        errEl.textContent = "Could not reach the database. Please check your internet connection or try again.";
      }
    }
  }, 10000);

  try {
    const res = initializeFirebase();
    if (!res || !res.success) {
      if (connectionTimeoutTimer) {
        clearTimeout(connectionTimeoutTimer);
        connectionTimeoutTimer = null;
      }
      console.warn("Firebase initialization status:", res);
      if (res && res.status === 'standby') {
        updateConnectionStatus('connected');
      } else {
        updateConnectionStatus('error');
        const errEl = document.getElementById('connectionErrorMessage');
        if (errEl) {
          errEl.textContent = res?.message || "Failed to initialize connection. Please verify your settings.";
        }
      }
      return;
    }

    startRealtimeSync(renderLeadsView, renderConversationsView, renderLogsView, updateActiveChatHeader, switchView, highlightLeadCard);
  } catch (err) {
    if (connectionTimeoutTimer) {
      clearTimeout(connectionTimeoutTimer);
      connectionTimeoutTimer = null;
    }
    console.error("Firebase connection error:", err);
    updateConnectionStatus('error');
  }
}

function startRealtimeSync(renderLeadsView, renderConversationsView, renderLogsView, updateActiveChatHeader, switchView, highlightLeadCard) {
  // 1. Subscribe to Team Users collection
  if (state.unsubscribeUsers) {
    state.unsubscribeUsers();
  }
  state.unsubscribeUsers = subscribeToUsers((users) => {
    if (users && users.length > 0) {
      // Sync Firestore users with local team members state
      state.teamMembers = users;
      saveTeamMembers(users);

      // Verify currently active user has not been deleted by admin
      if (state.currentUser && !['super_admin', 'admin'].includes(state.currentUser.role)) {
        const stillExists = users.some(u => u.id === state.currentUser.id);
        if (!stillExists) {
          logoutUser(() => {
            showToast("Your account has been deleted by an administrator.", "error");
          });
        }
      }
    }
  });

  // 2. Subscribe to Activity Logs
  if (state.unsubscribeLogs) {
    state.unsubscribeLogs();
  }
  state.unsubscribeLogs = subscribeToActivityLogs((firestoreLogs) => {
    if (firestoreLogs && firestoreLogs.length > 0) {
      const mergedMap = new Map();
      (state.logs || []).forEach(l => mergedMap.set(l.id, l));
      firestoreLogs.forEach(l => mergedMap.set(l.id, l));

      const mergedList = Array.from(mergedMap.values()).sort((a, b) => {
        return new Date(b.timestamp || 0) - new Date(a.timestamp || 0);
      });

      state.logs = mergedList;
      saveLogsToLocalStorage();
      updateLogsBadge();
      if (renderLogsView) renderLogsView();
    }
  });

  // 3. Subscribe to Real-Time Leads
  if (state.unsubscribeLeads) {
    state.unsubscribeLeads();
  }

  state.unsubscribeLeads = subscribeToLeads(
    (leadsList) => {
      if (connectionTimeoutTimer) {
        clearTimeout(connectionTimeoutTimer);
        connectionTimeoutTimer = null;
      }
      updateConnectionStatus('connected');
      if (elements.leadsLoadingState) elements.leadsLoadingState.style.display = 'none';

      console.log(`📊 [CRM App] Real-time leads update received (${leadsList.length} total docs in Firestore):`, leadsList);

      const isInitial = state.isInitialLeadsLoad;
      state.isInitialLeadsLoad = false;

      if (isInitial) {
        initLeadNotifications(leadsList);
      }

      leadsList.forEach(lead => {
        const isCustomerLead = lead.isLead !== false && lead.initiatedBy !== 'crm';
        const isNewDoc = !state.knownLeadIds.has(lead.id);
        const lastMsgKey = String(lead.lastMessageAt || lead.lastMessage || lead.updatedAt || '');
        const prevMsgKey = state.knownLeadMessages ? state.knownLeadMessages.get(lead.id) : null;
        const hasNewMessage = prevMsgKey !== undefined && prevMsgKey !== null && prevMsgKey !== lastMsgKey && lastMsgKey !== '';

        if (!isInitial && (isNewDoc || hasNewMessage) && isCustomerLead) {
          console.log(`🔔 [Notification] New incoming lead / message from ${lead.name || lead.phone} (${lead.id})`);
          playNotificationPing();
          addLeadNotification(lead);
          showNewLeadNotificationBanner(lead, (targetLead) => {
            if (switchView) switchView('leads');
            if (highlightLeadCard) highlightLeadCard(targetLead.id);
          });
          triggerDesktopNotification(lead, (targetLead) => {
            if (switchView) switchView('leads');
            if (highlightLeadCard) highlightLeadCard(targetLead.id);
          });
        }

        state.knownLeadIds.add(lead.id);
        if (!state.knownLeadMessages) state.knownLeadMessages = new Map();
        state.knownLeadMessages.set(lead.id, lastMsgKey);
      });

      const deduplicatedMap = new Map();
      leadsList.forEach(lead => {
        const normP = normalizePhone(lead.phone);
        const key = normP ? `phone_${normP}` : lead.id;
        if (!deduplicatedMap.has(key)) {
          deduplicatedMap.set(key, lead);
        } else {
          // Merge lead records if same phone exists with different ID format
          const existing = deduplicatedMap.get(key);
          deduplicatedMap.set(key, { ...existing, ...lead, name: lead.name || existing.name });
        }
      });

      state.leads = Array.from(deduplicatedMap.values());
      if (renderLeadsView) renderLeadsView();
      if (renderConversationsView) renderConversationsView();

      // Asynchronously fetch initial customer message for leads from subcollection
      state.leads.forEach(async (lead) => {
        if (!lead.firstMessage && !lead._firstUserMsg) {
          const firstMsgText = await fetchFirstUserMessage(lead.id);
          if (firstMsgText) {
            lead._firstUserMsg = firstMsgText;
            if (renderLeadsView) renderLeadsView();
          }
        }
      });

      if (state.activeLeadId && updateActiveChatHeader) {
        const currentActive = state.leads.find(l => l.id === state.activeLeadId);
        if (currentActive) updateActiveChatHeader(currentActive);
      }
    },
    (err) => {
      if (connectionTimeoutTimer) {
        clearTimeout(connectionTimeoutTimer);
        connectionTimeoutTimer = null;
      }
      console.error("Leads subscription error:", err);
      if (elements.leadsLoadingState) elements.leadsLoadingState.style.display = 'none';
      updateConnectionStatus('error');
      showToast(`Database listener error: ${err.message}`, 'error');
    }
  );
}
