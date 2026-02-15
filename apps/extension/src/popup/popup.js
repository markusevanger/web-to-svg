const startBtn = document.getElementById('start-btn');

startBtn.addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: 'start-picker' });
  window.close();
});
