const vscode = require('vscode');
const { isLikelyUrl, normalizeUrl } = require('./url');
const { searchBooks } = require('./page-loader');
const { HistoryStore } = require('./sidebar/history-store');
const { NavigationStore } = require('./sidebar/navigation-store');
const { PageCache } = require('./sidebar/page-cache');
const { RequestManager } = require('./sidebar/request-manager');
const {
  renderErrorHtml,
  renderHistoryPage,
  renderHomeHtml,
  renderLoadingHtml,
  renderPageHtml,
  renderSearchErrorHtml,
  renderSearchLoadingHtml
} = require('./renderer');

const VIEW_CONTAINER_ID = 'xiaoxiaoshuoSidebar';
const VIEW_ID = 'xiaoxiaoshuo.readerView';

class NovelReaderSidebarProvider {
  constructor(extensionUri, storage) {
    this.extensionUri = extensionUri;
    this.storage = storage;
    this.historyStore = new HistoryStore(storage);
    this.pageCache = new PageCache();
    this.navigationStore = new NavigationStore();
    this.requestManager = new RequestManager();
    this.currentPage = undefined;
    this.loadSequence = 0;
    this.currentUrl = '';
    this.currentMode = 'url';
    this.currentQuery = '';
    this.searchInputQuery = '';
    this.view = undefined;
  }

  get history() {
    return this.historyStore.history;
  }

  set history(value) {
    this.historyStore.history = value;
  }

  get searchHistory() {
    return this.historyStore.searchHistory;
  }

  set searchHistory(value) {
    this.historyStore.searchHistory = value;
  }

  get navigationStack() {
    return this.navigationStore.backStack;
  }

  set navigationStack(value) {
    this.navigationStore.backStack = value;
  }

  get forwardStack() {
    return this.navigationStore.forwardStack;
  }

  set forwardStack(value) {
    this.navigationStore.forwardStack = value;
  }

  resolveWebviewView(webviewView) {
    this.view = webviewView;
    webviewView.webview.options = {
      enableScripts: true
    };

    webviewView.webview.html = renderHomeHtml(
      webviewView.webview,
      this.currentUrl,
      this.history,
      this.searchHistory
    );

    webviewView.webview.onDidReceiveMessage(async (message) => {
      if (!message || typeof message.command !== 'string') {
        return;
      }

      if (message.command === 'load') {
        const value = String(message.value || message.url || '').trim();
        if (!value) {
          this.showToast('请输入书名或地址。');
          return;
        }

        if (isLikelyUrl(value)) {
          const normalized = normalizeUrl(value);
          if (!normalized.ok) {
            this.showToast(normalized.message);
            return;
          }
          await this.openUrl(normalized.url);
        } else {
          await this.search(value);
        }
        return;
      }

      if (message.command === 'search') {
        await this.search(message.query);
        return;
      }

      if (message.command === 'back') {
        await this.goBack();
        return;
      }

      if (message.command === 'forward') {
        await this.goForward();
        return;
      }

      if (message.command === 'history') {
        await this.showHistory();
        return;
      }

      if (message.command === 'refresh') {
        await this.refresh();
        return;
      }

      if (message.command === 'deleteSearchHistory') {
        await this.deleteSearchHistory(message.query);
        return;
      }

      if (message.command === 'clearSearchHistory') {
        await this.clearSearchHistory();
        return;
      }

      if (message.command === 'deleteReadingHistory') {
        await this.deleteReadingHistory(message.url);
        return;
      }

      if (message.command === 'deleteReadingHistoryItems') {
        await this.deleteReadingHistoryItems(message.urls);
        return;
      }

      if (message.command === 'clearReadingHistory') {
        await this.clearReadingHistory();
        return;
      }

      if (message.command === 'openItem') {
        const normalized = normalizeUrl(message.url);
        if (!normalized.ok) {
          this.showToast(normalized.message);
          return;
        }

        await this.openUrl(normalized.url, { preserveSearchInput: true });
        return;
      }

      if (message.command === 'openExternal') {
        const normalized = normalizeUrl(message.url || this.currentUrl);
        if (normalized.ok) {
          await vscode.env.openExternal(vscode.Uri.parse(normalized.url));
        }
      }
    });

    if (this.currentMode === 'history') {
      this.showHistory();
    } else if (this.currentMode === 'title' && this.currentQuery) {
      this.search(this.currentQuery);
    } else if (this.currentUrl) {
      this.loadPage(this.currentUrl);
    }
  }

