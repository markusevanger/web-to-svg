const startBtn = document.getElementById('start-btn');

startBtn.addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: 'start-picker' }).then((response) => {
    if (response?.error) {
      startBtn.textContent = 'Failed — try again';
      setTimeout(() => window.close(), 1500);
    } else {
      window.close();
    }
  }).catch(() => {
    startBtn.textContent = 'Failed — try again';
    setTimeout(() => window.close(), 1500);
  });
});
