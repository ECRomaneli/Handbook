import AppState from '@/AppState';
import { Settings } from '@/data/Constants';
import Storage from '@/data/Storage';
import ViewPropagator from '@/propagator/ViewPropagator';

import FramePropagator from '@/propagator/FramePropagator';
import NavbarService from '@/service/NavbarService';
import PageService from '@/service/PageService';
import ViewService from '@/service/ViewService';
import { getAcceleratorByEvent } from '@/util/EventKeyCapture';
import { BaseWindow, BaseWindowConstructorOptions, Event, Input, Rectangle, WebContents, WebContentsView, screen } from 'electron';
import { Draggable } from 'electron-draggable';
import Findbar from 'electron-findbar';
import { EventEmitter } from 'node:stream';

class FrameService {
  private readonly WINDOW_OPTIONS: BaseWindowConstructorOptions = {
    icon: undefined,
    frame: false,
    show: false,
    alwaysOnTop: true,
    minimizable: false,
    enableLargerThanScreen: true,
    acceptFirstMouse: true,
    skipTaskbar: true,
    roundedCorners: true,
    autoHideMenuBar: true,
  };

  constructor() {
    this.registerStateListeners();
    this.registerInstanceEvents();
    this.registerCustomViewEvents();
  }

  private registerCustomViewEvents(): void {
    FramePropagator.on('show', () => { ViewService.getCurrentView()!.emit('show'); });
    FramePropagator.on('hide', () => { ViewService.getCurrentView()!.emit('hide'); });
  }

  private getFrameOptions(): BaseWindowConstructorOptions {
    return {
      ...this.WINDOW_OPTIONS,
      backgroundColor: Storage.getSettings(Settings.BACKGROUND_COLOR),
      fullscreenable: Storage.getSettings(Settings.ALLOW_FULLSCREEN),
    };
  }

  public toggleVisibility(): void {
    const frame = this.getFrame()!;
    frame.isVisible() ? frame.hide() : frame.show();
  }

  public toggleMaximize(): void {
    const frame = this.getFrame()!;
    frame.isMaximized() ? frame.unmaximize() : frame.maximize();
  }

  public getFrame(): BaseWindow | undefined {
    return AppState.frame;
  }

  public updateActionArea(): void {
    if (NavbarService.hasView()) { return; }
    const frame = this.getFrame();
    if (!frame) { return; }
    const actionArea = Storage.getSettings(Settings.ACTION_AREA) as number;
    Draggable.from(frame).updateOptions({ region: { height: actionArea } });
  }

  private getOrCreateFrame(): BaseWindow {
    if (!this.getFrame()) { this.createFrame(); }
    return this.getFrame()!;
  }

  private createFrame() {
    const frame = new BaseWindow(this.getFrameOptions());
    frame.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    Draggable.from(frame, { maximize: true });
    AppState.frame = frame;
  }

  private registerStateListeners(): void {
    FramePropagator.on('modal-focus',
      () => this.getFrame()!.setOpacity(Storage.getSettings<number>(Settings.FOCUS_OPACITY) / 100));
    FramePropagator.on('modal-blur',
      () => this.getFrame()!.setOpacity(Storage.getSettings<number>(Settings.BLUR_OPACITY) / 100));
    FramePropagator.on('focus',
      () => this.getFrame()!.setOpacity(Storage.getSettings<number>(Settings.FOCUS_OPACITY) / 100));

    FramePropagator.on('blur', () => {
      const frame = this.getFrame()!;
      if (frame.isMaximized() && Storage.getSettings<boolean>(Settings.KEEP_OPACITY_WHEN_MAXIMIZED)) {
        frame.setOpacity(Storage.getSettings<number>(Settings.FOCUS_OPACITY) / 100);
      } else {
        frame.setOpacity(Storage.getSettings<number>(Settings.BLUR_OPACITY) / 100);
      }
    });

    FramePropagator.on('resize', () => {
      const navbar = NavbarService.getView();
      const view = ViewService.getCurrentView();
      if (!view) { throw new Error('No view to resize.'); }

      const navbarHeight = NavbarService.NAVBAR_HEIGHT;
      const size = this.getFrame()!.getSize();
      if (navbar) {
        navbar.setBounds({ x: 0, y: 0, width: size[0], height: navbarHeight });
        view.setBounds({ x: 0, y: navbarHeight, width: size[0], height: size[1] - navbarHeight });
      } else {
        view.setBounds({ x: 0, y: 0, width: size[0], height: size[1] });
      }
    });

    FramePropagator.on('closed', () => { AppState.frame = undefined; });

    ViewPropagator.onCurrentView('before-special-keydown', (e, input) => {
      const hideShortcut = Storage.getSettings(Settings.HIDE_SHORTCUT);
      if (!hideShortcut) { return; }

      const accelerator = getAcceleratorByEvent(input as Input);
      if (accelerator === hideShortcut) {
        (e as Event).preventDefault();
        this.hide();
      }
    });

    ViewPropagator.onCurrentView('enter-html-full-screen', () => {
      console.debug('Entering fullscreen, hiding navbar');
      this.getFrame()!.isFullScreenable() && NavbarService.hasView() && this.toggleNavbar(false);
    });

    ViewPropagator.onCurrentView('leave-html-full-screen', () => {
      console.debug('Leaving fullscreen, restoring navbar');
      this.getFrame()!.isFullScreenable() && NavbarService.hasView() && this.toggleNavbar(true);
    });
  }

