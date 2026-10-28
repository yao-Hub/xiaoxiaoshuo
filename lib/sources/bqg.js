const crypto = require('crypto');
const tls = require('tls');
const { createJsonHeaders, fetchHtml } = require('../http');
const { normalizeText } = require('../html');

const HOST_PATTERN = /(^|\.)bqg838\.cc$/i;
const BOOK_PATTERN = /^\/book\/(\d+)\/?$/i;
const CHAPTER_PATTERN = /^\/book\/(\d+)\/(\d+)\.html$/i;
const BASE_URL = 'https://www.bqg838.cc';
const EDGE_IPS = ['104.21.29.203', '172.67.186.238', '104.21.2.85'];
const TOKEN_KEY = Buffer.from('a3dc22cf70418a51', 'utf8');
const TOKEN_IV = Buffer.from('394c2c3202da6270', 'utf8');

function match(url) {
  try {
    const parsed = new URL(url);
    if (!HOST_PATTERN.test(parsed.hostname)) {
      return false;
    }

    const route = getRoute(parsed);
    return (
      route.pathname === '/' ||
      BOOK_PATTERN.test(route.pathname) ||
      CHAPTER_PATTERN.test(route.pathname)
    );
  } catch {
    return false;
  }
}

function getRoute(parsed) {
  const hash = parsed.hash.startsWith('#/') ? parsed.hash.slice(1) : '';
  const hashRoute = hash ? new URL(hash, parsed.origin) : null;

  return {
    pathname: hashRoute ? hashRoute.pathname : parsed.pathname,
    searchParams: hashRoute ? hashRoute.searchParams : parsed.searchParams
  };
}

function bookUrl(bookId) {
  return `${BASE_URL}/#/book/${bookId}/`;
}

function chapterUrl(bookId, chapterId) {
  return `${BASE_URL}/#/book/${bookId}/${chapterId}.html`;
}

function createToken(value) {
  const cipher = crypto.createCipheriv('aes-128-cbc', TOKEN_KEY, TOKEN_IV);
  return Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]).toString(
    'base64'
  );
}

function createHttp2Attempt(url, headers, timeoutMs, address, signal) {
  return () =>
    fetchHtml(url, {
      headers,
      signal,
      http2: true,
      timeoutMs,
      idleTimeoutMs: 1000,
      http2Options: {
        createConnection() {
          return tls.connect({
            host: address,
            port: 443,
            servername: 'www.bqg838.cc',
            ALPNProtocols: ['h2']
          });
        }
      }
    });
}

async function fetchApi(url, options = {}) {
  const headers = createJsonHeaders(`${BASE_URL}/`, BASE_URL);
  const timeoutMs = Number.isFinite(options.timeoutMs) ? options.timeoutMs : 7000;
  const attempts = EDGE_IPS.map((address) =>
    createHttp2Attempt(url, headers, timeoutMs, address, options.signal)
  );
  attempts.push(() => fetchHtml(url, { headers, timeoutMs, signal: options.signal }));

  try {
    return await Promise.any(attempts.map((attempt) => fetchApiAttempt(attempt)));
  } catch (error) {
    const errors = error && Array.isArray(error.errors) ? error.errors : [];
    const lastError = errors[errors.length - 1] || error;
    throw new Error(
      `笔趣阁接口请求失败：${lastError instanceof Error ? lastError.message : String(lastError)}`,
      { cause: error }
    );
  }
}

async function fetchApiAttempt(attempt) {
  const response = await attempt();
  const text = String(response.html || '').trim();
  if (!text) {
    throw new Error('接口返回为空。');
  }
  return JSON.parse(text);
}

function createBookApiUrl(bookId) {
  const url = new URL('/api/book', BASE_URL);
  url.searchParams.set('id', bookId);
  return url.toString();
}

function createBookListApiUrl(bookId) {
  const url = new URL('/api/booklist', BASE_URL);
  url.searchParams.set('id', bookId);
  return url.toString();
}

function createChapterApiUrl(bookId, chapterId) {
  const url = new URL('/api/chapter', BASE_URL);
  url.searchParams.set(
    'token',
    createToken({
      id: Number(bookId),
      chapterid: Number(chapterId)
    })
  );
  return url.toString();
}

async function loadBook(bookId, options = {}) {
  const [book, chapterData] = await Promise.all([
    fetchApi(createBookApiUrl(bookId), options),
    fetchApi(createBookListApiUrl(bookId), options)
  ]);
  const chapterTitles = chapterData && Array.isArray(chapterData.list) ? chapterData.list : [];
  const items = chapterTitles
    .map((title, index) => ({
      text: normalizeText(title),
      url: chapterUrl(bookId, index + 1)
    }))
    .filter((item) => item.text);

  if (!items.length) {
    throw new Error('笔趣阁没有识别到章节目录。');
  }

  return {
    kind: 'list',
    source: 'bqg',
    url: bookUrl(bookId),
    title: normalizeText(book.title || `笔趣阁作品 ${bookId}`),
    items
  };
}

async function loadChapter(bookId, chapterId, options = {}) {
  const chapter = await fetchApi(createChapterApiUrl(bookId, chapterId), options);
  const content = String(chapter.txt || '')
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => normalizeText(line).replace(/^\d+\s*[、.．:：]\s*/, ''))
    .filter(Boolean)
    .join('\n');

  if (!content) {
    throw new Error('笔趣阁没有识别到章节正文。');
  }

  const chapterNumber = Number(chapter.chapterid || chapterId);
  const chapterCount = Number(chapter.cs || 0);
  const titleParts = [
    normalizeText(chapter.chaptername || `第 ${chapterId} 章`),
    normalizeText(chapter.title || '')
  ].filter(Boolean);

  return {
    kind: 'chapter',
    source: 'bqg',
    url: chapterUrl(bookId, chapterNumber),
    title: titleParts.join(' · '),
    content,
    prevUrl: chapterNumber > 1 ? chapterUrl(bookId, chapterNumber - 1) : '',
    nextUrl: chapterCount > chapterNumber ? chapterUrl(bookId, chapterNumber + 1) : '',
    catalogUrl: bookUrl(bookId)
  };
}

async function load(url, options = {}) {
  const route = getRoute(new URL(url));
  const bookMatch = route.pathname.match(BOOK_PATTERN);
  if (bookMatch) {
    return loadBook(bookMatch[1], options);
  }

  const chapterMatch = route.pathname.match(CHAPTER_PATTERN);
  if (chapterMatch) {
    return loadChapter(chapterMatch[1], chapterMatch[2], options);
  }

  throw new Error('请打开笔趣阁的书籍或章节地址，或者直接输入书名进行搜索。');
}

async function search(query, options = {}) {
  const url = new URL('/api/search', BASE_URL);
  url.searchParams.set('q', query);
  const data = await fetchApi(url.toString(), options);
  const items = data && Array.isArray(data.data) ? data.data : [];

  return items
    .filter((item) => item && item.id && item.title)
    .slice(0, 12)
    .map((item) => {
      const bookId = String(item.id);
      return {
        text: normalizeText(item.title),
        meta: normalizeText(item.author || ''),
        actionText: '开始阅读',
        chaptersUrl: bookUrl(bookId),
        url: chapterUrl(bookId, 1)
      };
    });
}

module.exports = {
  load,
  match,
  search
};
