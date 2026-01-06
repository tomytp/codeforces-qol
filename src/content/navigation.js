/**
 * Codeforces QoL - Navigation Content Script
 * Handles Instant Problem Navigation: arrow key navigation between problems.
 */
(() => {
  'use strict';

  if (!/\/(contest|gym)\/(\d+)\/problem\/([A-Za-z0-9]+)/.test(location.pathname)) return;

  const DEBUG = false;
  const log = (...args) => { if (DEBUG) console.log('[CFX] Nav:', ...args); };

  // Use shared storage utilities (injected via manifest)
  const storage = window.cfxStorage || {
    get: (keys) => new Promise((resolve) => chrome.storage.local.get(keys, resolve))
  };

  /**
   * Parse contest/problem metadata from URL
   */
  const parseMeta = () => {
    const m1 = location.pathname.match(/\/contest\/(\d+)\/problem\/([A-Za-z0-9]+)/);
    if (m1) return { type: 'contest', id: m1[1], index: m1[2], base: `/contest/${m1[1]}` };

    const m2 = location.pathname.match(/\/gym\/(\d+)\/problem\/([A-Za-z0-9]+)/);
    if (m2) return { type: 'gym', id: m2[1], index: m2[2], base: `/gym/${m2[1]}` };

    return null;
  };

  const meta = parseMeta();
  if (!meta) return;

  const ORIGIN = location.origin;
  const contestRootUrl = `${ORIGIN}${meta.base}`;
  const problemsAltUrl = `${ORIGIN}${meta.base}/problems`;
  const standingsUrl = `${ORIGIN}${meta.base}/standings`;
  const apiProblemsUrl = meta.type === 'contest'
    ? `${ORIGIN}/api/contest.standings?contestId=${encodeURIComponent(meta.id)}&from=1&count=1`
    : null;
  const problemUrlOf = (idx) => `${ORIGIN}${meta.base}/problem/${encodeURIComponent(idx)}`;

  // State
  const cache = new Map();
  let order = [];
  let currentIdxValue = meta.index.toUpperCase();
  let initialized = false;
  const statements = new Map();
  const prepared = new Map();
  let staging = null;
  let captchaBackoffUntil = 0;

  const now = () => Date.now();

  /**
   * Extract problem indices from parsed HTML document
   */
  const extractProblemIndices = (doc) => {
    const idxs = [];

    // Try problems table first
    const table = doc.querySelector('table.problems');
    if (table) {
      const links = Array.from(table.querySelectorAll('a[href*="/problem/"]'));
      for (const a of links) {
        const m = (a.getAttribute('href') || '').match(/\/problem\/([A-Za-z0-9]+)/);
        if (m) idxs.push(m[1]);
      }
    }

    // Scan all anchors if table didn't work
    if (idxs.length === 0) {
      const baseRe = new RegExp(`^((https?:)?\/\/[^/]+)?${meta.base.replace(/\//g, '\\/')}\\/problem\\/([A-Za-z0-9]+)`);
      const links = Array.from(doc.querySelectorAll('a[href*="/problem/"]'));
      for (const a of links) {
        const href = a.getAttribute('href') || '';
        const m = href.match(baseRe);
        if (m) idxs.push(m[3] || m[1]);
      }
    }

    // Try problem statement titles
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
    return idxs.filter((x) => {
      if (seen.has(x)) return false;
      seen.add(x);
      return true;
    });
  };

  /**
   * Extract problem indices from current page DOM
   */
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

      // Fallback to whole document
      if (idxs.length === 0) {
        const allLinks = Array.from(document.querySelectorAll('a[href*="/problem/"]'));
        for (const a of allLinks) {
          const href = a.getAttribute('href') || '';
          const m = href.match(baseRe);
          if (m) idxs.push(m[1]);
        }
      }
    } catch (_) { }

    const seen = new Set();
    return idxs.filter((x) => {
      if (seen.has(x)) return false;
      seen.add(x);
      return true;
    });
  };

  /**
   * Fetch problems list from various sources
   */
  const fetchProblemsList = async () => {
    try {
      // Try current page first
      let list = extractFromCurrentPage();
      if (list.length > 0) return list;

      // Try API for contests
      if (apiProblemsUrl) {
        try {
          const res = await fetch(apiProblemsUrl, { credentials: 'include' });
          const json = await res.json();
          if (json?.status === 'OK' && json.result?.problems) {
            list = [...new Set(json.result.problems.map((p) => p.index).filter(Boolean))];
          }
        } catch (_) { }
        if (list.length > 0) return list;
      }

      // Try HTML fallbacks
      for (const url of [contestRootUrl, problemsAltUrl, standingsUrl]) {
        try {
          const res = await fetch(url, { credentials: 'include' });
          const text = await res.text();
          const doc = new DOMParser().parseFromString(text, 'text/html');
          list = extractProblemIndices(doc);
          if (list.length > 0) return list;
        } catch (_) { }
      }

      return [];
    } catch (e) {
      log('fetchProblemsList error:', e);
      return [];
    }
  };

  /**
   * Parse problem index from title text
   */
  const parseIndexFromTitle = (txt) => {
    const m = (txt || '').trim().match(/^([A-Za-z0-9]+)[\s\.:\-]/);
    return m ? m[1] : null;
  };

  /**
   * Check if document is a CAPTCHA page
   */
  const isCaptchaDoc = (doc, text) => {
    try {
      const title = doc?.title || '';
      if (/captcha|enter the code|verification/i.test(title)) return true;
      const body = (text || '').toLowerCase();
      if (body.includes('captcha') || body.includes('enter the code from the picture')) return true;
      if (doc?.querySelector('input[name="captcha"]')) return true;
    } catch (_) { }
    return false;
  };

  /**
   * Fetch a problem page with caching
   */
  const fetchProblemPage = async (url) => {
    if (cache.has(url)) return cache.get(url);

    const res = await fetch(url, { credentials: 'include' });
    const text = await res.text();
    const doc = new DOMParser().parseFromString(text, 'text/html');

    if (isCaptchaDoc(doc, text)) {
      captchaBackoffUntil = now() + 5 * 60 * 1000;
      throw new Error('captcha');
    }

    const page = doc.querySelector('#pageContent');
    const title = doc.title || 'Codeforces';
    const html = page ? page.innerHTML : text;
    const data = { title, pageHtml: html };
    cache.set(url, data);
    return data;
  };

  /**
   * Ensure staging container for prepared nodes
   */
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

  /**
   * Fetch and store all problem statements from /problems page
   */
  const ensureStatements = async () => {
    if (statements.size) return true;

    try {
      const res = await fetch(problemsAltUrl, { credentials: 'include' });
      const html = await res.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');

      const holders = Array.from(doc.querySelectorAll('.problemindexholder'));
      if (holders.length) {
        for (const holder of holders) {
          const titleEl = holder.querySelector('.problem-statement .header .title');
          const titleText = titleEl ? (titleEl.textContent || '').trim() : '';
          const idx = parseIndexFromTitle(titleText);
          if (idx) statements.set(idx, { html: holder.outerHTML, title: titleText });
        }
      } else {
        const blocks = Array.from(doc.querySelectorAll('.problem-statement'));
        for (const block of blocks) {
          const titleEl = block.querySelector('.header .title');
          const titleText = titleEl ? (titleEl.textContent || '').trim() : '';
          const idx = parseIndexFromTitle(titleText);
          if (idx) statements.set(idx, { html: block.outerHTML, title: titleText });
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

  /**
   * Build DOM node from stored statement
   */
  const buildNodeFromStatement = (idx) => {
    const stmt = statements.get(idx);
    if (!stmt) return null;

    const doc = new DOMParser().parseFromString(stmt.html.trim(), 'text/html');
    let node = doc.querySelector('.problemindexholder')
      || doc.querySelector('.problem-statement');
    return node ? document.adoptNode(node.cloneNode(true)) : null;
  };

  /**
   * Schedule MathJax typesetting
   * Content scripts can't access window.MathJax directly (isolated world),
   * so we inject a script into the page context.
   */
  const scheduleTypeset = () => {
    const run = () => {
      // Create a script element that runs in the page's context
      const script = document.createElement('script');
      script.textContent = `
        (function() {
          try {
            if (window.MathJax && window.MathJax.Hub) {
              MathJax.Hub.Queue(['Typeset', MathJax.Hub]);
            }
          } catch(e) {}
        })();
      `;
      document.documentElement.appendChild(script);
      script.remove();
    };

    // Trigger immediately for fastest response
    run();
  };

  /**
   * Prepare a problem node for instant swap - includes MathJax pre-rendering
   */
  const prepareIndexNode = (idx) => {
    try {
      if (!idx || prepared.has(idx)) return prepared.get(idx) || null;

      const node = buildNodeFromStatement(idx);
      if (!node) return null;

      // Add unique ID for MathJax targeting
      const nodeId = `cfx-prepared-${idx}`;
      node.id = nodeId;

      const host = ensureStaging();
      host.appendChild(node);
      prepared.set(idx, node);

      // Pre-render MathJax on this staged node
      const script = document.createElement('script');
      script.textContent = `
        (function() {
          try {
            var el = document.getElementById('${nodeId}');
            if (el && window.MathJax && window.MathJax.Hub) {
              MathJax.Hub.Queue(['Typeset', MathJax.Hub, el]);
            }
          } catch(e) {}
        })();
      `;
      document.documentElement.appendChild(script);
      script.remove();

      // Also warm up images
      const imgs = Array.from(node.querySelectorAll('img'));
      imgs.forEach((img) => {
        if (img.decode) img.decode().catch(() => { });
      });

      return node;
    } catch (_) {
      return null;
    }
  };


  /**
   * Check if rendered problem matches expected index
   */
  const validateRenderedIndex = (expectedIdx) => {
    try {
      const titleEl = document.querySelector('#pageContent .problem-statement .header .title');
      const txt = titleEl ? (titleEl.textContent || '').trim() : '';
      const idx = parseIndexFromTitle(txt);
      return idx && expectedIdx && idx.toUpperCase() === expectedIdx.toUpperCase();
    } catch (_) {
      return false;
    }
  };

  /**
   * Check if problem content exists
   */
  const hasProblemContent = () => {
    try {
      const ps = document.querySelector('#pageContent .problem-statement');
      if (!ps) return false;
      const text = (ps.textContent || '').replace(/\s+/g, ' ').trim();
      return text.length > 30;
    } catch (_) {
      return false;
    }
  };

  /**
   * Smooth DOM replacement
   */
  const smoothReplace = (existing, container, newNode) => {
    try {
      if (!newNode) return false;

      const h = container.getBoundingClientRect?.().height || 0;
      if (h) container.style.minHeight = h + 'px';

      if (existing) {
        existing.insertAdjacentElement('afterend', newNode);
        requestAnimationFrame?.(() => {
          existing.remove();
          container.style.minHeight = '';
        }) || setTimeout(() => {
          existing.remove();
          container.style.minHeight = '';
        }, 0);
        return true;
      } else if (container) {
        container.appendChild(newNode);
        requestAnimationFrame?.(() => { container.style.minHeight = ''; })
          || setTimeout(() => { container.style.minHeight = ''; }, 0);
        return true;
      }
    } catch (_) { }
    return false;
  };

  const getIndexFromUrl = (u) => {
    const m = (u || '').match(/\/problem\/([A-Za-z0-9]+)/);
    return m ? m[1] : null;
  };

  const currentIndex = () => {
    const upper = (currentIdxValue || '').toUpperCase();
    return order.findIndex(x => x.toUpperCase() === upper);
  };

  /**
   * Swap to a different problem
   */
  const swapTo = async (url) => {
    try {
      if (now() < captchaBackoffUntil) {
        location.href = url;
        return;
      }

      const idx = getIndexFromUrl(url);
      await ensureStatements().catch(() => { });

      const stmt = idx ? statements.get(idx) : null;

      if (stmt) {
        const container = document.querySelector('#pageContent');
        if (!container) { location.href = url; return; }

        let newNode = prepared.get(idx) || buildNodeFromStatement(idx);
        if (!newNode) { location.href = url; return; }

        const existing = container.querySelector('.problemindexholder')
          || container.querySelector('.problem-statement');

        if (!smoothReplace(existing, container, newNode)) {
          location.href = url;
          return;
        }

        if (prepared.get(idx) === newNode) prepared.delete(idx);

        history.pushState({ cfx: 'problem-swap', url }, '', url);
        if (stmt.title) document.title = stmt.title;

        log('Swapped to', idx, '- scheduling MathJax typeset');
        scheduleTypeset();

        // Validate render
        if (!validateRenderedIndex(idx) || !hasProblemContent()) {
          const data = await fetchProblemPage(url);
          const fetchedDoc = new DOMParser().parseFromString(data.pageHtml.trim(), 'text/html');
          const nh = fetchedDoc.querySelector('.problemindexholder')
            || fetchedDoc.querySelector('.problem-statement');
          if (nh) {
            const ex = container.querySelector('.problemindexholder')
              || container.querySelector('.problem-statement');
            if (!smoothReplace(ex, container, document.adoptNode(nh.cloneNode(true)))) {
              container.replaceChildren(...Array.from(fetchedDoc.body.childNodes).map(n => document.adoptNode(n)));
            }
          } else {
            container.replaceChildren(...Array.from(fetchedDoc.body.childNodes).map(n => document.adoptNode(n)));
          }
          document.title = data.title;
        }
      } else {
        // Fallback to fetch
        const data = await fetchProblemPage(url);
        const container = document.querySelector('#pageContent');
        if (!container) { location.href = url; return; }

        const parsedDoc = new DOMParser().parseFromString(data.pageHtml.trim(), 'text/html');
        const nh = parsedDoc.querySelector('.problemindexholder')
          || parsedDoc.querySelector('.problem-statement');

        if (nh) {
          const ex = container.querySelector('.problemindexholder')
            || container.querySelector('.problem-statement');
          const cloned = document.adoptNode(nh.cloneNode(true));
          if (!smoothReplace(ex, container, cloned)) {
            container.replaceChildren(...Array.from(parsedDoc.body.childNodes).map(n => document.adoptNode(n)));
          } else {
            scheduleTypeset();
          }
        } else {
          container.replaceChildren(...Array.from(parsedDoc.body.childNodes).map(n => document.adoptNode(n)));
        }

        history.pushState({ cfx: 'problem-swap', url }, '', url);
        document.title = data.title;
      }

      // Update current index
      const m = url.match(/\/problem\/([A-Za-z0-9]+)/);
      if (m) currentIdxValue = m[1].toUpperCase();

      // Notify other scripts
      document.dispatchEvent(new CustomEvent('cfx-problem-swapped', { detail: { url } }));

      scheduleTypeset();
      window.scrollTo(0, 0);

      // Prepare neighbors
      const i = currentIndex();
      if (i >= 0) {
        if (i + 1 < order.length) prepareIndexNode(order[i + 1]);
        if (i - 1 >= 0) prepareIndexNode(order[i - 1]);
      }

      if (!hasProblemContent()) {
        location.href = url;
      }
    } catch (e) {
      log('swap failed:', e);
      location.href = url;
    }
  };

  /**
   * Handle keyboard navigation
   */
  const handleKey = (e) => {
    if (e.defaultPrevented) return;

    const tag = e.target?.tagName?.toLowerCase() || '';
    if (tag === 'input' || tag === 'textarea' || e.target?.isContentEditable) return;

    if (e.key === 'ArrowRight' || (e.key === 'l' && e.ctrlKey)) {
      const i = currentIndex();
      if (i >= 0 && i < order.length - 1) {
        e.preventDefault();
        swapTo(problemUrlOf(order[i + 1]));
      }
    } else if (e.key === 'ArrowLeft' || (e.key === 'h' && e.ctrlKey)) {
      const i = currentIndex();
      if (i > 0) {
        e.preventDefault();
        swapTo(problemUrlOf(order[i - 1]));
      }
    }
  };

  /**
   * Prefetch neighboring problems
   */
  const prefetchNeighbors = () => {
    const i = currentIndex();
    const tasks = [];

    if (!statements.size) {
      const next = (i >= 0 && i < order.length - 1) ? problemUrlOf(order[i + 1]) : null;
      const prev = (i > 0) ? problemUrlOf(order[i - 1]) : null;
      if (next && !cache.has(next)) tasks.push(() => fetchProblemPage(next));
      if (prev && !cache.has(prev)) tasks.push(() => fetchProblemPage(prev));
    }

    if (tasks.length) {
      tasks.forEach((t) => t().catch(() => { }));
    }
  };

  /**
   * Start navigation with discovered problem order
   */
  const startWithOrder = () => {
    if (initialized) return;
    initialized = true;

    prefetchNeighbors();

    const i = currentIndex();
    if (i >= 0) {
      if (i + 1 < order.length) prepareIndexNode(order[i + 1]);
      if (i - 1 >= 0) prepareIndexNode(order[i - 1]);
    }

    window.addEventListener('keydown', handleKey, { passive: false });
    log('ready, order:', order);
  };

  /**
   * Try to discover problems from current page DOM
   */
  const tryDomDiscovery = () => {
    const list = extractFromCurrentPage();
    if (list.length > 0) {
      order = list;
      log('discovered from DOM:', order);
      startWithOrder();
      return true;
    }
    return false;
  };

  /**
   * Initialize navigation
   */
  const init = async () => {
    try {
      if (tryDomDiscovery()) return;

      // Watch for DOM changes
      const mo = new MutationObserver(() => { if (!initialized) tryDomDiscovery(); });
      mo.observe(document.documentElement, { childList: true, subtree: true });
      setTimeout(() => mo.disconnect(), 4000);

      // Try network discovery
      const [netList] = await Promise.all([
        fetchProblemsList(),
        ensureStatements().catch(() => false)
      ]);

      if (!initialized && netList.length) {
        order = netList;
        log('discovered from network:', order);
        startWithOrder();
      }

      setTimeout(() => {
        if (!initialized) log('No problems discovered');
      }, 4500);
    } catch (e) {
      log('init failed:', e);
    }
  };

  // Handle history navigation
  window.addEventListener('popstate', (e) => {
    if (e?.state?.cfx === 'problem-swap') {
      location.reload();
    }
  });

  /**
   * Boot with feature check
   */
  const boot = async () => {
    try {
      const prefs = await storage.get(['cfxInstantNav']);
      const enabled = prefs.hasOwnProperty?.('cfxInstantNav') ? Boolean(prefs.cfxInstantNav) : true;
      if (!enabled) return;
      init();
    } catch (_) {
      init();
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
