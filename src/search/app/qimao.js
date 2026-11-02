const { fetchJson } = require('../../core/http');
const { htmlToText, normalizeText } = require('../../core/html');
const { queryEncode, requestHeaders, sign } = require('./qimao-sign');

const SEARCH_API = 'https://api-bc.wtzw.com/search/v1/words';

async function search(query, options = {}) {
  const params = {
    extend: '',
    tab: '0',
    gender: '0',
    refresh_state: '8',
    page: '1',
    wd: query,
    is_short_story_user: '0'
  };
  params.sign = sign(params);

  const data = await fetchJson(`${SEARCH_API}?${queryEncode(params)}`, {
    headers: requestHeaders('00000000'),
    timeoutMs: 15000,
    signal: options.signal
  });
  const list = data && data.data && Array.isArray(data.data.books) ? data.data.books : [];

  return list
    .filter((item) => item && item.id && (item.original_title || item.title))
    .slice(0, 12)
    .map((item) => {
      const bookId = String(item.id);
      const catalogUrl = `https://www.qimao.com/shuku/${bookId}/`;
      return {
        text: normalizeText(item.original_title || htmlToText(item.title || '')),
        meta: [htmlToText(item.author || '').trim(), htmlToText(item.sub_title || '').trim()]
          .filter(Boolean)
          .join(' · '),
        actionText: '章节选择',
        coverUrl: String(item.image_link || ''),
        chaptersUrl: catalogUrl,
        url: catalogUrl
      };
    });
}

module.exports = {
  search
};
