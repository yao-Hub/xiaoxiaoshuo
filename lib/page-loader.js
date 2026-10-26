const { normalizeUrl } = require('./url');
const quanben = require('./sources/quanben');
const kadokado = require('./sources/kadokado');
const qidian = require('./sources/qidian');
const alicesw = require('./sources/alicesw');
const l3zc = require('./sources/l3zc');
const xbookcn = require('./sources/xbookcn');
const qimao = require('./sources/qimao');
const bqg = require('./sources/bqg');
const generic = require('./sources/generic');

const SEARCH_SOURCES = [
  { source: 'quanben', label: '全本小说网', search: quanben.search },
  { source: 'qidian', label: '起点中文网', search: qidian.search },
  { source: 'kadokado', label: 'KadoKado', search: kadokado.search },
  { source: 'l3zc', label: 'L3ZC', publicLabel: '站点2', private: true, search: l3zc.search },
  { source: 'alicesw', label: 'AliceSW', publicLabel: '站点1', private: true, search: alicesw.search },
  { source: 'xbookcn', label: 'xbookcn', search: xbookcn.search },
  { source: 'qimao', label: '七猫', search: qimao.search },
  { source: 'bqg', label: '笔趣阁', search: bqg.search }
];

async function loadPage(inputUrl, options = {}) {
  const normalized = normalizeUrl(inputUrl);

  if (!normalized.ok) {
    throw new Error(normalized.message);
  }

  const url = normalized.url;
  options.onProgress?.({ fraction: 0.03, label: '正在连接网站' });

  if (quanben.match(url)) {
    return quanben.load(url, options);
  }

  if (kadokado.match(url)) {
    return withFinalProgress(await kadokado.load(url), options);
  }

  if (qidian.match(url)) {
    return qidian.load(url, options);
  }

  if (alicesw.match(url)) {
    return alicesw.load(url, options);
  }

  if (l3zc.match(url)) {
    return l3zc.load(url, options);
  }

  if (xbookcn.match(url)) {
    return xbookcn.load(url, options);
  }

  if (qimao.match(url)) {
    return qimao.load(url, options);
  }

  if (bqg.match(url)) {
    return bqg.load(url, options);
  }

  return generic.load(url, options);
}

function getSourceLabel(source) {
  return source.publicLabel || source.label;
}

function formatSearchError(source, error) {
  const label = getSourceLabel(source);
  const message = error instanceof Error ? error.message : String(error);
  const networkHint = '该网站可能需要科学上网工具。连接后请重新加载 VS Code 窗口再试。';

  if (source.private) {
    return `${label}搜索失败，${networkHint}`;
  }

  return `${label}搜索失败：${message}。${networkHint}`;
}

async function withFinalProgress(page, options) {
  options.onProgress?.({ fraction: 0.97, label: '正在解析页面' });
  return page;
}

async function searchBooks(input, options = {}) {
  const query = String(input || '').trim();
  if (!query) {
    throw new Error('请输入要搜索的书名。');
  }
  throwIfAborted(options.signal);

  let completed = 0;
  const groups = new Array(SEARCH_SOURCES.length);
  options.onProgress?.({ fraction: 0.05, label: '正在搜索网站' });
  await Promise.all(
    SEARCH_SOURCES.map(async (provider, index) => {
      let group;
      try {
        throwIfAborted(options.signal);
        const items = await provider.search(query, { signal: options.signal });
        group = {
          source: provider.source,
          label: getSourceLabel(provider),
          items: sortSearchItems(Array.isArray(items) ? items : [], query),
          error: ''
        };
      } catch (error) {
        group = {
          source: provider.source,
          label: getSourceLabel(provider),
          items: [],
          error: formatSearchError(provider, error)
        };
      } finally {
        completed += 1;
        groups[index] = group;
        if (!options.signal || !options.signal.aborted) {
          const page = createSearchPage(query, groups, completed);
          try {
            options.onPartial?.(page);
          } catch {
            // A rendering failure should not interrupt the remaining searches.
          }
        }
        options.onProgress?.({
          fraction: 0.1 + (completed / SEARCH_SOURCES.length) * 0.85,
          label: `已完成 ${completed}/${SEARCH_SOURCES.length} 个网站`
        });
      }
    })
  );

  throwIfAborted(options.signal);
  return createSearchPage(query, groups, completed);
}

