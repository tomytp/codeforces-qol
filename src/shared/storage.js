export const storage = {
  async get(keys) {
    return await chrome.storage.local.get(keys);
  },
  async set(obj) {
    return await chrome.storage.local.set(obj);
  }
};

