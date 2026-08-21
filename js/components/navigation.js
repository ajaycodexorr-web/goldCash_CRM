/**
 * Main Application View Navigation Controller
 */

import { state } from '../state/app-state.js';
import { elements } from '../dom/elements.js';

export function setupNavigation(renderLeadsView, renderConversationsView, renderLogsView) {
  if (elements.navItemLeads) {
    elements.navItemLeads.addEventListener('click', () => switchView('leads', renderLeadsView, renderConversationsView, renderLogsView));
  }
  if (elements.navItemConversations) {
    elements.navItemConversations.addEventListener('click', () => switchView('conversations', renderLeadsView, renderConversationsView, renderLogsView));
  }
  if (elements.navItemLogs) {
    elements.navItemLogs.addEventListener('click', () => switchView('logs', renderLeadsView, renderConversationsView, renderLogsView));
  }
}

export function switchView(viewName, renderLeadsView, renderConversationsView, renderLogsView) {
  state.activeView = viewName;

  if (elements.navItemLeads) elements.navItemLeads.classList.toggle('active', viewName === 'leads');
  if (elements.navItemConversations) elements.navItemConversations.classList.toggle('active', viewName === 'conversations');
  if (elements.navItemLogs) elements.navItemLogs.classList.toggle('active', viewName === 'logs');

  if (elements.leadsViewSection) elements.leadsViewSection.style.display = viewName === 'leads' ? 'flex' : 'none';
  if (elements.conversationsViewSection) elements.conversationsViewSection.style.display = viewName === 'conversations' ? 'flex' : 'none';
  if (elements.logsViewSection) elements.logsViewSection.style.display = viewName === 'logs' ? 'flex' : 'none';

  if (viewName === 'leads' && renderLeadsView) {
    renderLeadsView();
  } else if (viewName === 'conversations' && renderConversationsView) {
    renderConversationsView();
  } else if (viewName === 'logs' && renderLogsView) {
    renderLogsView();
  }
}
