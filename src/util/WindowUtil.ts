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
}

export default WindowUtil;
