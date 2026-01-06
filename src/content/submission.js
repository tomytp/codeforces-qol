/**
 * Codeforces QoL - Submission Content Script
 * Handles Hide Test Case Info: hides "on test X" from verdict messages.
 */
(() => {
  'use strict';

  const STORAGE_KEY = 'cfxHideTestCaseInfo';
  let isEnabled = false;

  // Use shared storage utilities (injected via manifest)
  const storage = window.cfxStorage || {
    get: (keys) => new Promise((resolve) => chrome.storage.local.get(keys, resolve)),
    onChanged: (listener) => chrome.storage.onChanged.addListener(listener)
  };

  /**
   * Update verdict text in a DOM node
   */
  const updateNode = (node) => {
    if (!node.querySelectorAll) return;

    const verdictSpans = node.querySelectorAll(
      '.verdict-rejected, .verdict-waiting, [data-original-verdict]'
    );

    verdictSpans.forEach((span) => {
      const originalText = span.dataset.originalVerdict || span.textContent || '';

      // Store original text if not already saved
      if (!span.dataset.originalVerdict && originalText) {
        span.dataset.originalVerdict = originalText;
      }

      if (isEnabled) {
        // Hide test case info
        const newText = (span.dataset.originalVerdict || originalText)
          .replace(/\s+on\s+(test|pretest)\s+\d+/, '');
        if (span.textContent !== newText) {
          span.textContent = newText;
        }
      } else {
        // Restore original text
        if (span.dataset.originalVerdict && span.textContent !== span.dataset.originalVerdict) {
          span.textContent = span.dataset.originalVerdict;
        }
      }
    });
  };

  /**
   * Initialize the feature
   */
  const init = async () => {
    // Get initial state
    try {
      const prefs = await storage.get([STORAGE_KEY]);
      isEnabled = Boolean(prefs[STORAGE_KEY]);
    } catch (err) {
      console.error('[CFX] Submission: Storage error:', err);
      isEnabled = false;
    }

    // Listen for storage changes
    storage.onChanged((changes, area) => {
      if (area === 'local' && changes[STORAGE_KEY]) {
        isEnabled = Boolean(changes[STORAGE_KEY].newValue);
        if (document.body) updateNode(document.body);
      }
    });

    // Observe for DOM changes
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            updateNode(node);
          }
        });
      });
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });

    // Handle initial page content
    if (document.body) {
      updateNode(document.body);
    } else {
      document.addEventListener('DOMContentLoaded', () => {
        updateNode(document.body);
      }, { once: true });
    }
  };

  init();
})();