/**
 * Team Inbox Conversations List & Active Chat Pane Controller
 */

import { subscribeToMessages, markLeadAsRead, resolveWhatsAppMediaUrl } from '../../firebase-config.js';
import { state } from '../state/app-state.js';
import { elements } from '../dom/elements.js';
import { DEMO_LEADS } from '../constants/demo-data.js';
import { escapeHtml, getInitials, formatRelativeTime, formatTimeOnly, parseDate } from '../utils/formatters.js';
import { showToast } from '../utils/notifications.js';
import { clearAllStagedAttachments, autoResizeTextarea } from './composer.js';
import { openLightbox } from './lightbox.js';
import { handleDeleteLead } from './leads-table.js';

export function setupConversationsHandlers(switchView, renderLeadsView) {
  if (elements.convSearchInput) {
    elements.convSearchInput.addEventListener('input', (e) => {
      state.convSearchQuery = e.target.value.trim().toLowerCase();
      renderConversationsView();
    });
  }

  document.querySelectorAll('.conversations-col .filter-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.conversations-col .filter-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      state.convFilter = pill.dataset.filter;
      renderConversationsView();
    });
  });

  if (elements.markReadBtn) {
    elements.markReadBtn.addEventListener('click', () => {
      if (state.activeLeadId) {
        markLeadAsRead(state.activeLeadId);
        const lead = state.leads.find(l => l.id === state.activeLeadId);
        if (lead) lead.unreadCount = 0;
        renderConversationsView();
        showToast('Marked as read', 'info');
      }
    });
  }

  if (elements.refreshChatBtn) {
    elements.refreshChatBtn.addEventListener('click', () => {
      if (state.activeLeadId) {
        loadMessagesForLead(state.activeLeadId, renderLeadsView);
        showToast('Refreshing chat...', 'info');
      }
    });
  }

  if (elements.deleteLeadBtn) {
    elements.deleteLeadBtn.addEventListener('click', () => {
      if (state.activeLeadId) {
        handleDeleteLead(state.activeLeadId);
      }
    });
  }

  if (elements.closeErrorBannerBtn) {
    elements.closeErrorBannerBtn.addEventListener('click', () => {
      if (elements.chatErrorBanner) elements.chatErrorBanner.style.display = 'none';
    });
  }

  if (elements.useTemplateWindowBtn) {
    elements.useTemplateWindowBtn.addEventListener('click', () => {
      if (elements.quickTemplatesBtn) elements.quickTemplatesBtn.click();
    });
  }
}

