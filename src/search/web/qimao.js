const { createJsonHeaders, fetchJson } = require('../../core/http');
const { normalizeText } = require('../../core/html');

async function search(query, options = {}) {
  const searchUrl = new URL('https://www.qimao.com/qimaoapi/api/search/result');
  searchUrl.searchParams.set('keyword', query);
  searchUrl.searchParams.set('page', '1');
  searchUrl.searchParams.set('page_size', '15');
  const data = await fetchJson(searchUrl.toString(), {
    headers: createJsonHeaders('https://www.qimao.com/', 'https://www.qimao.com'),
    timeoutMs: 15000,
    signal: options.signal
  });
  const list =
    data && data.data && Array.isArray(data.data.search_list) ? data.data.search_list : [];

  return list
    .filter((item) => item && item.book_id && item.title)
    .slice(0, 12)
    .map((item) => ({
      text: normalizeText(item.title),
      meta: [item.author, item.category2_name].filter(Boolean).join(' · '),
      actionText: '章节选择',
      chaptersUrl: item.read_url || `https://www.qimao.com/shuku/${item.book_id}/`,
      url: item.read_url || `https://www.qimao.com/shuku/${item.book_id}/`
    }));
}

module.exports = {
  search
};