  async focus() {
    try {
      await vscode.commands.executeCommand(`workbench.view.extension.${VIEW_CONTAINER_ID}`);
    } catch {
      await vscode.commands.executeCommand(`${VIEW_ID}.focus`);
    }
  }

  async openPrompt() {
    await this.focus();

    const input = await vscode.window.showInputBox({
      title: '打开小小小说',
      prompt: '输入书名或地址，插件会自动识别输入类型。',
      placeHolder: 'https://example.com/book/1.html',
      value: this.currentMode === 'title' ? this.currentQuery : this.currentUrl,
      validateInput(value) {
        return String(value || '').trim() ? undefined : '请输入书名或地址。';
      }
    });

    if (!input) {
      return;
    }

    if (isLikelyUrl(input)) {
      const normalized = normalizeUrl(input);
      if (!normalized.ok) {
        vscode.window.showErrorMessage(normalized.message);
        return;
      }
      await this.openUrl(normalized.url);
      return;
    }

    await this.search(input);
  }

  async openUrl(url, options = {}) {
    const normalized = normalizeUrl(url);
    if (!normalized.ok) {
      throw new Error(normalized.message);
    }

    this.pushCurrentPage();
    this.currentUrl = normalized.url;
    this.currentMode = 'url';
    this.currentQuery = '';
    if (!options.preserveSearchInput) {
      this.searchInputQuery = '';
    }

    if (this.view) {
      await this.loadPage(normalized.url);
    }
  }

  async search(query, pushCurrent = true) {
    const value = String(query || '').trim();
    if (!value) {
      return;
    }

    if (pushCurrent) {
      this.pushCurrentPage();
    }
    this.currentMode = 'title';
    this.currentQuery = value;
    this.searchInputQuery = value;
    const sequence = ++this.loadSequence;
    const requestController = this.beginRequest();
    await this.rememberSearch(value);
    if (!this.view) {
      this.finishRequest(requestController);
      return;
    }

    this.view.webview.html = renderSearchLoadingHtml(
      this.view.webview,
      value,
      this.history,
      this.navigationStack.length > 0,
      this.forwardStack.length > 0
    );
    const reportProgress = this.createProgressReporter(sequence);

    try {
      const page = await searchBooks(value, {
        signal: requestController.signal,
        onProgress: reportProgress,
        onPartial: (partialPage) => {
          if (sequence !== this.loadSequence || requestController.signal.aborted || !this.view) {
            return;
          }

          this.currentPage = partialPage;
          this.view.webview.html = renderPageHtml(
            this.view.webview,
            this.withNavigation(partialPage),
            this.history,
            this.searchHistory
          );
        }
      });
      reportProgress({ fraction: 0.99, label: '正在生成搜索结果' });
      if (sequence !== this.loadSequence || !this.view) {
        return;
      }
      this.currentPage = page;
      this.view.webview.html = renderPageHtml(
        this.view.webview,
        this.withNavigation(page),
        this.history,
        this.searchHistory
      );
    } catch (error) {
      if (sequence !== this.loadSequence || !this.view) {
        return;
      }
      this.view.webview.html = renderSearchErrorHtml(
        this.view.webview,
        value,
        error instanceof Error ? error.message : String(error),
        this.history,
        this.navigationStack.length > 0,
        this.forwardStack.length > 0
      );
    } finally {
      this.finishRequest(requestController);
    }
  }