export function renderConversationsView() {
  const { leads, convSearchQuery, convFilter, activeLeadId, currentUser } = state;
  const isAgent = currentUser && currentUser.role === 'agent';

  // Conversations Tab shows active chats
  let activeConversations = leads.filter(lead => (lead.status || '').toLowerCase() !== 'deleted');

  // Strict Agent Filter: Agents ONLY see conversations for leads assigned to them ("Show only assign")
  if (isAgent) {
    activeConversations = activeConversations.filter(lead => lead.assigneeId === currentUser.id);

    // If active chat lead is not assigned to this agent, close active chat view
    if (activeLeadId) {
      const activeLead = leads.find(l => l.id === activeLeadId);
      if (activeLead && activeLead.assigneeId !== currentUser.id) {
        state.activeLeadId = null;
        if (elements.activeChatView) elements.activeChatView.style.display = 'none';
        if (elements.chatPlaceholder) elements.chatPlaceholder.style.display = 'flex';
      }
    }
  }

  const filtered = activeConversations.filter(lead => {
    const displayName = (lead.name || lead.phone || '').toLowerCase();
    const phone = (lead.phone || '').toLowerCase();
    const lastMsg = (lead.lastMessage || '').toLowerCase();

    const matchesSearch = !convSearchQuery ||
      displayName.includes(convSearchQuery) ||
      phone.includes(convSearchQuery) ||
      lastMsg.includes(convSearchQuery);

    const matchesFilter = convFilter === 'all' || (convFilter === 'unread' && (lead.unreadCount || 0) > 0);

    return matchesSearch && matchesFilter;
  });

  const totalCount = activeConversations.length;
  const unreadCount = activeConversations.filter(l => (l.unreadCount || 0) > 0).length;

  if (elements.convAllCount) elements.convAllCount.textContent = totalCount;
  if (elements.convUnreadCount) elements.convUnreadCount.textContent = unreadCount;
  if (elements.convActiveCount) elements.convActiveCount.textContent = `${filtered.length} conversations`;
  if (elements.navConversationsCount) elements.navConversationsCount.textContent = unreadCount || totalCount;

  if (!elements.conversationsList) return;

  if (filtered.length === 0) {
    elements.conversationsList.innerHTML = `<div style="padding: 20px; text-align: center; color: var(--text-muted);">No conversations</div>`;
    return;
  }

  elements.conversationsList.innerHTML = filtered.map(lead => {
    const isActive = lead.id === activeLeadId;
    const displayName = lead.name && lead.name.trim() ? lead.name.trim() : (lead.phone || lead.id);
    const relativeTime = formatRelativeTime(lead.lastMessageAt || lead.createdAt);
    const hasUnread = (lead.unreadCount || 0) > 0;
    const lastMsgText = lead.lastMessage || 'No messages yet';

    return `
      <div class="conv-item ${isActive ? 'active' : ''}" data-lead-id="${escapeHtml(lead.id)}">
        <div class="conv-info">
          <div class="conv-top-row">
            <span class="conv-name" title="${escapeHtml(displayName)}">${escapeHtml(displayName)}</span>
            <span class="conv-time">${relativeTime}</span>
          </div>
          <div class="conv-snippet" title="${escapeHtml(lastMsgText)}">
            ${escapeHtml(lastMsgText)}
          </div>
        </div>
        ${hasUnread ? `<span class="conv-unread-pill">${lead.unreadCount}</span>` : ''}
      </div>
    `;
  }).join('');

  elements.conversationsList.querySelectorAll('.conv-item').forEach(item => {
    item.addEventListener('click', () => {
      selectLead(item.dataset.leadId);
    });
  });
}

export function openLeadChat(leadId, switchView, renderLeadsView) {
  if (switchView) switchView('conversations');
  selectLead(leadId, renderLeadsView);
}

export function selectLead(leadId, renderLeadsView) {
  const lead = state.leads.find(l => l.id === leadId);
  if (!lead) return;

  state.activeLeadId = leadId;

  if ((lead.unreadCount || 0) > 0) {
    lead.unreadCount = 0;
    markLeadAsRead(leadId);
  }

  renderConversationsView();
  updateActiveChatHeader(lead);

  if (elements.chatPlaceholder) elements.chatPlaceholder.style.display = 'none';
  if (elements.activeChatView) elements.activeChatView.style.display = 'flex';
  if (elements.chatErrorBanner) elements.chatErrorBanner.style.display = 'none';

  clearAllStagedAttachments();

  if (state.windowTimerInterval) {
    clearInterval(state.windowTimerInterval);
  }
  update24HourWindowTimer();
  state.windowTimerInterval = setInterval(update24HourWindowTimer, 1000);

  loadMessagesForLead(leadId, renderLeadsView);

  setTimeout(() => {
    if (elements.messageTextInput && !elements.messageTextInput.disabled) {
      elements.messageTextInput.focus();
    }
  }, 100);
}

export function updateActiveChatHeader(lead) {
  const displayName = lead.name && lead.name.trim() ? lead.name.trim() : (lead.phone || lead.id);
  if (elements.chatContactName) elements.chatContactName.textContent = displayName;
  if (elements.chatContactPhone) elements.chatContactPhone.innerHTML = `<i class="fa-solid fa-phone"></i> ${escapeHtml(lead.phone || lead.id)}`;
  if (elements.chatContactAvatar) elements.chatContactAvatar.textContent = getInitials(displayName);
}

