import AppState from '@/AppState';
import { Settings } from '@/data/Constants';
import Persist from '@/data/Storage';
import ViewPropagator from '@/propagator/ViewPropagator';
import { ContextMenuType } from '@/service/ApplicationService';
import ContextMenuService from '@/service/ContextMenuService';
import PageService from '@/service/PageService';
import { getAcceleratorByEvent } from '@/util/EventKeyCapture';
import { getExtensionForMime, getFiltersForMime } from '@/util/MimeTypes';
import { BrowserWindow, clipboard, dialog, shell, WebContents, WebContentsView, WebContentsViewConstructorOptions } from 'electron';
import contextMenu from 'electron-context-menu';
import Findbar from 'electron-findbar';
import { writeFileSync } from 'fs';
import { EventEmitter } from 'stream';

class ViewService {
  public getHomeUrl(WebContentsView: WebContentsView): string {
    return WebContentsView.webContents.getURL();
  }

  public createView(options: WebContentsViewConstructorOptions): WebContentsView {
    const view = new WebContentsView(options);
    this.configureView(view);
    return view;
  }

  private configureView(view: WebContentsView): void {
    fixUserAgent(view.webContents);
    this.buildContextMenu(view);
    this.handleChildWindows(view);
  }

  public closeView(view = this.getCurrentView()!): void {
    view.webContents.close();
  }

  public isMuted(view = this.getCurrentView()!): boolean {
    return view.webContents.isAudioMuted();
  }

  public toggleMute(view: WebContentsView, forceState?: boolean): void {
    const oldState = view.webContents.isAudioMuted();
    const newState = forceState !== undefined ? forceState : !oldState;
    if (oldState === newState) { return; }
    view.webContents.setAudioMuted(newState);
    view.webContents.emit('mute-status-changed');
  }

  public goBack(view = this.getCurrentView()!): void {
    const hist = view.webContents.navigationHistory;
    if (hist.canGoBack()) { hist.goBack(); }
  }

  public goForward(view = this.getCurrentView()!): void {
    const hist = view.webContents.navigationHistory;
    if (hist.canGoForward()) { hist.goForward(); }
  }

  public reload(view = this.getCurrentView()!): void {
    view.webContents.reload();
  }

  public isLoading(view = this.getCurrentView()!): boolean {
    return view.webContents.isLoading();
  }

  public toggleFindbar(view: WebContentsView, show: boolean): void {
    const findbar = Findbar.fromIfExists(view.webContents)!;
    show ? findbar.open() : findbar.close();
  }

  public isFindbarFocused(view = this.getCurrentView()!): boolean {
    const findbar = Findbar.fromIfExists(view.webContents);
    return findbar?.isFocused() ?? false;
  }

  public getCurrentView(): WebContentsView | undefined {
    return AppState.currentPage?.view;
  }

  public getAllViews(): WebContentsView[] {
    return PageService.getAllActivePages().map((p) => p.view!);
  }

  public updateActiveViewSettings(id: string, value: unknown): void {
    ViewPropagator.sendToAllRenders('settings-updated', id, value);
  }

  /**
   * Create a new internal window with the same external ID, URL, bounds, visibility, and listeners.
   * @param oldView The view to be replaced. It will be destroyed at the end of the process.
   * @param options New options. If not present, the same options are going to be used.
   */
  recreateView(oldView: WebContentsView, options: WebContentsViewConstructorOptions) {
    const newView = new WebContentsView(options);
    newView.setBounds(oldView.getBounds());
    this.isMuted(oldView) && newView.webContents.setAudioMuted(true);

    newView.webContents.navigationHistory.restore({
      entries: oldView.webContents.navigationHistory.getAllEntries(),
      index: oldView.webContents.navigationHistory.getActiveIndex(),
    });
    this.configureView(newView);
    return newView;
  }

