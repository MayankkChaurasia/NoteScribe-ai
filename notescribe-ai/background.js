/**
 * background.js (Service Worker — MV3)
 *
 * Responsibilities:
 *  - Handle tab audio capture (tabCapture API)
 *  - Keep service worker alive during recording sessions
 *  - Store session metadata between popup open/close
 */

// ── Tab Capture ──────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'captureTab') {
    // Get the currently active tab
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      if (!tabs || !tabs.length) {
        sendResponse({ error: 'No active tab found' });
        return;
      }

      const tabId = tabs[0].id;

      try {
        // tabCapture.getMediaStreamId is available in MV3
        chrome.tabCapture.getMediaStreamId({ targetTabId: tabId }, (streamId) => {
          if (chrome.runtime.lastError) {
            sendResponse({ error: chrome.runtime.lastError.message });
            return;
          }
          sendResponse({ streamId });
        });
      } catch (err) {
        sendResponse({ error: err.message });
      }
    });

    // Return true to keep message channel open for async response
    return true;
  }

  // ── Ping to keep service worker alive ──
  if (message.action === 'ping') {
    sendResponse({ alive: true });
    return true;
  }

  // ── Save session from popup before it closes ──
  if (message.action === 'saveSessionData') {
    chrome.storage.session.set({ pendingSession: message.data }, () => {
      sendResponse({ saved: true });
    });
    return true;
  }

  // ── Retrieve pending session ──
  if (message.action === 'getPendingSession') {
    chrome.storage.session.get('pendingSession', (result) => {
      sendResponse({ session: result.pendingSession || null });
    });
    return true;
  }
});

// ── Install handler ──────────────────────────────────────
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('[NoteScribe AI] Extension installed successfully.');
    // Set default settings on first install
    chrome.storage.local.set({
      sessions: [],
      settings: {
        audioSource: 'mic',
        engine:      'browser',
        apiKey:      '',
      }
    });
  }
});

// ── Periodically keep SW alive during recording ──────────
// The popup sends pings; here we ensure timers can run
let keepAliveInterval = null;

chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'keepAlive') {
    keepAliveInterval = setInterval(() => {
      port.postMessage({ type: 'heartbeat' });
    }, 20000);

    port.onDisconnect.addListener(() => {
      clearInterval(keepAliveInterval);
      keepAliveInterval = null;
    });
  }
});
