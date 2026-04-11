import AppState from '@/AppState';
import { OS, Path, Permission, Positions, Settings } from '@/data/Constants';
import Storage from '@/data/Storage';
import { Page, PlainPage } from '@/model/Page';
import PreferencesPropagator from '@/propagator/PreferencesPropagator';
import ApplicationService from '@/service/ApplicationService';
import FrameService from '@/service/FrameService';
import MenuService from '@/service/MenuService';
import PageService from '@/service/PageService';
import TrayService from '@/service/TrayService';
import DialogUtil from '@/util/DialogUtil';
import { getOSKeyCombinationByEvent, parseToAccelerator, parseToOSKeyCombination } from '@/util/EventKeyCapture';
import Dialog from '@/util/modal/Dialog';
import { BrowserWindow, HandlerDetails, Input, IpcMainInvokeEvent, WebContents, app, shell } from 'electron';
import contextMenu from 'electron-context-menu';
import { Draggable } from 'electron-draggable';
import path from 'node:path';

class PreferencesService {
  private readonly dialog: Dialog = new Dialog();
  private readonly scheduledModals: string[] = [];

  constructor() {
    this.registerRenderListeners();
    this.registerStateListeners();
  }

  private registerStateListeners(): void {
    PreferencesPropagator.onRender('ready', () => { this.getWindow()!.show(); });
    PreferencesPropagator.on('closed', () => { AppState.preferences = undefined; });
  }

  public open(): void {
    if (AppState.preferences) { return; }

    const win = new BrowserWindow({
      icon: undefined,
      title: AppState.strings.preferences.title,
      width: 620,
      height: 620,
      show: false,
      frame: false,
      alwaysOnTop: true,
      transparent: OS.IS_LINUX,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
      },
    });

