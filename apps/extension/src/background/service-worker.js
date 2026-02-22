function injectContentScript(tabId) {
  chrome.scripting.executeScript({
    target: { tabId },
    files: ['content/content.bundle.js'],
  });
}

// Context menu
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'web-to-svg',
    title: 'Web to SVG',
    contexts: ['page', 'image', 'video'],
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
      if (tabs[0]?.id) {
        injectContentScript(tabs[0].id);
      }
    });
    return;
  }

  if (message.action === 'download') {
    chrome.downloads.download({
      url: message.dataUrl,
      filename: message.filename,
      saveAs: false,
    });
    return;
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
