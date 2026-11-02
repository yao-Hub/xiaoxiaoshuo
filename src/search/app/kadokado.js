const { createJsonHeaders, fetchJson } = require('../../core/http');

async function search(query, options = {}) {
  const headers = createJsonHeaders('https://www.kadokado.com.tw/', 'https://www.kadokado.com.tw');
  const data = await fetchJson(
    `https://api.kadokado.com.tw/v3/search?keyword=${encodeURIComponent(query)}&current=1&limit=12`,
    { headers, signal: options.signal }
  );

  return (Array.isArray(data.data) ? data.data : []).map((item) => ({
    text: item.displayName || item.oneLineIntro || 'KadoKado 作品',
    meta: [item.ownerDisplayName, item.oneLineIntro].filter(Boolean).join(' · '),
    actionText: '章节选择',
    chaptersUrl: `https://www.kadokado.com.tw/book/${item.id}`,
    url: `https://www.kadokado.com.tw/book/${item.id}`
  }));
}

module.exports = {
  search
};
