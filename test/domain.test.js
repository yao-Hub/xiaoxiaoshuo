const assert = require('node:assert/strict');
const test = require('node:test');
const { getSearchTitleScore, normalizeSearchText } = require('../src/search/service');
const { renderHomeHtml, renderPageHtml } = require('../src/ui/renderer');
const { SEARCH_SOURCES } = require('../src/search/registry');
const { HistoryStore } = require('../src/sidebar/stores/history-store');
const { NavigationStore } = require('../src/sidebar/stores/navigation-store');
const { isLikelyUrl, normalizeUrl, resolveUrl } = require('../src/core/url');
const fanqie = require('../src/content/sources/fanqie');
const qimao = require('../src/content/sources/qimao');
const shuqi = require('../src/content/sources/shuqi');

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

test('fanqie content decodes custom font glyphs', () => {
  assert.equal(fanqie.decodeFanqieText('\uE3E9\uE3EA\uE408'), '在主o');
});

test('qimao content keeps only the article body', () => {
  const html = `
    <div>搜索 立即登录 返回 快捷键指南 举报</div>
    <div class="chapter-detail-article">
      <div class="article">
        <p>第一段正文。</p>
        <p>第二段正文。</p>
      </div>
    </div>
    <div class="reader-report">举报类型 举报内容 联系方式</div>
  `;
  const content = qimao.extractQimaoChapterContent(html);

  assert.equal(content, '第一段正文。\n\n第二段正文。');
  assert.doesNotMatch(content, /立即登录|举报|快捷键/);
  assert.equal(qimao.extractQimaoChapterContent('<div>立即登录 举报 章节链接</div>'), '');
});

test('shuqi catalog keeps only chapters from the current book', () => {
  const html = `
    <a href="https://www.shuqi.com/reader?bid=8855023&amp;cid=1966572">1.第1章 大千世界</a>
    <a href="https://www.shuqi.com/reader?bid=8855023&amp;cid=1966573">2.第2章 位面裂缝</a>
    <a href="https://www.shuqi.com/reader?bid=999999&amp;cid=1">其他书籍</a>
    <a href="https://www.shuqi.com/about.html">书旗用户服务协议</a>
  `;
  const items = shuqi.extractChapterItems(
    html,
    'https://www.shuqi.com/chapter?bid=8855023',
    '8855023'
  );

  assert.deepEqual(
    items.map((item) => item.text),
    ['第1章 大千世界', '第2章 位面裂缝']
  );
  assert.deepEqual(
    items.map((item) => item.url),
    [
      'https://www.shuqi.com/reader?bid=8855023&cid=1966572',
      'https://www.shuqi.com/reader?bid=8855023&cid=1966573'
    ]
  );
});

test('webview renderer injects isolated styles and client state', () => {
  const html = renderHomeHtml({}, '');
  assert.match(html, /<style>/);
  assert.match(html, /class="toolbar"/);
  assert.match(html, /id="back"[^>]*aria-label="返回"/);
  assert.match(html, /id="forward"[^>]*aria-label="前进"/);
  assert.match(html, /id="refresh"[^>]*aria-label="刷新当前页面"/);
  assert.doesNotMatch(html, /id="load"/);
  assert.match(html, /toolbar\.requestSubmit\(\)/);
  assert.match(html, /const state =/);
  assert.doesNotMatch(html, /\$\{safeState\}/);
});

test('webview renderer shows a neutral message for unavailable content', () => {
  const html = renderPageHtml(
    {},
    {
      kind: 'chapter',
      title: '会员章节',
      content: '',
      contentUnavailable: true,
      contentUnavailableReason: '该章节需要会员，当前暂不提供正文。',
      url: 'https://example.com/chapter/1',
      prevUrl: '',
      nextUrl: ''
    }
  );
  assert.match(html, /class="content-unavailable"/);
  assert.match(html, /该章节需要会员，当前暂不提供正文。/);
});

test('search results are flat and always open the catalog', () => {
  const page = {
    kind: 'search',
    query: '完美世界',
    items: [
      {
        text: '完美世界',
        meta: '辰东',
        chaptersUrl: 'https://example.com/book/1/',
        url: 'https://example.com/book/1/1.html'
      }
    ],
    groups: [
      {
        source: 'example',
        label: '示例站点',
        items: [
          {
            text: '完美世界',
            meta: '辰东',
            chaptersUrl: 'https://example.com/book/1/',
            url: 'https://example.com/book/1/1.html'
          }
        ],
        error: ''
      }
    ]
  };
  const html = renderPageHtml({}, page);
  assert.doesNotMatch(html, /id="searchModeFilter"/);
  assert.doesNotMatch(html, /class="search-group/);
  assert.doesNotMatch(html, /class="button search-action"/);
  assert.match(html, /class="search-results-flat"/);
  assert.match(html, /data-open-url="https:\/\/example\.com\/book\/1\/"/);
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
