const { renderClientScript } = require('./webview/client');
const { WEBVIEW_STYLES } = require('./webview/styles');
const { escapeAttribute, escapeHtml, escapeScriptJson } = require('./html');

function createNonce() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let text = '';

  for (let i = 0; i < 32; i += 1) {
    text += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return text;
}

function getPanelTitle(page) {
  if (page && page.kind === 'search') {
    return page.query ? `搜索: ${page.query}` : '搜索';
  }

  if (page && page.kind === 'history') {
    return '历史';
  }

  if (!page || !page.kind) {
    return '小小小说';
  }

  if (page.kind === 'list') {
    return page.title ? `列表: ${page.title}` : '列表';
  }

  if (page.kind === 'chapter') {
    return page.title ? `阅读: ${page.title}` : '阅读';
  }

  return '小小小说';
}

function renderLoadingHtml(
  webview,
  url,
  history = [],
  value = url,
  backAvailable = false,
  forwardAvailable = false
) {
  return renderShell(webview, {
    kind: 'loading',
    url,
    value,
    history,
    backAvailable,
    forwardAvailable,
    title: '正在加载',
    body: '<div class="status">正在读取页面内容。</div>'
  });
}

function renderErrorHtml(
  webview,
  url,
  message,
  history = [],
  value = url,
  backAvailable = false,
  forwardAvailable = false
) {
  return renderShell(webview, {
    kind: 'error',
    url,
    value,
    history,
    backAvailable,
    forwardAvailable,
    title: '读取失败',
    body: `<div class="status error">${escapeHtml(message)}</div>`
  });
}

function renderSearchLoadingHtml(
  webview,
  query,
  history = [],
  backAvailable = false,
  forwardAvailable = false
) {
  return renderShell(webview, {
    kind: 'loading',
    url: '',
    value: query,
    mode: 'title',
    history,
    backAvailable,
    forwardAvailable,
    title: '正在搜索',
    body: '<div class="status">正在搜索已支持的小说网站。</div>'
  });
}

function renderSearchErrorHtml(
  webview,
  query,
  message,
  history = [],
  backAvailable = false,
  forwardAvailable = false
) {
  return renderShell(webview, {
    kind: 'error',
    url: '',
    value: query,
    mode: 'title',
    history,
    backAvailable,
    forwardAvailable,
    title: '搜索失败',
    body: `<div class="status error">${escapeHtml(message)}</div>`
  });
}

function renderHomeHtml(
  webview,
  url,
  history = [],
  searchHistory = [],
  backAvailable = false,
  forwardAvailable = false
) {
  return renderShell(webview, {
    kind: 'home',
    url,
    history,
    searchHistory,
    backAvailable,
    forwardAvailable,
    title: '小小小说',
    pageTitle: '小小小说',
    body: '<div class="status">在上方输入书名或地址，然后点击读取。</div>'
  });
}

function renderPageHtml(webview, page, history = [], searchHistory = []) {
  if (!page) {
    return renderErrorHtml(webview, '', '页面内容为空。');
  }

  if (page.kind === 'search') {
    return renderShell(webview, {
      kind: 'search',
      url: '',
      value: page.query || '',
      mode: 'title',
      title: page.title || '搜索',
      pageTitle: getPanelTitle(page),
      backAvailable: Boolean(page.backAvailable),
      forwardAvailable: Boolean(page.forwardAvailable),
      history,
      searchHistory,
      body: renderSearchBody(page)
    });
  }

  if (page.kind === 'history') {
    return renderShell(webview, {
      kind: 'history',
      url: '',
      value: '',
      title: '历史',
      pageTitle: '历史',
      backAvailable: Boolean(page.backAvailable),
      forwardAvailable: Boolean(page.forwardAvailable),
      history,
      searchHistory,
      body: renderHistoryPageBody(history, searchHistory)
    });
  }

  if (page.kind === 'list') {
    return renderShell(webview, {
      kind: 'list',
      url: page.url,
      value: page.value || page.url,
      title: page.title || '列表',
      pageTitle: getPanelTitle(page),
      backAvailable: Boolean(page.backAvailable),
      forwardAvailable: Boolean(page.forwardAvailable),
      history,
      searchHistory,
      body: renderListBody(page)
    });
  }

  return renderShell(webview, {
    kind: 'chapter',
    url: page.url,
    value: page.value || page.url,
    title: page.title || '阅读',
    pageTitle: getPanelTitle(page),
    backAvailable: Boolean(page.backAvailable),
    forwardAvailable: Boolean(page.forwardAvailable),
    prevUrl: page.prevUrl || '',
    nextUrl: page.nextUrl || '',
    content: page.content || '',
    history,
    searchHistory,
    body: renderChapterBodyWithToc(page)
  });
}

