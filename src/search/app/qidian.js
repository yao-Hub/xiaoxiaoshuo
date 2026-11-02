const { createMobileHeaders, fetchHtml } = require('../../core/http');
const { extractAnchors, normalizeText } = require('../../core/html');

async function search(query, options = {}) {
  const searchUrl = `https://m.qidian.com/search?kw=${encodeURIComponent(query)}`;
  const { html, url } = await fetchHtml(searchUrl, {
    headers: createMobileHeaders(),
    timeoutMs: 15000,
    signal: options.signal
  });
  const items = [];
  const seenBooks = new Set();

  for (const anchor of extractAnchors(html, url)) {
    let bookId;
    let chapterId;

    try {
      const parsed = new URL(anchor.url);
      const matchResult = parsed.pathname.match(/^\/chapter\/(\d+)\/(\d+)\/?$/);
      if (!matchResult) {
        continue;
      }
      bookId = matchResult[1];
      chapterId = matchResult[2];
    } catch {
      continue;
    }

    if (seenBooks.has(bookId)) {
      continue;
    }

    const title = String(anchor.text)
      .split(/\n+/)
      .map((line) => normalizeText(line))
      .find(Boolean);

    if (!title) {
      continue;
    }

    seenBooks.add(bookId);
    items.push({
      text: title,
      chaptersUrl: `https://m.qidian.com/book/${bookId}/catalog/`,
      url: `https://m.qidian.com/chapter/${bookId}/${chapterId || '0'}/`,
      actionText: '开始阅读'
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
