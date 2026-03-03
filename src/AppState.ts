import { IsDebug, Settings } from '@/data/Constants';
import Storage from '@/data/Storage';
import { getStrings } from '@/locale';
import { Strings } from '@/locale/en';
import { Page } from '@/model/Page';
import FramePropagator from '@/propagator/FramePropagator';
import NavbarPropagator from '@/propagator/NavbarPropagator';
import PreferencesPropagator from '@/propagator/PreferencesPropagator';
import TrayPropagator from '@/propagator/TrayPropagator';
import ViewPropagator from '@/propagator/ViewPropagator';
import { StateDebugger, TrackerEntry } from '@/util/debug/StateDebugger';
import AutoLaunch from 'auto-launch';
import { BaseWindow, BrowserWindow, MenuItemConstructorOptions, nativeTheme, Tray, WebContentsView } from 'electron';

export type SystemTheme = 'light' | 'dark';
export type ResetBoundType = 'bounds' | 'position' | '';

class AppState {
  private _autoLauncher = new AutoLaunch({ name: 'Handbook' });
  private _strings: Strings = getStrings('en');
  private _globalShortcut = '';
  private _resetBoundsType: ResetBoundType = Storage.getSettings(Settings.RESET_BOUNDS);
  private _systemTheme = this.getSystemTheme();
  private _tray?: Tray;
  private _preferences?: BrowserWindow;
  private _fromClipboardPage: Page = new Page(void 0, this.strings.contextMenu.fromClipboard);
  private _pages: Page[] = [];
  private readonly currentStack: { frame?: BaseWindow, navbar?: WebContentsView, page?: Page } = {};
  private readonly contextMenu: {
    tray?: MenuItemConstructorOptions[],
    view?: MenuItemConstructorOptions[],
    navbar?: MenuItemConstructorOptions[],
  } = {};

  constructor() { this.debugLifecycleStatus(); }

  get autoLauncher(): AutoLaunch { return this._autoLauncher; }
  get strings(): Strings { return this._strings; }
  get globalShortcut(): string { return this._globalShortcut; }
  set globalShortcut(shortcut: string) { this._globalShortcut = shortcut; }
  set resetBoundsType(type: ResetBoundType) { this._resetBoundsType = type; }
  get resetBoundsType(): ResetBoundType { return this._resetBoundsType; }
  set systemTheme(theme: SystemTheme) { this._systemTheme = theme; }
  get systemTheme(): SystemTheme { return this._systemTheme; }
  set trayContextMenu(menu: MenuItemConstructorOptions[] | undefined) { this.contextMenu.tray = menu; }
  get trayContextMenu(): MenuItemConstructorOptions[] | undefined { return this.contextMenu.tray; }
  set viewContextMenu(menu: MenuItemConstructorOptions[] | undefined) { this.contextMenu.view = menu; }
  get viewContextMenu(): MenuItemConstructorOptions[] | undefined { return this.contextMenu.view; }
  set navbarContextMenu(menu: MenuItemConstructorOptions[] | undefined) { this.contextMenu.navbar = menu; }
  get navbarContextMenu(): MenuItemConstructorOptions[] | undefined { return this.contextMenu.navbar; }
  set tray(tray: Tray) { this._tray = TrayPropagator.propagate(tray); }
  get tray(): Tray | undefined { return this._tray; }
  set preferences(window: BrowserWindow | undefined) { this._preferences = PreferencesPropagator.propagate(window); }
  get preferences(): BrowserWindow | undefined { return this._preferences; }
  set frame(frame: BaseWindow | undefined) { this.currentStack.frame = FramePropagator.propagate(frame); }
  get frame(): BaseWindow | undefined { return this.currentStack.frame; }
  set navbar(navbar: WebContentsView | undefined) { this.currentStack.navbar = NavbarPropagator.propagate(navbar); }
  get navbar(): WebContentsView | undefined { return this.currentStack.navbar; }
  get fromClipboardPage(): Page { return this._fromClipboardPage; }
  set currentPage(page: Page | undefined) {
    this.currentStack.page = page;
    if (page) {
      ViewPropagator.propagate(page.view);
      page.setViewChangeHandler(() => ViewPropagator.propagate(page.view));
    }
  }
  get currentPage(): Page | undefined { return this.currentStack.page; }
  set pages(pages: Page[]) { this._pages = pages; }
  get pages(): Page[] { return this._pages; }

  set googleApiKey(key: string) { process.env.GOOGLE_API_KEY = key; }
  set themeSource(theme: 'light' | 'dark' | 'system') { nativeTheme.themeSource = theme; }

  private getSystemTheme(): SystemTheme {
    const appTheme = Storage.getSettings(Settings.APP_THEME);
    if (appTheme !== 'system') { return appTheme as SystemTheme; }
    return nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
  }

  private debugLifecycleStatus() {
    IsDebug.state && StateDebugger.start(this.collectTrackers(), 1000, false);
  }

  private collectTrackers(): TrackerEntry[] {
    const allPages = () => [this._fromClipboardPage, ...this._pages];
    const pageType = (current?: Page) => {
      return !current ? '' :
        !current.view ? 'no view' :
          current.view.webContents.isDestroyed() ? 'view: destroyed' : 'view: alive';
    };

    return [
      { name: 'autoLauncher', provider: () => this._autoLauncher.isEnabled(), type: 'bool' },
      { name: 'strings', provider: () => this._strings, type: 'string' },
      { name: 'globalShortcut', provider: () => this._globalShortcut, type: 'string' },
      { name: 'resetBoundsType', provider: () => this._resetBoundsType, type: 'string' },
      { name: 'systemTheme', provider: () => this._systemTheme, type: 'string' },
      { name: 'contextMenu.tray', provider: () => this.trayContextMenu, type: 'array' },
      { name: 'contextMenu.view', provider: () => this.viewContextMenu, type: 'array' },
      { name: 'contextMenu.navbar', provider: () => this.navbarContextMenu, type: 'array' },
      { name: 'preferences', provider: () => this._preferences, type: 'destroyable' },
      { name: 'fromClipboardPage', provider: () => this._fromClipboardPage, type: pageType },
      { name: 'pages', provider: () => allPages(), type: 'array' },
      { name: 'pagesAlive', provider: () => allPages().filter((p) => p.hasView), type: 'array' },
      { name: 'currentStack.frame', provider: () => this.currentStack.frame, type: 'destroyable' },
      { name: 'currentStack.navbar', provider: () => this.currentStack.navbar?.webContents, type: 'destroyable' },
      { name: 'currentStack.page', provider: () => this.currentStack.page, type: pageType },
    ];
  }
}

export default new AppState();