  private registerInstanceEvents() {
    FramePropagator.on('moved', () => { this.ensureWindowVisible(); this.saveBounds(); });
    FramePropagator.on('resized', () => { this.saveBounds(); });
  }

  /**
   * Ensure the window title bar is visible (not off-screen at the top)
   * @param frame The frame to ensure visibility for. If not provided, the current frame will be used.
   */
  private ensureWindowVisible(frame = this.getFrame()) {
    if (!frame || frame.isDestroyed() || frame.isMaximized() || frame.isFullScreen()) { return; }

    const bounds = frame.getBounds();
    const display = screen.getDisplayNearestPoint({ x: bounds.x, y: bounds.y });

    // Minimum pixels of window that should be visible at the top
    const minVisibleHeight = 30;

    // Check if window is too far up (title bar not accessible)
    if (bounds.y < display.workArea.y) {
      frame.setPosition(bounds.x, display.workArea.y);
    }

    // Check if window is too far down (completely below screen)
    const maxY = display.workArea.y + display.workArea.height - minVisibleHeight;
    if (bounds.y > maxY) {
      frame.setPosition(bounds.x, maxY);
    }
  }

  private saveBounds() {
    const frame = this.getFrame();
    if (frame && !frame.isMaximized() && !frame.isFullScreen() && !frame.isKiosk()
      && (!frame.isSnapped || !frame.isSnapped())) {
      const windowBounds = frame.getBounds();
      const page = PageService.getCurrentPage();
      Storage.setSharedBounds(windowBounds);
      page!.id && Storage.setWindowBounds(page!.id, windowBounds);
    }
  }

  private toggleNavbar(visible: boolean): void {
    const navbar = NavbarService.getView()!;
    const view = PageService.getCurrentView()!;
    const size = this.getFrame()!.getSize();
    if (visible) {
      const navbarHeight = NavbarService.NAVBAR_HEIGHT;
      navbar.setBounds({ x: 0, y: 0, width: size[0], height: navbarHeight });
      view.setBounds({ x: 0, y: navbarHeight, width: size[0], height: size[1] - navbarHeight });
    } else {
      navbar.setBounds({ x: 0, y: 0, width: 0, height: 0 });
      view.setBounds({ x: 0, y: 0, width: size[0], height: size[1] });
    }
  }

  public isVisible(ignoreDestroyedError = false): boolean {
    const frame = this.getFrame();
    if (ignoreDestroyedError && (!frame || frame.isDestroyed())) { return false; }
    return frame!.isVisible();
  }

  public resetBounds(): void {
    const page = PageService.getCurrentPage()!;
    this.setBounds(PageService.getDefaultBounds(page, true));
  }

  public recreateFrame() {
    const isVisible = this.isVisible();
    this.forceClose(false);
    this.createFrame();
    this.updateView(isVisible);
  }

  public recreateWindow() {
    PageService.recreateView();
    this.recreateFrame();
  }

  public recreateAllWindows() {
    PageService.recreateAllViews();
    this.recreateFrame();
  }

  private getBoundView(): WebContentsView | undefined {
    return this.getFrame()?.contentView.children
      .find((child) => child !== AppState.navbar) as WebContentsView | undefined;
  }

