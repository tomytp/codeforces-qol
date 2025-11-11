document.addEventListener('DOMContentLoaded', async () => {
  const focus = document.getElementById('focusMode');
  const { focusMode } = await chrome.storage.local.get(['focusMode']);
  focus.checked = Boolean(focusMode);
  focus.addEventListener('change', () => {
    chrome.storage.local.set({ focusMode: focus.checked });
  });
});