function throwIfAborted(signal) {
  if (signal && signal.aborted) {
    const error = new Error('请求已取消。');
    error.name = 'AbortError';
    throw error;
  }
}

function createSearchPage(query, sourceGroups, completedCount) {
  const groups = SEARCH_SOURCES
    .map((source, index) => sourceGroups[index] || {
      source: source.source,
      label: getSourceLabel(source),
      items: [],
      error: '',
      searching: true
    })
    .sort((left, right) => compareSearchGroups(left, right, query));

  return {
    kind: 'search',
    source: 'search',
    url: '',
    query,
    title: `搜索：${query}`,
    groups,
    completedCount,
    totalSources: SEARCH_SOURCES.length,
    searching: completedCount < SEARCH_SOURCES.length
  };
}

function compareSearchGroups(left, right, query) {
  const rankDifference = getSearchGroupRank(left) - getSearchGroupRank(right);
  if (rankDifference) {
    return rankDifference;
  }

  if (left.items.length && right.items.length) {
    return (
      getSearchTitleScore(right.items[0].text, query) -
      getSearchTitleScore(left.items[0].text, query)
    );
  }

  return 0;
}

function getSearchGroupRank(group) {
  if (Array.isArray(group.items) && group.items.length) {
    return 0;
  }
  if (group.searching) {
    return 2;
  }
  if (group.error) {
    return 3;
  }
  return 1;
}

function sortSearchItems(items, query) {
  return items
    .map((item, index) => ({
      item,
      index,
      score: getSearchTitleScore(item.text || '', query)
    }))
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map(({ item }) => item);
}

function getSearchTitleScore(title, query) {
  const normalizedTitle = normalizeSearchText(title);
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedTitle || !normalizedQuery) {
    return 0;
  }

  if (normalizedTitle === normalizedQuery) {
    return 100000;
  }

  if (normalizedTitle.startsWith(normalizedQuery)) {
    return 80000 - Math.abs(normalizedTitle.length - normalizedQuery.length);
  }

  const containedAt = normalizedTitle.indexOf(normalizedQuery);
  if (containedAt >= 0) {
    return 60000 - containedAt * 100 - Math.abs(normalizedTitle.length - normalizedQuery.length);
  }

  if (normalizedQuery.includes(normalizedTitle)) {
    return 40000 - Math.abs(normalizedTitle.length - normalizedQuery.length);
  }

  let sharedPrefix = 0;
  while (
    sharedPrefix < normalizedTitle.length &&
    sharedPrefix < normalizedQuery.length &&
    normalizedTitle[sharedPrefix] === normalizedQuery[sharedPrefix]
  ) {
    sharedPrefix += 1;
  }

  const titleCharacters = new Set(normalizedTitle);
  let sharedCharacters = 0;
  for (const character of new Set(normalizedQuery)) {
    if (titleCharacters.has(character)) {
      sharedCharacters += 1;
    }
  }

  return sharedPrefix * 100 + sharedCharacters * 10 - Math.abs(normalizedTitle.length - normalizedQuery.length);
}

function normalizeSearchText(value) {
  return String(value || '')
    .normalize('NFKC')
    .toLocaleLowerCase('zh-CN')
    .replace(/[\s\p{P}\p{S}]+/gu, '')
    .replace(/(?:txt|最新章节|全文阅读|无弹窗|全文免费阅读)$/u, '');
}

module.exports = {
  loadPage,
  searchBooks,
  getSearchTitleScore,
  normalizeSearchText
};
