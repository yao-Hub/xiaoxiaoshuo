const WEBVIEW_STYLES = String.raw`
    :root {
      color-scheme: light dark;
      --border: color-mix(in srgb, var(--vscode-foreground) 16%, transparent);
      --reader-bg: var(--vscode-editor-background);
      --reader-fg: var(--vscode-editor-foreground);
      --muted: color-mix(in srgb, var(--vscode-foreground) 66%, transparent);
      --surface: var(--vscode-sideBar-background);
      --button-bg: var(--vscode-button-secondaryBackground);
      --button-fg: var(--vscode-button-secondaryForeground);
      --link: var(--vscode-textLink-foreground);
    }

    * { box-sizing: border-box; }

    body {
      min-width: 320px;
      height: 100vh;
      margin: 0;
      overflow: hidden;
      color: var(--reader-fg);
      background: var(--reader-bg);
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
    }

    .app {
      position: relative;
      display: grid;
      grid-template-rows: auto minmax(0, 1fr);
      height: 100vh;
    }

    .toolbar {
      display: grid;
      grid-template-columns: auto auto minmax(120px, 1fr) auto auto auto auto;
      gap: 8px;
      align-items: center;
      padding: 8px;
      border-bottom: 1px solid var(--border);
      background: var(--surface);
    }

    .address {
      width: 100%;
      min-width: 0;
      height: 30px;
      padding: 0 10px;
      color: var(--vscode-input-foreground);
      background: var(--vscode-input-background);
      border: 1px solid var(--vscode-input-border, var(--border));
      border-radius: 4px;
      outline: none;
      font-family: var(--vscode-font-family);
    }

    .address:focus {
      border-color: var(--vscode-focusBorder);
    }

    .button {
      min-width: 34px;
      height: 30px;
      padding: 0 10px;
      color: var(--button-fg);
      background: var(--button-bg);
      border: 1px solid transparent;
      border-radius: 4px;
      cursor: pointer;
      font: inherit;
      white-space: nowrap;
    }

    .button:hover {
      background: var(--vscode-toolbar-hoverBackground);
    }

    .button:disabled {
      cursor: not-allowed;
      opacity: 0.45;
    }

    .button:focus-visible {
      outline: 1px solid var(--vscode-focusBorder);
      outline-offset: 2px;
    }

    .search-suggestions {
      position: absolute;
      top: 47px;
      right: 8px;
      left: 8px;
      z-index: 20;
      max-height: min(360px, 60vh);
      overflow: auto;
      padding: 6px;
      color: var(--reader-fg);
      background: var(--vscode-dropdown-background);
      border: 1px solid var(--vscode-dropdown-border, var(--border));
      border-radius: 5px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
    }

    .loading-progress {
      position: absolute;
      top: 47px;
      right: 0;
      left: 0;
      z-index: 30;
      height: 3px;
      overflow: hidden;
      background: color-mix(in srgb, var(--vscode-progressBar-background) 18%, transparent);
    }

    .loading-progress-bar {
      width: 3%;
      height: 100%;
      background: var(--vscode-progressBar-background);
      transition: width 160ms ease-out;
    }

    .search-suggestions[hidden] {
      display: none;
    }

    .suggestions-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 4px 6px 7px;
      color: var(--muted);
      font-size: 0.8rem;
      font-weight: 650;
    }

    .suggestions-clear,
    .suggestion-query,
    .suggestion-remove {
      color: var(--reader-fg);
      background: transparent;
      border: 0;
      cursor: pointer;
      font: inherit;
    }

    .suggestions-clear {
      padding: 2px 4px;
      color: var(--link);
      font-size: 0.78rem;
      font-weight: 400;
    }

    .suggestion-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 28px;
      align-items: center;
      border-radius: 4px;
    }

    .suggestion-row:hover {
      background: var(--vscode-list-hoverBackground);
    }

    .suggestion-query {
      min-width: 0;
      padding: 7px 8px;
      text-align: left;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .suggestion-remove {
      width: 28px;
      height: 28px;
      color: var(--muted);
      font-size: 16px;
    }

    .suggestion-remove:hover {
      color: var(--reader-fg);
    }

    .suggestions-empty {
      padding: 10px 8px;
      color: var(--muted);
      font-size: 0.84rem;
    }

    .reader-shell {
      min-height: 0;
      overflow: auto;
      overflow-x: hidden;
      scrollbar-gutter: stable;
    }

    .chapter-view,
    .list-view,
    .search-view,
    .history-view {
      width: min(960px, calc(100% - 24px));
      margin: 0 auto;
      padding: 28px 0 56px;
    }

    h1 {
      margin: 0 0 8px;
      color: var(--reader-fg);
      font-size: 1.55rem;
      font-weight: 650;
      line-height: 1.35;
      letter-spacing: 0;
    }

    .source {
      margin: 0 0 28px;
      color: var(--muted);
      font-size: 0.86rem;
      overflow-wrap: anywhere;
    }

    .content {
      font-family: "Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", var(--vscode-font-family);
      font-size: var(--novel-font-size, 18px);
      line-height: 1.9;
      letter-spacing: 0;
    }

    .content p {
      margin: 0 0 1.05em;
      text-indent: 2em;
    }

    .chapter-nav {
      display: flex;
      gap: 10px;
      justify-content: center;
      margin-top: 34px;
    }

    .chapter-nav-top {
      margin-top: 0;
      margin-bottom: 26px;
    }

    .search-summary {
      margin: 8px 0 24px;
      color: var(--muted);
    }

    .search-live-progress {
      height: 4px;
      margin: -12px 0 22px;
      overflow: hidden;
      background: color-mix(in srgb, var(--vscode-progressBar-background) 18%, transparent);
      border-radius: 999px;
    }

    .search-live-progress-bar {
      height: 100%;
      background: var(--vscode-progressBar-background);
      transition: width 180ms ease-out;
    }

    .search-alert {
      margin: -10px 0 22px;
      padding: 10px 12px;
      color: var(--vscode-inputValidation-warningForeground);
      background: var(--vscode-inputValidation-warningBackground);
      border: 1px solid var(--vscode-inputValidation-warningBorder);
      border-radius: 5px;
      line-height: 1.5;
    }

    .search-empty.searching {
      color: var(--link);
    }

    .search-group.is-searching {
      border-style: dashed;
    }

    .search-group {
      margin-top: 22px;
      border: 1px solid var(--border);
      border-radius: 6px;
      overflow: hidden;
    }

    .search-group-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 10px 12px;
      background: var(--surface);
      border-bottom: 1px solid var(--border);
    }

    .search-group-head h2 {
      margin: 0;
      font-size: 1rem;
    }

    .search-count {
      min-width: 24px;
      padding: 1px 7px;
      color: var(--muted);
      text-align: center;
      border: 1px solid var(--border);
      border-radius: 999px;
      font-size: 0.8rem;
    }

    .search-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 10px;
      align-items: center;
      padding: 8px 10px;
      border-bottom: 1px solid var(--border);
    }

    .search-row:last-child {
      border-bottom: 0;
    }

    .search-link {
      min-width: 0;
      padding: 4px 2px;
      color: var(--link);
      background: transparent;
      border: 0;
      text-align: left;
      cursor: pointer;
      font: inherit;
    }

    .search-title,
    .search-meta {
      display: block;
      overflow-wrap: anywhere;
    }

    .search-meta,
    .search-empty {
      margin-top: 2px;
      color: var(--muted);
      font-size: 0.84rem;
    }

    .search-empty {
      padding: 12px;
    }

    .history-panel {
      max-height: min(360px, 52vh);
      overflow: auto;
      padding: 8px;
      border-bottom: 1px solid var(--border);
      background: var(--surface);
    }

    .history-panel[hidden] {
      display: none;
    }

    .history-link {
      display: block;
      width: 100%;
      padding: 8px;
      color: var(--reader-fg);
      background: transparent;
      border: 0;
      border-radius: 4px;
      text-align: left;
      cursor: pointer;
      font: inherit;
    }

    .history-link:hover {
      background: var(--vscode-toolbar-hoverBackground);
    }

    .history-title,
    .history-url {
      display: block;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .history-url,
    .history-empty {
      color: var(--muted);
      font-size: 0.84rem;
    }

    .history-empty {
      padding: 8px;
    }

    .history-heading {
      padding: 8px;
      color: var(--muted);
      font-size: 0.78rem;
      font-weight: 650;
      letter-spacing: 0.04em;
    }

    .search-history-list {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      padding: 0 8px 10px;
    }

    .search-history-link {
      padding: 4px 9px;
      color: var(--link);
      background: var(--button-bg);
      border: 1px solid var(--border);
      border-radius: 999px;
      cursor: pointer;
      font: inherit;
    }

    .search-history-link:hover {
      background: var(--vscode-toolbar-hoverBackground);
    }

    .history-page-section {
      margin-top: 28px;
      padding-top: 20px;
      border-top: 1px solid var(--border);
    }

    .history-page-section h2 {
      margin: 0;
      font-size: 1.05rem;
    }

    .history-section-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 12px;
    }

    .history-manage-toggle,
    .history-manage-button {
      color: var(--link);
      background: transparent;
      border: 0;
      cursor: pointer;
      font: inherit;
    }

    .history-manage-toggle {
      padding: 3px 5px;
      font-size: 0.82rem;
    }

    .history-manage-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 12px;
    }

    .history-manage-actions[hidden] {
      display: none;
    }

    .history-manage-button {
      padding: 5px 9px;
      color: var(--reader-fg);
      background: var(--button-bg);
      border: 1px solid var(--border);
      border-radius: 4px;
    }

    .history-manage-button.danger {
      color: var(--vscode-inputValidation-errorForeground);
    }

    .history-page-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      align-items: center;
      border-radius: 4px;
    }

    .history-view.is-managing .history-page-row {
      grid-template-columns: auto minmax(0, 1fr);
    }

    .history-page-row:hover {
      background: var(--vscode-toolbar-hoverBackground);
    }

    .history-select-input {
      display: none;
      margin: 0 4px 0 10px;
      accent-color: var(--vscode-focusBorder);
    }

    .history-view.is-managing .history-select-input {
      display: block;
    }

    .history-view.is-managing .history-page-link {
      cursor: default;
    }

    .history-page-link {
      display: block;
      width: 100%;
      padding: 10px;
      color: var(--reader-fg);
      background: transparent;
      border: 0;
      border-radius: 4px;
      text-align: left;
      cursor: pointer;
      font: inherit;
    }

    .history-page-link:hover {
      background: var(--vscode-toolbar-hoverBackground);
    }

    .toc-section {
      margin-top: 34px;
      padding-top: 24px;
      border-top: 1px solid var(--border);
    }

    .toc-list {
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .toc-item {
      margin: 0;
    }

    .toc-link {
      display: block;
      width: 100%;
      padding: 6px 0;
      color: var(--link);
      background: transparent;
      border: 0;
      text-align: left;
      cursor: pointer;
      font: inherit;
      line-height: 1.45;
      word-break: break-word;
    }

    .toc-link.is-active {
      color: var(--reader-fg);
      font-weight: 650;
    }

    .toc-text {
      cursor: default;
      color: var(--muted);
    }

    .toc-children {
      padding-left: 18px;
      margin-left: 2px;
      border-left: 1px solid var(--border);
    }

    .list-table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }

    .list-table th,
    .list-table td {
      padding: 10px 12px;
      border-bottom: 1px solid var(--border);
      vertical-align: top;
      text-align: left;
    }

    .list-table th {
      color: var(--muted);
      font-size: 0.84rem;
      font-weight: 600;
    }

    .title-cell {
      width: 100%;
    }

    .item-link {
      padding: 0;
      color: var(--link);
      background: transparent;
      border: 0;
      text-align: left;
      cursor: pointer;
      font: inherit;
      line-height: 1.5;
      word-break: break-word;
    }

    .status {
      padding: 18px 0;
      color: var(--muted);
    }

    .status.error {
      color: var(--vscode-inputValidation-errorForeground);
    }

    .toast {
      position: fixed;
      right: 12px;
      bottom: 12px;
      display: none;
      max-width: min(520px, calc(100vw - 24px));
      padding: 8px 10px;
      color: var(--vscode-inputValidation-errorForeground);
      background: var(--vscode-inputValidation-errorBackground);
      border: 1px solid var(--vscode-inputValidation-errorBorder);
      border-radius: 4px;
      overflow-wrap: anywhere;
    }

    @media (max-width: 720px) {
      .toolbar {
        grid-template-columns: auto auto minmax(100px, 1fr) auto auto auto auto;
      }

      .chapter-view,
      .list-view,
      .search-view,
      .history-view {
        width: calc(100% - 20px);
        padding-top: 22px;
      }

      .content {
        font-size: var(--novel-font-size, 17px);
      }

      .toc-children {
        padding-left: 12px;
      }
    }

    @media (max-width: 560px) {
      .toolbar {
        grid-template-columns: repeat(4, minmax(0, 1fr));
        grid-template-areas:
          "back forward address address"
          "load refresh external history";
      }

      #back {
        grid-area: back;
      }

      #forward {
        grid-area: forward;
      }

      #address {
        grid-area: address;
      }

      #load {
        grid-area: load;
      }

      #refresh {
        grid-area: refresh;
      }

      #external {
        grid-area: external;
      }

      #historyToggle {
        grid-area: history;
      }

      .toolbar .button,
      .toolbar .address {
        width: 100%;
        min-width: 0;
        padding-right: 6px;
        padding-left: 6px;
      }

      .search-suggestions {
        top: 85px;
      }

      .loading-progress {
        top: 84px;
      }
    }
  `;

module.exports = { WEBVIEW_STYLES };
