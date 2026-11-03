const { createBrowserHeaders, fetchHtml } = require('../../core/http');
const { extractAnchors, extractTitle, normalizeText } = require('../../core/html');

function match(url) {
  try {
    const parsed = new URL(url);
    return (
      /(^|\.)shuqi\.com$/i.test(parsed.hostname) &&
      (/^\/book\/\d+\.html$/i.test(parsed.pathname) ||
        (parsed.pathname === '/chapter' && /^\d+$/.test(parsed.searchParams.get('bid') || '')))
    );
  } catch {
    return false;
  }
}

function getBookId(url) {
  const parsed = new URL(url);
  return (
    parsed.pathname.match(/^\/book\/(\d+)\.html$/i)?.[1] || parsed.searchParams.get('bid') || ''
  );
}

function extractChapterItems(html, baseUrl, bookId) {
  const items = [];
  const seen = new Set();

  for (const anchor of extractAnchors(html, baseUrl)) {
    const url = anchor.url.replace(/&amp;/g, '&');
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      continue;
    }
    const itemBookId = parsed.searchParams.get('bid') || '';
    const chapterId = parsed.searchParams.get('cid') || '';
    if (
      parsed.pathname !== '/reader' ||
      itemBookId !== bookId ||
      !/^\d+$/.test(chapterId) ||
      seen.has(chapterId)
    ) {
      continue;
    }

    const title = normalizeText(anchor.text).replace(/^\d+\.\s*/, '');
    if (!title) {
      continue;
    }
    seen.add(chapterId);
    items.push({
      text: title,
      url: `https://www.shuqi.com/reader?bid=${bookId}&cid=${chapterId}`
    });
  }

  return items;
}

function isPaidReader(html) {
  const value = String(html);
  return value.includes('账户余额') && (value.includes('余额不足') || value.includes('请先充值'));
}

async function fetchBookCatalog(bookId, options = {}) {
  const url = `https://www.shuqi.com/chapter?bid=${bookId}`;
  const page = await fetchHtml(url, {
    headers: createBrowserHeaders(),
    timeoutMs: options.timeoutMs || 20000,
    signal: options.signal
  });
  let items = extractChapterItems(page.html, page.url, bookId);
  if (items.length) {
    return {
      html: page.html,
      url: page.url,
      items
    };
  }

  const bookPage = await fetchHtml(`https://www.shuqi.com/book/${bookId}.html`, {
    headers: createBrowserHeaders(),
    timeoutMs: options.timeoutMs || 20000,
    signal: options.signal
  });
  items = extractChapterItems(bookPage.html, bookPage.url, bookId);
  return {
    html: bookPage.html,
    url: bookPage.url,
    items
  };
}

async function load(url, options = {}) {
  const bookId = getBookId(url);
  const catalog = await fetchBookCatalog(bookId, options);
  const rawTitle = extractTitle(catalog.html, catalog.url);
  const title = rawTitle
    .replace(/^《|》$/g, '')
    .split(/(?:最新章节|全文免费阅读|章节目录)/)[0]
    .trim();

  if (!catalog.items.length) {
    throw new Error('书旗小说没有识别到章节目录。');
  }

  return {
    kind: 'list',
    source: 'shuqi',
    url: catalog.url,
    title: title || `书旗作品 ${bookId}`,
    items: catalog.items
  };
}

module.exports = {
  extractChapterItems,
  isPaidReader,
  load,
  match
};
