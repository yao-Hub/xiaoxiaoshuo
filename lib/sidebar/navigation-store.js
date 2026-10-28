const MAX_NAVIGATION_ITEMS = 30;

class NavigationStore {
  constructor() {
    this.backStack = [];
    this.forwardStack = [];
  }

  get backAvailable() {
    return this.backStack.length > 0;
  }

  get forwardAvailable() {
    return this.forwardStack.length > 0;
  }

  pushCurrent(page) {
    if (page && page.kind === 'history') {
      this.forwardStack = [];
      return;
    }
    this.pushBack(page || { kind: 'home' }, true);
  }

  pushBack(page, clearForward) {
    this.backStack.push(page);
    if (this.backStack.length > MAX_NAVIGATION_ITEMS) {
      this.backStack.shift();
    }
    if (clearForward) {
      this.forwardStack = [];
    }
  }

  pushForward(page) {
    if (!page || page.kind === 'history') {
      return;
    }
    this.forwardStack.push(page);
    if (this.forwardStack.length > MAX_NAVIGATION_ITEMS) {
      this.forwardStack.shift();
    }
  }

  takeBack() {
    return this.backStack.pop();
  }

  takeForward() {
    return this.forwardStack.pop();
  }

  withState(page, inputValue) {
    return {
      ...page,
      value: page.kind === 'search' ? page.query : inputValue || page.url || '',
      backAvailable: this.backAvailable,
      forwardAvailable: this.forwardAvailable
    };
  }
}

module.exports = { NavigationStore };
