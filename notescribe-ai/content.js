/**
 * content.js
 * Content script injected into all pages.
 *
 * Responsibilities:
 *  - Detect meeting platforms (Zoom, Meet, Teams, etc.) and surface a hint
 *  - Listen for keyboard shortcuts
 *  - Communicate page context back to popup
 */

(function () {
  'use strict';

  // ── Meeting platform detection ──────────────────────────
  const MEETING_SIGNALS = [
    { host: 'meet.google.com',          name: 'Google Meet' },
    { host: 'zoom.us',                   name: 'Zoom' },
    { host: 'teams.microsoft.com',       name: 'Microsoft Teams' },
    { host: 'app.gather.town',           name: 'Gather' },
    { host: 'whereby.com',               name: 'Whereby' },
    { host: 'webex.com',                 name: 'Webex' },
    { host: 'bluejeans.com',             name: 'BlueJeans' },
  ];

  const currentHost = window.location.hostname;
  const detectedPlatform = MEETING_SIGNALS.find(p => currentHost.includes(p.host));

  // Notify background/popup of detected platform
  if (detectedPlatform) {
    chrome.runtime.sendMessage({
      action:   'platformDetected',
      platform: detectedPlatform.name,
      url:      window.location.href,
    }).catch(() => {}); // Ignore if popup not open
  }

  // ── Listen for messages from popup ──────────────────────
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'getPageInfo') {
      sendResponse({
        title:    document.title,
        url:      window.location.href,
        platform: detectedPlatform?.name || null,
      });
      return true;
    }
  });

  // ── Keyboard shortcut: Alt+Shift+R to toggle recording ──
  document.addEventListener('keydown', (e) => {
    if (e.altKey && e.shiftKey && e.key === 'R') {
      chrome.runtime.sendMessage({ action: 'toggleRecordingShortcut' }).catch(() => {});
    }
  });

})();
