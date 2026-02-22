/**
 * Platform adapters abstract Chrome extension APIs so the engine
 * can run in both extension and regular web contexts.
 *
 * @typedef {Object} PlatformAdapter
 * @property {(url: string) => Promise<string>} fetchAsDataUrl
 * @property {(defaults: Object) => Promise<Object>} getSettings
 * @property {(settings: Object) => void} setSettings
 * @property {(dataUrl: string, filename: string) => void} download
 */

export function createChromeAdapter() {
  return {
    async fetchAsDataUrl(url) {
      try {
        const dataUrl = await chrome.runtime.sendMessage({ action: 'fetch-image', url });
        if (dataUrl && !dataUrl.error) return dataUrl;
      } catch {
        // Extension context may be invalidated, fall through
      }
      // Fallback: direct fetch (works for same-origin or CORS-enabled resources)
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`Fetch failed: ${resp.status} ${resp.statusText}`);
      const blob = await resp.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    },

    getSettings(defaults) {
      return new Promise((resolve, reject) => {
        chrome.storage.sync.get(defaults, (result) => {
          if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
          else resolve(result);
        });
      });
    },

    setSettings(partial) {
      chrome.storage.sync.set(partial);
    },

    download(dataUrl, filename) {
      chrome.runtime.sendMessage({ action: 'download', dataUrl, filename });
    },
  };
}

export function createWebAdapter() {
  return {
    async fetchAsDataUrl(url) {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`Fetch failed: ${resp.status} ${resp.statusText}`);
      const blob = await resp.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    },

    getSettings(defaults) {
      try {
        const stored = JSON.parse(localStorage.getItem('web-to-svg-settings') || '{}');
        return Promise.resolve({ ...defaults, ...stored });
      } catch {
        return Promise.resolve({ ...defaults });
      }
    },

    setSettings(partial) {
      try {
        const existing = JSON.parse(localStorage.getItem('web-to-svg-settings') || '{}');
        localStorage.setItem('web-to-svg-settings', JSON.stringify({ ...existing, ...partial }));
      } catch { /* ignore */ }
    },

    download(dataUrl, filename) {
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
    },
  };
}
