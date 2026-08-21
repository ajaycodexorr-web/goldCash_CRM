/**
 * Audio Synthesizer, Desktop Notifications & Toast Alerts
 */

import { elements } from '../dom/elements.js';
import { escapeHtml } from './formatters.js';

export function playNotificationPing() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, ctx.currentTime);
    osc1.frequency.setValueAtTime(880, ctx.currentTime + 0.1);

    gain1.gain.setValueAtTime(0.2, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);

    osc1.start();
    osc1.stop(ctx.currentTime + 0.35);
  } catch (err) {
    console.warn("Could not play audio notification ping:", err);
  }
}

export function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast-item toast-${type}`;
  toast.textContent = message;
  if (elements.toastContainer) {
    elements.toastContainer.appendChild(toast);
  }
  setTimeout(() => toast.remove(), 3500);
}

export function showNewLeadNotificationBanner(lead, onViewClick) {
  const displayName = lead.name && lead.name.trim() ? lead.name.trim() : (lead.phone || lead.id);
  const snippet = lead.lastMessage ? lead.lastMessage.substring(0, 50) : 'New customer message received';

  const banner = document.createElement('div');
  banner.className = 'new-lead-banner-notification';
  banner.innerHTML = `
    <div class="banner-icon-box"><i class="fa-solid fa-coins"></i></div>
    <div class="banner-content-box">
      <strong>🔔 New Lead Received!</strong>
      <span class="banner-lead-name">${escapeHtml(displayName)}</span>
      <span class="banner-lead-snippet">"${escapeHtml(snippet)}"</span>
    </div>
    <button class="banner-view-btn">View Lead</button>
    <button class="banner-close-btn">&times;</button>
  `;

  banner.querySelector('.banner-view-btn').addEventListener('click', () => {
    if (onViewClick) onViewClick(lead);
    banner.remove();
  });

  banner.querySelector('.banner-close-btn').addEventListener('click', () => {
    banner.remove();
  });

  if (elements.toastContainer) {
    elements.toastContainer.appendChild(banner);
  }

  setTimeout(() => {
    if (banner.parentElement) banner.remove();
  }, 8000);
}

export function triggerDesktopNotification(lead, onClick) {
  if (!("Notification" in window)) return;

  const displayName = lead.name && lead.name.trim() ? lead.name.trim() : (lead.phone || lead.id);
  const snippet = lead.lastMessage || 'New WhatsApp Lead';

  if (Notification.permission === "granted") {
    const notif = new Notification(`🔔 New Lead: ${displayName}`, {
      body: snippet,
      icon: 'goldCash-logo.svg'
    });
    notif.onclick = () => {
      window.focus();
      if (onClick) onClick(lead);
    };
  } else if (Notification.permission !== "denied") {
    Notification.requestPermission().then(permission => {
      if (permission === "granted") {
        triggerDesktopNotification(lead, onClick);
      }
    });
  }
}
