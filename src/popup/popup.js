const startBtn = document.getElementById('start-btn');
const filenameInput = document.getElementById('filename-pattern');
const scaleRadios = document.querySelectorAll('input[name="png-scale"]');
const outlineCheckbox = document.getElementById('outline-text');
const bgCheckbox = document.getElementById('capture-background');
const figmaCheckbox = document.getElementById('optimize-figma');

// Load saved settings
chrome.storage.sync.get({ filenamePattern: '{tagName}-{width}x{height}', pngScale: 2, outlineText: true, captureBackground: true, optimizeForFigma: false }, (data) => {
  filenameInput.value = data.filenamePattern;
  outlineCheckbox.checked = data.outlineText;
  bgCheckbox.checked = data.captureBackground;
  figmaCheckbox.checked = data.optimizeForFigma;
  scaleRadios.forEach((r) => {
    r.checked = Number(r.value) === data.pngScale;
  });
});

// Save settings on change
filenameInput.addEventListener('input', () => {
  chrome.storage.sync.set({ filenamePattern: filenameInput.value });
});

outlineCheckbox.addEventListener('change', () => {
  chrome.storage.sync.set({ outlineText: outlineCheckbox.checked });
});

bgCheckbox.addEventListener('change', () => {
  chrome.storage.sync.set({ captureBackground: bgCheckbox.checked });
});

figmaCheckbox.addEventListener('change', () => {
  chrome.storage.sync.set({ optimizeForFigma: figmaCheckbox.checked });
});

scaleRadios.forEach((r) => {
  r.addEventListener('change', () => {
    chrome.storage.sync.set({ pngScale: Number(r.value) });
  });
});

// Start picker
startBtn.addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: 'start-picker' });
  window.close();
});
