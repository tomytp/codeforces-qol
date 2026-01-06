/**
 * Codeforces QoL - Options Script
 * Handles options page UI for extension settings.
 */
document.addEventListener('DOMContentLoaded', () => {
  'use strict';

  const focusCheckbox = document.getElementById('focusMode');
  const instantNavCheckbox = document.getElementById('instantNav');
  const hideTestInfoCheckbox = document.getElementById('hideTestCaseInfo');
  const handleInput = document.getElementById('handle');
  const apiKeyInput = document.getElementById('apiKey');
  const apiSecretInput = document.getElementById('apiSecret');
  const saveButton = document.getElementById('saveApi');
  const saveStatus = document.getElementById('saveStatus');

  // Cross-browser storage helper
  const storage = {
    get: (keys) => new Promise((resolve) => {
      if (typeof browser !== 'undefined' && browser.storage) {
        browser.storage.local.get(keys).then(resolve).catch(() => resolve({}));
      } else {
        chrome.storage.local.get(keys, (res) => resolve(res || {}));
      }
    }),
    set: (obj) => new Promise((resolve) => {
      if (typeof browser !== 'undefined' && browser.storage) {
        browser.storage.local.set(obj).then(resolve).catch(resolve);
      } else {
        chrome.storage.local.set(obj, resolve);
      }
    })
  };

  // Load current settings
  const loadSettings = async () => {
    const res = await storage.get([
      'focusMode',
      'cfxInstantNav',
      'cfxHideTestCaseInfo',
      'cfxHandle',
      'cfxApiKey',
      'cfxApiSecret'
    ]);

    focusCheckbox.checked = Boolean(res.focusMode);

    if (instantNavCheckbox) {
      instantNavCheckbox.checked = res.hasOwnProperty('cfxInstantNav')
        ? Boolean(res.cfxInstantNav)
        : true;
    }

    if (hideTestInfoCheckbox) {
      hideTestInfoCheckbox.checked = Boolean(res.cfxHideTestCaseInfo);
    }

    if (handleInput) handleInput.value = res.cfxHandle || '';
    if (apiKeyInput) apiKeyInput.value = res.cfxApiKey || '';
    if (apiSecretInput) apiSecretInput.value = res.cfxApiSecret || '';
  };

  // Set up event listeners for toggles
  focusCheckbox.addEventListener('change', () => {
    storage.set({ focusMode: focusCheckbox.checked });
  });

  if (instantNavCheckbox) {
    instantNavCheckbox.addEventListener('change', () => {
      storage.set({ cfxInstantNav: instantNavCheckbox.checked });
    });
  }

  if (hideTestInfoCheckbox) {
    hideTestInfoCheckbox.addEventListener('change', () => {
      storage.set({ cfxHideTestCaseInfo: hideTestInfoCheckbox.checked });
    });
  }

  // Set up save button for API credentials
  if (saveButton) {
    saveButton.addEventListener('click', async () => {
      const creds = {
        cfxHandle: handleInput.value.trim(),
        cfxApiKey: apiKeyInput.value.trim(),
        cfxApiSecret: apiSecretInput.value.trim()
      };

      await storage.set(creds);

      saveStatus.textContent = 'Saved!';
      setTimeout(() => {
        saveStatus.textContent = '';
      }, 2000);
    });
  }

  loadSettings();
});
