import AppState from '@/AppState';
import { OS, Settings } from '@/data/Constants';
import Storage from '@/data/Storage';
import { Page } from '@/model/Page';
import StatePropagator from '@/propagator/StatePropagator';
import FrameService from '@/service/FrameService';
import PageService from '@/service/PageService';
import PreferencesService from '@/service/PreferencesService';
import TrayService from '@/service/TrayService';
import ViewService from '@/service/ViewService';
import QuickMenuModal, { QuickMenuItem } from '@/util/modal/QuickMenuModal';
import SearchEngine from '@ecromaneli/search-engine';
import { app, clipboard, Menu, MenuItemConstructorOptions, shell } from 'electron';

type MenuItem = MenuItemConstructorOptions & { submenu: MenuItemConstructorOptions[] };

class MenuService {
  private quickMenu: QuickMenuModal = new QuickMenuModal();

  constructor() {
    this.registerStateListeners();
    this.registerQuickMenuEventListeners();
  }

  private registerStateListeners(): void {
    StatePropagator.onChange(() => { this.refreshContextMenu(); }, true);
  }

  public updatePagesAndRefresh() {
    PageService.updatePages();
    this.refreshContextMenu();
  }

  public refreshContextMenu(): void {
    const trayMenuItems: MenuItemConstructorOptions[] = [];
    const menuItems: MenuItemConstructorOptions[] = [];
    const s = AppState.strings.menu;

    if (OS.IS_LINUX) {
      trayMenuItems.push({ label: s.showHidePage, click: () => PageService.setupOrTogglePage() });
      trayMenuItems.push({ type: 'separator' });
    }

    const groupBySession = Storage.getSettings<boolean>(Settings.GROUP_PAGES_BY_SESSION);
    const validPages = PageService.getValidPages(true);

    if (groupBySession) {
      const defaultSessionLabel = AppState.strings.preferences.pages.defaultSession;
      const sessionMap = new Map<string, Page[]>();
      validPages.forEach((p) => {
        const session = p.session !== Page.DEFAULT_SESSION ? p.session : defaultSessionLabel;
        if (!sessionMap.has(session)) { sessionMap.set(session, []); }
        sessionMap.get(session)!.push(p);
      });
      sessionMap.forEach((pages, session) => {
        menuItems.push({ label: session, submenu: pages.map(this.createMenuPageItem) });
      });
    } else {
      validPages.forEach((p) => menuItems.push(this.createMenuPageItem(p)));
    }

    menuItems.push({
      id: 'clipboard-url',
      type: 'checkbox',
      checked: PageService.isCurrentPage(AppState.fromClipboardPage),
      label: AppState.fromClipboardPage!.labelWithStatus,
      click: () => this.onClipboardPageClick(),
    });

    menuItems.push({ type: 'separator' });

    const activePages = PageService.getAllActivePages();
    let currentPageSubmenu;

    if (activePages.length > 0) {
      const activePagesMenu: MenuItem = { label: s.activePages, submenu: [] };
      menuItems.push(activePagesMenu);

      // If there is a current page, create its submenu.
      // Void Scenario: The old current page was removed
      if (AppState.currentPage?.hasView) {
        currentPageSubmenu = this.createPageSubmenu(AppState.currentPage);
        activePagesMenu.submenu!.push({
          label: AppState.currentPage.labelWithStatus,
          submenu: currentPageSubmenu,
        });

        activePages.length > 1 && activePagesMenu.submenu!.push({ type: 'separator' });
      }

      if (activePages.length > 1 || !PageService.isCurrentPage(activePages[0])) {
        const otherActivePages = activePages.filter((p) => !PageService.isCurrentPage(p));

        otherActivePages.forEach((p) => {
          activePagesMenu.submenu.push({ label: p.labelWithStatus, submenu: this.createPageSubmenu(p) });
        });

        menuItems.push({
          label: s.closeOtherPages, click: () =>
            otherActivePages.forEach((p) => PageService.closePageView(p)),
        });
      }
    }

    menuItems.push({
      label: s.closeAllPages, enabled: !!activePages.length, click: () => {
        FrameService.getFrame() && FrameService.forceClose(false);
        activePages.forEach((p) => PageService.closePageView(p));
      },
    });

    menuItems.push({ type: 'separator' });

    menuItems.push({ label: s.preferences, click: () => PreferencesService.open() });

    if (currentPageSubmenu) {
      const navbarPrefix = Storage.getSettings<boolean>(Settings.SHOW_FRAME) ? '✓ ' : '';
      AppState.viewContextMenu = [
        { label: s.openAnonymously, click: () => { FrameService.reopenAnonymously(); } },
        { label: navbarPrefix + s.navbar, click: () => { FrameService.toggleNavbar(); } },
        { type: 'separator' },
        { label: s.window, submenu: currentPageSubmenu },
        { label: s.handbook, submenu: menuItems },
      ];

      const quickActions = this.getQuickActions();
      if (quickActions.length > 0) {
        AppState.viewContextMenu.unshift({ label: s.quickActions, submenu: quickActions });
      }
    }

    trayMenuItems.push(...menuItems);
    trayMenuItems.push({ label: s.exit, click: () => app.quit() });

    AppState.navbarContextMenu = menuItems;
    AppState.trayContextMenu = trayMenuItems;

    TrayService.updateLinuxTrayContextMenu();
  }

  public getContextMenu(type: ContextMenuType): MenuItemConstructorOptions[] {
    switch (type) {
      case ContextMenuType.TRAY:
        return AppState.trayContextMenu!;
      case ContextMenuType.VIEW:
        return AppState.viewContextMenu!;
      case ContextMenuType.NAVBAR:
        return AppState.navbarContextMenu!;
    }
  }

