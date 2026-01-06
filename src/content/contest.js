/**
 * Codeforces QoL - Contest Content Script
 * Handles Focus Mode: hides standings and solved counts on contest/gym pages.
 */
(() => {
  'use strict';

  if (!/\/(contest|gym)\/\d+/.test(location.pathname)) return;

  // Use shared storage utilities (injected via manifest)
  const storage = window.cfxStorage || {
    getSync: (keys, cb) => chrome.storage.local.get(keys, cb),
    onChanged: (listener) => chrome.storage.onChanged.addListener(listener)
  };

  const PRE_HIDE_STYLE_ID = 'cfx-prehide';
  const FOCUS_STYLE_ID = 'cfx-focus-style';

  /**
   * Inject pre-hide styles to prevent flash of content
   */
  const ensurePrehideStyle = () => {
    if (document.getElementById(PRE_HIDE_STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = PRE_HIDE_STYLE_ID;
    style.textContent = `
      a[href*="/standings"] { display: none !important; }
      table.problems tr > *:last-child { display: none !important; }
    `;
    document.documentElement.appendChild(style);
  };

  /**
   * Inject focus mode toggle style
   */
  const ensureFocusStyle = () => {
    if (document.getElementById(FOCUS_STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = FOCUS_STYLE_ID;
    style.textContent = '.cfx-hidden { display: none !important; }';
    document.documentElement.appendChild(style);
  };

  // Apply pre-hide immediately
  ensurePrehideStyle();

  const hide = (el) => el?.classList?.add('cfx-hidden');
  const show = (el) => el?.classList?.remove('cfx-hidden');

  /**
   * Hide standings links
   */
  const hideStandingsLinks = (root = document) => {
    root.querySelectorAll('a[href*="/standings"]').forEach((a) => {
      hide(a);
      if (a.parentElement?.tagName === 'LI') hide(a.parentElement);
    });
  };

  /**
   * Find the column index containing solved count
   */
  const findSolvedColumnIndex = (table) => {
    const headerRows = table.tHead ? Array.from(table.tHead.rows) : [];
    const firstRow = headerRows[0] || table.rows[0];
    if (!firstRow) return -1;

    const cells = Array.from(firstRow.cells);
    for (let i = 0; i < cells.length; i++) {
      const txt = (cells[i].textContent || '').toLowerCase().replace(/\s+/g, '');
      if (/solved|solve|accepted|solutions/.test(txt)) {
        return i;
      }
    }

    // Fallback: last column in problems table
    if (table.classList.contains('problems') && cells.length > 0) {
      return cells.length - 1;
    }

    return -1;
  };

  /**
   * Hide solved count column in tables
   */
  const hideSolvedColumn = (root = document) => {
    root.querySelectorAll('table.problems, table').forEach((table) => {
      const idx = findSolvedColumnIndex(table);
      if (idx === -1) return;

      // Hide header cells
      const headerRows = table.tHead ? Array.from(table.tHead.rows) : [];
      if (headerRows.length) {
        headerRows.forEach((r) => r.cells[idx] && hide(r.cells[idx]));
      } else {
        const firstRow = table.rows[0];
        if (firstRow?.cells[idx]) hide(firstRow.cells[idx]);
      }

      // Hide body cells
      Array.from(table.tBodies || []).forEach((tb) => {
        Array.from(tb.rows).forEach((row) => row.cells[idx] && hide(row.cells[idx]));
      });
    });
  };

  /**
   * Hide inline solved badges
   */
  const hideInlineSolvedBadges = (root = document) => {
    const candidates = root.querySelectorAll('span, a, div, td, th');
    candidates.forEach((el) => {
      if (/\bsolv(ed|es)?\b/i.test(el.textContent || '')) {
        hide(el);
      }
    });
  };

  /**
   * Apply focus mode
   */
  const applyFocus = (root = document) => {
    ensureFocusStyle();
    hideStandingsLinks(root);
    hideSolvedColumn(root);
    hideInlineSolvedBadges(root);
  };

  /**
   * Clear focus mode
   */
  const clearFocus = (root = document) => {
    root.querySelectorAll('.cfx-hidden').forEach(show);
  };

  let observer = null;

  /**
   * Enable focus mode with DOM observation
   */
  const enableFocus = () => {
    applyFocus(document);

    if (!observer) {
      observer = new MutationObserver((mutations) => {
        mutations.forEach((m) => {
          if (m.type === 'childList') {
            m.addedNodes.forEach((node) => {
              if (node.nodeType === 1) applyFocus(node);
            });
          }
        });
      });
    }
    observer.observe(document.documentElement, { childList: true, subtree: true });
  };

  /**
   * Disable focus mode
   */
  const disableFocus = () => {
    observer?.disconnect();
    clearFocus(document);

    // Remove pre-hide style when focus is off
    document.getElementById(PRE_HIDE_STYLE_ID)?.remove();
  };

  // Initialize based on stored preference
  storage.getSync(['focusMode'], (res) => {
    if (res?.focusMode) {
      enableFocus();
    } else {
      disableFocus();
    }
  });

  // React to live preference changes
  storage.onChanged((changes, area) => {
    if (area !== 'local' || !changes.focusMode) return;

    if (changes.focusMode.newValue) {
      enableFocus();
    } else {
      disableFocus();
    }
  });
})();
