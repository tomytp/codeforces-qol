(() => {
  if (!/(\/contest\/|\/gym\/)\d+/.test(location.pathname)) return;

  // Pre-hide to prevent flash of content when Focus Mode is ON.
  // Hide standings links and the last column in the problems table early.
  const preStyleId = 'cfx-prehide';
  const ensurePrehide = () => {
    if (document.getElementById(preStyleId)) return;
    const st = document.createElement('style');
    st.id = preStyleId;
    st.textContent = `
      /* Hide any standings links quickly */
      a[href*="/standings"] { display: none !important; }
      /* Hide the last column in problems tables (typical solved count) */
      table.problems tr > *:last-child { display: none !important; }
    `;
    document.documentElement.appendChild(st);
  };
  ensurePrehide();

  // Inject a stylesheet for toggling visibility via a class.
  const styleId = 'cfx-focus-style';
  const ensureStyle = () => {
    if (document.getElementById(styleId)) return;
    const st = document.createElement('style');
    st.id = styleId;
    st.textContent = `.cfx-hidden{display:none !important;}`;
    document.documentElement.appendChild(st);
  };

  const hide = (el) => el && el.classList && el.classList.add('cfx-hidden');
  const show = (el) => el && el.classList && el.classList.remove('cfx-hidden');

  const hideStandingsLinks = (root = document) => {
    const links = root.querySelectorAll('a[href*="/standings"]');
    links.forEach((a) => {
      hide(a);
      if (a.parentElement && a.parentElement.tagName === 'LI') hide(a.parentElement);
    });
  };

  const findSolvedColIndex = (table) => {
    const headerRows = table.tHead ? Array.from(table.tHead.rows) : [];
    const firstRow = headerRows[0] || table.rows[0];
    if (!firstRow) return -1;
    const cells = Array.from(firstRow.cells);
    for (let i = 0; i < cells.length; i++) {
      const txt = (cells[i].textContent || '').toLowerCase().replace(/\s+/g, '');
      if (txt.includes('solved') || txt.includes('solve') || txt.includes('accepted') || txt.includes('solutions')) {
        return i;
      }
    }
    // Fallback: on Codeforces problems table, the solved count is typically the last column
    if (table.classList.contains('problems') && cells.length > 0) {
      return cells.length - 1;
    }
    return -1;
  };

  const hideSolvedColumnInTables = (root = document) => {
    const tables = Array.from(root.querySelectorAll('table.problems, table'));
    tables.forEach((table) => {
      const idx = findSolvedColIndex(table);
      if (idx === -1) return;
      const headerRows = table.tHead ? Array.from(table.tHead.rows) : [];
      if (headerRows.length) {
        headerRows.forEach((r) => r.cells[idx] && hide(r.cells[idx]));
      } else {
        const firstRow = table.rows[0];
        if (firstRow && firstRow.cells[idx]) hide(firstRow.cells[idx]);
      }
      Array.from(table.tBodies || []).forEach((tb) => {
        Array.from(tb.rows).forEach((row) => row.cells[idx] && hide(row.cells[idx]));
      });
    });
  };

  const hideInlineSolvedBadges = (root = document) => {
    const candidates = root.querySelectorAll('span, a, div, td, th');
    const re = /\bsolv(ed|es)?\b/i;
    candidates.forEach((el) => {
      const txt = el.textContent || '';
      if (re.test(txt)) hide(el);
    });
  };

  const applyFocus = (root = document) => {
    ensureStyle();
    hideStandingsLinks(root);
    hideSolvedColumnInTables(root);
    hideInlineSolvedBadges(root);
  };

  const clearFocus = (root = document) => {
    root.querySelectorAll('.cfx-hidden').forEach((el) => show(el));
  };

  let mo = null;
  const enableFocus = () => {
    applyFocus(document);
    if (!mo) {
      mo = new MutationObserver((muts) => {
        for (const m of muts) {
          if (m.type === 'childList') {
            m.addedNodes.forEach((node) => {
              if (node.nodeType === 1) applyFocus(node);
            });
          }
        }
      });
    }
    mo.observe(document.documentElement, { childList: true, subtree: true });
    // Keep prehide style in place when enabled.
  };

  const disableFocus = () => {
    if (mo) mo.disconnect();
    clearFocus(document);
    // Remove prehide if present since focus is off.
    const pre = document.getElementById(preStyleId);
    if (pre) pre.remove();
  };

  const getStorage = (keys, cb) => {
    if (typeof browser !== 'undefined' && browser.storage && browser.storage.local) {
      browser.storage.local.get(keys).then(cb).catch((e) => console.error(e));
    } else {
      chrome.storage.local.get(keys, cb);
    }
  };

  getStorage(['focusMode'], (res) => {
    const enabled = Boolean(res && res.focusMode);
    if (enabled) enableFocus();
    else disableFocus();
  });

  const onChanged = (changes, area) => {
    if (area !== 'local' || !changes || !('focusMode' in changes)) return;
    const nv = changes.focusMode.newValue;
    if (nv) enableFocus();
    else disableFocus();
  };

  if (chrome && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener(onChanged);
  } else if (typeof browser !== 'undefined' && browser.storage && browser.storage.onChanged) {
    browser.storage.onChanged.addListener(onChanged);
  }
})();
