import { BaseWindow, BrowserWindow, WebContents, WebContentsView } from 'electron';

class WindowUtil {
  public static getWindowFromWebContents(w: WebContents): BaseWindow | undefined {
    const allWindows = BaseWindow.getAllWindows();
    for (const win of allWindows) {
      if ((win as BrowserWindow).webContents === w) { return win; }
      if (!win.contentView) { continue; }
      for (const child of win.contentView.children) {
        if ((child as WebContentsView).webContents === w) { return win; }
      }
    }
    return undefined;
  }

  /**
   * Fix the webcontents userAgent removing the app tag. Some websites disallow features based on this.
   * @param {WebContents} webContents
   */
  public static fixUserAgent(webContents: WebContents): void {
    webContents.setUserAgent(webContents.getUserAgent().replace(/ handbook[^ ]+/i, ''));
  }

  public static setDefaultAlwaysOnTopSettings(window: BaseWindow): void {
    window.setAlwaysOnTop(true, 'modal-panel', 1);
  }
}

export default WindowUtil;
