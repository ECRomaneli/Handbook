import AppState from '@/AppState';
import { OS, Settings } from '@/data/Constants';
import Storage from '@/data/Storage';
import Dialog, { DialogOptions as ModalDialogOptions } from '@/util/modal/Dialog';
import { BrowserWindow, Notification as Notification2 } from 'electron';

export type DialogOptions = ModalDialogOptions & {
  parent?: BrowserWindow,
  confirmBtn?: string,
  cancelBtn?: string,
  confirmAction?: () => void,
  cancelAction?: () => void,
};

class DialogUtil {
  /**
   * Displays a tray balloon. If the OS is not Windows, a Notification is shown instead.
   */
  public notify(title: string, content: string, useBalloonIfAvailable = true): void {
    const tray = AppState.tray;
    const silent = !!Storage.getSettings(Settings.MUTE_STARTUP_SOUND);

    if (tray && OS.IS_WIN32 && useBalloonIfAvailable) {
      tray.displayBalloon({ title, content, iconType: 'info', noSound: silent });
    } else {
      new Notification2({ title, body: content, silent }).show();
    }
  }

  public async showConfirmationDialog(data: DialogOptions): Promise<void> {
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
}

export default new DialogUtil();
