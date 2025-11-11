document.addEventListener('DOMContentLoaded', () => {
  const focus = document.getElementById('focusMode');

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

  getStorage(['focusMode'], (res) => {
    focus.checked = Boolean(res && res.focusMode);
  });

  focus.addEventListener('change', () => {
    setStorage({ focusMode: focus.checked });
  });
});
