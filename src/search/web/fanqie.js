const { createJsonHeaders, fetchJson } = require('../../core/http');
const { normalizeText } = require('../../core/html');

const SEARCH_API = 'https://novel.snssdk.com/api/novel/channel/homepage/search/search/v1/';

async function search(query, options = {}) {
  const searchUrl = new URL(SEARCH_API);
  searchUrl.searchParams.set('q', query);
  searchUrl.searchParams.set('aid', '1967');
  searchUrl.searchParams.set('offset', '0');

  const data = await fetchJson(searchUrl.toString(), {
    headers: createJsonHeaders('https://fanqienovel.com/'),
    timeoutMs: 15000,
    signal: options.signal
  });
  const list = data && data.data && Array.isArray(data.data.ret_data) ? data.data.ret_data : [];

  return list
    .filter((item) => item && item.book_id && (item.book_name || item.title))
    .slice(0, 12)
    .map((item) => {
      const catalogUrl = `https://fanqienovel.com/page/${item.book_id}`;
      return {
        text: normalizeText(item.book_name || item.title),
        meta: [item.author, item.category].filter(Boolean).join(' · '),
        actionText: '章节选择',
        coverUrl: String(item.detail_page_thumb_url || item.thumb_url || ''),
        chaptersUrl: catalogUrl,
        url: catalogUrl
      };
    });
}

module.exports = {
  search
};
