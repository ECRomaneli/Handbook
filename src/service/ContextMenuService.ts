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
import Dialog, { DialogOptions } from '@/util/modal/Dialog';
import { app, BrowserWindow, clipboard, Menu, MenuItemConstructorOptions, shell } from 'electron';

type MenuItem = MenuItemConstructorOptions & { submenu: MenuItemConstructorOptions[] };

class ContextMenuService {
  constructor() {
    this.registerStateListeners();
  }

  private registerStateListeners(): void {
    StatePropagator.onChange(() => { this.refreshContextMenu(); }, true);
  }

  public refreshContextMenu(): void {
    const menuItems: MenuItemConstructorOptions[] = [];
    const windowMenuItems: MenuItemConstructorOptions[] = [];

    if (OS.IS_LINUX) {
      menuItems.push({ label: 'Show / Hide Page', click: () => PageService.setupOrTogglePage() });
      menuItems.push({ type: 'separator' });
    }

    const groupBySession = Storage.getSettings<boolean>(Settings.GROUP_PAGES_BY_SESSION);
    const validPages = PageService.getValidPages();

    if (groupBySession) {
      const sessionMap = new Map<string, Page[]>();
      validPages.forEach((p) => {
        const session = p.session || Page.DEFAULT_SESSION;
        if (!sessionMap.has(session)) { sessionMap.set(session, []); }
        sessionMap.get(session)!.push(p);
      });

      sessionMap.forEach((pages, session) => {
        windowMenuItems.push({ label: session, submenu: pages.map(this.createMenuPageItem) });
      });
    } else {
      validPages.forEach((p) => windowMenuItems.push(this.createMenuPageItem(p)));
    }

    windowMenuItems.push({
      id: 'clipboard-url',
      type: 'radio',
      checked: PageService.isCurrentPage(AppState.fromClipboardPage),
      label: AppState.fromClipboardPage!.labelWithStatus,
      click: () => {
        const url = this.getClipboardImage() ?? this.getClipboardUrl();

        const page = AppState.fromClipboardPage;
        const wasChanged = PageService.changeUrl(page, url);

        if (page.hasView && wasChanged) {
          FrameService.isVisible(true) || FrameService.toggleVisibility();
        } else if (page.url) {
          PageService.selectPage(page);
        }
      },
    });

    windowMenuItems.push({ type: 'separator' });

    const activePages = PageService.getAllActivePages();
    let currentPageSubmenu;

    if (activePages.length > 0) {
      const activePagesMenu: MenuItem = { label: 'Active Pages', submenu: [] };
      windowMenuItems.push(activePagesMenu);

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

        windowMenuItems.push({
          label: 'Close Other Pages', click: () =>
            otherActivePages.forEach((p) => PageService.closePageView(p)),
        });
      }
    }

    windowMenuItems.push({
      label: 'Close All Pages', enabled: !!activePages.length, click: () => {
        FrameService.forceClose();
        activePages.forEach((p) => PageService.closePageView(p));
      },
    });

    windowMenuItems.push({ type: 'separator' });

    windowMenuItems.push({ label: 'Preferences...', click: () => PreferencesService.open() });

    menuItems.push(...windowMenuItems);
    menuItems.push({
      label: 'Exit', click: () => {
        this.showConfirmationDialog({
          title: 'Exit',
          message: 'Are you sure you want to exit Handbook?',
          confirmBtn: 'Confirm',
          cancelBtn: 'Cancel',
          parent: null,
          confirmAction: () => app.quit(),
        });
      },
    });

    if (currentPageSubmenu) {
      AppState.viewContextMenu = [
        { label: 'Window', submenu: currentPageSubmenu },
        { label: 'Handbook', submenu: windowMenuItems },
      ];
    }

    AppState.navbarContextMenu = windowMenuItems;
    AppState.trayContextMenu = menuItems;

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
    return !image.isEmpty() ? image.toDataURL() : void 0;
  }

  private getClipboardUrl(): string | undefined {
    const cb = clipboard.readText();
    return Page.isValidUrl(cb) ? cb : void 0;
  }

  public shouldEnableClipboardPage(): boolean {
    return PageService.isCurrentPage(AppState.fromClipboardPage) ||
      !!this.getClipboardUrl() ||
      !!this.getClipboardImage();
  }

  private async showConfirmationDialog(
    data: DialogOptions & {
      parent: BrowserWindow | null,
      confirmBtn?: string,
      cancelBtn?: string,
      confirmAction?: () => void,
      cancelAction?: () => void,
    },
  ): Promise<void> {
    const result = await Dialog.show(
      data.parent ?? null,
      {
        type: data.type || 'question',
        title: data.title || 'Confirmation',
        message: data.message || 'Are you sure?',
        buttons: [data.confirmBtn ?? 'Ok', data.cancelBtn ?? 'Cancel'],
        defaultId: 1,
        cancelId: 1,
      },
    );

    setTimeout(() => {
      if (result.response === 0) {
        data.confirmAction && data.confirmAction();
      } else {
        data.cancelAction && data.cancelAction();
      }
    });
  }

  private createPageSubmenu(page: Page): MenuItemConstructorOptions[] {
    const view = page.view!;
    const wc = view.webContents;

    return PageService.isCurrentPage(page) ?
      [
        { label: FrameService.isVisible(true) ? 'Hide' : 'Show', click: () => FrameService.toggleVisibility() },
        { label: ViewService.isMuted(view) ? 'Unmute' : 'Mute', click: () => ViewService.toggleMute(view) },
        { label: 'Close', click: () => { FrameService.forceClose(); } },
        { type: 'separator' },
        { label: 'Find...', click: () => ViewService.toggleFindbar(view, true), visible: FrameService.isVisible(true) },
        { label: 'Back', click: () => ViewService.goBack(view) },
        { label: 'Forward', click: () => ViewService.goForward(view) },
        { type: 'separator' },
        { label: 'Refresh', click: () => ViewService.reload(view) },
        { label: 'Home', click: () => PageService.resetUrl(page) },
        { type: 'separator' },
        { label: 'Reset Window', click: () => { FrameService.recreateWindow(); } },
        { label: 'Reset Bounds', click: () => { FrameService.resetBounds(); } },
        { type: 'separator' },
        { label: 'Copy URL', click: () => clipboard.writeText(wc.getURL()) },
        { label: 'Open in Browser', click: () => { shell.openExternal(wc.getURL()); } },
        { label: 'Create Page from URL', click: () => { PageService.createNewPageFromCurrentUrl(); } },
        { type: 'separator' },
        { label: 'Open DevTools', click: () => wc.openDevTools() },
        { label: 'Permissions', click: () => PreferencesService.openPermissions(wc.getURL()) },
      ] :
      [
        { label: 'Show', click: () => PageService.selectPage(page) },
        { label: ViewService.isMuted(view) ? 'Unmute' : 'Mute', click: () => ViewService.toggleMute(view) },
        { label: 'Close', click: () => PageService.closePageView(page) },
        { type: 'separator' },
        { label: 'Permissions', click: () => PreferencesService.openPermissions(wc.getURL()) },
      ];
  }

  private createMenuPageItem(page: Page): MenuItemConstructorOptions {
    return {
      type: 'radio',
      checked: PageService.isCurrentPage(page),
      label: page.labelWithStatus,
      click: () => PageService.selectPage(page),
    };
  }
}

export enum ContextMenuType {
  TRAY = 'tray',
  VIEW = 'view',
  NAVBAR = 'navbar',
}

export default new ContextMenuService();
