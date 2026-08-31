/**
 * Main Application View Navigation Controller
 */

import { state } from '../state/app-state.js';
import { elements } from '../dom/elements.js';
import { hasPermission } from '../services/user-service.js';

export function setupNavigation(renderLeadsView, renderConversationsView, renderLogsView, renderTeamList, renderSettingsView) {
  if (elements.navItemLeads) {
    elements.navItemLeads.addEventListener('click', () => switchView('leads', renderLeadsView, renderConversationsView, renderLogsView, renderTeamList, renderSettingsView));
  }
  if (elements.navItemConversations) {
    elements.navItemConversations.addEventListener('click', () => switchView('conversations', renderLeadsView, renderConversationsView, renderLogsView, renderTeamList, renderSettingsView));
  }
  if (elements.navItemLogs) {
    elements.navItemLogs.addEventListener('click', () => switchView('logs', renderLeadsView, renderConversationsView, renderLogsView, renderTeamList, renderSettingsView));
  }
  if (elements.navItemTeam) {
    elements.navItemTeam.addEventListener('click', () => switchView('team', renderLeadsView, renderConversationsView, renderLogsView, renderTeamList, renderSettingsView));
  }
  if (elements.navItemSettings) {
    elements.navItemSettings.addEventListener('click', () => switchView('settings', renderLeadsView, renderConversationsView, renderLogsView, renderTeamList, renderSettingsView));
  }
}

export function switchView(viewName, renderLeadsView, renderConversationsView, renderLogsView, renderTeamList, renderSettingsView) {
  let targetView = viewName;
  if (targetView === 'logs' && !hasPermission('canViewLogs')) {
    targetView = 'leads';
  }
  if (targetView === 'team' && !hasPermission('canViewTeams')) {
    targetView = 'leads';
  }

  state.activeView = targetView;

  if (elements.navItemLeads) elements.navItemLeads.classList.toggle('active', targetView === 'leads');
  if (elements.navItemConversations) elements.navItemConversations.classList.toggle('active', targetView === 'conversations');
  if (elements.navItemLogs) elements.navItemLogs.classList.toggle('active', targetView === 'logs');
  if (elements.navItemTeam) elements.navItemTeam.classList.toggle('active', targetView === 'team');
  if (elements.navItemSettings) elements.navItemSettings.classList.toggle('active', targetView === 'settings');

  if (elements.leadsViewSection) elements.leadsViewSection.style.display = targetView === 'leads' ? 'flex' : 'none';
  if (elements.conversationsViewSection) elements.conversationsViewSection.style.display = targetView === 'conversations' ? 'flex' : 'none';
  if (elements.logsViewSection) elements.logsViewSection.style.display = targetView === 'logs' ? 'flex' : 'none';
  if (elements.teamViewSection) elements.teamViewSection.style.display = targetView === 'team' ? 'flex' : 'none';
  if (elements.settingsViewSection) elements.settingsViewSection.style.display = targetView === 'settings' ? 'flex' : 'none';

  if (targetView === 'leads' && renderLeadsView) {
    renderLeadsView();
  } else if (targetView === 'conversations' && renderConversationsView) {
    renderConversationsView();
  } else if (targetView === 'logs' && renderLogsView) {
    renderLogsView();
  } else if (targetView === 'team' && renderTeamList) {
    renderTeamList();
  } else if (targetView === 'settings' && renderSettingsView) {
    renderSettingsView();
  }
}
