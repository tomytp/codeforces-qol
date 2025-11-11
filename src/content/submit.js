(() => {
  const isSubmitPage = () => /\/(problemset|contest|gym)\/.*submit/.test(location.pathname);
  if (!isSubmitPage()) return;

  const log = (...args) => console.log('[CFX] SubmitPrefill:', ...args);
  let cfxNotifiedSubmit = false;

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

  const findLangSelect = (root = document) => root.querySelector('#programTypeId, select[name="programTypeId"]');
  const findSourceArea = (root = document) => root.querySelector('#sourceCodeTextarea, textarea[name="source"]');
  const findProblemIndexSelect = (root = document) => root.querySelector('select[name="submittedProblemIndex"], #submittedProblemIndex');
  const findProblemsetCodeInput = (root = document) => root.querySelector('input[name="submittedProblemCode"], #submittedProblemCode');

  const chooseCppOption = (sel) => {
    if (!sel) return false;
    const opts = Array.from(sel.options);
    let best = null;
    let bestVersion = -1;
    for (const o of opts) {
      const text = (o.textContent || '').toLowerCase();
      if (!/c\+\+|g\+\+/.test(text)) continue;
      const m = text.match(/(?:c\+\+|g\+\+)\s*(\d{2})/);
      const ver = m ? parseInt(m[1], 10) : 0;
      if (ver > bestVersion) {
        bestVersion = ver;
        best = o;
      }
    }
    if (!best) {
      best = opts.find((o) => /(c\+\+|g\+\+)/i.test(o.textContent || '')) || null;
    }
    if (!best) return false;
    sel.value = best.value;
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  };

  const findSubmitForm = () => {
    const lang = findLangSelect();
    const area = findSourceArea();
    const probSel = findProblemIndexSelect();
    const probCode = findProblemsetCodeInput();
    const candidates = [
      lang && lang.closest('form'),
      area && area.closest('form'),
      probSel && probSel.closest('form'),
      probCode && probCode.closest('form'),
      document.querySelector('form[action*="/submit"]')
    ].filter(Boolean);
    for (const f of candidates) {
      if (f.querySelector('#programTypeId, [name="programTypeId"], #sourceCodeTextarea, textarea[name="source"], [name="submittedProblemIndex"], #submittedProblemIndex, #submittedProblemCode, [name="submittedProblemCode"]')) {
        return f;
      }
    }
    return null;
  };

  const apply = (payload) => {
    const { code, problemIndex, problemId, autoSubmit } = payload || {};
    const lang = findLangSelect();
    const area = findSourceArea();
    if (lang) chooseCppOption(lang);
    if (area && typeof code === 'string') {
      area.value = code;
      area.dispatchEvent(new Event('input', { bubbles: true }));
      area.dispatchEvent(new Event('change', { bubbles: true }));
      area.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
    }
    const probSel = findProblemIndexSelect();
    if (probSel && problemIndex) {
      const opt = Array.from(probSel.options).find(
        (o) => (o.value || '').toUpperCase() === String(problemIndex).toUpperCase()
      );
      if (opt) {
        probSel.value = opt.value;
        probSel.dispatchEvent(new Event('change', { bubbles: true }));
      }
    } else {
      const probCode = findProblemsetCodeInput();
      if (probCode && problemId && problemIndex) {
        probCode.value = `${String(problemId)}${String(problemIndex).toUpperCase()}`;
        probCode.dispatchEvent(new Event('input', { bubbles: true }));
        probCode.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
    if (autoSubmit) {
      let attempts = 0;
      const maxAttempts = 75; // up to ~6s
      const tick = () => {
        attempts++;
        const form = findSubmitForm();
        const submitBtn = form && form.querySelector('button[type="submit"], input[type="submit"]');
        const langNow = findLangSelect();
        const langOk = !!(langNow && langNow.value);
        const areaNow = findSourceArea();
        const codeOk = !!(areaNow && areaNow.value && areaNow.value.length > 0);
        const selNow = findProblemIndexSelect();
        const codeInput = findProblemsetCodeInput();
        const probOk = !!((selNow && selNow.value) || (codeInput && codeInput.value));
        if (form && langOk && codeOk && probOk) {
          if (!cfxNotifiedSubmit) {
            try {
              const path = location.pathname;
              let myUrl = 'https://codeforces.com/problemset/status?my=on';
              const m1 = path.match(/\/contest\/(\d+)\/submit/);
              const m2 = path.match(/\/gym\/(\d+)\/submit/);
              if (m1) myUrl = `https://codeforces.com/contest/${m1[1]}/my`;
              else if (m2) myUrl = `https://codeforces.com/gym/${m2[1]}/my`;
              chrome.runtime.sendMessage({ type: 'CFX_SUBMITTED', myUrl });
            } catch (e) {}
            cfxNotifiedSubmit = true;
          }
          // Clear payload then submit
          setStorage({ cfx_submit_payload: null }, () => {
            if (submitBtn) submitBtn.click();
            else form.submit();
          });
          return;
        }
        if (attempts < maxAttempts) setTimeout(tick, 80);
        else setStorage({ cfx_submit_payload: null });
      };
      setTimeout(tick, 50);
    }
  };

  const tryApply = () => {
    getStorage(['cfx_submit_payload'], (res) => {
      const payload = res && res.cfx_submit_payload;
      if (!payload) return;
      apply(payload);
      log('applied payload');
    });
  };

  const mo = new MutationObserver(tryApply);
  mo.observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tryApply);
  } else {
    tryApply();
  }
})();