  async goBack() {
    const page = this.navigationStack.pop();
    if (!page || !this.view) {
      this.showToast('没有可返回的上一页。');
      return;
    }

    this.abortActiveRequest();
    this.pushForwardPage(this.currentPage || { kind: 'home' });
    const sequence = ++this.loadSequence;
    await this.restoreNavigationPage(page, sequence);
  }

  async goForward() {
    const page = this.forwardStack.pop();
    if (!page || !this.view) {
      this.showToast('没有可前进的下一页。');
      return;
    }

    this.abortActiveRequest();
    this.pushNavigationPage(this.currentPage || { kind: 'home' }, false);
    const sequence = ++this.loadSequence;
    await this.restoreNavigationPage(page, sequence);
  }

  async restoreNavigationPage(page, sequence) {
    if (page.kind === 'home') {
      this.currentPage = undefined;
      this.currentMode = 'url';
      this.currentQuery = '';
      this.currentUrl = '';
      this.searchInputQuery = '';
      if (sequence !== this.loadSequence || !this.view) {
        return;
      }
      this.view.webview.html = renderHomeHtml(
        this.view.webview,
        '',
        this.history,
        this.searchHistory,
        this.navigationStack.length > 0,
        this.forwardStack.length > 0
      );
      return;
    }

    this.currentPage = page;
    if (page.kind === 'search') {
      this.currentMode = 'title';
      this.currentQuery = page.query || '';
      this.searchInputQuery = page.query || '';
    } else if (page.kind === 'history') {
      this.currentMode = 'history';
      this.currentQuery = '';
    } else {
      this.currentMode = 'url';
      this.currentQuery = '';
      this.currentUrl = page.url || this.currentUrl;
    }

    if (sequence !== this.loadSequence || !this.view) {
      return;
    }

    if (page.kind === 'search' && page.searching) {
      await this.search(page.query || '', false);
      return;
    }

    this.view.webview.html = renderPageHtml(
      this.view.webview,
      this.withNavigation(page),
      this.history,
      this.searchHistory
    );
  }

  async showHistory(pushCurrent = true) {
    if (!this.view) {
      return;
    }

    this.abortActiveRequest();
    if (pushCurrent) {
      this.pushCurrentPage();
    }
    const page = {
      kind: 'history',
      source: 'app',
      url: '',
      title: '历史'
    };
    this.currentPage = page;
    this.currentMode = 'history';
    this.currentQuery = '';
    ++this.loadSequence;
    this.view.webview.html = renderHistoryPage(
      this.view.webview,
      this.history,
      this.searchHistory,
      this.navigationStack.length > 0,
      this.forwardStack.length > 0
    );
  }

  async refresh() {
    if (!this.view) {
      return;
    }

    if (this.currentMode === 'history') {
      await this.showHistory(false);
      return;
    }

    if (this.currentMode === 'title' && this.currentQuery) {
      await this.search(this.currentQuery, false);
      return;
    }

    if (this.currentUrl) {
      this.pageCache.delete(this.currentUrl);
      await this.loadPage(this.currentUrl, true);
      return;
    }

    this.currentPage = undefined;
    this.view.webview.html = renderHomeHtml(
      this.view.webview,
      '',
      this.history,
      this.searchHistory,
      this.navigationStack.length > 0,
      this.forwardStack.length > 0
    );
  }

  async loadPage(url, force = false) {
    if (!this.view) {
      return;
    }

    const sequence = ++this.loadSequence;
    const requestController = this.beginRequest();

    try {
      if (!force) {
        const cachedPage = this.getCachedPage(url);
        if (cachedPage) {
          await this.renderLoadedPage(cachedPage, url, sequence);
          return;
        }
      }

      this.view.webview.html = renderLoadingHtml(
        this.view.webview,
        url,
        this.history,
        this.searchInputQuery || url,
        this.navigationStack.length > 0,
        this.forwardStack.length > 0
      );
      const reportProgress = this.createProgressReporter(sequence);
      const page = await this.fetchPage(url, reportProgress, requestController.signal);
      reportProgress({ fraction: 0.99, label: '正在渲染页面' });
      await this.renderLoadedPage(page, url, sequence);
    } catch (error) {
      if (sequence !== this.loadSequence || !this.view) {
        return;
      }

      this.view.webview.html = renderErrorHtml(
        this.view.webview,
        url,
        error instanceof Error ? error.message : String(error),
        this.history,
        this.searchInputQuery || url,
        this.navigationStack.length > 0,
        this.forwardStack.length > 0
      );
    } finally {
      this.finishRequest(requestController);
    }
  }

