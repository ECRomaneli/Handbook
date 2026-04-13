import AppState from '@/AppState';
import { Settings } from '@/data/Constants';
import Storage from '@/data/Storage';
import AutoUpdaterService from '@/service/AutoUpdaterService';
import FrameService from '@/service/FrameService';
import MenuService from '@/service/MenuService';
import NavbarService from '@/service/NavbarService';
import PageService from '@/service/PageService';
import PermissionService from '@/service/PermissionService';
import PreferencesService from '@/service/PreferencesService';
import SyncService from '@/service/SyncService';
import TrayService from '@/service/TrayService';
import ViewService from '@/service/ViewService';
import { parseToAccelerator } from '@/util/EventKeyCapture';
import Dialog, { DialogOptions } from '@/util/modal/Dialog';
import { app, BrowserWindow, globalShortcut, Menu, MenuItemConstructorOptions, Rectangle, Session, session, WebContentsView } from 'electron';
import Findbar from 'electron-findbar';

class ApplicationService {
  private static readonly ACCEPT_LANGUAGE_HEADER = 'Accept-Language';

  public initialize() {
    this.setupExitDialog();
    this.setupAutoLaunch();
    this.registerGlobalShortcut();
    this.setupAccelerators();
    this.forceLanguageHeader();
    this.defineFindbarDefaultPosition();
    PermissionService.denyPermissionsOnSession(session.defaultSession);
    PermissionService.setupPermissionsHandler({
      getSessionByWebContents: (wc) => PageService.getPageByWebContents(wc)?.session,
      getWindow: () => FrameService.getFrame(),
    });
    AppState.themeSource = Storage.getSettings(Settings.APP_THEME);
    AppState.googleApiKey = Storage.getSettings(Settings.GOOGLE_API_KEY);
    AutoUpdaterService.initialize();
    SyncService.initialize();
    TrayService.initialize();
  }

  private defineFindbarDefaultPosition() {
    Findbar.setDefaultBoundsHandler((parentBounds, findbarBounds) => {
      const x = parentBounds.x + (parentBounds.width - findbarBounds.width) - 25;
      const y = parentBounds.y + 25;
      return { x, y } as Rectangle;
    });
  }

  public registerGlobalShortcut() {
    if (AppState.globalShortcut) { globalShortcut.unregister(AppState.globalShortcut); }

    AppState.globalShortcut = Storage.getSettings(Settings.GLOBAL_SHORTCUT);
    if (!AppState.globalShortcut) { return; }

    try {
      const ok = globalShortcut.register(AppState.globalShortcut, () => { PageService.setupOrTogglePage(); });
      if (!ok) { throw new Error('Not registered'); }
    } catch (e) {
      console.error('Failed to create the shortcut: ', e);

      const s = AppState.strings.application;
      Dialog.confirm(null, {
        title: s.shortcutFailed,
        message: `${s.shortcutFailed}: [${AppState.globalShortcut}]`,
      }).then((confirmed) => {
        if (confirmed) {
          PreferencesService.applySettingsUpdate(Settings.GLOBAL_SHORTCUT, '');
          AppState.globalShortcut = '';
        }
      });
    }
  }

  public async setupAutoLaunch(): Promise<void> {
    const s = AppState.strings.application;
    try {
      const isEnabled = await AppState.autoLauncher.isEnabled();
      let autoLaunchEnabled = Storage.getSettings(Settings.AUTO_LAUNCH);

      if (!isEnabled && autoLaunchEnabled === undefined) {
        autoLaunchEnabled = await Dialog.confirm(PreferencesService.getWindow() ?? null, {
          title: s.autoLaunchTitle,
          message: s.autoLaunchMsg,
          defaultId: 0,
        });
        PreferencesService.applySettingsUpdate(Settings.AUTO_LAUNCH, autoLaunchEnabled);
      }

      if (autoLaunchEnabled && !isEnabled) {
        await AppState.autoLauncher.enable();
      } else if (!autoLaunchEnabled && isEnabled) {
        await AppState.autoLauncher.disable();
      }
    } catch (err) {
      console.error('Error setting up auto launch:', err);

      const confirmed = await Dialog.confirm(PreferencesService.getWindow() ?? null, {
        title: s.autoLaunchFailed,
        message: s.autoLaunchFailedMsg,
        defaultId: 0,
      });

      if (confirmed) {
        PreferencesService.applySettingsUpdate(Settings.AUTO_LAUNCH, false);
        await AppState.autoLauncher.disable();
      }
    }
  }

