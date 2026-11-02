const appFanqie = require('./app/fanqie');
const appKadokado = require('./app/kadokado');
const appQidian = require('./app/qidian');
const appQimao = require('./app/qimao');
const appShuqi = require('./app/shuqi');
const webQuanben = require('./web/quanben');
const webFanqie = require('./web/fanqie');
const webKadokado = require('./web/kadokado');
const webL3zc = require('./web/l3zc');
const webAlicesw = require('./web/alicesw');
const webXbookcn = require('./web/xbookcn');
const webQimao = require('./web/qimao');
const webShuqi = require('./web/shuqi');
const webBqg = require('./web/bqg');

function createAppSearchMode(search) {
  return { key: 'app', label: 'App', search };
}

function createWebSearchMode(search) {
  return { key: 'web', label: '网页', search };
}

const SEARCH_SOURCES = [
  {
    source: 'quanben',
    label: '全本小说网',
    searchModes: [createWebSearchMode(webQuanben)]
  },
  {
    source: 'qidian',
    label: '起点中文网',
    searchModes: [createAppSearchMode(appQidian.search), createWebSearchMode(appQidian.search)]
  },
  {
    source: 'fanqie',
    label: '番茄小说',
    searchModes: [createAppSearchMode(appFanqie.search), createWebSearchMode(webFanqie.search)]
  },
  {
    source: 'kadokado',
    label: 'KadoKado',
    searchModes: [createAppSearchMode(appKadokado.search), createWebSearchMode(webKadokado.search)]
  },
  {
    source: 'l3zc',
    label: 'L3ZC',
    publicLabel: '站点2',
    private: true,
    searchModes: [createWebSearchMode(webL3zc)]
  },
  {
    source: 'alicesw',
    label: 'AliceSW',
    publicLabel: '站点1',
    private: true,
    searchModes: [createWebSearchMode(webAlicesw)]
  },
  {
    source: 'xbookcn',
    label: 'xbookcn',
    searchModes: [createWebSearchMode(webXbookcn)]
  },
  {
    source: 'qimao',
    label: '七猫',
    searchModes: [createAppSearchMode(appQimao.search), createWebSearchMode(webQimao.search)]
  },
  {
    source: 'shuqi',
    label: '书旗小说',
    searchModes: [createAppSearchMode(appShuqi.search), createWebSearchMode(webShuqi.search)]
  },
  {
    source: 'bqg',
    label: '笔趣阁',
    searchModes: [createWebSearchMode(webBqg)]
  }
];

module.exports = {
  SEARCH_SOURCES
};
