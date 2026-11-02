const https = require('https');
const { normalizeText } = require('../../core/html');
const { signRequest } = require('./fanqie-sign');

const SEARCH_API = 'https://reading.snssdk.com/reading/bookapi/search/tab/v';
const APP_QUERY = {
  iid: '2187355326270644',
  device_id: '2187355326004404',
  ac: 'wifi',
  channel: '43536163a',
  aid: '1967',
  app_name: 'novelapp',
  version_code: '70132',
  version_name: '7.0.1.32',
  device_platform: 'android',
  os: 'android',
  ssmix: 'a',
  os_version: '10',
  device_type: 'P30',
  device_brand: 'realme',
  update_version_code: '70132',
  manifest_version_code: '70132',
  pv_player: '70132'
};

function fetchSearchData(url, headers, signal) {
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
    const request = https.get(url, { headers }, (response) => {
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
    });

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

function toSearchItem(item) {
  const catalogUrl = `https://fanqienovel.com/page/${item.book_id}`;
  return {
    text: normalizeText(item.book_name || item.title),
    meta: [item.author, item.category].filter(Boolean).join(' · '),
    actionText: '章节选择',
    coverUrl: String(item.detail_page_thumb_url || item.thumb_url || ''),
    chaptersUrl: catalogUrl,
    url: catalogUrl
  };
}

async function search(query, options = {}) {
  const searchUrl = new URL(SEARCH_API);
  for (const [key, value] of Object.entries({
    ...APP_QUERY,
    query,
    passback: '0',
    selected_items: '',
    tab_type: '3'
  })) {
    searchUrl.searchParams.set(key, value);
  }

  const headers = {
    'user-agent': 'com.dragon.read',
    referer: 'https://fanqienovel.com/',
    ...signRequest(searchUrl.toString())
  };
  const data = await fetchSearchData(searchUrl.toString(), headers, options.signal);
  if (data?.code !== 0) {
    throw new Error(`接口请求失败：${data?.message || data?.code}`);
  }
  const tab = Array.isArray(data.search_tabs)
    ? data.search_tabs.find((item) => Number(item.tab_type) === 3)
    : null;
  const cells = tab && Array.isArray(tab.data) ? tab.data : [];
  const list = cells.flatMap((cell) => (Array.isArray(cell.book_data) ? cell.book_data : []));

  return list
    .filter((item) => item && item.book_id && (item.book_name || item.title))
    .slice(0, 12)
    .map(toSearchItem);
}

module.exports = {
  search
};
