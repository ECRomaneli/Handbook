import AppState from '@/AppState';
import { OS, Path, Settings } from '@/data/Constants';
import Storage from '@/data/Storage';
import StatePropagator from '@/propagator/StatePropagator';
import TrayPropagator from '@/propagator/TrayPropagator';
import FrameService from '@/service/FrameService';
import MenuService, { ContextMenuType } from '@/service/MenuService';
import PageService from '@/service/PageService';
import { nativeTheme, Tray } from 'electron';
import path from 'node:path';

class TrayService {
  public initialize() {
    this.createTray();
    MenuService.updatePagesAndRefresh();
    this.registerDynamicContextMenu();
    this.registerTrayEvents();
    OS.IS_WIN32 && AppState.tray!.focus();
  }

  public updateLinuxTrayContextMenu() {
    if (OS.IS_LINUX) { AppState.tray!.setContextMenu(MenuService.buildContextMenu(ContextMenuType.TRAY)); }
  }

  public updateTrayIcon(): void {
    AppState.tray!.setImage(this.getTrayIcon(FrameService.isVisible(true)));
  }

  private createTray() {
    const tray = new Tray(this.getTrayIcon(false));
    AppState.tray = tray;
    tray.setToolTip(AppState.strings.tray.tooltip);
  }

  private registerDynamicContextMenu() {
    if (OS.IS_LINUX) {
      StatePropagator.onChange(() => {
        const contextMenu = MenuService.buildContextMenu(ContextMenuType.TRAY);
        this.getTray().setContextMenu(contextMenu);
      });
      return;
    }

    const popUpMenu = () => {
      const contextMenu = MenuService.buildContextMenu(ContextMenuType.TRAY);
      contextMenu.getMenuItemById('clipboard-url')!.visible = MenuService.shouldEnableClipboardPage();
      this.getTray().popUpContextMenu(contextMenu);
    };

    if (OS.IS_DARWIN) {
      TrayPropagator.on('mouse-longpress', popUpMenu);
    }

    TrayPropagator.on('right-click', popUpMenu);
  }

  private getTray(): Tray {
    return AppState.tray!;
  }

  private registerTrayEvents() {
    TrayPropagator.on('click', () => PageService.setupOrTogglePage());
    StatePropagator.onChange(() => { this.updateTrayIcon(); });
  }

  private getTrayIconPath(theme: 'light' | 'dark', open: boolean): string {
    return path.join(Path.ASSETS, 'tray', theme, `${open ? 'open' : 'closed'}Template.png`);
  }

  private getTrayIcon(open: boolean): string {
    // Darwin changes automatically the icon when the app is in dark mode using the alpha channel
    if (OS.IS_DARWIN) { return this.getTrayIconPath('light', open); }

    let theme = Storage.getSettings(Settings.TRAY_ICON_THEME) as 'preferred' | 'system' | 'light' | 'dark';
    if (theme === 'system') {
      // On Windows, this property distinguishes between system and app light/dark theme
      // Other OSs, if the app theme is system, use the nativeTheme.shouldUseDarkColors
      // otherwise, use the cached theme
      theme = OS.IS_WIN32 ? nativeTheme.shouldUseDarkColorsForSystemIntegratedUI ? 'dark' : 'light' :
        Storage.getSettings(Settings.APP_THEME) === 'system' ? nativeTheme.shouldUseDarkColors ? 'dark' : 'light' :
          AppState.systemTheme;
    } else if (theme === 'preferred') {
      theme = nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
    }

    return this.getTrayIconPath(theme, open);
  }
}

export default new TrayService();
