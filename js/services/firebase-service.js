/**
 * Firebase Connection & Real-Time Firestore Synchronization Service
 */

import { initializeFirebase, subscribeToLeads, subscribeToActivityLogs, fetchFirstUserMessage } from '../../firebase-config.js';
import { state } from '../state/app-state.js';
import { elements } from '../dom/elements.js';
import { DEMO_LEADS } from '../constants/demo-data.js';
import { playNotificationPing, showNewLeadNotificationBanner, triggerDesktopNotification, showToast } from '../utils/notifications.js';
import { saveLogsToLocalStorage, updateLogsBadge } from './logging-service.js';

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
    }
  }, 10000);

  try {
    const result = initializeFirebase();

    if (result.success) {
      state.demoMode = false;
      startLeadsListener(renderLeadsView, renderConversationsView, updateActiveChatHeader, switchView, highlightLeadCard);
      startLogsListener(renderLogsView);
    } else {
      if (connectionTimeoutTimer) clearTimeout(connectionTimeoutTimer);
      updateConnectionStatus('error');
      state.demoMode = true;
      state.leads = [...DEMO_LEADS];
      if (renderLeadsView) renderLeadsView();
      if (renderConversationsView) renderConversationsView();
    }
  } catch (err) {
    if (connectionTimeoutTimer) clearTimeout(connectionTimeoutTimer);
    updateConnectionStatus('error');
  }
}

export function startLogsListener(renderLogsView) {
  if (state.unsubscribeLogs) {
    state.unsubscribeLogs();
  }

  state.unsubscribeLogs = subscribeToActivityLogs(
    (logsList) => {
      console.log(`📋 [CRM App] Real-time activity_logs update received (${logsList.length} total entries):`, logsList);
      state.logs = logsList;
      saveLogsToLocalStorage();
      updateLogsBadge();
      if (state.activeView === 'logs' && renderLogsView) {
        renderLogsView();
      }
    },
    (err) => {
      console.warn("Real-time activity_logs listener warning:", err);
    }
  );
}

export function startLeadsListener(renderLeadsView, renderConversationsView, updateActiveChatHeader, switchView, highlightLeadCard) {
  if (elements.leadsLoadingState) elements.leadsLoadingState.style.display = 'flex';

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

      leadsList.forEach(lead => {
        const isCustomerLead = lead.isLead !== false && lead.initiatedBy !== 'crm';
        const isNewDoc = !state.knownLeadIds.has(lead.id);

        if (!isInitial && isNewDoc && isCustomerLead) {
          console.log(`🔔 [Notification] New incoming lead detected from ${lead.name || lead.phone} (${lead.id})`);
          playNotificationPing();
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
      });

      state.leads = leadsList;
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
      showToast(`Firestore listener error: ${err.message}`, 'error');
    }
  );
}
