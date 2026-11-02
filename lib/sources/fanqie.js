const https = require('https');
const { createJsonHeaders } = require('../http');
const { normalizeText } = require('../html');

const SEARCH_API = 'https://novel.snssdk.com/api/novel/channel/homepage/search/search/v1/';

function fetchSearchData(url, signal) {
  return new Promise((resolve, reject) => {
    let timeout;
    const abort = () => {
      const error = new Error('请求已取消。');
      error.name = 'AbortError';
      request.destroy(error);
    };
    const cleanup = () => {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', abort);
    };
    const request = https.get(
      url,
      { headers: createJsonHeaders('https://fanqienovel.com/') },
      (response) => {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          response.resume();
          reject(new Error(`接口请求失败: HTTP ${response.statusCode}`));
          return;
        }

        const chunks = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => {
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
          } catch {
            reject(new Error('接口没有返回 JSON 数据。'));
          }
        });
        response.on('error', reject);
      }
    );

    timeout = setTimeout(() => {
      const error = new Error('接口请求超时。');
      request.destroy(error);
    }, 15000);
    request.on('close', cleanup);
    request.on('error', reject);

    if (signal?.aborted) {
      abort();
    } else {
      signal?.addEventListener('abort', abort, { once: true });
    }
  });
}

async function search(query, options = {}) {
  const searchUrl = new URL(SEARCH_API);
  searchUrl.searchParams.set('q', query);
  searchUrl.searchParams.set('aid', '1967');

  const data = await fetchSearchData(searchUrl.toString(), options.signal);
  const list = data && data.data && Array.isArray(data.data.ret_data) ? data.data.ret_data : [];

  return list
    .filter((item) => item && item.book_id && item.title)
    .slice(0, 12)
    .map((item) => {
      const catalogUrl = `https://fanqienovel.com/page/${item.book_id}`;
      return {
        text: normalizeText(item.title),
        meta: [item.author, item.category].filter(Boolean).join(' · '),
        actionText: '章节选择',
        coverUrl: String(item.thumb_url || ''),
        chaptersUrl: catalogUrl,
        url: catalogUrl
      };
    });
}

module.exports = {
  search
};
