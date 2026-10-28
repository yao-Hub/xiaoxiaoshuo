const HISTORY_KEY = 'xiaoxiaoshuo.history';
const SEARCH_HISTORY_KEY = 'xiaoxiaoshuo.searchHistory';
const MAX_HISTORY_ITEMS = 20;

class HistoryStore {
  constructor(storage) {
    this.storage = storage;
    this.history = this.readHistory();
    this.searchHistory = this.readSearchHistory();
  }

  readHistory() {
    const stored = this.storage && this.storage.get ? this.storage.get(HISTORY_KEY, []) : [];
    if (!Array.isArray(stored)) {
      return [];
    }
    return stored
      .map((item) => (typeof item === 'string' ? { url: item, title: item } : item))
      .filter((item) => item && typeof item.url === 'string' && item.url)
      .slice(0, MAX_HISTORY_ITEMS);
  }

  readSearchHistory() {
    const stored = this.storage && this.storage.get ? this.storage.get(SEARCH_HISTORY_KEY, []) : [];
    if (!Array.isArray(stored)) {
      return [];
    }
    return stored
      .map((item) => String(item || '').trim())
      .filter(Boolean)
      .slice(0, MAX_HISTORY_ITEMS);
  }

  async rememberSearch(query) {
    const value = String(query || '').trim();
    if (!value) return;
    this.searchHistory = [value, ...this.searchHistory.filter((item) => item !== value)].slice(
      0,
      MAX_HISTORY_ITEMS
    );
    await this.persistSearchHistory();
  }

  async deleteSearchHistory(query) {
    const value = String(query || '').trim();
    if (!value) return;
    this.searchHistory = this.searchHistory.filter((item) => item !== value);
    await this.persistSearchHistory();
  }

  async clearSearchHistory() {
    this.searchHistory = [];
    await this.persistSearchHistory();
  }

  async rememberPage(page, fallbackUrl) {
    const url = page && page.url ? page.url : fallbackUrl;
    if (!url) return;
    const title = page && page.title ? page.title : url;
    this.history = [
      { url, title, lastOpenedAt: Date.now() },
      ...this.history.filter((item) => item.url !== url)
    ].slice(0, MAX_HISTORY_ITEMS);
    await this.persistHistory();
  }

  async deleteReadingHistory(url) {
    const value = String(url || '').trim();
    if (!value) return;
    this.history = this.history.filter((item) => item.url !== value);
    await this.persistHistory();
  }

  async deleteReadingHistoryItems(urls) {
    const selected = new Set(
      (Array.isArray(urls) ? urls : []).map((url) => String(url || '').trim()).filter(Boolean)
    );
    if (!selected.size) return;
    this.history = this.history.filter((item) => !selected.has(item.url));
    await this.persistHistory();
  }

  async clearReadingHistory() {
    this.history = [];
    await this.persistHistory();
  }

  async persistSearchHistory() {
    if (this.storage && this.storage.update) {
      await this.storage.update(SEARCH_HISTORY_KEY, this.searchHistory);
    }
  }

  async persistHistory() {
    if (this.storage && this.storage.update) {
      await this.storage.update(HISTORY_KEY, this.history);
    }
  }
}

module.exports = { HistoryStore };
