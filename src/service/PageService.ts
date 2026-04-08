import AppState from '@/AppState';
import { Positions, Settings } from '@/data/Constants';
import Storage from '@/data/Storage';
import { Page } from '@/model/Page';
import FrameService from '@/service/FrameService';
import MenuService from '@/service/MenuService';
import NavbarService from '@/service/NavbarService';
import PreferencesService from '@/service/PreferencesService';
import TrayService from '@/service/TrayService';
import ViewService from '@/service/ViewService';
import { Rectangle, screen, Size, WebContents, WebContentsView, WebContentsViewConstructorOptions } from 'electron';

class PageService {
  public setupOrTogglePage(): void {
    if (!AppState.pages.length) {
      PreferencesService.open();
      return;
    }

    if (!this.getCurrentPage()) {
      this.selectPage(AppState.pages[0]);
      return;
    }

    if (!this.getCurrentView()) {
      this.setupCurrentPage();
      return;
    }

    FrameService.toggleVisibility();
  }

  public selectPage(page = this.getCurrentPage()): void {
    if (this.getCurrentPage() === page) {
      return this.setupOrTogglePage();
    }

    const previousPage = this.getCurrentPage();

    AppState.currentPage = page;
    this.setupCurrentPage();

    if (!Storage.getSettings<boolean>(Settings.SHARE_BOUNDS)) {
      FrameService.getFrame()?.isMaximized() && FrameService.toggleMaximize();
    }

    if (previousPage?.view && !previousPage.persist) {
      this.closePageView(previousPage);
    }
  }

  public recreateAllViews(): void {
    this.getAllActivePages().forEach((p) => this.recreateView(p));
    MenuService.refreshContextMenu();
  }

  private setupCurrentPage(): void {
    if (!this.getCurrentView()) {
      this.openPageView();
      MenuService.refreshContextMenu();
      TrayService.updateTrayIcon();
    }
    FrameService.updateView(true);
  }

  public updatePages() {
    const newPages = Page.fromList(Storage.getPages());

    if (!newPages.some((p) => p.isValid)) {
      AppState.pages = [];
      PreferencesService.open();
      return;
    }

    if (!AppState.pages) {
      AppState.pages = newPages;
      return;
    }

    const updatedPages = this.getAllActivePages(true).filter((p) => {
      if (newPages.some((np) => np.id === p.id)) { return true; }
      this.closePageView(p);
      if (this.isCurrentPage(p)) {
        AppState.currentPage = void 0;
        FrameService.getFrame() && FrameService.forceClose(false);
      }
      return false;
    });

    AppState.pages = newPages.map((newPage) => {
      const page = updatedPages.find((updatedPage) => updatedPage.id === newPage.id);
      if (!page) { return newPage; }
      this.updatePageAndPropagate(page, newPage);
      return page;
    });
  }

  public updatePageAndPropagate(to: Page, from: Page): void {
    const labelChanged = to.label !== from.label;
    const urlChanged = to.url !== from.url;
    const sessionChanged = to.session !== from.session;

    to.persist = from.persist;
    to.label = from.label;
    to.session = from.session;
    to.url = from.url;

    if (!to.view) { return; }

    if (!to.persist && !this.isCurrentPage(to)) {
      this.closePageView(to);
      return;
    }

    if (urlChanged || sessionChanged) {
      this.reopenPageView(to);
      FrameService.updateView();
      return;
    }

    labelChanged && NavbarService.sendLabel();
  }

  public getCurrentHomeUrl(): string {
    return AppState.currentPage!.url;
  }

  public getAllActivePages(excludeCustomPages?: boolean): Page[] {
    return this.getAllPages(excludeCustomPages).filter((p) => p.hasView);
  }

  public hasAnyActivePage(): boolean {
    return this.getAllPages().some((p) => p.hasView);
  }

  public getAllPages(excludeCustomPages?: boolean): Page[] {
    const pages = [...AppState.pages];
    if (!excludeCustomPages) {
      pages.push(AppState.fromClipboardPage);
    }
    return pages;
  }

  public getCurrentPage(): Page | undefined {
    return AppState.currentPage;
  }

  public getCurrentView(): WebContentsView | undefined {
    return this.getCurrentPage()?.view;
  }

  public createNewPageFromCurrentUrl(): void {
    if (!this.getCurrentPage()) { throw new Error('No view to create page from current URL.'); }

    const url = this.getCurrentView()!.webContents.getURL();
    if (!Page.isValidUrl(url)) { throw new Error('Invalid URL to create page: ' + url.substring(0, 20) + '...'); }

    const webContents = this.getCurrentView()!.webContents;
    const currentPage = this.getCurrentPage()!;

    // Create a new page with the current URL
    const newPage = new Page(undefined, webContents.getTitle(), url, undefined, currentPage.session, false);
    Storage.setPage(newPage.toPlainPage());
    MenuService.updatePagesAndRefresh();
    PreferencesService.sendPagesUpdated();
  }

  public isCurrentPage(page?: Page): boolean {
    return !!page && AppState.currentPage === page;
  }

  public changeUrl(page: Page, url?: string): boolean {
    if (!url || page.url === url) { return false; }

    page.url = url;
    if (page.hasView) {
      page.view!.webContents.loadURL(url);
    }
    return true;
  }

  public hasPages(): boolean {
    return AppState.pages.length > 0;
  }