  public buildContextMenu(type: ContextMenuType): Menu {
    return Menu.buildFromTemplate(this.getContextMenu(type));
  }

  private getClipboardImage(): string | undefined {
    const image = clipboard.readImage();
    return !image.isEmpty() ? image.toDataURL() : undefined;
  }

  private getClipboardUrl(): string | undefined {
    const cb = clipboard.readText();
    return Page.isValidUrl(cb) ? cb : undefined;
  }

  public shouldEnableClipboardPage(): boolean {
    return PageService.isCurrentPage(AppState.fromClipboardPage) ||
      !!this.getClipboardUrl() ||
      !!this.getClipboardImage();
  }

  public onClipboardPageClick() {
    const url = this.getClipboardImage() ?? this.getClipboardUrl();

    const page = AppState.fromClipboardPage;
    const wasChanged = PageService.changeUrl(page, url);

    if (page.hasView && wasChanged) {
      FrameService.isVisible(true) || FrameService.toggleVisibility();
    } else if (page.url) {
      PageService.selectPage(page);
    }
  }

  private createPageSubmenu(page: Page): MenuItemConstructorOptions[] {
    const view = page.view!;
    const wc = view.webContents;
    const s = AppState.strings.menu;

    return PageService.isCurrentPage(page) && FrameService.getFrame() ?
      [
        { label: FrameService.isVisible(true) ? s.hide : s.show, click: () => FrameService.toggleVisibility() },
        { label: ViewService.isMuted(view) ? s.unmute : s.mute, click: () => ViewService.toggleMute(view) },
        { label: s.close, click: () => { FrameService.forceClose(); } },
        { type: 'separator' },
        { label: s.find, click: () => ViewService.toggleFindbar(view, true), visible: FrameService.isVisible(true) },
        { label: s.back, click: () => ViewService.goBack(view) },
        { label: s.forward, click: () => ViewService.goForward(view) },
        { type: 'separator' },
        { label: s.refresh, click: () => ViewService.reload(view) },
        { label: s.home, click: () => PageService.resetUrl(page) },
        { type: 'separator' },
        { label: s.resetWindow, click: () => { FrameService.recreateWindow(); } },
        { label: s.resetBounds, click: () => { FrameService.resetBounds(); } },
        { type: 'separator' },
        { label: s.copyUrl, click: () => clipboard.writeText(wc.getURL()) },
        { label: s.openInBrowser, click: () => { shell.openExternal(wc.getURL()); } },
        { label: s.createPageFromUrl, click: () => { PageService.createNewPageFromCurrentUrl(); } },
        { label: s.printToPdf, click: () => { ViewService.printToPdf(); } },
        { type: 'separator' },
        { label: s.openDevTools, click: () => wc.openDevTools() },
        { label: s.permissions, click: () => PreferencesService.openPermissions(wc.getURL()) },
      ] :
      [
        { label: s.show, click: () => PageService.selectPage(page) },
        { label: ViewService.isMuted(view) ? s.unmute : s.mute, click: () => ViewService.toggleMute(view) },
        { label: s.close, click: () => PageService.closePageView(page) },
        { type: 'separator' },
        { label: s.permissions, click: () => PreferencesService.openPermissions(wc.getURL()) },
      ];
  }

  private createMenuPageItem(page: Page): MenuItemConstructorOptions {
    return {
      type: 'checkbox',
      checked: PageService.isCurrentPage(page),
      label: page.labelWithStatus,
      click: () => PageService.selectPage(page),
    };
  }

  public toggleQuickMenu(): void {
    if (this.quickMenu.isOpen()) {
      this.quickMenu.close();
    } else {
      const frame = FrameService.getFrame();
      this.quickMenu.open({
        items: this.getQuickMenuItems(),
        strings: AppState.strings.quickMenu,
      }, frame);
    }
  }

  private registerQuickMenuEventListeners(): void {
    this.quickMenu.on('select', (item: QuickMenuItem) => {
      this.quickMenu.close();
      if (item.isPreferences) {
        PreferencesService.open();
      } else {
        const targetPage = PageService.getAllPages().find((p) => p.id === item.id);
        if (targetPage === AppState.fromClipboardPage) {
          this.onClipboardPageClick();
          return;
        }
        if (targetPage === PageService.getCurrentPage()) { return; }
        PageService.selectPage(targetPage);
      }
    });

    this.quickMenu.on('filter', (query: string) => {
      const allItems = this.getQuickMenuItems();
      let filtered: QuickMenuItem[];

      if (!query || !query.trim()) {
        filtered = allItems;
      } else {
        query = query.trim();
        const parsedQuery = query[0] === '"' || query.includes(':') ? query : query.split(' ').join(' and ');
        filtered = SearchEngine.search(allItems, parsedQuery);
      }

      this.quickMenu.sendFilterResults(filtered);
    });
  }

  private getQuickMenuItems(): QuickMenuItem[] {
    const items: QuickMenuItem[] = PageService.getValidPages(true)
      .map((p: Page) => ({ id: p.id, label: p.labelWithStatus, url: p.url, session: p.session }));

    if (this.shouldEnableClipboardPage()) {
      const p = AppState.fromClipboardPage;
      items.push({ id: p.id!, label: p.labelWithStatus, url: p.url, session: p.session });
    }

    items.push({
      label: AppState.strings.menu.preferences,
      url: '',
      isPreferences: true,
    });

    return items;
  }

  private getQuickActions(): MenuItemConstructorOptions[] {
    const items = Storage.getQuickActions();
    return items
      .filter((item) => item.label && item.url)
      .map((item) => ({
        label: item.label,
        click: () => ViewService.openQuickAction(item.url),
      }));
  }
}

export enum ContextMenuType {
  TRAY = 'tray',
  VIEW = 'view',
  NAVBAR = 'navbar',
}

export default new MenuService();
