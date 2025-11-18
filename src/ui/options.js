document.addEventListener('DOMContentLoaded', () => {
  const focus = document.getElementById('focusMode');
  const instant = document.getElementById('instantNav');
  const handle = document.getElementById('handle');
  const apiKey = document.getElementById('apiKey');
  const apiSecret = document.getElementById('apiSecret');
  const saveApi = document.getElementById('saveApi');
  const saveStatus = document.getElementById('saveStatus');

  const getStorage = (keys, cb) => {
    if (typeof browser !== 'undefined' && browser.storage && browser.storage.local) {
      browser.storage.local.get(keys).then(cb).catch((e) => console.error(e));
    } else {
      chrome.storage.local.get(keys, cb);
    }
  };

  const setStorage = (obj, cb) => {
    if (typeof browser !== 'undefined' && browser.storage && browser.storage.local) {
      browser.storage.local.set(obj).then(() => cb && cb()).catch((e) => console.error(e));
    } else {
      chrome.storage.local.set(obj, cb);
    }
  };

  getStorage(['focusMode','cfxInstantNav', 'cfxHandle', 'cfxApiKey', 'cfxApiSecret'], (res) => {
    focus.checked = Boolean(res && res.focusMode);
    if (instant) instant.checked = res && Object.prototype.hasOwnProperty.call(res, 'cfxInstantNav') ? Boolean(res.cfxInstantNav) : true;
    if (handle) handle.value = (res && res.cfxHandle) || '';
    if (apiKey) apiKey.value = (res && res.cfxApiKey) || '';
    if (apiSecret) apiSecret.value = (res && res.cfxApiSecret) || '';
  });

  focus.addEventListener('change', () => setStorage({ focusMode: focus.checked }));
  if (instant) instant.addEventListener('change', () => setStorage({ cfxInstantNav: instant.checked }));

  if (saveApi) {
    saveApi.addEventListener('click', () => {
      const creds = {
        cfxHandle: handle.value.trim(),
        cfxApiKey: apiKey.value.trim(),
        cfxApiSecret: apiSecret.value.trim(),
      };
      setStorage(creds, () => {
        saveStatus.textContent = 'Saved!';
        setTimeout(() => {
          saveStatus.textContent = '';
        }, 2000);
      });
    });
  }
});
