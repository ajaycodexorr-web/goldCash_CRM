/**
 * Main Application Orchestrator & Initialization Controller
 */

import { updateLeadStatus, getSavedConfig, saveConfig } from '../firebase-config.js';
import { state } from './state/app-state.js';
import { elements } from './dom/elements.js';
import { showToast } from './utils/notifications.js';
import { setupExportHandlers } from './utils/export-excel.js';
import { loadSavedLogs } from './services/logging-service.js';
import { loadTeamMembers } from './services/user-service.js';
import { connectFirebase } from './services/firebase-service.js';
import { setupNavigation, switchView } from './components/navigation.js';
import { setupLeadsHandlers, renderLeadsView, highlightLeadCard } from './components/leads-table.js';
import { setupConversationsHandlers, renderConversationsView, openLeadChat, renderMessagesStream, updateActiveChatHeader } from './components/chat-inbox.js';
import { setupComposerHandlers } from './components/composer.js';
import { setupLightboxHandlers } from './components/lightbox.js';
import { setupLogsHandlers, renderLogsView } from './components/logs-table.js';
import { setupUserSwitcher } from './components/user-switcher.js';
import { setupTeamManagement } from './components/team-management.js';
import { initAuthCheck } from './services/auth-service.js';
import { setupLoginView } from './components/login-view.js';

// Application Initialization Bootstrapper
document.addEventListener('DOMContentLoaded', () => {
  loadSavedLogs();
  loadTeamMembers();

  const handleSwitchView = (v) => switchView(v, handleRenderLeads, renderConversationsView, renderLogsView);
  const handleOpenLeadChat = (id) => openLeadChat(id, handleSwitchView, handleRenderLeads);
  const handleRenderLeads = () => renderLeadsView(renderConversationsView, handleOpenLeadChat);

  // Setup Login Page & Authentication Check
  setupLoginView((user) => {
    setupUserSwitcher(() => {
      handleRenderLeads();
      renderConversationsView();
      renderLogsView();
    });
    handleRenderLeads();
    renderConversationsView();
    renderLogsView();
  });

  const isAuthenticated = initAuthCheck((user) => {
    handleRenderLeads();
    renderConversationsView();
    renderLogsView();
  });

  // Setup UI Component Event Handlers
  setupUserSwitcher(() => {
    handleRenderLeads();
    renderConversationsView();
    renderLogsView();
  });
  setupTeamManagement(() => {
    setupUserSwitcher(() => {
      handleRenderLeads();
      renderConversationsView();
      renderLogsView();
    });
    handleRenderLeads();
  });
  setupNavigation(handleRenderLeads, renderConversationsView, renderLogsView);
  setupLeadsHandlers(renderConversationsView, handleOpenLeadChat);
  setupConversationsHandlers(handleSwitchView, handleRenderLeads);
  setupComposerHandlers(handleRenderLeads, renderConversationsView, renderMessagesStream, updateLeadStatus);
  setupLightboxHandlers();
  setupLogsHandlers();
  setupExportHandlers();
  setupConfigModalHandlers(handleRenderLeads, handleSwitchView);

  // Initialize Firebase Connection
  connectFirebase(
    handleRenderLeads,
    renderConversationsView,
    renderLogsView,
    updateActiveChatHeader,
    handleSwitchView,
    highlightLeadCard
  );
});

function setupConfigModalHandlers(handleRenderLeads, handleSwitchView) {
  if (elements.popupRetryBtn) {
    elements.popupRetryBtn.addEventListener('click', () => {
      showToast('Attempting to reconnect to Firebase...', 'info');
      connectFirebase(
        handleRenderLeads,
        renderConversationsView,
        renderLogsView,
        updateActiveChatHeader,
        handleSwitchView,
        highlightLeadCard
      );
    });
  }

  if (elements.configBtn) {
    elements.configBtn.addEventListener('click', () => {
      populateConfigForm();
      if (elements.configModal) elements.configModal.style.display = 'flex';
    });
  }

  if (elements.closeModalBtn) {
    elements.closeModalBtn.addEventListener('click', () => {
      if (elements.configModal) elements.configModal.style.display = 'none';
    });
  }

  if (elements.resetConfigBtn) {
    elements.resetConfigBtn.addEventListener('click', () => {
      localStorage.removeItem('wa_crm_firebase_config_v1');
      populateConfigForm();
      showToast('Reset to defaults', 'info');
    });
  }

  if (elements.firebaseConfigForm) {
    elements.firebaseConfigForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const config = {
        apiKey: elements.cfgApiKey ? elements.cfgApiKey.value.trim() : '',
        projectId: elements.cfgProjectId ? elements.cfgProjectId.value.trim() : 'gold-cash-whatsapp',
        authDomain: elements.cfgAuthDomain ? elements.cfgAuthDomain.value.trim() : 'gold-cash-whatsapp.firebaseapp.com',
        storageBucket: elements.cfgStorageBucket ? elements.cfgStorageBucket.value.trim() : 'gold-cash-whatsapp.appspot.com',
        messagingSenderId: elements.cfgMessagingSenderId ? elements.cfgMessagingSenderId.value.trim() : '',
        appId: elements.cfgAppId ? elements.cfgAppId.value.trim() : '',
        functionUrl: elements.cfgFunctionUrl ? elements.cfgFunctionUrl.value.trim() : 'sendWhatsAppMessage'
      };

      saveConfig(config);
      if (elements.configModal) elements.configModal.style.display = 'none';
      showToast('Firebase configuration saved. Connecting...', 'info');
      connectFirebase(
        handleRenderLeads,
        renderConversationsView,
        renderLogsView,
        updateActiveChatHeader,
        handleSwitchView,
        highlightLeadCard
      );
    });
  }
}

function populateConfigForm() {
  const cfg = getSavedConfig();
  if (elements.cfgApiKey) elements.cfgApiKey.value = cfg.apiKey || '';
  if (elements.cfgProjectId) elements.cfgProjectId.value = cfg.projectId || 'gold-cash-whatsapp';
  if (elements.cfgAuthDomain) elements.cfgAuthDomain.value = cfg.authDomain || 'gold-cash-whatsapp.firebaseapp.com';
  if (elements.cfgStorageBucket) elements.cfgStorageBucket.value = cfg.storageBucket || 'gold-cash-whatsapp.appspot.com';
  if (elements.cfgMessagingSenderId) elements.cfgMessagingSenderId.value = cfg.messagingSenderId || '';
  if (elements.cfgAppId) elements.cfgAppId.value = cfg.appId || '';
  if (elements.cfgFunctionUrl) elements.cfgFunctionUrl.value = cfg.functionUrl || 'sendWhatsAppMessage';
}
