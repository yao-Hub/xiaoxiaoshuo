const { SEARCH_SOURCES } = require('./registry');

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

async function searchBooks(input, options = {}) {
  const query = String(input || '').trim();
  if (!query) {
    throw new Error('请输入要搜索的书名。');
  }
  throwIfAborted(options.signal);

  const activeSources = SEARCH_SOURCES;
  let completed = 0;
  const groups = new Array(activeSources.length);
  options.onProgress?.({
    fraction: 0.05,
    label: `正在搜索全部来源`
  });
  await Promise.all(
    activeSources.map(async (provider, index) => {
      let group;
      try {
        throwIfAborted(options.signal);
        const mode = provider.searchModes[0];
        const items = await mode.search(query, { signal: options.signal });
        group = {
          source: provider.source,
          label: getSourceLabel(provider),
          items: sortSearchItems(Array.isArray(items) ? items : [], query).map((item) => ({
            ...item,
            mode: mode.key
          })),
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
        options.onProgress?.({
          fraction: 0.1 + (completed / activeSources.length) * 0.85,
          label: `已完成 ${completed}/${activeSources.length} 个网站`
        });
      }
    })
  );

  throwIfAborted(options.signal);
  return createSearchPage(query, activeSources, groups);
}

function throwIfAborted(signal) {
  if (signal && signal.aborted) {
    const error = new Error('请求已取消。');
    error.name = 'AbortError';
    throw error;
  }
}

function createSearchPage(query, sources, sourceGroups) {
  const groups = sourceGroups
    .slice(0, sources.length)
    .sort((left, right) => compareSearchGroups(left, right, query));

  return {
    kind: 'search',
    source: 'search',
    url: '',
    query,
    title: `搜索：${query}`,
    groups,
    items: groups
      .flatMap((group) => group.items)
      .sort(
        (left, right) =>
          getSearchTitleScore(right.text, query) - getSearchTitleScore(left.text, query)
      )
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
  if (group.error) {
    return 2;
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

  return (
    sharedPrefix * 100 +
    sharedCharacters * 10 -
    Math.abs(normalizedTitle.length - normalizedQuery.length)
  );
}

function normalizeSearchText(value) {
  return String(value || '')
    .normalize('NFKC')
    .toLocaleLowerCase('zh-CN')
    .replace(/[\s\p{P}\p{S}]+/gu, '')
    .replace(/(?:txt|最新章节|全文阅读|无弹窗|全文免费阅读)$/u, '');
}

module.exports = {
  getSearchTitleScore,
  normalizeSearchText,
  searchBooks
};