export function loadMessagesForLead(leadId, renderLeadsView) {
  if (elements.messagesLoading) elements.messagesLoading.style.display = 'flex';
  if (elements.messagesEmptyChat) elements.messagesEmptyChat.style.display = 'none';
  if (elements.messagesStream) elements.messagesStream.innerHTML = '';

  if (state.demoMode) {
    if (elements.messagesLoading) elements.messagesLoading.style.display = 'none';
    const demoLead = DEMO_LEADS.find(l => l.id === leadId);
    state.messages = demoLead ? (demoLead.messages || []) : [];
    renderMessagesStream();
    return;
  }

  if (state.unsubscribeMessages) {
    state.unsubscribeMessages();
  }

  state.unsubscribeMessages = subscribeToMessages(
    leadId,
    (messagesList) => {
      if (elements.messagesLoading) elements.messagesLoading.style.display = 'none';
      state.messages = messagesList;
      renderMessagesStream();
      update24HourWindowTimer();

      // Extract & cache the user's first incoming message for User Query column
      const activeLead = state.leads.find(l => l.id === leadId);
      if (activeLead && messagesList.length > 0) {
        const firstIncoming = messagesList.find(m => m.direction === 'incoming' || m.fromUser === true);
        if (firstIncoming) {
          const txt = firstIncoming.text || firstIncoming.caption || firstIncoming.message;
          if (txt && typeof txt === 'string' && txt.trim()) {
            activeLead._firstUserMsg = txt.trim();
            if (renderLeadsView) renderLeadsView();
          }
        }
      }
    },
    (err) => {
      console.error(`Messages fetch failed for lead ${leadId}:`, err);
      if (elements.messagesLoading) elements.messagesLoading.style.display = 'none';
      showToast(`Error loading messages: ${err.message}`, 'error');
    }
  );
}

export function renderMessagesStream() {
  const { messages } = state;

  if (!messages || messages.length === 0) {
    if (elements.messagesEmptyChat) elements.messagesEmptyChat.style.display = 'flex';
    if (elements.messagesStream) elements.messagesStream.innerHTML = '';
    return;
  }

  if (elements.messagesEmptyChat) elements.messagesEmptyChat.style.display = 'none';

  let html = '';
  let lastDateString = null;

  messages.forEach((msg, msgIndex) => {
    const msgDate = parseDate(msg.createdAt || msg.timestamp);
    const dateString = msgDate ? msgDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : null;

    if (dateString && dateString !== lastDateString) {
      html += `<div class="date-divider">${dateString}</div>`;
      lastDateString = dateString;
    }

    const isOutgoing = msg.direction === 'outgoing';
    const directionClass = isOutgoing ? 'outgoing' : 'incoming';
    const timeFormatted = formatTimeOnly(msg.createdAt || msg.timestamp);
    const status = (msg.status || (isOutgoing ? 'sent' : 'received')).toLowerCase();
    const isFailed = isOutgoing && status === 'failed';

    const normalized = normalizeMessageMedia(msg);
    const performerName = msg.performedByName || msg.assigneeName || (isOutgoing ? (msg.performedBy || 'Admin User') : 'Customer');
    const bubbleContent = renderMessageBubbleContent(normalized, msg, msgIndex);
    const isMedia = normalized.type !== 'text';

    html += `
      <div class="message-row ${directionClass}">
        <div class="message-bubble ${isMedia ? 'bubble-media' : ''} ${isFailed ? 'bubble-failed' : ''}">
          ${bubbleContent}
          <div class="message-meta">
            <span class="msg-assignee-tag" title="Assignee / Performer: ${escapeHtml(performerName)}"><i class="fa-solid fa-user-check"></i> ${escapeHtml(performerName)}</span>
            <span class="message-time">${timeFormatted}</span>
            ${getStatusIconHtml(status, isOutgoing)}
          </div>
        </div>
      </div>
    `;
  });

  if (elements.messagesStream) {
    elements.messagesStream.innerHTML = html;
    scrollChatToBottom();
    attachMessageStreamInteractions();
    resolvePendingMediaIds();
  }
}

