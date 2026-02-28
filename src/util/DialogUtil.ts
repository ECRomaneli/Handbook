import AppState from '@/AppState';
import { OS } from '@/data/Constants';
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

    if (tray && OS.IS_WIN32 && useBalloonIfAvailable) {
      tray.displayBalloon({ title, content, iconType: 'info' });
    } else {
      new Notification2({ title, body: content }).show();
    }
  }

  public async showConfirmationDialog(data: DialogOptions): Promise<void> {
    const result = await Dialog.show(
      data.parent ?? null,
      {
        type: data.type || 'question',
        title: data.title || 'Confirmation',
        message: data.message || 'Are you sure?',
        buttons: [data.confirmBtn ?? 'Ok', data.cancelBtn ?? 'Cancel'],
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