  public getValidPages(): Page[] {
    return AppState.pages.filter((page) => page.isValid);
  }

  public getPageByWebContents(webContents: WebContents): Page | undefined {
    return AppState.pages.find((page) => page.view?.webContents === webContents);
  }

  private openPageView(page = this.getCurrentPage()!): void {
    if (page.view) { throw new Error('Page view already exists.'); }
    const view = ViewService.createView(this.createViewOptions(page));
    page.view = view;
    view.webContents.once('dom-ready', () => (view.isReady = true));
    view.webContents.loadURL(page.url);
  }

  private reopenPageView(page = this.getCurrentPage()!): void {
    this.closePageView(page);
    this.openPageView(page);
  }

  public closePageView(page = this.getCurrentPage()!): void {
    if (!page.view) { return; }
    const view = page.view;
    page.view = undefined;
    const wc = view.webContents;
    wc && !wc.isDestroyed() && wc.close();
  }

  public recreateView(page = this.getCurrentPage()!): void {
    if (!page.view) { throw new Error('No view to recreate.'); }
    const oldView = page.view;
    const newView = ViewService.recreateView(oldView, this.createViewOptions(page));
    page.view = newView;
    oldView.removeAllListeners();
    oldView.webContents.removeAllListeners();
    oldView.webContents.close();
  }

  public resetUrl(page = this.getCurrentPage()!): void {
    page.view!.webContents.loadURL(this.getCurrentHomeUrl());
  }

  /**
   * If the page has bounds, return its bounds. Otherwise, calculate the bounds based on user settings.
   * @param page Page to get the bounds for.
   * @returns Window bounds.
   */
  public getPageBounds(page: Page): Rectangle {
    if (!page.hasBounds) {
      page.hasBounds = true;
      if (AppState.resetBoundsType) { return this.getDefaultBounds(page); }
    }

    const bounds = Storage.getSettings(Settings.SHARE_BOUNDS) ?
      Storage.getSharedBounds() : Storage.getWindowBounds(page.id!);

    // Verify if the stored bounds have position
    if (bounds.x !== void 0) { return bounds as Rectangle; }

    return this.getBoundsForDefaultPosition(bounds);
  }

  /**
   * Get the bounds based on the reset settings.
   * @param {Page} page Page to get the bounds for.
   * @param {true} [forceResetBounds] If true, the bounds are reset regardless of the current settings.
   * @returns {Rectangle} bounds.
   */
  public getDefaultBounds(page: Page, forceResetBounds?: true): Rectangle {
    const isShared = Storage.getSettings(Settings.SHARE_BOUNDS);

    let size;

    if (forceResetBounds || AppState.resetBoundsType === 'bounds') {
      size = Storage.getDefaultSize();
    } else {
      size = isShared ? Storage.getSharedBounds() : Storage.getWindowBounds(page.id!);
    }

    // If the bounds are shared, then the bounds are reset only once
    isShared && (AppState.resetBoundsType = '');

    return this.getBoundsForDefaultPosition(size);
  }

  /**
     * Calculate default position based on the window, offset, and screen size.
     * @param windowSize Window size to be used in the returned
     * bounds and for distance calculation.
     * @returns Window bounds.
     */
  private getBoundsForDefaultPosition(windowSize: Size): Rectangle {
    const bounds = { width: windowSize.width, height: windowSize.height } as Rectangle;

    // Get user position preference
    const position = Storage.getSettings(Settings.DEFAULT_POSITION);

    // Get the available area
    const area = screen.getPrimaryDisplay().workAreaSize as Rectangle;
    area.width -= bounds.width;
    area.height -= bounds.height;
    area.x = 0;
    area.y = 0;

    // Calc position
    switch (position) {
      case Positions.TOP_LEFT: bounds.y = area.y + Page.MARGIN.y; bounds.x = area.x + Page.MARGIN.x; break;
      case Positions.TOP_CENTER: bounds.y = area.y + Page.MARGIN.y; bounds.x = area.width / 2 | 0; break;
      case Positions.TOP_RIGHT: bounds.y = area.y + Page.MARGIN.y; bounds.x = area.width - Page.MARGIN.x; break;
      case Positions.MIDDLE_LEFT: bounds.y = area.height / 2 | 0; bounds.x = area.x + Page.MARGIN.x; break;
      case Positions.CENTER: bounds.y = area.height / 2 | 0; bounds.x = area.width / 2 | 0; break;
      case Positions.MIDDLE_RIGHT: bounds.y = area.height / 2 | 0; bounds.x = area.width - Page.MARGIN.x; break;
      case Positions.BOTTOM_LEFT: bounds.y = area.height - Page.MARGIN.y; bounds.x = area.x + Page.MARGIN.x; break;
      case Positions.BOTTOM_CENTER: bounds.y = area.height - Page.MARGIN.y; bounds.x = area.width / 2 | 0; break;
      case Positions.BOTTOM_RIGHT: bounds.y = area.height - Page.MARGIN.y; bounds.x = area.width - Page.MARGIN.x; break;
      default: bounds.y = area.y + Page.MARGIN.y; bounds.x = area.width - Page.MARGIN.x;
    }

    return bounds;
  }

  private createViewOptions(page: Page): WebContentsViewConstructorOptions {
    return {
      webPreferences: {
        partition: Storage.getPartitionName(page.session),
      },
    };
  }
}

export default new PageService();