function renderHistoryPage(
  webview,
  history = [],
  searchHistory = [],
  backAvailable = false,
  forwardAvailable = false
) {
  return renderPageHtml(
    webview,
    {
      kind: 'history',
      url: '',
      title: '历史',
      history,
      searchHistory,
      backAvailable,
      forwardAvailable
    },
    history,
    searchHistory
  );
}

function renderHistoryPageBody(history, _searchHistory) {
  const readItems = Array.isArray(history) ? history.slice(0, 20) : [];
  const readButtons = readItems
    .map((item) => {
      const url = typeof item === 'string' ? item : item.url || '';
      const title = typeof item === 'string' ? item : item.title || url;
      if (!url) {
        return '';
      }
      return `
        <div class="history-page-row">
          <input class="history-select-input" type="checkbox" data-history-select value="${escapeAttribute(url)}" aria-label="选择这条阅读历史">
          <button class="history-page-link" type="button" data-open-url="${escapeAttribute(url)}">
            <span class="history-title">${escapeHtml(title)}</span>
            <span class="history-url">${escapeHtml(url)}</span>
          </button>
        </div>`;
    })
    .join('');

  return `
    <section class="history-view">
      <div class="history-page-section">
        <div class="history-section-head">
          <h2>阅读历史</h2>
          ${readItems.length ? '<button class="history-manage-toggle" type="button" data-toggle-history-management>管理</button>' : ''}
        </div>
        ${
          readItems.length
            ? `
          <div class="history-manage-actions" hidden>
            <button class="history-manage-button" type="button" data-select-all-history>全选</button>
            <button class="history-manage-button" type="button" data-delete-selected-history>删除选中</button>
            <button class="history-manage-button danger" type="button" data-clear-reading-history>全部删除</button>
          </div>`
            : ''
        }
        ${readItems.length ? readButtons : '<div class="history-empty">暂无阅读历史</div>'}
      </div>
    </section>`;
}

function renderSearchSuggestions(searchHistory) {
  const queryItems = Array.isArray(searchHistory) ? searchHistory.slice(0, 20) : [];
  if (!queryItems.length) {
    return '';
  }

  const rows = queryItems
    .map(
      (query) => `
      <div class="suggestion-row">
        <button class="suggestion-query" type="button" data-search-query="${escapeAttribute(query)}">${escapeHtml(query)}</button>
        <button class="suggestion-remove" type="button" data-delete-search-query="${escapeAttribute(query)}" aria-label="删除这条搜索历史">×</button>
      </div>`
    )
    .join('');

  return `
    <div class="search-suggestions" id="searchSuggestions" hidden>
      <div class="suggestions-head">
        <span>搜索历史</span>
        ${queryItems.length ? '<button class="suggestions-clear" type="button" data-clear-search-history>清除全部</button>' : ''}
      </div>
      ${rows}
    </div>`;
}

