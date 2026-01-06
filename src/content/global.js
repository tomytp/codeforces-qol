/**
 * Codeforces QoL - Global Content Script
 * Runs on all Codeforces pages. Handles the "Submit Clipboard in C++" button.
 */
(() => {
  'use strict';

  if (!location.hostname.includes('codeforces.com')) return;

  // Use shared storage utilities (injected via manifest)
  const storage = window.cfxStorage || {
    getSync: (keys, cb) => chrome.storage.local.get(keys, cb),
    setSync: (obj, cb) => chrome.storage.local.set(obj, cb)
  };

  /**
   * Check if current page is a problem page
   */
  const isProblemPage = () => {
    const p = location.pathname;
    return /\/contest\/\d+\/problem\/[A-Za-z0-9]+/.test(p)
      || /\/problemset\/problem\/\d+\/[A-Za-z0-9]+/.test(p)
      || /\/gym\/\d+\/problem\/[A-Za-z0-9]+/.test(p);
  };

  /**
   * Parse problem metadata from URL
   */
  const parseProblemMeta = () => {
    const m1 = location.pathname.match(/\/contest\/(\d+)\/problem\/([A-Za-z0-9]+)/);
    if (m1) return { type: 'contest', contestId: m1[1], problemIndex: m1[2] };

    const m2 = location.pathname.match(/\/problemset\/problem\/(\d+)\/([A-Za-z0-9]+)/);
    if (m2) return { type: 'problemset', problemId: m2[1], problemIndex: m2[2] };

    const m3 = location.pathname.match(/\/gym\/(\d+)\/problem\/([A-Za-z0-9]+)/);
    if (m3) return { type: 'gym', gymId: m3[1], problemIndex: m3[2] };

    return null;
  };

  // Placement control to avoid heavy reflows
  let cfxPlaceStable = false;
  let cfxObserver = null;
  let cfxDebounce = null;

  /**
   * Find a sidebar box by its caption text
   */
  const findSidebarBoxByTitle = (sidebar, regex) => {
    const boxes = Array.from(sidebar.querySelectorAll('.roundbox.sidebox'));
    return boxes.find((box) => {
      const cap = box.querySelector('.caption.titled');
      return cap && regex.test((cap.textContent || '').toLowerCase());
    });
  };

  /**
   * Insert the submit clipboard button
   */
  const insertButton = () => {
    if (!isProblemPage()) return;

    let btn = document.getElementById('cfx-submit-clipboard-btn');
    if (!btn) {
      btn = document.createElement('button');
      btn.id = 'cfx-submit-clipboard-btn';
      btn.textContent = 'Submit Clipboard in C++';
      btn.title = 'Reads clipboard, opens submit page, auto-selects latest C++, and auto-submits';
      btn.type = 'button';
      btn.style.cssText = 'margin:8px 0;padding:6px 10px;font:600 12px system-ui;cursor:pointer;';
    }

    const sidebar = document.querySelector('#sidebar');

    if (sidebar) {
      const submitBox = findSidebarBoxByTitle(sidebar, /submit\?/);
      const lastBox = findSidebarBoxByTitle(sidebar, /last\s+submissions/);

      if (submitBox || lastBox) {
        // Style for sidebar placement
        Object.assign(btn.style, {
          position: '',
          right: '',
          bottom: '',
          zIndex: '',
          display: 'block',
          width: '100%',
          boxSizing: 'border-box',
          margin: '0 0 8px 0'
        });

        if (lastBox) {
          if (btn.parentElement !== sidebar || btn.nextSibling !== lastBox) {
            sidebar.insertBefore(btn, lastBox);
          }
        } else if (submitBox) {
          sidebar.insertBefore(btn, submitBox.nextSibling);
        }

        cfxPlaceStable = true;
        if (cfxObserver) {
          try { cfxObserver.disconnect(); } catch (_) { }
          cfxObserver = null;
        }
        return;
      }
    }

    // Fallback: place in problem statement or fixed position
    let container = document.querySelector('.problem-statement .header')
      || document.querySelector('.problem-statement')
      || document.querySelector('#pageContent')
      || document.body;

    if (container.closest && container.closest('form')) {
      container = document.body;
      btn.style.cssText += 'position:fixed;bottom:16px;right:16px;z-index:2147483647;';
    }

    if (btn.parentElement !== container) {
      container.appendChild(btn);
    }
  };

  /**
   * Handle button click
   */
  const handleSubmitClick = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    const btn = e.currentTarget;
    if (btn.disabled) return;

    btn.disabled = true;
    const originalText = btn.textContent;
    btn.textContent = 'Submitting…';

    try {
      const code = await navigator.clipboard.readText();
      if (!code) {
        alert('Clipboard is empty.');
        return;
      }

      const meta = parseProblemMeta();
      if (!meta) {
        alert('Could not detect problem.');
        return;
      }

      chrome.runtime.sendMessage({ type: 'CFX_SUBMIT_CLIPBOARD', meta, code }, () => {
        btn.disabled = false;
        btn.textContent = originalText;
      });
    } catch (err) {
      console.error('[CFX] Submit error:', err);
      alert('Failed to read clipboard or navigate.');
      btn.disabled = false;
      btn.textContent = 'Submit Clipboard in C++';
    }
  };

  /**
   * Initialize button with click handler
   */
  const initButton = () => {
    insertButton();
    const btn = document.getElementById('cfx-submit-clipboard-btn');
    if (btn && !btn.__cfxClickInit) {
      btn.__cfxClickInit = true;
      btn.addEventListener('click', handleSubmitClick);
    }
  };

  // Insert button on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initButton);
  } else {
    initButton();
  }

  // Watch for DOM changes to re-insert button if needed
  cfxObserver = new MutationObserver(() => {
    if (cfxPlaceStable) return;
    if (cfxDebounce) clearTimeout(cfxDebounce);
    cfxDebounce = setTimeout(() => {
      try { initButton(); } catch (_) { }
    }, 150);
  });
  cfxObserver.observe(document.documentElement, { childList: true, subtree: true });

  // Re-run placement after problem swaps triggered by navigation script
  document.addEventListener('cfx-problem-swapped', () => {
    cfxPlaceStable = false;
    initButton();
  });
})();
