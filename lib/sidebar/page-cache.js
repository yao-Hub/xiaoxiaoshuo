const { loadPage } = require('../page-loader');

const MAX_PAGE_CACHE_ITEMS = 12;

class PageCache {
  constructor() {
    this.entries = new Map();
  }

  get(url) {
    const entry = this.entries.get(url);
    if (!entry || !entry.page) {
      return null;
    }
    this.store(url, entry.page);
    return entry.page;
  }

  has(url) {
    return this.entries.has(url);
  }

  delete(url) {
    this.entries.delete(url);
  }

  async fetch(url, onProgress, signal) {
    const existing = this.entries.get(url);
    if (existing && existing.page) {
      return existing.page;
    }
    if (existing && existing.promise) {
      return existing.promise;
    }

    const promise = loadPage(url, { onProgress, signal })
      .then((page) => {
        this.store(url, page);
        return page;
      })
      .catch((error) => {
        this.entries.delete(url);
        throw error;
      });
    this.entries.set(url, { promise });
    return promise;
  }

  prefetch(url) {
    if (!url || this.entries.has(url)) {
      return;
    }
    const promise = loadPage(url)
      .then((page) => {
        this.store(url, page);
        return page;
      })
      .catch(() => {
        this.entries.delete(url);
      });
    this.entries.set(url, { promise });
  }

  store(url, page) {
    this.entries.delete(url);
    this.entries.set(url, { page });
    while (this.entries.size > MAX_PAGE_CACHE_ITEMS) {
      const oldestKey = this.entries.keys().next().value;
      if (!oldestKey) {
        break;
      }
      this.entries.delete(oldestKey);
    }
  }
}

module.exports = { PageCache };
