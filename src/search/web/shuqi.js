const { createBrowserHeaders, fetchHtml } = require('../../core/http');
const { htmlToText, normalizeText } = require('../../core/html');

const ITEM_PATTERN =
  /<li>\s*<a class="book-cover"[^>]*href="([^"]+)"[^>]*>[\s\S]*?<img src="([^"]*)"[\s\S]*?<a class="ellipsis"[^>]*>([\s\S]*?)<\/a>[\s\S]*?class="book-autor">[\s\S]*?作者：([\s\S]*?)<\/a>[\s\S]*?class="category">([\s\S]*?)<\/div>/gi;

async function search(query, options = {}) {
  const searchUrl = new URL('https://www.shuqi.com/search');
  searchUrl.searchParams.set('keyword', query);
  const { html } = await fetchHtml(searchUrl.toString(), {
    headers: createBrowserHeaders(),
    timeoutMs: 15000,
    signal: options.signal
  });
  const items = [];
  const seen = new Set();

  for (const match of html.matchAll(ITEM_PATTERN)) {
    const catalogUrl = new URL(match[1], 'https://www.shuqi.com').toString();
    if (seen.has(catalogUrl)) {
      continue;
    }
    const title = normalizeText(htmlToText(match[3]));
    if (!title) {
      continue;
    }
    seen.add(catalogUrl);
    items.push({
      text: title,
      meta: [
        normalizeText(htmlToText(match[4])).replace(/^作者：/, ''),
        normalizeText(htmlToText(match[5]))
      ]
        .filter(Boolean)
        .join(' · '),
      actionText: '章节选择',
      coverUrl: String(match[2] || '').replace(/^http:/i, 'https:'),
      chaptersUrl: catalogUrl,
      url: catalogUrl
    });
    if (items.length >= 12) {
      break;
    }
  }

  return items;
}

module.exports = {
  search
};