  /**
   * Update the current view with a new one.
   * @param show Whether to show the window after updating the view.
   */
  public updateView(show = false) {
    const page = PageService.getCurrentPage()!;
    const newView = page.view!;
    const oldView = this.getBoundView();

    if (newView === oldView) { return; }

    const frame = this.getOrCreateFrame();
    oldView && frame.contentView.removeChildView(oldView);
    oldView?.emit('detached');
    this.setupNavbarForCurrentPage();

    const bounds = PageService.getPageBounds(page);
    this.setBounds(bounds, newView);

    const dragHandle = Draggable.from(frame);
    const navbar = NavbarService.getView();
    if (navbar) {
      frame.contentView.addChildView(navbar);
      dragHandle.attach(navbar.webContents, {
        exclude: 'button',
        maximize: true,
      });
    } else {
      dragHandle.attach(newView.webContents, {
        region: { height: Storage.getSettings(Settings.ACTION_AREA) as number },
        exclude: 'button, a',
        maximize: true,
      });
    }
    if (newView.webContents.isLoading()) {
      ViewPropagator.onceCurrentView('dom-ready', () => {
        const frame = this.getFrame();
        if (!frame || newView !== PageService.getCurrentView()) { return; } // View changed while loading
        frame.contentView.addChildView(newView);
        newView.emit('attached');
      });
    } else {
      frame.contentView.addChildView(newView);
      newView.emit('attached');
    }

    this.buildViewFindbar(newView);
    show && this.show();
  }

  private buildViewFindbar(view: EventEmitter & { webContents: WebContents }): void {
    const oldFindbar = Findbar.fromIfExists(view.webContents);

    if (oldFindbar) {
      oldFindbar.updateParentWindow(this.getFrame()!);
      return;
    }

    const findbar = Findbar.from(this.getFrame()!, view.webContents);
    findbar.followVisibilityEvents(false);

    findbar.setWindowOptions({ alwaysOnTop: true });

    findbar.setWindowHandler((bar) => {
      const showCascade = () => bar.isVisible() || bar.show();
      const hideCascade = () => bar.isVisible() && bar.hide();
      bar.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
      bar.prependListener('focus', () => this.getFrame()!.emit('modal-focus'));
      bar.prependListener('blur', () => this.getFrame()!.emit('modal-blur'));
      bar.once('closed', () => {
        view.off('show', showCascade);
        view.off('hide', hideCascade);
        view.off('attached', showCascade);
        view.off('detached', hideCascade);
      });
      view.on('show', showCascade);
      view.on('hide', hideCascade);
      view.on('attached', showCascade);
      view.on('detached', hideCascade);
    });
  }

  private setBounds(bounds: Rectangle, view = PageService.getCurrentView()!, isFullScreen = false) {
    if (AppState.navbar && !isFullScreen) {
      AppState.navbar.setBounds({ x: 0, y: 0, width: bounds.width, height: NavbarService.NAVBAR_HEIGHT });
      view.setBounds({
        x: 0,
        y: NavbarService.NAVBAR_HEIGHT,
        width: bounds.width,
        height: bounds.height - NavbarService.NAVBAR_HEIGHT,
      });
    } else {
      view.setBounds({ x: 0, y: 0, width: bounds.width, height: bounds.height });
    }
    this.getFrame()!.setBounds(bounds);
  }

  public show(): void {
    this.getFrame()!.show();
  }

  public hide(): void {
    this.getFrame()!.hide();
  }

  public unbindView(view?: WebContentsView) {
    const frame = this.getFrame();
    frame && view && frame.contentView.removeChildView(view);
  }

  public setupNavbarForCurrentPage() {
    if (!Storage.getSettings(Settings.SHOW_FRAME)) {
      if (NavbarService.hasView()) {
        this.getFrame()!.contentView.removeChildView(NavbarService.getView()!);
      }
      NavbarService.close();
      return;
    }

    NavbarService.hasView() || NavbarService.createView();
    NavbarService.changeView();
  }

  public isFocused(): boolean {
    const frame = this.getFrame();
    return frame && !frame.isDestroyed() ? frame.isFocused() : false;
  }

  /**
     * Try to close window normally, if it fails, then destroy the window.
     * This method call the "close" event even when destroyed.
     */
  public forceClose(closePage = true) {
    const frame = this.getFrame()!;
    frame.close();
    if (!frame.isDestroyed()) {
      frame.emit('close');
      frame.destroy();
    }
    closePage && PageService.closePageView();
    NavbarService.close();
    AppState.frame = undefined;
  }
}

export default new FrameService();