function renderSearchBody(page) {
  const groups = Array.isArray(page.groups) ? page.groups : [];
  const failedCount = groups.filter((group) => group.error).length;
  const totalSources = Math.max(groups.length, Number(page.totalSources) || groups.length);
  const completedCount = Math.min(totalSources, Number(page.completedCount) || groups.length);
  const searching = Boolean(page.searching);
  const sections = groups
    .map((group) => {
      const items = Array.isArray(group.items) ? group.items.slice(0, 12) : [];
      const rows = items
        .map(
          (item) => `
          <div class="search-row">
            <button class="search-link" type="button" data-open-url="${escapeAttribute(item.chaptersUrl || item.url)}">
              <span class="search-title">${escapeHtml(item.text || item.url)}</span>
              ${item.meta ? `<span class="search-meta">${escapeHtml(item.meta)}</span>` : ''}
            </button>
            <button class="button search-action" type="button" data-open-url="${escapeAttribute(item.url)}">${escapeHtml(item.actionText || '打开')}</button>
          </div>`
        )
        .join('');
      const content = group.searching
        ? '<div class="search-empty searching">正在搜索<span class="searching-dots">…</span></div>'
        : group.error
          ? `<div class="search-empty error">${escapeHtml(group.error)}</div>`
          : items.length
            ? rows
            : '<div class="search-empty">没有找到相关作品</div>';

      return `
        <section class="search-group${group.searching ? ' is-searching' : ''}">
          <div class="search-group-head">
            <h2>${escapeHtml(group.label)}</h2>
            <span class="search-count">${group.searching ? '…' : items.length}</span>
          </div>
          ${content}
        </section>`;
    })
    .join('');
  const total = groups.reduce(
    (sum, group) => sum + (Array.isArray(group.items) ? group.items.length : 0),
    0
  );
  const progressPercent = totalSources ? Math.round((completedCount / totalSources) * 100) : 100;
  const summary = searching
    ? `正在搜索：已完成 ${completedCount}/${totalSources} 个网站，当前找到 ${total} 个结果。`
    : `已搜索 ${groups.length} 个网站，共找到 ${total} 个可打开结果${failedCount ? `，${failedCount} 个网站搜索失败` : ''}。`;
  const progress = searching
    ? `
      <div class="search-live-progress" role="progressbar" aria-label="搜索进度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progressPercent}">
        <div class="search-live-progress-bar" style="width: ${progressPercent}%"></div>
      </div>`
    : '';

  return `
    <section class="search-view">
      <h1>“${escapeHtml(page.query || '')}” 的搜索结果</h1>
      <p class="search-summary">${summary}</p>
      ${progress}
      ${failedCount ? '<div class="search-alert">部分网站搜索失败，可能需要科学上网工具。连接后请重新加载 VS Code 窗口再试。</div>' : ''}
      ${sections}
    </section>`;
}

function renderListBody(page) {
  const items = Array.isArray(page.items) ? page.items.slice(0, 5000) : [];

  if (!items.length) {
    return '<div class="status">未识别到列表项。</div>';
  }

  const rows = items
    .map(
      (item) => `
      <tr>
        <td class="title-cell">
          <button class="item-link" type="button" data-open-url="${escapeAttribute(item.url)}">${escapeHtml(item.text)}</button>
        </td>
      </tr>`
    )
    .join('');

  return `
    <section class="list-view">
      <table class="list-table">
        <tbody>${rows}</tbody>
      </table>
    </section>`;
}

function renderTocBody(page) {
  const items = Array.isArray(page.toc) ? page.toc : [];

  if (!items.length) {
    return '';
  }

  return `
    <section class="toc-section">
      <h2>目录</h2>
      ${renderTocList(items, page.url || '')}
    </section>`;
}

function renderTocList(items, currentUrl) {
  const rows = items
    .map((item) => {
      const isActive = item.url && item.url === currentUrl;
      const title = escapeHtml(item.title || '未命名章节');
      const link = item.url
        ? `<button class="toc-link${isActive ? ' is-active' : ''}" type="button" data-open-url="${escapeAttribute(item.url)}" ${isActive ? 'aria-current="page"' : ''}>${title}</button>`
        : `<span class="toc-link toc-text">${title}</span>`;
      const children =
        item.children && item.children.length
          ? `<div class="toc-children">${renderTocList(item.children, currentUrl)}</div>`
          : '';

      return `<li class="toc-item">${link}${children}</li>`;
    })
    .join('');

  return `<ul class="toc-list">${rows}</ul>`;
}