  async renderLoadedPage(page, fallbackUrl, sequence) {
    if (sequence !== this.loadSequence || !this.view) {
      return;
    }

    this.currentUrl = page.url || fallbackUrl;
    this.currentPage = page;
    if (page.url && page.url !== fallbackUrl) {
      this.storePage(page.url, page);
    }
    await this.rememberPage(page, fallbackUrl);
    if (sequence !== this.loadSequence || !this.view) {
      return;
    }

    this.view.webview.html = renderPageHtml(
      this.view.webview,
      this.withNavigation(page),
      this.history,
      this.searchHistory
    );
    this.prefetchNextPage(page.nextUrl);
  }

  getCachedPage(url) {
    return this.pageCache.get(url);
  }

  async fetchPage(url, onProgress, signal) {
    return this.pageCache.fetch(url, onProgress, signal);
  }

  prefetchNextPage(url) {
    this.pageCache.prefetch(url);
  }

  storePage(url, page) {
    this.pageCache.store(url, page);
  }

  async rememberSearch(query) {
    await this.historyStore.rememberSearch(query);
  }

  async deleteSearchHistory(query) {
    await this.historyStore.deleteSearchHistory(query);
    this.refreshHistoryPage();
  }

  async clearSearchHistory() {
    await this.historyStore.clearSearchHistory();
    this.refreshHistoryPage();
  }

  refreshHistoryPage() {
    if (!this.view || !this.currentPage || this.currentPage.kind !== 'history') {
      return;
    }
    ++this.loadSequence;
    this.view.webview.html = renderHistoryPage(
      this.view.webview,
      this.history,
      this.searchHistory,
      this.navigationStore.backAvailable,
      this.navigationStore.forwardAvailable
    );
  }

  async deleteReadingHistory(url) {
    await this.historyStore.deleteReadingHistory(url);
    this.refreshHistoryPage();
  }

  async deleteReadingHistoryItems(urls) {
    await this.historyStore.deleteReadingHistoryItems(urls);
    this.refreshHistoryPage();
  }

  async clearReadingHistory() {
    await this.historyStore.clearReadingHistory();
    this.refreshHistoryPage();
  }
  pushCurrentPage() {
    this.navigationStore.pushCurrent(this.currentPage);
  }

  pushNavigationPage(page, clearForward) {
    this.navigationStore.pushBack(page, clearForward);
  }

  pushForwardPage(page) {
    this.navigationStore.pushForward(page);
  }

  withNavigation(page) {
    return this.navigationStore.withState(page, this.searchInputQuery);
  }
  async rememberPage(page, fallbackUrl) {
    await this.historyStore.rememberPage(page, fallbackUrl);
  }
  beginRequest() {
    return this.requestManager.begin();
  }

  finishRequest(controller) {
    this.requestManager.finish(controller);
  }

  abortActiveRequest() {
    this.requestManager.abort();
  }
  showToast(message) {
    if (this.view) {
      this.view.webview.postMessage({ command: 'toast', message });
    }
  }

  createProgressReporter(sequence) {
    let lastPercent = 0;

    return ({ fraction, label } = {}) => {
      if (sequence !== this.loadSequence || !this.view) {
        return;
      }

      const percent = Math.max(
        lastPercent,
        Math.min(98, Math.max(3, Math.round(Number(fraction || 0) * 100)))
      );
      lastPercent = percent;
      this.view.webview.postMessage({
        command: 'progress',
        percent,
        label: label || '正在加载'
      });
    };
  }
}

module.exports = {
  NovelReaderSidebarProvider,
  VIEW_ID
};
