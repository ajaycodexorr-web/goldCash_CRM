/**
 * Centralized DOM Elements Cache
 */

export const elements = {
  // Navigation Sidebar
  navItemLeads: document.getElementById('navItemLeads'),
  navItemConversations: document.getElementById('navItemConversations'),
  navItemLogs: document.getElementById('navItemLogs'),
  navLeadsCount: document.getElementById('navLeadsCount'),
  navConversationsCount: document.getElementById('navConversationsCount'),
  navLogsCount: document.getElementById('navLogsCount'),

  // Views
  leadsViewSection: document.getElementById('leadsViewSection'),
  conversationsViewSection: document.getElementById('conversationsViewSection'),
  logsViewSection: document.getElementById('logsViewSection'),

  // Logs View Elements
  logsSearchInput: document.getElementById('logsSearchInput'),
  clearLogsBtn: document.getElementById('clearLogsBtn'),
  logsCardsList: document.getElementById('logsCardsList'),
  logsEmptyState: document.getElementById('logsEmptyState'),
  countAllLogs: document.getElementById('countAllLogs'),
  countStatusLogs: document.getElementById('countStatusLogs'),
  countDeleteLogs: document.getElementById('countDeleteLogs'),
  countMessageLogs: document.getElementById('countMessageLogs'),
  countAssigneeLogs: document.getElementById('countAssigneeLogs'),

  // Connection & Config
  connectionModal: document.getElementById('connectionModal'),
  connectingState: document.getElementById('connectingState'),
  connectionFailedState: document.getElementById('connectionFailedState'),
  popupRetryBtn: document.getElementById('popupRetryBtn'),
  configBtn: document.getElementById('configBtn'),
  configModal: document.getElementById('configModal'),
  closeModalBtn: document.getElementById('closeModalBtn'),
  firebaseConfigForm: document.getElementById('firebaseConfigForm'),
  resetConfigBtn: document.getElementById('resetConfigBtn'),

  cfgApiKey: document.getElementById('cfgApiKey'),
  cfgProjectId: document.getElementById('cfgProjectId'),
  cfgAuthDomain: document.getElementById('cfgAuthDomain'),
  cfgStorageBucket: document.getElementById('cfgStorageBucket'),
  cfgMessagingSenderId: document.getElementById('cfgMessagingSenderId'),
  cfgAppId: document.getElementById('cfgAppId'),
  cfgFunctionUrl: document.getElementById('cfgFunctionUrl'),

  // Leads View Elements
  leadsSearchInput: document.getElementById('leadsSearchInput'),
  leadsCardsList: document.getElementById('leadsCardsList'),
  leadsLoadingState: document.getElementById('leadsLoadingState'),
  leadsEmptyState: document.getElementById('leadsEmptyState'),
  countAllLeads: document.getElementById('countAllLeads'),
  countNewLeads: document.getElementById('countNewLeads'),
  countContactedLeads: document.getElementById('countContactedLeads'),
  countNoAnswerLeads: document.getElementById('countNoAnswerLeads'),
  countFollowUpLeads: document.getElementById('countFollowUpLeads'),
  countConvertedLeads: document.getElementById('countConvertedLeads'),
  countLostLeads: document.getElementById('countLostLeads'),
  countDeletedLeads: document.getElementById('countDeletedLeads'),

  // Export Modal Elements
  exportExcelBtn: document.getElementById('exportExcelBtn'),
  exportModal: document.getElementById('exportModal'),
  closeExportModalBtn: document.getElementById('closeExportModalBtn'),
  cancelExportBtn: document.getElementById('cancelExportBtn'),
  confirmDownloadExcelBtn: document.getElementById('confirmDownloadExcelBtn'),
  exportDateRangeFields: document.getElementById('exportDateRangeFields'),
  exportStartDate: document.getElementById('exportStartDate'),
  exportEndDate: document.getElementById('exportEndDate'),
  exportStatusSelect: document.getElementById('exportStatusSelect'),

  // Conversations View Elements
  convSearchInput: document.getElementById('convSearchInput'),
  conversationsList: document.getElementById('conversationsList'),
  convAllCount: document.getElementById('convAllCount'),
  convUnreadCount: document.getElementById('convUnreadCount'),
  convActiveCount: document.getElementById('convActiveCount'),

  // Active Chat Window Elements
  chatPlaceholder: document.getElementById('chatPlaceholder'),
  activeChatView: document.getElementById('activeChatView'),
  chatContactAvatar: document.getElementById('chatContactAvatar'),
  chatContactName: document.getElementById('chatContactName'),
  chatContactPhone: document.getElementById('chatContactPhone'),
  markReadBtn: document.getElementById('markReadBtn'),
  refreshChatBtn: document.getElementById('refreshChatBtn'),
  deleteLeadBtn: document.getElementById('deleteLeadBtn'),
  chatErrorBanner: document.getElementById('chatErrorBanner'),
  chatErrorMessage: document.getElementById('chatErrorMessage'),
  closeErrorBannerBtn: document.getElementById('closeErrorBannerBtn'),
  chatMessagesBody: document.getElementById('chatMessagesBody'),
  messagesStream: document.getElementById('messagesStream'),
  messagesLoading: document.getElementById('messagesLoading'),
  messagesEmptyChat: document.getElementById('messagesEmptyChat'),

  // Composer
  composerAttachmentsTray: document.getElementById('composerAttachmentsTray'),
  trayCount: document.getElementById('trayCount'),
  trayItemsList: document.getElementById('trayItemsList'),
  clearAllAttachmentsBtn: document.getElementById('clearAllAttachmentsBtn'),
  sendMessageForm: document.getElementById('sendMessageForm'),
  messageTextInput: document.getElementById('messageTextInput'),
  sendMessageBtn: document.getElementById('sendMessageBtn'),
  attachmentMenuBtn: document.getElementById('attachmentMenuBtn'),
  attachmentPopover: document.getElementById('attachmentPopover'),
  attachImageFileBtn: document.getElementById('attachImageFileBtn'),
  attachDocFileBtn: document.getElementById('attachDocFileBtn'),
  attachUrlBtn: document.getElementById('attachUrlBtn'),
  imageFileInput: document.getElementById('imageFileInput'),
  docFileInput: document.getElementById('docFileInput'),

  // Media Modal
  mediaInputModal: document.getElementById('mediaInputModal'),
  closeMediaModalBtn: document.getElementById('closeMediaModalBtn'),
  cancelMediaModalBtn: document.getElementById('cancelMediaModalBtn'),
  mediaAttachmentForm: document.getElementById('mediaAttachmentForm'),
  mediaUrlInput: document.getElementById('mediaUrlInput'),
  mediaFilenameInput: document.getElementById('mediaFilenameInput'),
  mediaFilenameGroup: document.getElementById('mediaFilenameGroup'),
  mediaCaptionInput: document.getElementById('mediaCaptionInput'),
  toggleTypeImage: document.getElementById('toggleTypeImage'),
  toggleTypeDoc: document.getElementById('toggleTypeDoc'),

  // Lightbox Modal
  imageLightboxModal: document.getElementById('imageLightboxModal'),
  lightboxCounter: document.getElementById('lightboxCounter'),
  lightboxInlineTitle: document.getElementById('lightboxInlineTitle'),
  lightboxImage: document.getElementById('lightboxImage'),
  lightboxVideo: document.getElementById('lightboxVideo'),
  lightboxCaption: document.getElementById('lightboxCaption'),
  lightboxPrevBtn: document.getElementById('lightboxPrevBtn'),
  lightboxNextBtn: document.getElementById('lightboxNextBtn'),
  lightboxCloseBtn: document.getElementById('lightboxCloseBtn'),
  lightboxDownloadBtn: document.getElementById('lightboxDownloadBtn'),
  lightboxNewTabBtn: document.getElementById('lightboxNewTabBtn'),

  // Templates & Toast
  quickTemplatesBtn: document.getElementById('quickTemplatesBtn'),
  templatesPopover: document.getElementById('templatesPopover'),
  closeTemplatesBtn: document.getElementById('closeTemplatesBtn'),
  toastContainer: document.getElementById('toastContainer'),

  // 24-Hour WhatsApp Messaging Window
  chatWindowTimerBadge: document.getElementById('chatWindowTimerBadge'),
  chatWindowTimerText: document.getElementById('chatWindowTimerText'),
  windowExpiredBanner: document.getElementById('windowExpiredBanner'),
  useTemplateWindowBtn: document.getElementById('useTemplateWindowBtn'),

  // Delete Confirmation Modal
  deleteConfirmModal: document.getElementById('deleteConfirmModal'),
  closeDeleteModalBtn: document.getElementById('closeDeleteModalBtn'),
  cancelDeleteModalBtn: document.getElementById('cancelDeleteModalBtn'),
  confirmDeleteModalBtn: document.getElementById('confirmDeleteModalBtn'),
  deleteLeadTargetName: document.getElementById('deleteLeadTargetName')
};