function renderChapterBodyWithToc(page) {
  const paragraphs = String(page.content || '')
    .split(/\n{2,}/)
    .map((line) => `<p>${escapeHtml(line).replace(/\n/g, '<br>')}</p>`)
    .join('');

  return `
    <article class="chapter-view">
      <h1>${escapeHtml(page.title || '阅读')}</h1>
      <p class="source">${escapeHtml(page.url || '')}</p>
      ${renderChapterNavigation(page, 'top')}
      <div class="content">${paragraphs}</div>
      ${renderChapterNavigation(page, 'bottom')}
      ${renderTocBody(page)}
    </article>`;
}

function renderChapterNavigation(page, position) {
  const hasToc = Array.isArray(page.toc) && page.toc.length > 0;
  let directoryAttributes = 'disabled';

  if (hasToc) {
    directoryAttributes = 'data-scroll-toc';
  } else if (page.catalogUrl) {
    directoryAttributes = `data-open-url="${escapeAttribute(page.catalogUrl)}"`;
  } else if (page.backAvailable) {
    directoryAttributes = 'data-go-back';
  }

  return `
    <nav class="chapter-nav${position === 'top' ? ' chapter-nav-top' : ''}" aria-label="章节导航">
      <button class="nav-button" type="button" data-open-url="${escapeAttribute(page.prevUrl || '')}" ${page.prevUrl ? '' : 'disabled'}>上一章</button>
      <button class="nav-button nav-directory" type="button" ${directoryAttributes}>目录</button>
      <button class="nav-button" type="button" data-open-url="${escapeAttribute(page.nextUrl || '')}" ${page.nextUrl ? '' : 'disabled'}>下一章</button>
    </nav>`;
}

function renderShell(webview, page) {
  const nonce = createNonce();
  const searchHistory = Array.isArray(page.searchHistory) ? page.searchHistory : [];
  const safeState = escapeScriptJson({
    kind: page.kind,
    url: page.url,
    value: page.value || (page.kind === 'search' ? page.query : page.url) || '',
    mode: page.mode || (page.kind === 'search' ? 'title' : 'url'),
    canRefresh: Boolean(
      page.url || page.mode === 'title' || page.kind === 'search' || page.kind === 'history'
    ),
    title: page.title,
    canGoBack: Boolean(page.backAvailable),
    canGoForward: Boolean(page.forwardAvailable)
  });
  const pageTitle = escapeHtml(page.pageTitle || getPanelTitle(page));
  const bodyClass = page.kind ? `page-${page.kind}` : 'page';
  const backDisabled = page.backAvailable ? '' : 'disabled';
  const forwardDisabled = page.forwardAvailable ? '' : 'disabled';
  const refreshDisabled =
    page.url || page.mode === 'title' || page.kind === 'search' || page.kind === 'history'
      ? ''
      : 'disabled';
  const loadingProgress =
    page.kind === 'loading'
      ? '<div class="loading-progress" role="progressbar" aria-label="加载中" aria-valuemin="0" aria-valuemax="100" aria-valuenow="3"><div class="loading-progress-bar"></div></div>'
      : '';

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <title>${pageTitle}</title>
  <style>${WEBVIEW_STYLES}</style>
</head>
<body class="${bodyClass}">
  <div class="app">
    <form class="toolbar" id="toolbar">
      <button class="button" id="back" type="button" ${backDisabled}>返回</button>
      <button class="button" id="forward" type="button" ${forwardDisabled}>前进</button>
      <input class="address" id="address" type="url" aria-label="地址" spellcheck="false">
      <button class="button" id="load" type="submit" title="读取">读取</button>
      <button class="button" id="refresh" type="button" title="刷新当前页面" ${refreshDisabled}>刷新</button>
      <button class="button" id="external" type="button" title="在浏览器打开">打开</button>
      <button class="button" id="historyToggle" type="button" title="历史记录" aria-expanded="false">历史</button>
    </form>
    ${renderSearchSuggestions(searchHistory)}
    ${loadingProgress}
    <main class="reader-shell">
      ${page.body}
    </main>
  </div>
  <div class="toast" id="toast" role="status"></div>
  ${renderClientScript(nonce, safeState)}
</body>
</html>`;
}

module.exports = {
  getPanelTitle,
  renderErrorHtml,
  renderHistoryPage,
  renderHomeHtml,
  renderLoadingHtml,
  renderPageHtml,
  renderSearchErrorHtml,
  renderSearchLoadingHtml
};
