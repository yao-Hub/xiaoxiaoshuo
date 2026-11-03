const { createBrowserHeaders, fetchHtml } = require('../../core/http');
const {
  cleanNovelText,
  extractAnchors,
  extractChapterContent,
  extractTitle,
  htmlToText,
  normalizeText
} = require('../../core/html');
const generic = require('./generic');
const { mapping: fanqieFontMap } = require('../fanqie-font-map');

function match(url) {
  try {
    const parsed = new URL(url);
    return (
      /(^|\.)fanqienovel\.com$/i.test(parsed.hostname) &&
      (/^\/reader\/\d+\/?$/.test(parsed.pathname) || /^\/page\/\d+\/?$/.test(parsed.pathname))
    );
  } catch {
    return false;
  }
}

function decodeFanqieText(value) {
  return String(value)
    .replace(/[\uE000-\uF8FF]/g, (character) => fanqieFontMap[character] || character)
    .normalize('NFKC');
}

function getChapterTitle(html, fallbackUrl) {
  const matchResult = String(html).match(
    /<h1\b[^>]*class=["'][^"']*\bmuye-reader-title\b[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i
  );
  return matchResult ? normalizeText(htmlToText(matchResult[1])) : extractTitle(html, fallbackUrl);
}

function getCatalogUrl(html) {
  const matchResult = String(html).match(/https:\/\/fanqienovel\.com\/page\/(\d+)/i);
  return matchResult ? `https://fanqienovel.com/page/${matchResult[1]}` : '';
}

async function load(url, options = {}) {
  const { html, url: finalUrl } = await fetchHtml(url, {
    ...options,
    headers: createBrowserHeaders()
  });

  if (/^\/page\/\d+\/?$/.test(new URL(finalUrl).pathname)) {
    return generic.buildListPage(finalUrl, html, 'fanqie');
  }

  const content = cleanNovelText(decodeFanqieText(extractChapterContent(html)));
  if (!content) {
    throw new Error('番茄小说没有识别到章节正文。');
  }

  const anchors = extractAnchors(html, finalUrl);
  const prev = anchors.find((item) => /^(上一章|上一页|上一篇)$/i.test(item.text));
  const next = anchors.find((item) => /^(下一章|下一页|下一篇)$/i.test(item.text));

  return {
    kind: 'chapter',
    source: 'fanqie',
    url: finalUrl,
    title: getChapterTitle(html, finalUrl),
    content,
    prevUrl: prev ? prev.url : '',
    nextUrl: next ? next.url : '',
    catalogUrl: getCatalogUrl(html)
  };
}

module.exports = {
  decodeFanqieText,
  load,
  match
};