  /**
     * Handle child windows.
     * @param parent
     */
  public handleChildWindows(parent: EventEmitter & { webContents: WebContents }, closestParent = parent): void {
    closestParent.webContents.on('did-create-window', (childWindow) => {
      const showCascade = () => !childWindow.isDestroyed() && childWindow.show();
      const hideCascade = () => !childWindow.isDestroyed() && childWindow.hide();

      childWindow.once('closed', () => {
        parent.off('show', showCascade);
        parent.off('hide', hideCascade);
        parent.off('detached', hideCascade);
      });
      parent.on('show', showCascade);
      parent.on('hide', hideCascade);
      parent.on('detached', hideCascade);

      const findbar = Findbar.from(childWindow);
      findbar.setWindowOptions({ alwaysOnTop: true });
      findbar.setWindowHandler((findbar: BrowserWindow) => {
        findbar.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
      });

      childWindow.webContents.on('before-input-event', (e, input) => {
        if (input.type !== 'keyDown') { return; }
        if (!input.control && !input.meta && input.code !== 'Escape') { return; }

        const accelerator = getAcceleratorByEvent(input);
        if (accelerator === 'Ctrl+F' || (process.platform === 'darwin' && accelerator === 'Meta+F')) {
          e.preventDefault();
          findbar.open();
        } else if (accelerator === 'Esc' && findbar.isOpen()) {
          e.preventDefault();
          findbar.close();
        }
      });

      contextMenu({
        window: childWindow, append: () => [
          { label: 'Find...', click: () => findbar.open(), visible: childWindow.isVisible() },
          { label: 'Back', click: () => childWindow.webContents.navigationHistory.goBack() },
          { label: 'Forward', click: () => childWindow.webContents.navigationHistory.goForward() },
          { type: 'separator' },
          { label: 'Refresh', click: () => childWindow.reload() },
          { type: 'separator' },
          { label: 'Copy URL', click: () => { clipboard.writeText(childWindow.webContents.getURL()); } },
          { label: 'Open in Browser', click: () => { shell.openExternal(childWindow.webContents.getURL()); } },
          { label: 'Open DevTools', click: () => childWindow.webContents.openDevTools() },
        ],
      });
      fixUserAgent(childWindow.webContents);
      childWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
      this.handleChildWindows(parent, childWindow);
    })
      .setWindowOpenHandler((details) => {
        if (Persist.getSettings(Settings.USE_EXTERNAL_BROWSER)) {
          shell.openExternal(details.url);
          return { action: 'deny' };
        }

        return {
          action: 'allow',
          overrideBrowserWindowOptions: {
            alwaysOnTop: true,
            minimizable: false,
            fullscreenable: false,
            enableLargerThanScreen: true,
            skipTaskbar: true,
            autoHideMenuBar: true,
            acceptFirstMouse: true,
            webPreferences: {
              partition: Persist.getPartitionName(AppState.currentPage!.session),
            },
          },
        };
      });
  }

  /**
   * Build window right-click menu.
   */
  buildContextMenu(view: WebContentsView) {
    contextMenu({
      window: view,
      append: () => {
        return [
          {
            label: 'Save...',
            visible: view.webContents.getURL().startsWith('data:'),
            click: async () => { saveBase64ToFile(view.webContents.getURL()); },
          },
          ...ContextMenuService.getContextMenu(ContextMenuType.VIEW)!,
        ];
      },
    });
  }
}

async function saveBase64ToFile(base64Data: string, suggestedName?: string) {
  try {
    let buffer, fileName, filters;

    // Check if it's a data URL with MIME type
    if (typeof base64Data === 'string' && base64Data.startsWith('data:')) {
      const matches = base64Data.match(/^data:([^;]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        const mimeType = matches[1];
        const base64 = matches[2];
        let category = mimeType.split('/')[0];
        if (category === 'application') { category = 'data'; }

        const extension = getExtensionForMime(mimeType);
        suggestedName = suggestedName || `${category}_${getFormatedDateString()}`;
        fileName = extension ? `${suggestedName}.${extension}` : suggestedName;
        filters = getFiltersForMime(mimeType);

        buffer = Buffer.from(base64, 'base64');
      } else {
        throw new Error('Invalid data URL format');
      }
    } else {
      // Treat as plain base64
      buffer = Buffer.from(base64Data, 'base64');
      fileName = suggestedName ?? `data_${getFormatedDateString()}`;
      filters = [{ name: 'All Files', extensions: ['*'] }];
    }

    // Show save dialog
    const result = await dialog.showSaveDialog({
      title: 'Save File',
      defaultPath: fileName,
      filters: filters,
    });

    if (!result.canceled && result.filePath) {
      writeFileSync(result.filePath, buffer);
      return true;
    }

    return false;
  } catch (error) {
    console.error('Error saving base64 data:', error);
    return false;
  }
}

/**
 * Fix the webcontents userAgent removing the app tag. Some websites disallow features based on this.
 * @param {WebContents} webContents
 */
function fixUserAgent(webContents: WebContents): void {
  webContents.setUserAgent(webContents.getUserAgent().replace(/ handbook[^ ]+/i, ''));
}

function getFormatedDateString() {
  return new Date().toISOString().split('.')[0];
}

export default new ViewService();
