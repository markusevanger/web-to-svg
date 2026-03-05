function injectContentScript(tabId) {
  chrome.scripting.executeScript({
    target: { tabId },
    files: ['content/content.bundle.js'],
  }).catch((err) => {
    console.warn('[Web to SVG] Could not inject content script:', err.message);
  });
}

// Context menu
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'web-to-svg',
    title: 'Web to SVG',
    contexts: ['page', 'image', 'video'],
  }, () => {
    if (chrome.runtime.lastError) {
      // Duplicate ID on extension update — safe to ignore
      console.debug('[Web to SVG] Context menu:', chrome.runtime.lastError.message);
    }
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'web-to-svg' && tab?.id) {
    injectContentScript(tab.id);
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'start-picker') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (chrome.runtime.lastError) {
        console.warn('[Web to SVG] Tab query failed:', chrome.runtime.lastError.message);
        sendResponse?.({ error: chrome.runtime.lastError.message });
        return;
      }
      if (tabs[0]?.id) {
        injectContentScript(tabs[0].id);
        sendResponse?.({ ok: true });
      } else {
        sendResponse?.({ error: 'No active tab found' });
      }
    });
    return true;
  }

  if (message.action === 'download') {
    chrome.downloads.download({
      url: message.dataUrl,
      filename: message.filename,
      saveAs: false,
    }, (downloadId) => {
      if (chrome.runtime.lastError) {
        console.warn('[Web to SVG] Download failed:', chrome.runtime.lastError.message);
        sendResponse?.({ error: chrome.runtime.lastError.message });
      } else {
        sendResponse?.({ ok: true, downloadId });
      }
    });
    return true;
  }

  if (message.action === 'fetch-image') {
    // Fetch cross-origin images from the service worker context
    // which isn't subject to page-level CORS restrictions
    const MAX_RESPONSE_SIZE = 50 * 1024 * 1024; // 50 MB
    const BLOCKED_SCHEMES = /^(file|chrome|chrome-extension|about|javascript):/i;

    (async () => {
      try {
        const url = message.url;
        if (BLOCKED_SCHEMES.test(url)) {
          sendResponse({ error: 'Blocked URL scheme' });
          return;
        }

        const resp = await fetch(url, { signal: AbortSignal.timeout(30_000) });

        const contentLength = parseInt(resp.headers.get('Content-Length'), 10);
        if (contentLength > MAX_RESPONSE_SIZE) {
          sendResponse({ error: 'Response too large' });
          return;
        }

        const blob = await resp.blob();
        if (blob.size > MAX_RESPONSE_SIZE) {
          sendResponse({ error: 'Response too large' });
          return;
        }

        const reader = new FileReader();
        const dataUrl = await new Promise((resolve, reject) => {
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        sendResponse(dataUrl);
      } catch (err) {
        sendResponse({ error: err.message });
      }
    })();
    return true; // keep message channel open for async response
  }
});