function normalizeMessageMedia(msg) {
  let type = (msg.type || '').toLowerCase();
  let mediaUrl = msg.mediaUrl || msg.url || msg.link || '';
  let mediaId = msg.mediaId || msg.media_id || '';
  let filename = msg.filename || msg.name || '';
  let caption = msg.caption || '';
  let text = msg.text || '';

  if (msg.image && typeof msg.image === 'object') {
    if (!type || type === 'text') type = 'image';
    if (!mediaId && msg.image.id) mediaId = msg.image.id;
    if (!mediaUrl && (msg.image.url || msg.image.link)) mediaUrl = msg.image.url || msg.image.link;
    if (!caption && msg.image.caption) caption = msg.image.caption;
  }
  if (msg.document && typeof msg.document === 'object') {
    if (!type || type === 'text') type = 'document';
    if (!mediaId && msg.document.id) mediaId = msg.document.id;
    if (!mediaUrl && (msg.document.url || msg.document.link)) mediaUrl = msg.document.url || msg.document.link;
    if (!filename && msg.document.filename) filename = msg.document.filename;
    if (!caption && msg.document.caption) caption = msg.document.caption;
  }
  if (msg.video && typeof msg.video === 'object') {
    if (!type || type === 'text') type = 'video';
    if (!mediaId && msg.video.id) mediaId = msg.video.id;
    if (!mediaUrl && (msg.video.url || msg.video.link)) mediaUrl = msg.video.url || msg.video.link;
    if (!caption && msg.video.caption) caption = msg.video.caption;
  }

  if (mediaId && (!mediaUrl || mediaUrl.includes('facebook.com') || mediaUrl.includes('fbsbx.com'))) {
    mediaUrl = `https://whatsappmediaproxy-udyapyjpza-uc.a.run.app?mediaId=${encodeURIComponent(mediaId)}`;
  }

  if (isImageUrl(mediaUrl) || isImageUrl(filename)) type = 'image';
  else if (isVideoUrl(mediaUrl) || isVideoUrl(filename)) type = 'video';
  else if (isPdfUrl(mediaUrl) || isPdfUrl(filename)) type = 'document';

  return { type: type || 'text', mediaUrl, mediaId, filename, caption, text };
}

function renderMessageBubbleContent(norm, origMsg, msgIndex) {
  const { type, mediaUrl, mediaId, filename, caption, text } = norm;
  
  let captionDisplay = (caption && caption.trim() && caption !== text) ? caption.trim() : (text && text !== caption ? text.trim() : '');
  
  const genericLabels = ['photo', '📷 photo', 'image', '📷 image', 'video', '🎥 video', 'document', '📄 document', 'file'];
  if (captionDisplay && (
      genericLabels.includes(captionDisplay.toLowerCase().trim()) ||
      captionDisplay === filename || 
      captionDisplay === origMsg.filename ||
      captionDisplay === origMsg.name ||
      isImageUrl(captionDisplay) ||
      isVideoUrl(captionDisplay) ||
      isPdfUrl(captionDisplay) ||
      /\.(png|jpe?g|gif|webp|svg|mp4|pdf|mov|avi)$/i.test(captionDisplay)
  )) {
    captionDisplay = '';
  }

  const isUploading = origMsg.status === 'sending' || origMsg.isUploading === true;
  const uploadOverlayHtml = isUploading ? `
    <div class="media-upload-overlay">
      <div class="media-upload-spinner-circle">
        <i class="fa-solid fa-arrow-up-from-bracket media-upload-icon"></i>
        <div class="media-upload-spinner"></div>
      </div>
      <span class="media-upload-text">Uploading...</span>
    </div>
  ` : '';

  if (type === 'image' || (mediaUrl && isImageUrl(mediaUrl))) {
    return `
      <div class="msg-image-wrap" data-lightbox-url="${escapeHtml(mediaUrl)}">
        <img src="${escapeHtml(mediaUrl)}" alt="WhatsApp photo" loading="lazy">
        ${uploadOverlayHtml}
        ${!isUploading ? `<span class="image-zoom-badge"><i class="fa-solid fa-magnifying-glass-plus"></i> View</span>` : ''}
      </div>
      ${captionDisplay ? `<div class="msg-caption">${formatMessageTextWithLinks(captionDisplay)}</div>` : ''}
    `;
  }

  if (type === 'video' || (mediaUrl && isVideoUrl(mediaUrl))) {
    return `
      <div class="msg-video-wrap">
        <video src="${escapeHtml(mediaUrl)}" controls preload="metadata"></video>
        ${uploadOverlayHtml}
      </div>
      ${captionDisplay ? `<div class="msg-caption">${formatMessageTextWithLinks(captionDisplay)}</div>` : ''}
    `;
  }

  if (type === 'document' || (mediaUrl && isPdfUrl(mediaUrl)) || filename) {
    const docName = filename || 'Document.pdf';
    return `
      <a href="${escapeHtml(mediaUrl)}" class="msg-doc-card" target="_blank" download="${escapeHtml(docName)}">
        <i class="fa-solid fa-file-pdf"></i>
        <span>${escapeHtml(docName)}</span>
        ${uploadOverlayHtml}
      </a>
      ${captionDisplay ? `<div class="msg-caption">${formatMessageTextWithLinks(captionDisplay)}</div>` : ''}
    `;
  }

  return `<div class="message-text">${formatMessageTextWithLinks(text || '')}</div>`;
}

