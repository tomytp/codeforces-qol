// Background script (Manifest V2)
chrome.runtime.onInstalled.addListener(() => {
  console.log('Codeforces QoL installed');
});

// Handle background submission flow to avoid visible navigation.
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || msg.type !== 'CFX_SUBMIT_CLIPBOARD') return;
  const { meta, code } = msg;
  if (!meta || !code) return;

  const buildSubmitUrl = () => {
    if (meta.type === 'contest') return `https://codeforces.com/contest/${meta.contestId}/submit`;
    if (meta.type === 'gym') return `https://codeforces.com/gym/${meta.gymId}/submit`;
    if (meta.type === 'problemset') return `https://codeforces.com/problemset/submit`;
    return `https://codeforces.com/problemset/submit`;
  };
  const buildMyUrl = () => {
    if (meta.type === 'contest') return `https://codeforces.com/contest/${meta.contestId}/my`;
    if (meta.type === 'gym') return `https://codeforces.com/gym/${meta.gymId}/my`;
    return `https://codeforces.com/problemset/status?my=on`;
  };

  const payload = {
    code,
    problemIndex: meta.problemIndex,
    problemId: meta.problemId,
    autoSubmit: true,
    when: Date.now()
  };

  // Use a simple inflight lock to avoid duplicate submissions
  chrome.storage.local.get(['cfx_submit_inflight'], (res) => {
    const now = Date.now();
    const inflight = res && res.cfx_submit_inflight;
    if (inflight && inflight.expiresAt && inflight.expiresAt > now) {
      sendResponse({ ok: false, reason: 'inflight' });
      return;
    }
    const lock = { startedAt: now, expiresAt: now + 45000 };
    const originTabId = sender && sender.tab && sender.tab.id;
    chrome.storage.local.set({ cfx_submit_inflight: lock, cfx_submit_payload: payload }, () => {
      const submitUrl = buildSubmitUrl();
      const myUrl = buildMyUrl();

      chrome.tabs.create({ url: submitUrl, active: false }, (submitTab) => {
        if (!submitTab || !submitTab.id) return;

        // Hide the tab in Firefox if supported (requires "tabHide" permission)
        try {
          if (chrome.tabs.hide) {
            chrome.tabs.hide(submitTab.id);
          } else if (typeof browser !== 'undefined' && browser.tabs && browser.tabs.hide) {
            browser.tabs.hide(submitTab.id).catch(() => {});
          }
        } catch (_) {}

        // Track when the submit tab reaches the status/my page and fully loads
        let reachedMyUrl = false;
        const isMyUrl = (url) => /\/(contest|gym)\/\d+\/(my|status)|problemset\/status/.test(url || '');
        const listener = (tabId, changeInfo, tab) => {
          if (tabId !== submitTab.id) return;
          if (changeInfo.url && isMyUrl(changeInfo.url)) {
            reachedMyUrl = true;
          }
          if (changeInfo.status === 'complete') {
            const currentUrl = (tab && tab.url) || changeInfo.url || '';
            if (reachedMyUrl || isMyUrl(currentUrl)) {
              chrome.tabs.onUpdated.removeListener(listener);
              if (originTabId) {
                try { chrome.tabs.reload(originTabId); } catch (_) {}
              }
              try { chrome.tabs.remove(submitTab.id); } catch (_) {}
              chrome.storage.local.remove('cfx_submit_inflight');
            }
          }
        };
        chrome.tabs.onUpdated.addListener(listener);

        // Safety: clear inflight if nothing happens after timeout
        setTimeout(() => {
          chrome.storage.local.get(['cfx_submit_inflight'], (r2) => {
            const i2 = r2 && r2.cfx_submit_inflight;
            if (i2 && i2.expiresAt && i2.expiresAt <= Date.now()) {
              chrome.storage.local.remove('cfx_submit_inflight');
              try { chrome.tabs.remove(submitTab.id); } catch (_) {}
            }
          });
        }, 46000);
      });
    });
  });

  sendResponse({ ok: true });
  return true;
});

// When submit content script triggers submission, navigate submit tab to My/Status silently
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (!msg || msg.type !== 'CFX_SUBMITTED') return;
  const tabId = sender && sender.tab && sender.tab.id;
  const myUrl = msg.myUrl;
  if (tabId && myUrl) {
    setTimeout(() => {
      // Keep the tab inactive; onUpdated listener will handle reload+close
      chrome.tabs.update(tabId, { url: myUrl, active: false });
    }, 500);
  }
});
