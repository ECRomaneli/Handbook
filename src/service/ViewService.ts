import AppState from '@/AppState';
import { Settings } from '@/data/Constants';
import Storage from '@/data/Storage';
import { PageView } from '@/model/Page';
import ViewPropagator from '@/propagator/ViewPropagator';
import MenuService, { ContextMenuType } from '@/service/MenuService';
import PageService from '@/service/PageService';
import { getAcceleratorByEvent } from '@/util/EventKeyCapture';
import { getExtensionForMime, getFiltersForMime } from '@/util/MimeTypes';
import { BrowserWindow, clipboard, dialog, shell, WebContents, WebContentsView, WebContentsViewConstructorOptions } from 'electron';
import contextMenu from 'electron-context-menu';
import Findbar from 'electron-findbar';
import { writeFileSync } from 'fs';
import { EventEmitter } from 'stream';

export type ChildWebContents = WebContents & { __parent__?: WebContents };

class ViewService {
  public getHomeUrl(WebContentsView: WebContentsView): string {
    return WebContentsView.webContents.getURL();
  }

  public createView(options: WebContentsViewConstructorOptions): PageView {
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

  public focus(view = this.getCurrentView()): void {
    if (!view) { console.error('Cannot focus without view.'); return; }
    const wc = view.webContents;
    if (!wc || wc.isDestroyed()) { console.error('Cannot focus with destroyed view.'); return; }

    wc.focus();
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
  public recreateView(oldView: WebContentsView, options: WebContentsViewConstructorOptions) {
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
        parent.off('attached', showCascade);
        parent.off('detached', hideCascade);
      });
      parent.on('show', showCascade);
      parent.on('hide', hideCascade);
      parent.on('attached', showCascade);
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
          { label: AppState.strings.menu.find, click: () => findbar.open(), visible: childWindow.isVisible() },
          { label: AppState.strings.menu.back, click: () => childWindow.webContents.navigationHistory.goBack() },
          { label: AppState.strings.menu.forward, click: () => childWindow.webContents.navigationHistory.goForward() },
          { type: 'separator' },
          { label: AppState.strings.menu.refresh, click: () => childWindow.reload() },
          { type: 'separator' },
          // eslint-disable-next-line @stylistic/max-len
          { label: AppState.strings.menu.copyUrl, click: () => { clipboard.writeText(childWindow.webContents.getURL()); } },
          // eslint-disable-next-line @stylistic/max-len
          { label: AppState.strings.menu.openInBrowser, click: () => { shell.openExternal(childWindow.webContents.getURL()); } },
          { label: AppState.strings.menu.openDevTools, click: () => childWindow.webContents.openDevTools() },
        ],
      });
      fixUserAgent(childWindow.webContents);
      childWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
      (childWindow.webContents as ChildWebContents).__parent__ = parent.webContents;
      this.handleChildWindows(parent, childWindow);
    })
      .setWindowOpenHandler((details) => {
        if (Storage.getSettings(Settings.USE_EXTERNAL_BROWSER)) {
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
              partition: Storage.getPartitionName(AppState.currentPage!.session),
            },
          },
        };
      });
  }

  /**
   * Build window right-click menu.
   */
  public buildContextMenu(view: WebContentsView) {
    contextMenu({
      window: view,
      append: () => {
        return [
          {
            label: AppState.strings.menu.save,
            visible: view.webContents.getURL().startsWith('data:'),
            click: async () => { saveBase64ToFile(view.webContents.getURL()); },
          },
          ...MenuService.getContextMenu(ContextMenuType.VIEW)!,
        ];
      },
    });
  }

  public getSelectedText(view = this.getCurrentView()!): Promise<string> {
    return view.webContents?.executeJavaScript('window.getSelection()?.toString()') ?? Promise.resolve('');
  }

  private openInChildWindow(url: string): void {
    const view = this.getCurrentView();
    if (!view) { console.error('Cannot open URL without view.'); return; }

    view.webContents.executeJavaScript(`
      window.open('${url}', '_blank', 'width=800,height=600');
    `);
  }

  public async searchInGoogle(view = this.getCurrentView()!, aiMode = false): Promise<void> {
    const text = await this.getSelectedText(view);
    if (!text.trim()) { return; }
    let googleUrl = `https://www.google.com/search?q=${encodeURIComponent(text)}`;
    if (aiMode) {
      googleUrl += '&udm=50';
    }
    this.openInChildWindow(googleUrl);
  }

  public async translateWithGoogle(view = this.getCurrentView()!): Promise<void> {
    const text = await this.getSelectedText(view);
    if (!text.trim()) { return; }
    const appLang = AppState.language.split('-')[0];
    const translateUrl = `https://translate.google.com/?sl=auto&tl=${appLang}&text=${encodeURIComponent(text)}`;
    this.openInChildWindow(translateUrl);
  }

  public getRootWebContents(webContents: ChildWebContents): WebContents | undefined {
    return webContents.__parent__ ?? webContents;
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
      title: AppState.strings.dialog.saveFile,
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
