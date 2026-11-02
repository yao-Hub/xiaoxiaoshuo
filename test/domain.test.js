const assert = require('node:assert/strict');
const test = require('node:test');
const { getSearchTitleScore, normalizeSearchText } = require('../src/search/service');
const { renderHomeHtml, renderPageHtml } = require('../src/ui/renderer');
const { SEARCH_SOURCES } = require('../src/search/registry');
const { HistoryStore } = require('../src/sidebar/stores/history-store');
const { NavigationStore } = require('../src/sidebar/stores/navigation-store');
const { isLikelyUrl, normalizeUrl, resolveUrl } = require('../src/core/url');

test('URL normalization accepts HTTP(S) and rejects unsafe schemes', () => {
  assert.deepEqual(normalizeUrl('example.com/book/1'), {
    ok: true,
    url: 'https://example.com/book/1'
  });
  assert.equal(normalizeUrl('javascript:alert(1)').ok, false);
  assert.equal(normalizeUrl('').ok, false);
  assert.equal(isLikelyUrl('https://example.com/book/1'), true);
  assert.equal(isLikelyUrl('完美世界'), false);
  assert.equal(
    resolveUrl('/chapter/2', 'https://example.com/book/1'),
    'https://example.com/chapter/2'
  );
});

test('search title normalization removes punctuation and site suffixes', () => {
  assert.equal(normalizeSearchText('《完美 世界》最新章节'), '完美世界');
});

test('search ranking prefers exact matches over partial matches', () => {
  const query = '完美世界';
  const exact = getSearchTitleScore('完美世界', query);
  const contained = getSearchTitleScore('从完美世界开始', query);
  const unrelated = getSearchTitleScore('盘龙', query);
  assert.ok(exact > contained);
  assert.ok(contained > unrelated);
});

test('webview renderer injects isolated styles and client state', () => {
  const html = renderHomeHtml({}, '');
  assert.match(html, /<style>/);
  assert.match(html, /class="toolbar"/);
  assert.match(html, /const state =/);
  assert.doesNotMatch(html, /\$\{safeState\}/);
});

test('toolbar exposes app and web search modes before the address field', () => {
  const page = {
    kind: 'search',
    query: '完美世界',
    searchMode: 'app',
    completedCount: 1,
    totalSources: 1,
    groups: []
  };
  const html = renderPageHtml({}, page);
  assert.match(html, /id="searchModeFilter"/);
  assert.ok(html.indexOf('id="searchModeFilter"') < html.indexOf('id="address"'));
  assert.match(html, /<option value="app"[^>]*selected>App<\/option>/);
  assert.match(html, /<option value="web"[^>]*>网页<\/option>/);
  assert.doesNotMatch(html, /<option value="all">/);

  page.searchMode = 'web';
  assert.match(renderPageHtml({}, page), /<option value="web"[^>]*selected>网页<\/option>/);
});

test('every search source declares supported data modes', () => {
  for (const source of SEARCH_SOURCES) {
    assert.ok(Array.isArray(source.searchModes));
    assert.ok(source.searchModes.length);
  }

  const appSources = SEARCH_SOURCES.filter((source) =>
    source.searchModes.some((mode) => mode.key === 'app')
  );
  const webSources = SEARCH_SOURCES.filter((source) =>
    source.searchModes.some((mode) => mode.key === 'web')
  );
  assert.deepEqual(
    appSources.map((source) => source.source),
    ['qidian', 'fanqie', 'kadokado', 'qimao', 'shuqi']
  );
  assert.equal(webSources.length, SEARCH_SOURCES.length);
});

test('history store deduplicates and persists history', async () => {
  const values = new Map();
  const storage = {
    get(key, fallback) {
      return values.has(key) ? values.get(key) : fallback;
    },
    async update(key, value) {
      values.set(key, value);
    }
  };
  const store = new HistoryStore(storage);
  await store.rememberSearch('完美世界');
  await store.rememberSearch('盘龙');
  await store.rememberSearch('完美世界');
  assert.deepEqual(store.searchHistory, ['完美世界', '盘龙']);
  await store.deleteSearchHistory('盘龙');
  assert.deepEqual(store.searchHistory, ['完美世界']);
});

test('navigation store maintains bounded back and forward state', () => {
  const navigation = new NavigationStore();
  navigation.pushCurrent({ kind: 'home' });
  navigation.pushForward({ kind: 'chapter', url: 'https://example.com/2' });
  assert.equal(navigation.backAvailable, true);
  assert.equal(navigation.forwardAvailable, true);
  assert.deepEqual(navigation.takeForward(), {
    kind: 'chapter',
    url: 'https://example.com/2'
  });
  assert.equal(navigation.forwardAvailable, false);
});
