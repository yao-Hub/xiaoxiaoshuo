const SEARCH_MODES = [
  { key: 'app', label: 'App' },
  { key: 'web', label: '网页' }
];

const DEFAULT_SEARCH_MODE = 'web';

function normalizeSearchMode(value) {
  return SEARCH_MODES.some((mode) => mode.key === value) ? value : DEFAULT_SEARCH_MODE;
}

module.exports = {
  DEFAULT_SEARCH_MODE,
  SEARCH_MODES,
  normalizeSearchMode
};
