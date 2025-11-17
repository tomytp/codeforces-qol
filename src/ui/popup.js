document.addEventListener('DOMContentLoaded', () => {
  const focus = document.getElementById('focusMode');
  const instant = document.getElementById('instantNav');
  const hideInfo = document.getElementById('hideTestCaseInfo');

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

  getStorage(['focusMode', 'cfxInstantNav', 'cfxHideTestCaseInfo'], (res) => {
    focus.checked = Boolean(res && res.focusMode);
    if (instant) instant.checked = res && Object.prototype.hasOwnProperty.call(res, 'cfxInstantNav') ? Boolean(res.cfxInstantNav) : true;
    if (hideInfo) hideInfo.checked = Boolean(res && res.cfxHideTestCaseInfo);
  });

  focus.addEventListener('change', () => {
    setStorage({ focusMode: focus.checked });
  });

  if (instant) {
    instant.addEventListener('change', () => {
      setStorage({ cfxInstantNav: instant.checked });
    });
  }

  if (hideInfo) {
    hideInfo.addEventListener('change', () => {
      setStorage({ cfxHideTestCaseInfo: hideInfo.checked });
    });
  }
});