    AppState.preferences = win;
    const fps = Storage.getSettings(Settings.DRAG_REFRESH_RATE) as number || null;
    Draggable.from(win, { region: { height: 86 }, exclude: '.exit-btn, li', fps });

    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    this.buildContextMenu();
    win.webContents.setWindowOpenHandler(PreferencesService.openExternal);
    win.loadFile(path.join(Path.WEB, 'preferences', 'index.html'));
    // on ready, win.show() is called
  }

  public reload(): void {
    AppState.preferences!.webContents.reload();
  }

  public queryPermissions(query: string): void {
    PreferencesPropagator.sendToRender('permissions-query', query);
  }

  public permissionsUpdated(): void {
    PreferencesPropagator.sendToRender('permissions-updated', Storage.getPermissions());
  }

  public applySettingsUpdate(id: string, value: unknown): void {
    Storage.setSettings(id, value);
    PreferencesPropagator.sendToRender('settings-updated', id, value);
  }

  public isOpen(): boolean {
    const win = AppState.preferences;
    return win !== undefined && !win.isDestroyed() && win.isVisible();
  }

  public close(): void {
    const win = AppState.preferences;
    win && !win.isDestroyed() && win.close();
  }

  public getWindow(): BrowserWindow | undefined {
    return AppState.preferences;
  }

  public openAndExecute(listener: () => void): void {
    if (this.isOpen()) { return listener(); }
    PreferencesPropagator.onceRender('ready', listener);
    this.open();
  }

  /**
   * Register listeners for the renderer process.
   * Bugfix: Use setBounds instead of setPosition to avoid resizing when moving from one screen to another on Windows.
   */
  private registerRenderListeners(): void {
    // Handle UI [x] button
    PreferencesPropagator.onRender('close', (): void => this.close());

    PreferencesPropagator.onRender('pages-updated', (_, pages: Page[]): void => {
      Storage.setPages(pages);
      this.sendPagesUpdated();
      MenuService.updatePagesAndRefresh();
    });

    PreferencesPropagator.onRender('settings-updated', (_, id: string, value: unknown): void => {
      Storage.setSettings(id, value);
      this.updateSettings(id, value);
    });

    PreferencesPropagator.onRender('permissions-updated',
      (_, sessionName: string, url: string, permission: string, value: string): void => {
        Storage.setPermission(sessionName, url, permission, value);
      });

    PreferencesPropagator.onRender('permissions-revoke',
      (_, sessionName: string, url: string, permission: string): void => {
        Storage.revokePermissions(sessionName, url, permission);
      });

    PreferencesPropagator.handleRender('i18n', () => ({
      preferences: AppState.strings.preferences,
      permission: AppState.strings.permission,
    }));

    PreferencesPropagator.handleRender('confirm',
      async (event: IpcMainInvokeEvent, message: string): Promise<boolean> => {
        if (!this.isPreferences(event.sender)) { return false; }
        return await this.dialog.confirm(AppState.preferences!, { message });
      });

    PreferencesPropagator.handleRender('constants', (event: IpcMainInvokeEvent): unknown => {
      if (!this.isPreferences(event.sender)) { return null; }
      return { OS, Settings, Positions, Permission };
    });

    PreferencesPropagator.handleRender('get-pages', (): PlainPage[] => Storage.getPages());

    PreferencesPropagator.handleRender('get-settings', (_e: IpcMainInvokeEvent, id: string): unknown =>
      Storage.getSettings(id),
    );

    PreferencesPropagator.handleRender('get-permissions',
      (
        _e: IpcMainInvokeEvent,
        sessionName?: string,
        url?: string,
        permission?: string,
      ): Record<string, unknown> => Storage.getPermissions(sessionName, url, permission) as Record<string, unknown>,
    );

    /* eslint-disable @stylistic/max-len */
    PreferencesPropagator.handleRender('parse-to-os-key-combination', (_e, acc: string): string => parseToOSKeyCombination(acc));
    PreferencesPropagator.handleRender('parse-to-accelerator', (_e, parsedValue: string): string => parseToAccelerator(parsedValue));
    PreferencesPropagator.handleRender('get-os-key-combination-by-event', (_e, input: Input): string => getOSKeyCombinationByEvent(input));
    /* eslint-enable @stylistic/max-len */
  }

  private buildContextMenu(): void {
    const win = AppState.preferences;
    if (!win) { return; }
    const s = AppState.strings.menu;
    contextMenu({
      window: win,
      append: () => [
        { label: s.openDevTools, click: () => win.webContents.openDevTools() },
        { label: s.close, click: () => win.close() },
      ],
    });
  }

  public sendPagesUpdated(): void {
    PreferencesPropagator.sendToRender('pages-updated', Storage.getPages());
  }

  public isPreferences(senderWebContents: WebContents): boolean {
    const webContents = AppState.preferences?.webContents;
    if (webContents === undefined) {
      console.error('Preferences window is not open');
      return false;
    }

    if (senderWebContents !== webContents) {
      console.error('Sender is not the preferences window');
      return false;
    }

    return true;
  }

  public openPermissions(rawUrl: string): void {
    const url = new URL(rawUrl);
    const query = 'url: ' + (url.protocol === 'file:' ? url.pathname : url.origin);
    this.openAndExecute(() => {
      this.queryPermissions(query);
    });
  }

  public beforeCloseConfirm(
    id: string, title: string, message: string, confirmAction: () => void, onFinally?: () => void) {

    if (this.scheduledModals.includes(id)) { return; }
    this.scheduledModals.push(id);
    this.getWindow()!.prependOnceListener('close', async (e) => {
      e.preventDefault();
      const d = AppState.strings.dialog;
      await DialogUtil.showConfirmationDialog({
        title, message, confirmBtn: d.yes, cancelBtn: d.no, parent: this.getWindow(), confirmAction,
      });

      this.scheduledModals.splice(this.scheduledModals.indexOf(id), 1);
      onFinally && onFinally();
      if (this.scheduledModals.length === 0) { this.close(); }
    });
  }

  /**
   * Listen for settings updates and took actions based on their IDs.
   *  @param id Settings ID
   * @param value Settings value
   */
  private updateSettings(id: string, value: unknown): void {
    const s = AppState.strings.preferences;
    switch (id) {
      case Settings.AUTO_LAUNCH:
        ApplicationService.setupAutoLaunch();
        break;
      case Settings.SHOW_FRAME:
      case Settings.ALLOW_FULLSCREEN:
        FrameService.getFrame() && FrameService.recreateFrame();
        break;
      case Settings.FOCUS_OPACITY:
      case Settings.BLUR_OPACITY:
      case Settings.KEEP_OPACITY_WHEN_MAXIMIZED: {
        FrameService.emitBlurIfVisible();
        break;
      }
      case Settings.ACTION_AREA:
        FrameService.updateActionArea();
        break;
      case Settings.DRAG_REFRESH_RATE:
        FrameService.updateFpsForDrag();
        Draggable.from(this.getWindow()!).updateOptions({ fps: value as number || null });
        break;
      case Settings.GLOBAL_SHORTCUT:
        ApplicationService.registerGlobalShortcut();
        break;
      case Settings.APP_THEME:
        AppState.themeSource = value as 'light' | 'dark' | 'system';
        TrayService.updateTrayIcon();
        break;
      case Settings.TRAY_ICON_THEME:
        TrayService.updateTrayIcon();
        break;
      case Settings.GOOGLE_API_KEY:
        AppState.googleApiKey = value as string;
        this.beforeCloseConfirm(
          'restart-application',
          s.restartApp,
          s.restartForApiKey,
          () => { app.relaunch(); app.exit(0); },
        );
        break;
      case Settings.APP_LANGUAGE:
        AppState.refreshStrings();
        MenuService.refreshContextMenu();
        FrameService.getFrame() && FrameService.recreateFrame();
        this.reload();
        break;
      case Settings.PREFERRED_LANGUAGE:
        this.beforeCloseConfirm(
          'restart-application',
          s.restartApp,
          s.restartForLanguage,
          () => { app.relaunch(); app.exit(0); },
        );
        break;
      case Settings.GROUP_PAGES_BY_SESSION:
        MenuService.refreshContextMenu();
        break;
      case Settings.CLIPBOARD_URL_SESSION:
        PageService.updateClipboardUrlSession(value as string);
        break;
      case Settings.QUICK_MENU_SHORTCUT:
        ApplicationService.updateQuickMenuAccelerator();
        break;
    }
    setImmediate(() => { this.getWindow()?.focus(); });
  }

  /**
   * Open external links in the system's default browser.
   * This is used to handle links that are opened from the preferences window.
   */
  private static openExternal(details: HandlerDetails): { action: 'deny' } {
    shell.openExternal(details.url);
    return { action: 'deny' };
  }
}

export default new PreferencesService();
