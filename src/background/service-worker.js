function injectContentScript(tabId) {
  chrome.scripting.executeScript({
    target: { tabId },
    files: ['content/content.bundle.js'],
  });
}

// Context menu
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'element-to-svg',
    title: 'Element to SVG',
    contexts: ['page', 'image', 'video'],
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'element-to-svg' && tab?.id) {
    injectContentScript(tab.id);
  }
});

chrome.commands.onCommand.addListener((command, tab) => {
  if (command === 'toggle-picker' && tab?.id) {
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
    (async () => {
      try {
        const resp = await fetch(message.url);
        const blob = await resp.blob();
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
