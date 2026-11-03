const {
  createBrowserHeaders,
  createJsonHeaders,
  fetchHtml,
  fetchJson
} = require('../../core/http');
const {
  extractAnchors,
  cleanNovelText,
  extractTitle,
  htmlToText,
  normalizeText
} = require('../../core/html');

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

function extractQimaoChapterContent(html) {
  const candidates = [];
  const articlePatterns = [
    /<div\b[^>]*class=["'][^"']*\bchapter-detail-article\b[^"']*["'][^>]*>[\s\S]*?<div\b[^>]*class=["'][^"']*\barticle\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi,
    /<div\b[^>]*class=["'][^"']*\barticle\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi
  ];

  for (const pattern of articlePatterns) {
    for (const match of String(html).matchAll(pattern)) {
      const content = cleanNovelText(htmlToText(match[1]));
      if (content) {
        candidates.push(content);
      }
    }
  }

  return candidates.sort((a, b) => b.length - a.length)[0] || '';
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
  const content = extractQimaoChapterContent(html);

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
    contentUnavailable: !content,
    contentUnavailableReason: content ? '' : '该章节需要七猫会员，当前来源暂不提供正文。',
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

module.exports = {
  extractQimaoChapterContent,
  load,
  match
};