function isImageUrl(url) {
  if (!url) return false;
  return /\.(jpeg|jpg|gif|png|webp|svg)(\?.*)?$/i.test(url) || url.startsWith('data:image/');
}

function isVideoUrl(url) {
  if (!url) return false;
  return /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(url) || url.startsWith('data:video/');
}

function isPdfUrl(url) {
  if (!url) return false;
  return /\.pdf(\?.*)?$/i.test(url) || url.startsWith('data:application/pdf');
}

function formatMessageTextWithLinks(text) {
  if (!text) return '';
  const escaped = escapeHtml(text);
  const urlRegex = /(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/g;
  return escaped.replace(urlRegex, (url) => {
    return `<a href="${escapeHtml(url)}" class="msg-link" target="_blank" rel="noopener noreferrer">${escapeHtml(url)}</a>`;
  });
}

async function resolvePendingMediaIds() {
  if (!elements.messagesStream) return;
  const pendingNodes = elements.messagesStream.querySelectorAll('[data-media-id]:not([data-resolved="true"])');
  pendingNodes.forEach(async (el) => {
    const mediaId = el.dataset.mediaId;
    if (!mediaId) return;
    el.setAttribute('data-resolved', 'true');
    try {
      const resolvedUrl = await resolveWhatsAppMediaUrl(mediaId);
      if (resolvedUrl) {
        if (el.tagName === 'IMG') {
          el.src = resolvedUrl;
          const parentWrap = el.closest('.msg-image-wrap');
          if (parentWrap) parentWrap.dataset.lightboxUrl = resolvedUrl;
        } else if (el.tagName === 'VIDEO') {
          el.src = resolvedUrl;
        } else if (el.tagName === 'A') {
          el.href = resolvedUrl;
        }
      }
    } catch (err) {
      console.warn(`Media ID resolution failed for ${mediaId}:`, err);
    }
  });
}

function attachMessageStreamInteractions() {
  if (!elements.messagesStream) return;
  elements.messagesStream.querySelectorAll('.msg-image-wrap').forEach(wrap => {
    wrap.addEventListener('click', () => {
      const url = wrap.dataset.lightboxUrl;
      if (url) openLightbox([{ url, caption: '', name: 'Image' }], 0);
    });
  });
}

function scrollChatToBottom() {
  if (!elements.chatMessagesBody) return;
  setTimeout(() => {
    elements.chatMessagesBody.scrollTo({
      top: elements.chatMessagesBody.scrollHeight,
      behavior: 'smooth'
    });
  }, 50);
}

function getStatusIconHtml(status, isOutgoing) {
  if (!isOutgoing) return '';
  if (status === 'read') return `<i class="fa-solid fa-check-double" style="color:#53bdeb"></i>`;
  if (status === 'delivered') return `<i class="fa-solid fa-check-double" style="color:#8696a0"></i>`;
  return `<i class="fa-solid fa-check" style="color:#8696a0"></i>`;
}

export function update24HourWindowTimer() {
  if (!elements.chatWindowTimerBadge || !elements.chatWindowTimerText) return;

  if (!state.activeLeadId) {
    elements.chatWindowTimerBadge.style.display = 'none';
    return;
  }

  elements.chatWindowTimerBadge.style.display = 'inline-flex';
  const lead = state.leads.find(l => l.id === state.activeLeadId);
  if (!lead) return;

  let lastCustomerTime = null;

  if (lead.lastCustomerMessageAt) {
    lastCustomerTime = getComparableTime(lead.lastCustomerMessageAt);
  } else if (lead.lastIncomingTimestamp) {
    lastCustomerTime = getComparableTime(lead.lastIncomingTimestamp);
  }

  if (!lastCustomerTime && Array.isArray(state.messages) && state.messages.length > 0) {
    const incomingMsgs = state.messages.filter(m => m.direction === 'incoming' || m.fromUser === true);
    if (incomingMsgs.length > 0) {
      const latestIncoming = incomingMsgs[incomingMsgs.length - 1];
      lastCustomerTime = getComparableTime(latestIncoming.createdAt || latestIncoming.timestamp);
    }
  }

  if (!lastCustomerTime && (lead.lastMessageDirection === 'incoming' || !lead.hasAdminReplied || lead.isLead === true)) {
    lastCustomerTime = getComparableTime(lead.lastMessageAt || lead.createdAt);
  }

  const badge = elements.chatWindowTimerBadge;
  const textEl = elements.chatWindowTimerText;
  const expiredBanner = elements.windowExpiredBanner;
  const messageInput = elements.messageTextInput;
  const sendBtn = elements.sendMessageBtn;
  const attachmentBtn = elements.attachmentMenuBtn;

  const WINDOW_DURATION_MS = 24 * 60 * 60 * 1000;
  const expiryTime = (lastCustomerTime || Date.now()) + WINDOW_DURATION_MS;
  const now = Date.now();
  const diffMs = expiryTime - now;

  if (diffMs > 0) {
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);

    const formattedTime = `Window closes in ${hours}h ${String(minutes).padStart(2, '0')}m`;
    textEl.textContent = formattedTime;

    if (hours < 4) {
      badge.className = 'window-timer-badge urgent-red';
      badge.title = `Urgent: 24-Hour window closes in ${hours}h ${minutes}m ${seconds}s`;
    } else if (hours < 12) {
      badge.className = 'window-timer-badge warning-amber';
      badge.title = `Warning: 24-Hour window closes in ${hours}h ${minutes}m ${seconds}s`;
    } else {
      badge.className = 'window-timer-badge active-green';
      badge.title = `24-Hour Window Active (${hours}h ${minutes}m remaining)`;
    }

    if (expiredBanner) expiredBanner.style.display = 'none';
    if (messageInput) {
      messageInput.disabled = false;
      messageInput.placeholder = "Type a WhatsApp message... (Enter to send, Shift+Enter for newline)";
    }
    if (sendBtn) sendBtn.disabled = false;
    if (attachmentBtn) attachmentBtn.disabled = false;
  } else {
    badge.className = 'window-timer-badge expired';
    textEl.textContent = 'Window Closed';
    badge.title = '24-Hour Messaging Window Expired. Only Template Messages can be sent.';

    if (expiredBanner) expiredBanner.style.display = 'flex';
    if (messageInput) {
      messageInput.value = '';
      messageInput.disabled = true;
      messageInput.placeholder = "🔒 24-Hour Window Closed. Click Quick Templates to send a template message.";
    }
    if (sendBtn) sendBtn.disabled = true;
    if (attachmentBtn) attachmentBtn.disabled = true;
  }
}

function getComparableTime(val) {
  if (!val) return null;
  const d = parseDate(val);
  return d ? d.getTime() : null;
}
