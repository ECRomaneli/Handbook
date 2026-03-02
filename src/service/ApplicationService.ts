import AppState from '@/AppState';
import { Settings } from '@/data/Constants';
import Storage from '@/data/Storage';
import AutoUpdaterService from '@/service/AutoUpdaterService';
import FrameService from '@/service/FrameService';
import PageService from '@/service/PageService';
import PermissionService from '@/service/PermissionService';
import PreferencesService from '@/service/PreferencesService';
import TrayService from '@/service/TrayService';
import ViewService from '@/service/ViewService';
import Dialog from '@/util/modal/Dialog';
import { globalShortcut, Menu, MenuItem, session, WebContentsView } from 'electron';

class ApplicationService {
  public initialize() {
    this.setupAutoLaunch();
    this.registerGlobalShortcut();
    this.setupAccelerators();
    PermissionService.denyPermissionsOnSession(session.defaultSession);
    PermissionService.setupPermissionsHandler();
    AppState.themeSource = Storage.getSettings(Settings.APP_THEME);
    AppState.googleApiKey = Storage.getSettings(Settings.GOOGLE_API_KEY);
    TrayService.initialize();
    AutoUpdaterService.initialize();
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

      Dialog.confirm(null, {
        title: 'Failed to create the shortcut',
        message: `Failed to register [${AppState.globalShortcut}] as a global shortcut. Remove the shortcut?`,
      }).then((confirmed) => {
        if (confirmed) {
          PreferencesService.applySettingsUpdate(Settings.GLOBAL_SHORTCUT, '');
          AppState.globalShortcut = '';
        }
      });
    }
  }

  public async setupAutoLaunch(): Promise<void> {
    try {
      const isEnabled = await AppState.autoLauncher.isEnabled();
      let autoLaunchEnabled = Storage.getSettings(Settings.AUTO_LAUNCH);

      if (!isEnabled && autoLaunchEnabled === void 0) {
        autoLaunchEnabled = await Dialog.confirm(PreferencesService.getWindow() ?? null, {
          title: 'Launch on Startup',
          message: 'Do you want Handbook to launch automatically on startup?',
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
        title: 'Failed to set Auto Launch',
        message: 'Unfortunately, Handbook could not be set to launch automatically on startup. ' +
          'Do you want to disable it?',
        defaultId: 0,
      });

      if (confirmed) {
        PreferencesService.applySettingsUpdate(Settings.AUTO_LAUNCH, false);
        await AppState.autoLauncher.disable();
      }
    }
  }

  private setupAccelerators() {
    const ifVisible = (viewAction: (view: WebContentsView) => void) => () => {
      const view = ViewService.getCurrentView();
      if (!view) { return; }
      const frame = FrameService.getFrame();
      frame?.isVisible() && (FrameService.isFocused() || ViewService.isFindbarFocused()) && viewAction(view);
    };

    const pageMenu = new MenuItem({
      label: 'Page', submenu: [
        /* eslint-disable @stylistic/max-len */
        { label: 'Find...', click: ifVisible((view) => ViewService.toggleFindbar(view, true)), accelerator: 'CommandOrControl+F' },
        { label: 'Dismiss', visible: false, click: ifVisible((view) => { ViewService.toggleFindbar(view, false); view.webContents.focus(); }), accelerator: 'Esc' },
        { label: 'Back', click: ifVisible((view) => ViewService.goBack(view)), accelerator: 'CommandOrControl+Left' },
        { label: 'Forward', click: ifVisible((view) => ViewService.goForward(view)), accelerator: 'CommandOrControl+Right' },
        { label: 'Refresh', click: ifVisible((view) => ViewService.reload(view)), accelerator: 'CommandOrControl+R' },
        { label: 'Open DevTools', click: ifVisible((view) => view.webContents.openDevTools()), accelerator: 'CommandOrControl+Shift+I' },
      ],
      /* eslint-enable @stylistic/max-len */
    });

    const systemMenu = Menu.getApplicationMenu();
    (systemMenu ?? new Menu()).append(pageMenu);
    Menu.setApplicationMenu(systemMenu);
  }
}

export enum ContextMenuType {
  TRAY = 'tray',
  VIEW = 'view',
  NAVBAR = 'navbar',
}

export default new ApplicationService();
