import AppState from '@/AppState';
import { OS, Path, Permission, Positions, Settings } from '@/data/Constants';
import Storage from '@/data/Storage';
import { Page, PlainPage } from '@/model/Page';
import PreferencesPropagator from '@/propagator/PreferencesPropagator';
import ApplicationService from '@/service/ApplicationService';
import FrameService from '@/service/FrameService';
import PageService from '@/service/PageService';
import TrayService from '@/service/TrayService';
import ViewService from '@/service/ViewService';
import DialogUtil from '@/util/DialogUtil';
import Dialog from '@/util/modal/Dialog';
import { registerDraggableArea } from '@/util/PropagatorUtil';
import { BrowserWindow, HandlerDetails, IpcMainEvent, IpcMainInvokeEvent, WebContents, app, shell } from 'electron';
import contextMenu from 'electron-context-menu';
import path from 'node:path';

/** Listener type for pages updated event */
type PagesUpdatedListener = (event: IpcMainEvent, pages: Record<string, unknown>[]) => void;

/** Listener type for settings updated event */
type SettingsUpdatedListener = (event: IpcMainEvent, id: string, value: unknown) => void;

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
    this.onSettingsUpdated((_e, id, value) => this.updateSettings(id, value));
  }

  public open(): void {
    if (AppState.preferences) { return; }

    const win = new BrowserWindow({
      icon: undefined,
      title: 'Preferences',
      width: 700,
      height: 640,
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

    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    this.buildContextMenu();
    win.webContents.setWindowOpenHandler(PreferencesService.openExternal);
    win.loadFile(path.join(Path.WEB, 'preferences', 'index.html'));
    // on ready, win.show() is called
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
    registerDraggableArea(PreferencesPropagator, () => this.getWindow()!);

    // Handle UI [x] button
    PreferencesPropagator.onRender('close', (): void => this.close());

    PreferencesPropagator.handleRender('confirm',
      async (event: IpcMainInvokeEvent, message: string): Promise<boolean> => {
        if (!this.isPreferences(event.sender)) { return false; }
        return await this.dialog.confirm(AppState.preferences!, { message });
      });

    PreferencesPropagator.handleRender('constants', (event: IpcMainInvokeEvent): unknown => {
      if (!this.isPreferences(event.sender)) { return null; }
      return { OS, Settings, Positions, Permission };
    });

    // IPC handlers
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

    PreferencesPropagator.onRender('pages-updated', (_, pages: Page[]): void => {
      Storage.setPages(pages);
    });

    PreferencesPropagator.onRender('settings-updated', (_, id: string, value: unknown): void => {
      Storage.setSettings(id, value);
    });

    PreferencesPropagator.onRender('permissions-updated',
      (_, sessionName: string, url: string, permission: string, value: string): void => {
        Storage.setPermission(sessionName, url, permission, value);
      });

    PreferencesPropagator.onRender('permissions-revoke',
      (_, sessionName: string, url: string, permission: string): void => {
        Storage.revokePermissions(sessionName, url, permission);
      });
  }

  private buildContextMenu(): void {
    const win = AppState.preferences;
    if (!win) { return; }
    contextMenu({
      window: win,
      append: () => [
        { role: 'toggleDevTools' },
        { role: 'close' },
      ],
    });
  }

  public onPagesUpdated(listener: PagesUpdatedListener): void {
    PreferencesPropagator.onRender('pages-updated', listener);
  }

  public onSettingsUpdated(listener: SettingsUpdatedListener): void {
    PreferencesPropagator.onRender('settings-updated', listener);
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
      await DialogUtil.showConfirmationDialog({
        title, message, confirmBtn: 'Yes', cancelBtn: 'No', parent: this.getWindow(), confirmAction,
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
    switch (id) {
      case Settings.SHOW_FRAME:
        if (!PageService.hasAnyActivePage()) { return; }
        this.beforeCloseConfirm(
          'recreate-all-windows',
          'Recreate all windows?',
          'Only new windows will receive the new configuration. Do you want to recreate all windows now?',
          () => FrameService.recreateAllWindows(),
        );
        break;
      case Settings.ALLOW_FULLSCREEN:
        FrameService.recreateFrame();
        break;
      case Settings.FOCUS_OPACITY:
      case Settings.BLUR_OPACITY:
      case Settings.KEEP_OPACITY_WHEN_MAXIMIZED: {
        const view = PageService.getCurrentView();
        view && FrameService.isVisible() && view.emit('blur');
        break;
      }
      case Settings.ACTION_AREA:
      case Settings.HIDE_SHORTCUT:
        ViewService.updateActiveViewSettings(id, value);
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
          'Restart app?',
          'A complete restart is required for the Google API key to take effect. Restart now?',
          () => { app.relaunch(); app.exit(0); },
        );
        break;
      case Settings.AUTO_LAUNCH:
        ApplicationService.setupAutoLaunch();
        break;
    }
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
