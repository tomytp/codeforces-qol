/**
 * Codeforces QoL - Submit Content Script
 * Auto-fills and submits code from clipboard when triggered by background script.
 */
(() => {
  'use strict';

  if (!/\/(problemset|contest|gym)\/.*submit/.test(location.pathname)) return;

  const LOG_PREFIX = '[CFX] Submit:';
  const log = (...args) => console.log(LOG_PREFIX, ...args);

  // Use shared storage utilities (injected via manifest)
  const storage = window.cfxStorage || {
    get: (keys) => new Promise((resolve) => chrome.storage.local.get(keys, resolve)),
    set: (obj) => new Promise((resolve) => chrome.storage.local.set(obj, resolve))
  };

  let hasNotifiedSubmit = false;

  // DOM element finders
  const findLangSelect = () => document.querySelector('#programTypeId, select[name="programTypeId"]');
  const findSourceArea = () => document.querySelector('#sourceCodeTextarea, textarea[name="source"]');
  const findProblemIndexSelect = () => document.querySelector('select[name="submittedProblemIndex"], #submittedProblemIndex');
  const findProblemCodeInput = () => document.querySelector('input[name="submittedProblemCode"], #submittedProblemCode');

  /**
   * Select the most recent C++ compiler option
   */
  const selectCppOption = (select) => {
    if (!select) return false;

    const opts = Array.from(select.options);
    let best = null;
    let bestVersion = -1;

    for (const opt of opts) {
      const text = (opt.textContent || '').toLowerCase();
      if (!/c\+\+|g\+\+/.test(text)) continue;

      const match = text.match(/(?:c\+\+|g\+\+)\s*(\d{2})/);
      const ver = match ? parseInt(match[1], 10) : 0;

      if (ver > bestVersion) {
        bestVersion = ver;
        best = opt;
      }
    }

    // Fallback to any C++ option
    if (!best) {
      best = opts.find((o) => /(c\+\+|g\+\+)/i.test(o.textContent || ''));
    }

    if (!best) return false;

    select.value = best.value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  };

  /**
   * Find the submit form
   */
  const findSubmitForm = () => {
    const elements = [
      findLangSelect(),
      findSourceArea(),
      findProblemIndexSelect(),
      findProblemCodeInput()
    ].filter(Boolean);

    for (const el of elements) {
      const form = el.closest('form');
      if (form) return form;
    }

    return document.querySelector('form[action*="/submit"]');
  };

  /**
   * Apply payload to form
   */
  const applyPayload = async (payload) => {
    const { code, problemIndex, problemId, autoSubmit } = payload || {};

    // Select C++ compiler
    const langSelect = findLangSelect();
    if (langSelect) selectCppOption(langSelect);

    // Fill source code
    const sourceArea = findSourceArea();
    if (sourceArea && typeof code === 'string') {
      sourceArea.value = code;
      sourceArea.dispatchEvent(new Event('input', { bubbles: true }));
      sourceArea.dispatchEvent(new Event('change', { bubbles: true }));
      sourceArea.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
    }

    // Select problem
    const probSelect = findProblemIndexSelect();
    if (probSelect && problemIndex) {
      const opt = Array.from(probSelect.options).find(
        (o) => (o.value || '').toUpperCase() === String(problemIndex).toUpperCase()
      );
      if (opt) {
        probSelect.value = opt.value;
        probSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }
    } else {
      const probCode = findProblemCodeInput();
      if (probCode && problemId && problemIndex) {
        probCode.value = `${problemId}${String(problemIndex).toUpperCase()}`;
        probCode.dispatchEvent(new Event('input', { bubbles: true }));
        probCode.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }

    // Auto-submit if requested
    if (autoSubmit) {
      await waitAndSubmit();
    }
  };

  /**
   * Wait for form to be ready, then submit
   */
  const waitAndSubmit = () => {
    return new Promise((resolve) => {
      let attempts = 0;
      const maxAttempts = 75; // ~6s

      const tick = async () => {
        attempts++;

        const form = findSubmitForm();
        const submitBtn = form?.querySelector('button[type="submit"], input[type="submit"]');
        const langOk = Boolean(findLangSelect()?.value);
        const codeOk = Boolean(findSourceArea()?.value?.length > 0);
        const probSelect = findProblemIndexSelect();
        const probCode = findProblemCodeInput();
        const probOk = Boolean(probSelect?.value || probCode?.value);

        if (form && langOk && codeOk && probOk) {
          // Notify background script of submission
          if (!hasNotifiedSubmit) {
            const path = location.pathname;
            let myUrl = 'https://codeforces.com/problemset/status?my=on';

            const m1 = path.match(/\/contest\/(\d+)\/submit/);
            const m2 = path.match(/\/gym\/(\d+)\/submit/);

            if (m1) myUrl = `https://codeforces.com/contest/${m1[1]}/my`;
            else if (m2) myUrl = `https://codeforces.com/gym/${m2[1]}/my`;

            chrome.runtime.sendMessage({ type: 'CFX_SUBMITTED', myUrl });
            hasNotifiedSubmit = true;
          }

          // Clear payload and submit
          await storage.set({ cfx_submit_payload: null });
          submitBtn ? submitBtn.click() : form.submit();
          resolve();
          return;
        }

        if (attempts < maxAttempts) {
          setTimeout(tick, 80);
        } else {
          await storage.set({ cfx_submit_payload: null });
          resolve();
        }
      };

      setTimeout(tick, 50);
    });
  };

  /**
   * Try to apply stored payload
   */
  const tryApply = async () => {
    try {
      const res = await storage.get(['cfx_submit_payload']);
      const payload = res?.cfx_submit_payload;
      if (!payload) return;

      log('Applying payload');
      await applyPayload(payload);
    } catch (err) {
      console.error(LOG_PREFIX, 'Error:', err);
    }
  };

  // Watch for DOM changes and try to apply payload
  const observer = new MutationObserver(tryApply);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  // Try to apply on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tryApply);
  } else {
    tryApply();
  }
})();
