import AppState from '@/AppState';
import { Path } from '@/data/Constants';
import NavbarPropagator from '@/propagator/NavbarPropagator';
import ViewPropagator from '@/propagator/ViewPropagator';
import { ContextMenuType } from '@/service/ApplicationService';
import FrameService from '@/service/FrameService';
import MenuService from '@/service/MenuService';
import PageService from '@/service/PageService';
import PreferencesService from '@/service/PreferencesService';
import ViewService from '@/service/ViewService';
import { clipboard, WebContentsView } from 'electron';
import path from 'node:path';

class NavbarService {
  public readonly NAVBAR_HEIGHT = 40;
  public readonly NAVBAR_WEB_FOLDER = path.join(Path.WEB, 'navigation-bar');

  constructor() {
    this.registerStateListeners();
    this.registerRenderListeners();
  }

  public hasView(): boolean {
    return AppState.navbar !== void 0;
  }

  public createView(): WebContentsView {
    const navbar = new WebContentsView({
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(this.NAVBAR_WEB_FOLDER, 'preload.js'),
      },
    });
    AppState.navbar = navbar;
    navbar.webContents.loadFile(path.join(this.NAVBAR_WEB_FOLDER, 'index.html'));
    return navbar;
  }

  public getView(): WebContentsView | undefined {
    return AppState.navbar;
  }

  private getCurrentUrl(): string {
    const currentView = PageService.getCurrentView();
    return currentView ? currentView.webContents.getURL() : '';
  }

  public sendLabel(label = AppState.currentPage!.label): void {
    NavbarPropagator.sendToRender('label-updated', label);
  }

  public onLoadChangeView(): void {
    this.onLoad(() => this.changeView());
  }

  private onLoad(callback: () => void): void {
    if (this.getView()!.webContents.isLoading()) {
      NavbarPropagator.once('did-stop-loading', callback);
    } else {
      callback();
    }
  }

  /**
   * Change the current view being controlled by the navigation bar
   */
  private changeView(): void {
    const page = AppState.currentPage;
    if (!page || !page.hasView) { return; }
    const view = page.view;

    this.sendLabel(page.label);
    this.sendDidNavigate();
    NavbarPropagator.sendToRender(ViewService.isLoading(view) ? 'did-start-loading' : 'did-stop-loading');
    NavbarPropagator.sendToRender('mute-status-changed', ViewService.isMuted(view));
  }

  private sendDidNavigate(): void {
    const wc = PageService.getCurrentView()!.webContents;
    NavbarPropagator.sendToRender('did-navigate', {
      url: this.getCurrentUrl() || PageService.getCurrentHomeUrl(),
      canGoBack: wc.navigationHistory.canGoBack(),
      canGoForward: wc.navigationHistory.canGoForward(),
    });
  }

  private registerStateListeners(): void {
    ViewPropagator.onCurrentView('did-navigate', () => { this.sendDidNavigate(); });
    ViewPropagator.onCurrentView('did-navigate-in-page', () => { this.sendDidNavigate(); });
    ViewPropagator.onCurrentView('did-start-loading', () => { NavbarPropagator.sendToRender('did-start-loading'); });
    ViewPropagator.onCurrentView('did-stop-loading', () => { NavbarPropagator.sendToRender('did-stop-loading'); });
    ViewPropagator.onCurrentView('mute-status-changed', () => {
      NavbarPropagator.sendToRender('mute-status-changed', PageService.getCurrentView()?.webContents.isAudioMuted());
    });
  }

  private registerRenderListeners(): void {
    NavbarPropagator.handleRender('i18n', () => AppState.strings.menu);

    NavbarPropagator.onRender('back', (): void => {
      PageService.getCurrentView()!.webContents.navigationHistory.goBack();
    });

    NavbarPropagator.onRender('forward', (): void => {
      PageService.getCurrentView()!.webContents.navigationHistory.goForward();
    });

    NavbarPropagator.onRender('home', (): void => {
      PageService.getCurrentView()!.webContents.loadURL(PageService.getCurrentHomeUrl());
    });

    NavbarPropagator.onRender('refresh', (): void => {
      const wc = PageService.getCurrentView()!.webContents;
      (wc.isLoading() && wc.stop()) || wc.reload();
    });

    NavbarPropagator.onRender('copy-url', (): void => {
      clipboard.writeText(this.getCurrentUrl());
    });

    NavbarPropagator.onRender('open-permissions', (): void => {
      PreferencesService.openPermissions(this.getCurrentUrl());
    });

    NavbarPropagator.onRender('list-pages', (): void => {
      MenuService.buildContextMenu(ContextMenuType.NAVBAR).popup({ window: FrameService.getFrame()! });
    });

    NavbarPropagator.onRender('hide', (): void => {
      FrameService.hide();
    });

    NavbarPropagator.onRender('toggle-mute', (): void => {
      ViewService.toggleMute(PageService.getCurrentView()!);
    });

    NavbarPropagator.onRender('close', (): void => {
      FrameService.forceClose();
    });
  }

  public close(): void {
    if (AppState.navbar) {
      AppState.navbar.webContents.close();
      AppState.navbar = undefined;
    }
  }
}

export default new NavbarService();