  public disableExitDialog() {
    app.removeAllListeners('before-quit');
  }

  private setupExitDialog() {
    let quitting = false;
    app.on('before-quit', (e) => {
      if (quitting) { return; }
      e.preventDefault();
      const d = AppState.strings.exitDialog;
      return this.showConfirmationDialog({
        title: d.title,
        message: d.message,
        confirmBtn: d.confirm,
        cancelBtn: AppState.strings.dialog.cancel,
        parent: null,
        confirmAction: () => { quitting = true; app.quit(); },
      });
    });
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
    const d = AppState.strings.dialog;
    const result = await Dialog.show(
      data.parent ?? null,
      {
        type: data.type || 'question',
        title: data.title || d.confirmation,
        message: data.message || d.areYouSure,
        buttons: [data.confirmBtn ?? d.ok, data.cancelBtn ?? d.cancel],
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

  private setupAccelerators() {
    AppState.defaultAppMenu = (Menu.getApplicationMenu()?.items || []);
    this.buildApplicationMenu();
  }

  private buildApplicationMenu() {
    const ifVisible = (viewAction: (view: WebContentsView) => void) => () => {
      const view = ViewService.getCurrentView();
      if (!view) { return; }
      const frame = FrameService.getFrame();
      frame?.isVisible() && (FrameService.isFocused() || ViewService.isFindbarFocused()) && viewAction(view);
    };

    const m = AppState.strings.menu;
    const quickMenuAcc = parseToAccelerator(Storage.getSettings<string>(Settings.QUICK_MENU_SHORTCUT));

    const pageMenu: MenuItemConstructorOptions = {
      label: m.page, submenu: [
        /* eslint-disable @stylistic/max-len */
        { label: m.find, click: ifVisible((view) => ViewService.toggleFindbar(view, true)), accelerator: 'CommandOrControl+F' },
        { label: m.dismiss, visible: false, click: ifVisible((view) => { ViewService.toggleFindbar(view, false); view.webContents.focus(); }), accelerator: 'Esc' },
        { label: m.back, click: ifVisible(() => ViewService.goBack()), accelerator: 'CommandOrControl+Left' },
        { label: m.forward, click: ifVisible(() => ViewService.goForward()), accelerator: 'CommandOrControl+Right' },
        { label: m.refresh, click: ifVisible(() => ViewService.reload()), accelerator: 'CommandOrControl+R' },
        { label: m.openDevTools, click: ifVisible((view) => view.webContents.openDevTools({ mode: 'detach' })), accelerator: 'CommandOrControl+Shift+I' },
        { label: m.navbarOpenDevTools, click: () => NavbarService.getView()?.webContents.openDevTools({ mode: 'detach' }), accelerator: 'CommandOrControl+Shift+P' },
        /* eslint-enable @stylistic/max-len */
      ],
    };

    if (quickMenuAcc) {
      (pageMenu.submenu! as MenuItemConstructorOptions[]).push(
        { label: m.quickMenu, click: ifVisible(() => MenuService.toggleQuickMenu()), accelerator: quickMenuAcc },
      );
    }

    Menu.setApplicationMenu(Menu.buildFromTemplate([...AppState.defaultAppMenu, pageMenu]));
  }

  public updateQuickMenuAccelerator() {
    this.buildApplicationMenu();
  }

  public forceLanguageHeader(): void {
    let preferredLanguage = Storage.getSettings(Settings.PREFERRED_LANGUAGE) as string | undefined;
    if (preferredLanguage === 'app') {
      preferredLanguage = Storage.getSettings(Settings.APP_LANGUAGE) as string || undefined;
    }
    const hasPreferredLanguage = preferredLanguage && preferredLanguage.trim() !== '';

    app.prependListener('session-created', (s: Session) => {
      hasPreferredLanguage && this.overrideAcceptLanguage(s, preferredLanguage!);
    });
  }

  private overrideAcceptLanguage(s: Session, preferredLanguage: string): void {
    // Build Accept-Language header with the preferred language + English fallback
    const acceptLanguage = `${preferredLanguage},en;q=0.5`;

    s.webRequest.onBeforeSendHeaders((details, callback) => {
      details.requestHeaders[ApplicationService.ACCEPT_LANGUAGE_HEADER] = acceptLanguage;
      callback({ requestHeaders: details.requestHeaders });
    });
  }
}

export default new ApplicationService();
