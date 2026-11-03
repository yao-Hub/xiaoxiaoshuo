const { normalizeUrl } = require('../core/url');
const quanben = require('./sources/quanben');
const kadokado = require('./sources/kadokado');
const qidian = require('./sources/qidian');
const alicesw = require('./sources/alicesw');
const l3zc = require('./sources/l3zc');
const xbookcn = require('./sources/xbookcn');
const qimao = require('./sources/qimao');
const fanqie = require('./sources/fanqie');
const shuqi = require('./sources/shuqi');
const bqg = require('./sources/bqg');
const generic = require('./sources/generic');

const PAGE_SOURCES = [
  { source: 'quanben', match: quanben.match, load: quanben.load },
  {
    source: 'kadokado',
    match: kadokado.match,
    load: kadokado.load,
    finalProgress: true
  },
  { source: 'qidian', match: qidian.match, load: qidian.load },
  { source: 'alicesw', match: alicesw.match, load: alicesw.load },
  { source: 'l3zc', match: l3zc.match, load: l3zc.load },
  { source: 'xbookcn', match: xbookcn.match, load: xbookcn.load },
  { source: 'qimao', match: qimao.match, load: qimao.load },
  { source: 'fanqie', match: fanqie.match, load: fanqie.load },
  { source: 'shuqi', match: shuqi.match, load: shuqi.load },
  { source: 'bqg', match: bqg.match, load: bqg.load }
];

async function loadPage(inputUrl, options = {}) {
  const normalized = normalizeUrl(inputUrl);

  if (!normalized.ok) {
    throw new Error(normalized.message);
  }

  const url = normalized.url;
  options.onProgress?.({ fraction: 0.03, label: '正在连接网站' });
  const provider = PAGE_SOURCES.find((candidate) => candidate.match(url));
  if (!provider) {
    return generic.load(url, options);
  }
  const page = await provider.load(url, options);
  return provider.finalProgress ? withFinalProgress(page, options) : page;
}

async function withFinalProgress(page, options) {
  options.onProgress?.({ fraction: 0.97, label: '正在解析页面' });
  return page;
}

module.exports = {
  loadPage
};
