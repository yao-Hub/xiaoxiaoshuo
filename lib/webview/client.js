const { escapeAttribute } = require('../html');

const CLIENT_SCRIPT = String.raw`
    const state = __SAFE_STATE__;
    const vscode = acquireVsCodeApi();
    const address = document.getElementById('address');
    const suggestions = document.getElementById('searchSuggestions');
    const toolbar = document.getElementById('toolbar');
    const back = document.getElementById('back');
    const forward = document.getElementById('forward');
    const refresh = document.getElementById('refresh');
    const external = document.getElementById('external');
    const historyToggle = document.getElementById('historyToggle');
    const toast = document.getElementById('toast');
    const progressElement = document.querySelector('.loading-progress');
    const progressBar = document.querySelector('.loading-progress-bar');

    address.type = 'text';
    address.placeholder = '输入书名或地址';
    address.value = state.value || '';
    restoreFontSize();
    syncBackButton();
    syncForwardButton();
    syncExternalButton();

    address.addEventListener('focus', () => showSearchSuggestions(true));
    address.addEventListener('click', () => showSearchSuggestions(true));
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        showSearchSuggestions(false);
      }
    });
    document.addEventListener('click', (event) => {
      if (suggestions && !suggestions.contains(event.target) && event.target !== address) {
        showSearchSuggestions(false);
      }
    });

    toolbar.addEventListener('submit', (event) => {
      event.preventDefault();
      hideToast();
      vscode.postMessage({ command: 'load', value: address.value });
    });

    back.addEventListener('click', () => {
      vscode.postMessage({ command: 'back' });
    });

    forward.addEventListener('click', () => {
      vscode.postMessage({ command: 'forward' });
    });

    refresh.addEventListener('click', () => {
      vscode.postMessage({ command: 'refresh' });
    });

    external.addEventListener('click', () => {
      vscode.postMessage({ command: 'openExternal', url: state.url });
    });

    historyToggle.addEventListener('click', () => {
      vscode.postMessage({ command: 'history' });
    });

    document.addEventListener('click', (event) => {
      const manageToggle = event.target && event.target.closest ? event.target.closest('[data-toggle-history-management]') : null;
      if (manageToggle) {
        event.preventDefault();
        const view = manageToggle.closest('.history-view');
        const actions = view.querySelector('.history-manage-actions');
        const managing = !view.classList.contains('is-managing');
        view.classList.toggle('is-managing', managing);
        actions.hidden = !managing;
        manageToggle.textContent = managing ? '完成' : '管理';
        view.querySelectorAll('[data-history-select]').forEach((checkbox) => {
          checkbox.checked = false;
        });
        return;
      }

      const selectAllTarget = event.target && event.target.closest ? event.target.closest('[data-select-all-history]') : null;
      if (selectAllTarget) {
        event.preventDefault();
        const checkboxes = [...document.querySelectorAll('[data-history-select]')];
        const shouldSelect = checkboxes.some((checkbox) => !checkbox.checked);
        checkboxes.forEach((checkbox) => {
          checkbox.checked = shouldSelect;
        });
        selectAllTarget.textContent = shouldSelect ? '取消全选' : '全选';
        return;
      }

      const deleteSelectedTarget = event.target && event.target.closest ? event.target.closest('[data-delete-selected-history]') : null;
      if (deleteSelectedTarget) {
        event.preventDefault();
        const selected = [...document.querySelectorAll('[data-history-select]:checked')].map((checkbox) => checkbox.value);
        if (!selected.length) {
          showToast('请先选择要删除的历史。');
          return;
        }
        vscode.postMessage({ command: 'deleteReadingHistoryItems', urls: selected });
        return;
      }

      const clearReadingTarget = event.target && event.target.closest ? event.target.closest('[data-clear-reading-history]') : null;
      if (clearReadingTarget) {
        event.preventDefault();
        vscode.postMessage({ command: 'clearReadingHistory' });
        return;
      }

      const deleteTarget = event.target && event.target.closest ? event.target.closest('[data-delete-search-query]') : null;
      if (deleteTarget) {
        event.preventDefault();
        const query = deleteTarget.getAttribute('data-delete-search-query') || '';
        const row = deleteTarget.closest('.suggestion-row');
        if (row) {
          row.remove();
        }
        const remaining = suggestions.querySelectorAll('.suggestion-row').length;
        if (!remaining) {
          showSearchSuggestions(false);
        }
        vscode.postMessage({ command: 'deleteSearchHistory', query });
        return;
      }

      const clearTarget = event.target && event.target.closest ? event.target.closest('[data-clear-search-history]') : null;
      if (clearTarget) {
        event.preventDefault();
        suggestions.querySelectorAll('.suggestion-row').forEach((row) => row.remove());
        clearTarget.remove();
        showSearchSuggestions(false);
        vscode.postMessage({ command: 'clearSearchHistory' });
        return;
      }

      const tocTarget = event.target && event.target.closest ? event.target.closest('[data-scroll-toc]') : null;
      if (tocTarget) {
        event.preventDefault();
        const tocSection = document.querySelector('.toc-section');
        if (tocSection) {
          tocSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        return;
      }

      const backTarget = event.target && event.target.closest ? event.target.closest('[data-go-back]') : null;
      if (backTarget) {
        event.preventDefault();
        vscode.postMessage({ command: 'back' });
        return;
      }

      const searchTarget = event.target && event.target.closest ? event.target.closest('[data-search-query]') : null;
      if (searchTarget) {
        event.preventDefault();
        hideToast();
        vscode.postMessage({ command: 'search', query: searchTarget.getAttribute('data-search-query') || '' });
        return;
      }

      const target = event.target && event.target.closest ? event.target.closest('[data-open-url]') : null;
      if (!target) {
        return;
      }

      const url = target.getAttribute('data-open-url');
      if (!url) {
        return;
      }

      if (target.classList.contains('history-page-link') && document.querySelector('.history-view.is-managing')) {
        event.preventDefault();
        const checkbox = target.closest('.history-page-row')?.querySelector('[data-history-select]');
        if (checkbox) {
          checkbox.checked = !checkbox.checked;
        }
        return;
      }

      if (target.classList.contains('item-link') || target.classList.contains('search-link') || target.classList.contains('search-action') || target.classList.contains('nav-button') || target.classList.contains('toc-link') || target.classList.contains('history-link') || target.classList.contains('history-page-link')) {
        event.preventDefault();
        hideToast();
        vscode.postMessage({ command: 'openItem', url });
      }
    });

    window.addEventListener('message', (event) => {
      if (event.data && event.data.command === 'toast') {
        showToast(event.data.message);
        return;
      }

      if (event.data && event.data.command === 'progress' && progressElement && progressBar) {
        const percent = Math.max(0, Math.min(100, Number(event.data.percent) || 0));
        progressBar.style.width = percent + '%';
        progressElement.setAttribute('aria-valuenow', String(percent));
      }
    });

    function syncBackButton() {
      back.disabled = !state.canGoBack;
    }

    function syncForwardButton() {
      forward.disabled = !state.canGoForward;
    }

    function showSearchSuggestions(open) {
      if (!suggestions) {
        return;
      }
      suggestions.toggleAttribute('hidden', !open);
      suggestions.style.display = open ? 'block' : 'none';
    }

    function syncExternalButton() {
      external.disabled = !state.url;
    }

    function restoreFontSize() {
      const saved = Number(localStorage.getItem('novelFontSize') || 18);
      document.documentElement.style.setProperty('--novel-font-size', clampFontSize(saved) + 'px');
    }

    function clampFontSize(value) {
      return Math.max(14, Math.min(28, value));
    }

    function showToast(text) {
      toast.textContent = text;
      toast.style.display = 'block';
      window.setTimeout(hideToast, 3600);
    }

    function hideToast() {
      toast.textContent = '';
      toast.style.display = 'none';
    }
  `;

function renderClientScript(nonce, safeState) {
  return `<script nonce="${escapeAttribute(nonce)}">${CLIENT_SCRIPT.replace('__SAFE_STATE__', () => safeState)}</script>`;
}

module.exports = { renderClientScript };
