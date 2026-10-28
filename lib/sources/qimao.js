const { createBrowserHeaders, createJsonHeaders, fetchHtml, fetchJson } = require('../http');
const {
  extractAnchors,
  extractChapterContent,
  extractTitle,
  htmlToText,
  normalizeText
} = require('../html');

const BOOK_PATTERN = /^\/shuku\/(\d+)\/?$/i;
const CHAPTER_PATTERN = /^\/shuku\/(\d+)-(\d+)\/?$/i;

function match(url) {
  try {
    const parsed = new URL(url);
    return (
      /(^|\.)qimao\.com$/i.test(parsed.hostname) &&
      (BOOK_PATTERN.test(parsed.pathname) || CHAPTER_PATTERN.test(parsed.pathname))
    );
  } catch {
    return false;
  }
}

function getBookTitle(html, fallbackUrl) {
  const keyword = String(html).match(
    /<meta\b[^>]*name=["']keywords["'][^>]*content=["'][^"']*《([^》]+)》/i
  );
  if (keyword) {
    return normalizeText(keyword[1]);
  }

  const title = extractTitle(html, fallbackUrl);
  return title.split(/(?:免费阅读|最新章节|全文免费阅读)/i)[0].trim() || title;
}

function getChapterTitle(html, fallbackUrl) {
  const match = String(html).match(
    /<h2\b[^>]*class=["'][^"']*\bchapter-title\b[^"']*["'][^>]*>([\s\S]*?)<\/h2>/i
  );
  return match ? normalizeText(htmlToText(match[1])) : extractTitle(html, fallbackUrl);
}

async function loadBook(bookId, url, options = {}) {
  const headers = createBrowserHeaders();
  const [page, chapterData] = await Promise.all([
    fetchHtml(url, { ...options, headers }),
    fetchJson(`https://www.qimao.com/qimaoapi/api/book/chapter-list?book_id=${bookId}`, {
      headers: createJsonHeaders(url, 'https://www.qimao.com'),
      timeoutMs: 15000,
      signal: options.signal
    })
  ]);
  const chapters =
    chapterData && chapterData.data && Array.isArray(chapterData.data.chapters)
      ? chapterData.data.chapters
      : [];
  const items = chapters
    .filter((chapter) => chapter && chapter.id && chapter.title)
    .map((chapter) => ({
      text: normalizeText(chapter.title),
      url: `https://www.qimao.com/shuku/${bookId}-${chapter.id}/`
    }));

  if (!items.length) {
    throw new Error('七猫没有识别到章节目录。');
  }

  return {
    kind: 'list',
    source: 'qimao',
    url,
    title: getBookTitle(page.html, page.url),
    items
  };
}

async function loadChapter(bookId, url, options = {}) {
  const { html, url: finalUrl } = await fetchHtml(url, {
    ...options,
    headers: createBrowserHeaders()
  });
  const content = extractChapterContent(html);
  if (!content) {
    throw new Error('七猫没有识别到章节正文。');
  }

  const anchors = extractAnchors(html, finalUrl);
  const prev = anchors.find((item) => /^(上一章|上一页|上一篇)$/i.test(item.text));
  const next = anchors.find((item) => /^(下一章|下一页|下一篇)$/i.test(item.text));
  const chapterMatch = new URL(finalUrl).pathname.match(CHAPTER_PATTERN);
  const resolvedBookId = bookId || (chapterMatch ? chapterMatch[1] : '');

  return {
    kind: 'chapter',
    source: 'qimao',
    url: finalUrl,
    title: getChapterTitle(html, finalUrl),
    content,
    prevUrl: prev ? prev.url : '',
    nextUrl: next ? next.url : '',
    catalogUrl: resolvedBookId ? `https://www.qimao.com/shuku/${resolvedBookId}/` : ''
  };
}

async function load(url, options = {}) {
  const pathname = new URL(url).pathname;
  const bookMatch = pathname.match(BOOK_PATTERN);
  if (bookMatch) {
    return loadBook(bookMatch[1], url, options);
  }

  const chapterMatch = pathname.match(CHAPTER_PATTERN);
  if (!chapterMatch) {
    throw new Error('没有识别到七猫书籍或章节 ID。');
  }
  return loadChapter(chapterMatch[1], url, options);
}

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
  load,
  match,
  search
};
