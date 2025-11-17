(() => {
  const STORAGE_KEY = 'cfxHideTestCaseInfo';
  let isEnabled = false;

  const getStorage = (keys) => new Promise((resolve) => {
    try {
      if (typeof browser !== 'undefined' && browser.storage && browser.storage.local) {
        browser.storage.local.get(keys).then((res) => resolve(res || {})).catch(() => resolve({}));
      } else {
        chrome.storage.local.get(keys, (res) => resolve(res || {}));
      }
    } catch (_) { resolve({}); }
  });

  const updateNode = (node) => {
    // Query for spans that are either verdicts or have been modified by this script before
    const verdictSpans = node.querySelectorAll ? node.querySelectorAll('.verdict-rejected, .verdict-waiting, [data-original-verdict]') : [];

    verdictSpans.forEach(span => {
      const originalText = span.dataset.originalVerdict || span.textContent || '';
      // If we haven't stored the original text yet, and it's a valid verdict, store it.
      if (!span.dataset.originalVerdict && originalText) {
        span.dataset.originalVerdict = originalText;
      }

      if (isEnabled) {
        // Hide test case info
        const newText = (span.dataset.originalVerdict || originalText).replace(/\s+on\s+(test|pretest)\s+\d+/, '');
        if (span.textContent !== newText) {
          span.textContent = newText;
        }
      } else {
        // Restore original text if it exists
        if (span.dataset.originalVerdict && span.textContent !== span.dataset.originalVerdict) {
          span.textContent = span.dataset.originalVerdict;
        }
      }
    });
  };

  const main = async () => {
    // 1. Get initial state
    const prefs = await getStorage([STORAGE_KEY]);
    isEnabled = !!prefs[STORAGE_KEY];

    // 2. Listen for storage changes to handle live toggling
    browser.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes[STORAGE_KEY]) {
        isEnabled = !!changes[STORAGE_KEY].newValue;
        updateNode(document.body);
      }
    });

    // 3. Observe for DOM changes to handle dynamically loaded verdicts
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const addedNode of mutation.addedNodes) {
          if (addedNode.nodeType === Node.ELEMENT_NODE) {
            updateNode(addedNode);
          }
        }
      }
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });

    // 4. Handle initial page content correctly
    if (document.body) {
        updateNode(document.body);
    } else {
        document.addEventListener('DOMContentLoaded', () => {
            updateNode(document.body);
        }, { once: true });
    }
  };

  main();
})();