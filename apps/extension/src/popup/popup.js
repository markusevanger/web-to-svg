const startBtn = document.getElementById('start-btn');

startBtn.addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: 'start-picker' }).catch(() => {
    // Service worker may not be ready — close anyway
  }).finally(() => {
    window.close();
  });
});
