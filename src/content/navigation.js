(() => {
  const isProblemPage = () => /\/(contest|gym)\/(\d+)\/problem\/([A-Za-z0-9]+)/.test(location.pathname);
  if (!isProblemPage()) return;

  const DEBUG = false;
  const log = (...args) => { if (DEBUG) console.log('[CFX] Nav:', ...args); };

  const parseMeta = () => {
    const m1 = location.pathname.match(/\/contest\/(\d+)\/problem\/([A-Za-z0-9]+)/);
    if (m1) return { type: 'contest', id: m1[1], index: m1[2], base: `/contest/${m1[1]}` };
    const m2 = location.pathname.match(/\/gym\/(\d+)\/problem\/([A-Za-z0-9]+)/);
    if (m2) return { type: 'gym', id: m2[1], index: m2[2], base: `/gym/${m2[1]}` };
    return null;
  };

  const meta = parseMeta();
  if (!meta) return;

  // Storage helper
  const getStorage = (keys) => new Promise((resolve) => {
    try {
      if (typeof browser !== 'undefined' && browser.storage && browser.storage.local) {
        browser.storage.local.get(keys).then((res) => resolve(res || {})).catch(() => resolve({}));
      } else {
        chrome.storage.local.get(keys, (res) => resolve(res || {}));
      }
    } catch (_) { resolve({}); }
  });

  const ORIGIN = location.origin;
  const contestRootUrl = `${ORIGIN}${meta.base}`;
  const problemsAltUrl = `${ORIGIN}${meta.base}/problems`;
  const standingsUrl = `${ORIGIN}${meta.base}/standings`;
  const apiProblemsUrl = meta.type === 'contest'
    ? `${ORIGIN}/api/contest.standings?contestId=${encodeURIComponent(meta.id)}&from=1&count=1`
    : null;
  const problemUrlOf = (idx) => `${ORIGIN}${meta.base}/problem/${encodeURIComponent(idx)}`;

  // Cache of URL -> { title, pageHtml }
  const cache = new Map();
  let order = [];
  let currentIdxValue = meta.index;
  let initialized = false;
  const statements = new Map(); // index -> { html, title }
  const prepared = new Map(); // index -> prepared DOM element for instant swap
  let staging = null;

  // (no storage needed for navigation prefs at this time)

  // Fetch contest root to get ordered problem indices
  const extractProblemIndices = (doc) => {
    const idxs = [];
    // 1) Prefer the canonical problems table
    const table = doc.querySelector('table.problems');
    if (table) {
      const links = Array.from(table.querySelectorAll('a[href*="/problem/"]'));
      for (const a of links) {
        const m = (a.getAttribute('href') || '').match(/\/problem\/([A-Za-z0-9]+)/);
        if (m) idxs.push(m[1]);
      }
    }
    // 2) If empty, scan all anchors for this contest/gym base
    if (idxs.length === 0) {
      const baseRe = new RegExp(`^((https?:)?\/\/[^/]+)?${meta.base.replace(/\//g, '\\/')}\/problem\/([A-Za-z0-9]+)`);
      const links = Array.from(doc.querySelectorAll('a[href*="/problem/"]'));
      for (const a of links) {
        const href = a.getAttribute('href') || '';
        const m = href.match(baseRe);
        if (m) idxs.push(m[3] || m[1]);
      }
    }
    // 3) If still empty, parse problem statements (on /problems page)
    if (idxs.length === 0) {
      const titles = Array.from(doc.querySelectorAll('.problem-statement .header .title'));
      for (const t of titles) {
        const txt = (t.textContent || '').trim();
        const m = txt.match(/^([A-Za-z0-9]+)\s*[\.:]/);
        if (m) idxs.push(m[1]);
      }
    }
    // De-duplicate while preserving order
    const seen = new Set();
    const uniq = [];
    for (const x of idxs) { if (!seen.has(x)) { seen.add(x); uniq.push(x); } }
    log('extractProblemIndices: table=', !!table, 'anchors/idxs=', uniq.length);
    return uniq;
  };

  const extractFromCurrentPage = () => {
    const idxs = [];
    try {
      const baseRe = new RegExp(`${meta.base.replace(/\//g, '\\/')}/problem/([A-Za-z0-9]+)`);
      const sidebar = document.querySelector('#sidebar') || document;
      const links = Array.from(sidebar.querySelectorAll('a[href*="/problem/"]'));
      for (const a of links) {
        const href = a.getAttribute('href') || '';
        const m = href.match(baseRe);
        if (m) idxs.push(m[1]);
      }
      // If sidebar failed, scan the whole document as a fallback
      if (idxs.length === 0) {
        const allLinks = Array.from(document.querySelectorAll('a[href*="/problem/"]'));
        for (const a of allLinks) {
          const href = a.getAttribute('href') || '';
          const m = href.match(baseRe);
          if (m) idxs.push(m[1]);
        }
      }
    } catch (_) {}
    const seen = new Set();
    const uniq = [];
    for (const x of idxs) { if (!seen.has(x)) { seen.add(x); uniq.push(x); } }
    log('extractFromCurrentPage: idxs=', uniq.length);
    return uniq;
  };

  const fetchProblemsList = async () => {
    try {
      // 1) Try current page structure first (fast, no network)
      let list = extractFromCurrentPage();
      if (list && list.length > 0) return list;

      // 2) Prefer API for contests to minimize HTML fetches
      if (apiProblemsUrl) {
        try {
          const resApi = await fetch(apiProblemsUrl, { credentials: 'include' });
          const json = await resApi.json();
          if (json && json.status === 'OK' && json.result && json.result.problems) {
            const ids = json.result.problems.map((p) => p.index).filter(Boolean);
            const uniq = [];
            const seen = new Set();
            for (const x of ids) { if (!seen.has(x)) { seen.add(x); uniq.push(x); } }
            list = uniq;
          }
        } catch (_) {}
        if (list && list.length > 0) return list;
      }

      // 3) Minimal HTML fallbacks (root, then /problems, then standings)
      try {
        const res = await fetch(contestRootUrl, { credentials: 'include' });
        const text = await res.text();
        const doc = new DOMParser().parseFromString(text, 'text/html');
        list = extractProblemIndices(doc);
      } catch (_) {}
      if (!list || list.length === 0) {
        try {
          const res2 = await fetch(problemsAltUrl, { credentials: 'include' });
          const text2 = await res2.text();
          const doc2 = new DOMParser().parseFromString(text2, 'text/html');
          list = extractProblemIndices(doc2);
        } catch (_) {}
      }
      if (!list || list.length === 0) {
        try {
          const res3 = await fetch(standingsUrl, { credentials: 'include' });
          const text3 = await res3.text();
          const doc3 = new DOMParser().parseFromString(text3, 'text/html');
          list = extractProblemIndices(doc3);
        } catch (_) {}
      }
      return list || [];
    } catch (e) {
      log('fetchProblemsList error:', e);
      return [];
    }
  };

  // fetchProblemPage defined later with CAPTCHA detection

  const parseIndexFromTitle = (txt) => {
    const m = (txt || '').trim().match(/^([A-Za-z0-9]+)[\s\.:\-]/);
    return m ? m[1] : null;
  };

  const ensureStaging = () => {
    if (staging && document.body.contains(staging)) return staging;
    staging = document.getElementById('cfx-nav-staging');
    if (!staging) {
      staging = document.createElement('div');
      staging.id = 'cfx-nav-staging';
      staging.style.cssText = 'position:absolute;left:-99999px;top:auto;width:1px;height:1px;overflow:hidden;visibility:hidden;';
      (document.body || document.documentElement).appendChild(staging);
    }
    return staging;
  };

  const buildNodeFromStatement = (idx) => {
    const stmt = statements.get(idx);
    if (!stmt) return null;
    const tpl = document.createElement('template');
    tpl.innerHTML = stmt.html.trim();
    let node = tpl.content.querySelector('.problemindexholder');
    if (!node) node = tpl.content.querySelector('.problem-statement');
    if (!node) return null;
    return node.cloneNode(true);
  };

  const prepareIndexNode = (idx) => {
    try {
      if (!idx || prepared.has(idx)) return prepared.get(idx) || null;
      const node = buildNodeFromStatement(idx);
      if (!node) return null;
      const host = ensureStaging();
      host.appendChild(node);
      prepared.set(idx, node);
      // Warm up images and math for zero-delay swap
      try {
        const imgs = Array.from(node.querySelectorAll('img'));
        Promise.all(imgs.map((img) => {
          try {
            if (img.decode) return img.decode().catch(() => {});
            if (!img.complete) return new Promise((res) => { img.addEventListener('load', res, { once: true }); img.addEventListener('error', res, { once: true }); });
          } catch (_) {}
          return Promise.resolve();
        })).then(() => scheduleTypeset(node)).catch(() => scheduleTypeset(node));
      } catch (_) { scheduleTypeset(node); }
      return node;
    } catch (_) { return null; }
  };

  const ensureStatements = async () => {
    if (statements.size) return true;
    try {
      const res = await fetch(problemsAltUrl, { credentials: 'include' });
      const html = await res.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');
      // Prefer full problem containers to preserve structure/styles
      const holders = Array.from(doc.querySelectorAll('.problemindexholder'));
      if (holders.length) {
        for (const holder of holders) {
          const titleEl = holder.querySelector('.problem-statement .header .title');
          const titleText = titleEl ? (titleEl.textContent || '').trim() : '';
          const idx = parseIndexFromTitle(titleText);
          if (!idx) continue;
          statements.set(idx, { html: holder.outerHTML, title: titleText });
        }
      } else {
        // Fallback: store just the statement if holders not present
        const blocks = Array.from(doc.querySelectorAll('.problem-statement'));
        for (const block of blocks) {
          const titleEl = block.querySelector('.header .title');
          const titleText = titleEl ? (titleEl.textContent || '').trim() : '';
          const idx = parseIndexFromTitle(titleText);
          if (!idx) continue;
          statements.set(idx, { html: block.outerHTML, title: titleText });
        }
      }
      if (!order.length && statements.size) {
        order = Array.from(statements.keys());
      }
      return statements.size > 0;
    } catch (_) {
      return false;
    }
  };

  const sequential = async (tasks, onProgress) => {
    for (let i = 0; i < tasks.length; i++) {
      try { await tasks[i](); } catch (e) { /* ignore */ }
      if (onProgress) onProgress(i + 1, tasks.length);
    }
  };

  let captchaBackoffUntil = 0;
  const now = () => Date.now();
  const isCaptchaDoc = (doc, text) => {
    try {
      const title = (doc && doc.title) || '';
      if (/captcha|enter the code|verification/i.test(title)) return true;
      const body = (text || '').toLowerCase();
      if (body.includes('captcha') || body.includes('enter the code from the picture')) return true;
      if (doc && doc.querySelector('input[name="captcha"]')) return true;
    } catch (_) {}
    return false;
  };

  const fetchProblemPage = async (url) => {
    if (cache.has(url)) return cache.get(url);
    const res = await fetch(url, { credentials: 'include' });
    const text = await res.text();
    const doc = new DOMParser().parseFromString(text, 'text/html');
    if (isCaptchaDoc(doc, text)) {
      captchaBackoffUntil = now() + 5 * 60 * 1000; // 5 minutes
      throw new Error('captcha');
    }
    const page = doc.querySelector('#pageContent');
    const title = doc.title || 'Codeforces';
    const html = page ? page.innerHTML : text;
    const data = { title, pageHtml: html };
    cache.set(url, data);
    return data;
  };

  const getIndexFromUrl = (u) => {
    const m = (u || '').match(/\/problem\/([A-Za-z0-9]+)/);
    return m ? m[1] : null;
  };

  const validateRenderedIndex = (expectedIdx) => {
    try {
      const titleEl = document.querySelector('#pageContent .problem-statement .header .title');
      const txt = titleEl ? (titleEl.textContent || '').trim() : '';
      const idx = parseIndexFromTitle(txt);
      return idx && expectedIdx && idx.toUpperCase() === expectedIdx.toUpperCase();
    } catch (_) { return false; }
  };

  const hasProblemContent = () => {
    try {
      const ps = document.querySelector('#pageContent .problem-statement');
      if (!ps) return false;
      const text = (ps.textContent || '').replace(/\s+/g, ' ').trim();
      return text.length > 30;
    } catch (_) { return false; }
  };

  const scheduleTypeset = (node) => {
    try {
      const c = node || (document.querySelector('#pageContent') || document.body);
      const run = () => {
        try {
          if (window.MathJax) {
            if (window.MathJax.Hub && window.MathJax.Hub.Queue) {
              window.MathJax.Hub.Queue(["Typeset", window.MathJax.Hub, c]);
            } else if (window.MathJax.typesetPromise) {
              window.MathJax.typesetPromise([c]).catch(() => {});
            }
          }
        } catch (_) {}
      };
      if (window.requestAnimationFrame) {
        requestAnimationFrame(() => setTimeout(run, 0));
      } else {
        setTimeout(run, 0);
      }
    } catch (_) {}
  };

  const smoothReplace = (existing, container, newNode) => {
    try {
      if (!newNode) return false;
      const h = (() => { try { return container.getBoundingClientRect().height; } catch(_) { return 0; } })();
      if (h) { try { container.style.minHeight = h + 'px'; } catch (_) {} }
      if (existing) {
        existing.insertAdjacentElement('afterend', newNode);
        if (window.requestAnimationFrame) {
          requestAnimationFrame(() => {
            try { existing.remove(); } catch (_) {}
            try { container.style.minHeight = ''; } catch (_) {}
          });
        } else {
          setTimeout(() => {
            try { existing.remove(); } catch (_) {}
            try { container.style.minHeight = ''; } catch (_) {}
          }, 0);
        }
        return true;
      } else if (container) {
        container.appendChild(newNode);
        if (window.requestAnimationFrame) {
          requestAnimationFrame(() => { try { container.style.minHeight = ''; } catch (_) {} });
        } else {
          setTimeout(() => { try { container.style.minHeight = ''; } catch (_) {} }, 0);
        }
        return true;
      }
    } catch (_) {}
    return false;
  };

  const swapTo = async (url) => {
    try {
      if (now() < captchaBackoffUntil) { location.href = url; return; }
      const idx = getIndexFromUrl(url);
      // Ensure bundle is ready (best-effort, non-blocking on failure)
      try { await ensureStatements(); } catch (_) {}
      // Try zero-network swap using preloaded /problems statements
      const stmt = idx ? statements.get(idx) : null;
      if (stmt) {
        const container = document.querySelector('#pageContent');
        if (!container) { location.href = url; return; }
        const currentHolder = container.querySelector('.problemindexholder');
        // Prefer a prebuilt node if available
        let newNode = prepared.get(idx);
        if (!newNode) newNode = buildNodeFromStatement(idx);
        if (!newNode) { location.href = url; return; }
        const existing = currentHolder || container.querySelector('.problem-statement');
        if (!smoothReplace(existing, container, newNode)) { location.href = url; return; }
        // Remove from staging map if it was prepared
        if (prepared.get(idx) === newNode) prepared.delete(idx);
        history.pushState({ cfx: 'problem-swap', url }, '', url);
        if (stmt.title) document.title = stmt.title;
        // Typeset only the inserted node if needed
        scheduleTypeset(newNode);
        // Validate that the statement rendered; otherwise fall back to full fetch
        try {
          const okIdx = validateRenderedIndex(idx);
          const okContent = hasProblemContent();
          if (!okIdx || !okContent) {
            const data = await fetchProblemPage(url);
            if (!container) { location.href = url; return; }
            // Replace only the problem holder if possible for smoother paint
            const tpl2 = document.createElement('template');
            tpl2.innerHTML = data.pageHtml.trim();
            const nh = tpl2.content.querySelector('.problemindexholder') || tpl2.content.querySelector('.problem-statement');
            if (nh) {
              const ex2 = container.querySelector('.problemindexholder') || container.querySelector('.problem-statement');
              if (!smoothReplace(ex2, container, nh.cloneNode(true))) container.innerHTML = data.pageHtml;
            } else {
              container.innerHTML = data.pageHtml;
            }
            document.title = data.title;
          }
        } catch (_) {}
      } else {
        // Fallback to fetch the single problem page
        const data = await fetchProblemPage(url);
        const container = document.querySelector('#pageContent');
        if (!container) { location.href = url; return; }
        // Swap main content without executing inline scripts to avoid CSP/CAPTCHA
        const tpl = document.createElement('template');
        tpl.innerHTML = data.pageHtml.trim();
        const nh = tpl.content.querySelector('.problemindexholder') || tpl.content.querySelector('.problem-statement');
        if (nh) {
          const ex = container.querySelector('.problemindexholder') || container.querySelector('.problem-statement');
          const cloned = nh.cloneNode(true);
          if (!smoothReplace(ex, container, cloned)) container.innerHTML = data.pageHtml;
          else scheduleTypeset(cloned);
        } else {
          container.innerHTML = data.pageHtml;
        }
        history.pushState({ cfx: 'problem-swap', url }, '', url);
        document.title = data.title;
      }
      // Update current index from URL
      try {
        const m = url.match(/\/problem\/([A-Za-z0-9]+)/);
        if (m) currentIdxValue = m[1];
      } catch (_) {}
      // Notify other content scripts (e.g., submit button inserter) to re-run
      try { document.dispatchEvent(new CustomEvent('cfx-problem-swapped', { detail: { url } })); } catch (_) {}
      // Re-typeset math after next paint for smoothness (container-level fallback)
      scheduleTypeset();
      // Scroll to top for consistency
      window.scrollTo(0, 0);
      // Light neighbor prepare after swap (no network)
      const i = currentIndex();
      if (i >= 0) {
        const n1 = (i + 1 < order.length) ? order[i + 1] : null;
        const p1 = (i - 1 >= 0) ? order[i - 1] : null;
        if (n1) prepareIndexNode(n1);
        if (p1) prepareIndexNode(p1);
      }

      // Final guard: if still no content, navigate normally
      if (!hasProblemContent()) {
        location.href = url;
      }
    } catch (e) {
      log('swap failed, falling back to navigation');
      location.href = url;
    }
  };

  const currentIndex = () => order.indexOf(currentIdxValue);

  const handleKey = (e) => {
    if (e.defaultPrevented) return;
    const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : '';
    if (tag === 'input' || tag === 'textarea' || (e.target && e.target.isContentEditable)) return;
    if (e.key === 'ArrowRight' || (e.key === 'l' && e.ctrlKey)) {
      const i = currentIndex();
      if (i >= 0 && i < order.length - 1) {
        e.preventDefault();
        swapTo(problemUrlOf(order[i + 1]));
      } else {
        log('Right key: no next problem (order size:', order.length, 'idx:', i, ')');
      }
    } else if (e.key === 'ArrowLeft' || (e.key === 'h' && e.ctrlKey)) {
      const i = currentIndex();
      if (i > 0) {
        e.preventDefault();
        swapTo(problemUrlOf(order[i - 1]));
      } else {
        log('Left key: no previous problem (order size:', order.length, 'idx:', i, ')');
      }
    }
  };

  const PREFETCH_DELAY_MS = 0;
  let prefetchTimer = null;
  const prefetchNeighbors = () => {
    if (prefetchTimer) { clearTimeout(prefetchTimer); prefetchTimer = null; }
    const i = currentIndex();
    const next = (i >= 0 && i < order.length - 1) ? problemUrlOf(order[i + 1]) : null;
    const prev = (i > 0) ? problemUrlOf(order[i - 1]) : null;
    const tasks = [];
    // If we have bundled statements, no network prefetch needed
    if (!statements.size) {
      if (next && !cache.has(next)) tasks.push(() => fetchProblemPage(next));
      if (prev && !cache.has(prev)) tasks.push(() => fetchProblemPage(prev));
    }
    if (tasks.length === 0) return;
    prefetchTimer = setTimeout(() => sequential(tasks), PREFETCH_DELAY_MS);
  };

  const startWithOrder = () => {
    if (initialized) return;
    initialized = true;
    // Only prefetch neighbors lightly to reduce server impact
    prefetchNeighbors();
    // Also prepare neighbor DOM nodes upfront for instant swap
    const i = currentIndex();
    if (i >= 0) {
      const n1 = (i + 1 < order.length) ? order[i + 1] : null;
      const p1 = (i - 1 >= 0) ? order[i - 1] : null;
      if (n1) prepareIndexNode(n1);
      if (p1) prepareIndexNode(p1);
    }
    window.addEventListener('keydown', handleKey, { passive: false });
    log('preload ready', order);
  };

  const tryDomDiscovery = () => {
    const list = extractFromCurrentPage();
    if (list && list.length > 0) {
      order = list;
      log('discovered problems from DOM:', order);
      startWithOrder();
      return true;
    }
    return false;
  };

  const init = async () => {
    try {
      // 1) Try DOM discovery immediately
      if (tryDomDiscovery()) return;

      // 2) Observe DOM mutations for a bit to catch late-rendered sidebar/content
      let gaveUp = false;
      const mo = new MutationObserver(() => { if (!initialized) tryDomDiscovery(); });
      mo.observe(document.documentElement, { childList: true, subtree: true });
      setTimeout(() => { gaveUp = true; try { mo.disconnect(); } catch (_) {} }, 4000);

      // 3) In parallel, try network discovery (order) and fetch bundled statements
      const [netList] = await Promise.all([
        fetchProblemsList(),
        ensureStatements().catch(() => false),
      ]);
      if (!initialized && netList && netList.length) {
        order = netList;
        log('discovered problems from network:', order);
        startWithOrder();
      }

      // 4) If still not initialized after grace period, give up quietly
      setTimeout(() => {
        if (!initialized) log('No problems discovered; navigation disabled');
      }, 4500);
    } catch (e) {
      log('init failed', e);
    }
  };

  // Recompute meta/index when history changes within same page
  window.addEventListener('popstate', (e) => {
    // On back/forward, just reload to avoid desync.
    if (e && e.state && e.state.cfx === 'problem-swap') {
      location.reload();
    }
  });

  const boot = async () => {
    try {
      const prefs = await getStorage(['cfxInstantNav']);
      const enabled = prefs && Object.prototype.hasOwnProperty.call(prefs, 'cfxInstantNav') ? Boolean(prefs.cfxInstantNav) : true;
      if (!enabled) return; // feature disabled from options
      init();
    } catch (_) { init(); }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
