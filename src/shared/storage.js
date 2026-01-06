/**
 * Codeforces QoL - Unified Storage Utilities
 * Cross-browser compatible storage wrapper for Firefox (browser.*) and Chrome (chrome.*)
 */

(function() {
  'use strict';

  // Detect browser API
  const browserApi = typeof browser !== 'undefined' ? browser : chrome;
  const storageArea = browserApi.storage.local;

  /**
   * Get values from storage (Promise-based)
   * @param {string|string[]} keys - Key(s) to retrieve
   * @returns {Promise<Object>} Object with key-value pairs
   */
  const get = (keys) => {
    return new Promise((resolve, reject) => {
      try {
        if (typeof browser !== 'undefined' && browser.storage) {
          browser.storage.local.get(keys).then(resolve).catch(reject);
        } else {
          chrome.storage.local.get(keys, (result) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(result || {});
            }
          });
        }
      } catch (e) {
        reject(e);
      }
    });
  };

  /**
   * Set values in storage (Promise-based)
   * @param {Object} items - Object with key-value pairs to store
   * @returns {Promise<void>}
   */
  const set = (items) => {
    return new Promise((resolve, reject) => {
      try {
        if (typeof browser !== 'undefined' && browser.storage) {
          browser.storage.local.set(items).then(resolve).catch(reject);
        } else {
          chrome.storage.local.set(items, () => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve();
            }
          });
        }
      } catch (e) {
        reject(e);
      }
    });
  };

  /**
   * Remove values from storage (Promise-based)
   * @param {string|string[]} keys - Key(s) to remove
   * @returns {Promise<void>}
   */
  const remove = (keys) => {
    return new Promise((resolve, reject) => {
      try {
        if (typeof browser !== 'undefined' && browser.storage) {
          browser.storage.local.remove(keys).then(resolve).catch(reject);
        } else {
          chrome.storage.local.remove(keys, () => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve();
            }
          });
        }
      } catch (e) {
        reject(e);
      }
    });
  };

  /**
   * Get values from storage (callback-based for legacy compatibility)
   * @param {string|string[]} keys - Key(s) to retrieve
   * @param {Function} callback - Callback receiving result object
   */
  const getSync = (keys, callback) => {
    get(keys).then(callback).catch((e) => {
      console.error('[CFX] Storage get error:', e);
      callback({});
    });
  };

  /**
   * Set values in storage (callback-based for legacy compatibility)
   * @param {Object} items - Object with key-value pairs to store
   * @param {Function} [callback] - Optional callback after save
   */
  const setSync = (items, callback) => {
    set(items).then(() => callback && callback()).catch((e) => {
      console.error('[CFX] Storage set error:', e);
      callback && callback();
    });
  };

  /**
   * Listen for storage changes
   * @param {Function} listener - Callback(changes, areaName)
   */
  const onChanged = (listener) => {
    if (browserApi.storage && browserApi.storage.onChanged) {
      browserApi.storage.onChanged.addListener(listener);
    }
  };

  // Export to window for content script access
  window.cfxStorage = {
    get,
    set,
    remove,
    getSync,
    setSync,
    onChanged
  };

  // Also expose as window.storage for gym-page.js compatibility
  window.storage = {
    get,
    set,
    remove
  };
})();
