const { createHash } = require('node:crypto');

const SIGN_KEY = 'd3dGiJc651gSQ8w1';
const VERSIONS = [
  '73720',
  '73700',
  '73620',
  '73600',
  '73500',
  '73420',
  '73400',
  '73328',
  '73325',
  '73320',
  '73300',
  '73220',
  '73200',
  '73100',
  '73000',
  '72900',
  '72820',
  '72800',
  '70720',
  '62010',
  '62112'
];

function sign(params) {
  const joined = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('');
  return createHash('md5')
    .update(joined + SIGN_KEY, 'utf8')
    .digest('hex');
}

function stableHash(value) {
  let hash = 0;
  for (const character of String(value)) {
    hash = (hash * 31 + character.codePointAt(0)) >>> 0;
  }
  return hash >= 0x80000000 ? hash - 0x100000000 : hash;
}

function requestHeaders(bookId = '') {
  const hash = bookId ? stableHash(bookId) : 0;
  const versionIndex = Math.abs(hash) % VERSIONS.length;
  const headers = {
    AUTHORIZATION: '',
    'app-version': VERSIONS[versionIndex],
    'application-id': 'com.****.reader',
    channel: 'unknown',
    'net-env': '1',
    platform: 'android',
    'qm-params': '',
    reg: '0'
  };
  headers.sign = sign(headers);
  headers['user-agent'] =
    'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';
  return headers;
}

function queryEncode(params) {
  return Object.keys(params)
    .sort()
    .map(
      (key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key]).replace(/%20/g, '+')}`
    )
    .join('&');
}

module.exports = {
  queryEncode,
  requestHeaders,
  sign
};
