const { createMobileHeaders, fetchJson } = require('../../core/http');
const { normalizeText } = require('../../core/html');

const SEARCH_API = 'https://read.xiaoshuo1-sm.com/novel/i.php';

async function search(query, options = {}) {
  const searchUrl = new URL(SEARCH_API);
  for (const [key, value] of Object.entries({
    do: 'is_search',
    isNewBind: '0',
    platform: '3',
    user_id: '8000000',
    q: query,
    page: '1',
    size: '10',
    uid: '8000000',
    filterMigu: '1',
    p: '3'
  })) {
    searchUrl.searchParams.set(key, value);
  }

  const data = await fetchJson(searchUrl.toString(), {
    headers: {
      ...createMobileHeaders(),
      accept: 'application/json, text/plain, */*'
    },
    timeoutMs: 15000,
    signal: options.signal
  });
  const list = [
    ...(data.aladdin ? [data.aladdin] : []),
    ...(Array.isArray(data.data) ? data.data : [])
  ];

  return list
    .filter(
      (item) =>
        item &&
        item.bid &&
        item.title &&
        item.host === 'shuqi.com' &&
        item.first_category_name !== '听书'
    )
    .slice(0, 12)
    .map((item) => {
      const catalogUrl = `https://www.shuqi.com/book/${item.bid}.html`;
      return {
        text: normalizeText(item.title),
        meta: [item.author, item.category].filter(Boolean).join(' · '),
        actionText: '章节选择',
        coverUrl: String(item.cover || '').replace(/^http:/i, 'https:'),
        chaptersUrl: catalogUrl,
        url: catalogUrl
      };
    });
}

module.exports = {
  search
};
