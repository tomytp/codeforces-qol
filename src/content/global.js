(() => {
  if (!location.hostname.includes('codeforces.com')) return;

  const isProblemPage = () => {
    const p = location.pathname;
    return /\/contest\/\d+\/problem\/[A-Za-z0-9]+/.test(p)
      || /\/problemset\/problem\/\d+\/[A-Za-z0-9]+/.test(p)
      || /\/gym\/\d+\/problem\/[A-Za-z0-9]+/.test(p);
  };

  const parseProblemMeta = () => {
    const m1 = location.pathname.match(/\/contest\/(\d+)\/problem\/([A-Za-z0-9]+)/);
    if (m1) return { type: 'contest', contestId: m1[1], problemIndex: m1[2] };
    const m2 = location.pathname.match(/\/problemset\/problem\/(\d+)\/([A-Za-z0-9]+)/);
    if (m2) return { type: 'problemset', problemId: m2[1], problemIndex: m2[2] };
    const m3 = location.pathname.match(/\/gym\/(\d+)\/problem\/([A-Za-z0-9]+)/);
    if (m3) return { type: 'gym', gymId: m3[1], problemIndex: m3[2] };
    return null;
  };

  const getStorage = (keys, cb) => {
    try {
      if (typeof browser !== 'undefined' && browser.storage && browser.storage.local) {
        browser.storage.local.get(keys).then(cb).catch((e) => console.error(e));
      } else {
        chrome.storage.local.get(keys, cb);
      }
    } catch (e) { console.error(e); }
  };
  const setStorage = (obj, cb) => {
    try {
      if (typeof browser !== 'undefined' && browser.storage && browser.storage.local) {
        browser.storage.local.set(obj).then(() => cb && cb()).catch((e) => console.error(e));
      } else {
        chrome.storage.local.set(obj, cb);
      }
    } catch (e) { console.error(e); }
  };

  // Placement control to avoid heavy reflows
  let cfxPlaceStable = false;
  let cfxObserver = null;
  let cfxDebounce = null;

  const insertButton = () => {
    if (!isProblemPage()) return;

    // Try to locate the right sidebar "Submit?" area by text and position.
    const findSubmitSidebarAnchor = () => {
      const candSel = '.caption, .titled, h2, h3, .roundbox, .box, .sidebox, .menu-box, .sidebar, #sidebar, .second-level-menu';
      let targets = Array.from(document.querySelectorAll(candSel)).filter(el => /submit\?/i.test((el.textContent || '')));
      targets = targets.filter(el => {
        try { const r = el.getBoundingClientRect(); return r.left > window.innerWidth * 0.6; } catch (_) { return false; }
      });
      if (targets.length) return targets[0];
      let links = Array.from(document.querySelectorAll('a[href*="/submit"]'));
      links = links.filter(a => { try { const r = a.getBoundingClientRect(); return r.left > window.innerWidth * 0.6; } catch(_) { return false; } });
      return links[0] || null;
    };

    // Fallbacks: problem header, statement, page content, or body.
    let container = document.querySelector('.problem-statement .header')
      || document.querySelector('.problem-statement')
      || document.querySelector('#pageContent')
      || document.body;
    let btn = document.getElementById('cfx-submit-clipboard-btn');
    if (!btn) {
      btn = document.createElement('button');
      btn.id = 'cfx-submit-clipboard-btn';
      btn.textContent = 'Submit Clipboard in C++';
      btn.title = 'Reads clipboard, opens submit page, auto-selects latest C++, and auto-submits';
      btn.style.cssText = 'margin:8px 0;padding:6px 10px;font:600 12px system-ui;cursor:pointer;';
      btn.type = 'button';
    }
    // Prefer to place the button between 'Submit?' and 'Last submissions' in #sidebar
    const sidebar = document.querySelector('#sidebar');
    const allBoxes = sidebar ? Array.from(sidebar.querySelectorAll('.roundbox.sidebox')) : [];
    const findBoxByTitle = (re) => allBoxes.find((box) => {
      const cap = box.querySelector('.caption.titled');
      return cap && re.test((cap.textContent || '').toLowerCase());
    });
    const submitBox = findBoxByTitle(/submit\?/);
    const lastBox = findBoxByTitle(/last\s+submissions/);

    if (sidebar && (submitBox || lastBox)) {
      btn.style.position = '';
      btn.style.right = '';
      btn.style.bottom = '';
      btn.style.zIndex = '';
      btn.style.display = 'block';
      btn.style.width = '100%';
      btn.style.boxSizing = 'border-box';
      btn.style.margin = '0 0 8px 0';
      if (lastBox) {
        if (btn.parentElement !== sidebar || btn.nextSibling !== lastBox) {
          sidebar.insertBefore(btn, lastBox);
        }
      } else if (submitBox) {
        sidebar.insertBefore(btn, submitBox.nextSibling);
      }
      cfxPlaceStable = true;
      if (cfxObserver) { try { cfxObserver.disconnect(); } catch (_) {} cfxObserver = null; }
    } else {
      if (container.closest && container.closest('form')) {
        container = document.body;
        btn.style.cssText += 'position:fixed;bottom:16px;right:16px;z-index:2147483647;';
      }
      if (btn.parentElement !== container) container.appendChild(btn);
    }

    if (!btn.__cfxClickInit) {
      btn.__cfxClickInit = true;
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        try {
          if (btn.disabled) return;
          btn.disabled = true;
          const originalText = btn.textContent;
          btn.textContent = 'Submitting…';
          const code = await navigator.clipboard.readText();
          if (!code) { alert('Clipboard is empty.'); return; }
          const meta = parseProblemMeta();
          if (!meta) { alert('Could not detect problem.'); return; }
          chrome.runtime.sendMessage({ type: 'CFX_SUBMIT_CLIPBOARD', meta, code }, () => {
            // Re-enable the button UI after handing off to background
            btn.disabled = false;
            btn.textContent = originalText;
          });
        } catch (e) {
          console.error(e);
          alert('Failed to read clipboard or navigate.');
          btn.disabled = false;
          btn.textContent = 'Submit Clipboard in C++';
        }
      });
    }
  };

  // Insert ASAP and also when DOM updates.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', insertButton);
  } else {
    insertButton();
  }
  cfxObserver = new MutationObserver(() => {
    if (cfxPlaceStable) return;
    if (cfxDebounce) clearTimeout(cfxDebounce);
    cfxDebounce = setTimeout(() => { try { insertButton(); } catch (_) {} }, 150);
  });
  cfxObserver.observe(document.documentElement, { childList: true, subtree: true });
})();
