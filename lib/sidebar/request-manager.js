class RequestManager {
  constructor() {
    this.activeController = undefined;
  }

  begin() {
    this.abort();
    const controller = new AbortController();
    this.activeController = controller;
    return controller;
  }

  finish(controller) {
    if (this.activeController === controller) {
      this.activeController = undefined;
    }
  }

  abort() {
    const controller = this.activeController;
    if (!controller) {
      return;
    }
    this.activeController = undefined;
    controller.abort();
  }
}

module.exports = { RequestManager };
