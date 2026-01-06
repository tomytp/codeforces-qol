/**
 * Codeforces QoL - Popup Script
 * Handles popup UI for toggling extension features and API settings.
 */
document.addEventListener('DOMContentLoaded', () => {
  'use strict';

  // Elements
  const focusCheckbox = document.getElementById('focusMode');
  const instantNavCheckbox = document.getElementById('instantNav');
  const hideTestInfoCheckbox = document.getElementById('hideTestCaseInfo');
  const handleInput = document.getElementById('handle');
  const apiKeyInput = document.getElementById('apiKey');
  const apiSecretInput = document.getElementById('apiSecret');
  const detectHandleBtn = document.getElementById('detectHandle');
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
    instantNavCheckbox.checked = res.hasOwnProperty('cfxInstantNav')
      ? Boolean(res.cfxInstantNav)
      : true;
    hideTestInfoCheckbox.checked = Boolean(res.cfxHideTestCaseInfo);
    handleInput.value = res.cfxHandle || '';
    apiKeyInput.value = res.cfxApiKey || '';
    apiSecretInput.value = res.cfxApiSecret || '';
  };

  // Toggle event listeners
  focusCheckbox.addEventListener('change', () => {
    storage.set({ focusMode: focusCheckbox.checked });
  });

  instantNavCheckbox.addEventListener('change', () => {
    storage.set({ cfxInstantNav: instantNavCheckbox.checked });
  });

  hideTestInfoCheckbox.addEventListener('change', () => {
    storage.set({ cfxHideTestCaseInfo: hideTestInfoCheckbox.checked });
  });

  // Auto-detect handle from Codeforces page
  detectHandleBtn.addEventListener('click', async () => {
    detectHandleBtn.textContent = '...';
    detectHandleBtn.disabled = true;

    try {
      // Query the active Codeforces tab
      const tabs = await new Promise((resolve) => {
        chrome.tabs.query({ active: true, currentWindow: true }, resolve);
      });

      const tab = tabs[0];
      if (!tab || !tab.url || !tab.url.includes('codeforces.com')) {
        alert('Please open a Codeforces page first');
        return;
      }

      // Execute script to extract handle from page
      const results = await new Promise((resolve) => {
        chrome.tabs.executeScript(tab.id, {
          code: `
            (function() {
              // Try to find handle from header
              const headerLink = document.querySelector('a[href^="/profile/"]');
              if (headerLink) {
                const href = headerLink.getAttribute('href');
                const match = href.match(/\\/profile\\/([^/]+)/);
                if (match) return match[1];
              }
              // Try from logout link
              const logoutForm = document.querySelector('form[action*="logout"]');
              if (logoutForm) {
                const handleEl = logoutForm.closest('.lang-chooser')?.querySelector('a[href^="/profile/"]');
                if (handleEl) {
                  const match = handleEl.getAttribute('href').match(/\\/profile\\/([^/]+)/);
                  if (match) return match[1];
                }
              }
              return null;
            })();
          `
        }, resolve);
      });

      const handle = results && results[0];
      if (handle) {
        handleInput.value = handle;
        await storage.set({ cfxHandle: handle });
        showStatus('Handle detected!');
      } else {
        alert('Could not detect handle. Make sure you are logged in to Codeforces.');
      }
    } catch (err) {
      console.error('Error detecting handle:', err);
      alert('Error detecting handle. Make sure you have a Codeforces tab open.');
    } finally {
      detectHandleBtn.textContent = '🔄';
      detectHandleBtn.disabled = false;
    }
  });

  // Save API settings
  saveButton.addEventListener('click', async () => {
    const creds = {
      cfxHandle: handleInput.value.trim(),
      cfxApiKey: apiKeyInput.value.trim(),
      cfxApiSecret: apiSecretInput.value.trim()
    };

    await storage.set(creds);
    showStatus('Saved!');
  });

  // Show status message
  const showStatus = (message) => {
    saveStatus.textContent = message;
    setTimeout(() => {
      saveStatus.textContent = '';
    }, 2000);
  };

  loadSettings();
});
