import { Path } from '@/data/Constants';
import { BaseWindow, BrowserWindow, MessageBoxReturnValue } from 'electron';
import path from 'node:path';
import Modal from './Modal';

/**
 * Dialog options interface
 */
export interface DialogOptions {
  /** Type of the message box */
  type?: 'none' | 'info' | 'error' | 'question' | 'warning';
  /** Title of the message box */
  title?: string;
  /** Content of the message box */
  message?: string;
  /** Width in pixels of the message box. If not set, the width will be set to 400 */
  textWidth?: number;
  /** Array of texts for buttons. By default, a single "OK" button will be used */
  buttons?: string[];
  /** Index of the button in the buttons array which will be selected by default when the message box opens */
  defaultId?: number;
  /** The index of the button to be used to cancel the dialog, via the `Esc` key */
  cancelId?: number;
  /** If provided, the message box will include a checkbox with the given label */
  checkboxLabel?: string;
  /** Initial checked state of the checkbox. `false` by default */
  checkboxChecked?: boolean;
}

/**
 * Alert options interface
 */
export interface AlertOptions {
  /** Title of the message box */
  title?: string;
  /** Content of the message box */
  message: string;
  /** Width in pixels of the message box. If not set, the width will be set to 400 */
  textWidth?: number;
  /** Array of texts for buttons. By default, a single "OK" button will be used */
  buttons?: string[];
}

/**
 * Confirm options interface
 */
export interface ConfirmOptions {
  /** Title of the message box */
  title?: string;
  /** Content of the message box. By default, this will be set to "Confirm?" */
  message?: string;
  /** Width in pixels of the message box. If not set, the width will be set to 400 */
  textWidth?: number;
  /** Array of texts for buttons. By default, this will be set to `['Yes', 'No']` */
  buttons?: string[];
  /** Index of the button in the buttons array which will be selected by default when the message box opens */
  defaultId?: number;
  /** The index of the button to be used to cancel the dialog, via the `Esc` key */
  cancelId?: number;
}

class Dialog {
  static readonly #DEFAULT_ALERT_BUTTONS = ['OK'];
  static readonly #DEFAULT_CONFIRM_BUTTONS = ['Yes', 'No'];
  static readonly #DEFAULT_WIDTH = 400;
  static readonly #ROOT_PATH = path.join(Path.WEB, 'dialog');

  #options: DialogOptions | undefined;
  #modal: Modal;

  constructor() {
    this.#modal = new Modal({
      filePath: path.join(Dialog.#ROOT_PATH, 'index.html'),
      disableParentEvents: true,
      lockModalToWindow: true,
    })
      .setWindowOptions({
        width: Dialog.#DEFAULT_WIDTH,
        height: 1,
        alwaysOnTop: true,
        movable: true,
        resizable: false,
        show: false,
        transparent: process.platform === 'linux',
        webPreferences: { preload: path.join(Dialog.#ROOT_PATH, 'preload.js') },
      })
      .setWindowHandler((window: BrowserWindow) => {
        // window.webContents.openDevTools()
        window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
        if (this.#options?.textWidth) {
          Dialog.#setWidth(window, this.#options.textWidth);
        }
        this.onceClose(() => {
          this.#modal.close();
        }).#onceSetHeight((h: number) => {
          Dialog.#setHeight(window, h);
          window.show();
        });
        this.#sendData(this.#options!);
      });
  }

  /**
   * Used by the show() method to open the modal. Do not call this method directly.
   * @param parent Parent window
   * @param opts Dialog options
   */
  #open(parent: BaseWindow | null, opts: DialogOptions): void {
    if (!this.#modal.isOpen()) {
      this.#options = opts;
      if (!this.#options.buttons || this.#options.buttons.length === 0) {
        this.#options.buttons = Dialog.#DEFAULT_ALERT_BUTTONS;
        this.#options.defaultId = 0;
        this.#options.cancelId = 0;
      } else if (!this.#options.cancelId) {
        this.#options.cancelId = 0;
      }
    }
    this.#modal.open({ parent: parent || undefined });
  }

  /**
   * Show dialog. This is a promise-based method that will resolve when the modal is closed.
   * @param parent Parent window to attach the modal to. If null, the modal will be opened in the center of the screen.
   * @param opts Dialog options.
   * @returns Promise resolving to MessageBoxReturnValue
   */
  show(parent: BaseWindow | null, opts: DialogOptions): Promise<MessageBoxReturnValue> {
    return new Promise((resolve, reject) => {
      try {
        this.onceClose(resolve).#open(parent, opts);
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Show alert dialog. This is a promise-based method that will resolve when the modal is closed.
   * @param parent Parent window to attach the modal to. If null, the modal will be opened in the center of the screen.
   * @param opts Alert options.
   */
  async alert(parent: BaseWindow | null, opts: AlertOptions): Promise<void> {
    const dialogOpts: DialogOptions = opts || {};
    dialogOpts.textWidth = dialogOpts.textWidth || Dialog.#DEFAULT_WIDTH;
    dialogOpts.buttons = opts.buttons || Dialog.#DEFAULT_ALERT_BUTTONS;
    dialogOpts.defaultId = undefined;
    if (!dialogOpts.message) {
      throw new Error('Dialog.alert() must have a message');
    }
    await this.show(parent, dialogOpts);
  }

  /**
   * Show confirmation dialog. This is a promise-based method that will resolve when the modal is closed.
   * @param parent Parent window to attach the modal to. If null, the modal will be opened in the center of the screen.
   * @param opts Confirmation options.
   * @returns True if confirmed, false if cancelled.
   */
  async confirm(parent: BaseWindow | null, opts?: ConfirmOptions): Promise<boolean> {
    const dialogOpts: DialogOptions = opts || {};
    dialogOpts.message = dialogOpts.message || 'Confirm?';
    dialogOpts.textWidth = dialogOpts.textWidth || Dialog.#DEFAULT_WIDTH;
    if (!dialogOpts.buttons) {
      dialogOpts.buttons = Dialog.#DEFAULT_CONFIRM_BUTTONS;
      dialogOpts.defaultId = dialogOpts.defaultId ?? 1;
      dialogOpts.cancelId = dialogOpts.cancelId ?? 1;
    }

    if (dialogOpts.buttons.length > 2) {
      throw new Error('Dialog.confirm() only supports two buttons');
    }
    const result = await this.show(parent, dialogOpts);
    return result.response !== dialogOpts.cancelId;
  }

  #sendData(opts: DialogOptions): void {
    this.#modal.sendToRenderer('dialog.open', opts);
  }

  onceClose(listener: (result: MessageBoxReturnValue) => void): this {
    this.#modal.onceRenderer('dialog.close', listener);
    return this;
  }

  #onceSetHeight(listener: (height: number) => void): this {
    this.#modal.onceRenderer('dialog.setHeight', listener);
    return this;
  }

  /**
   * Request dialog. This is a promise-based method that will resolve when the modal is closed.
   * @param parent Parent window to attach the modal to. If null, the modal will be opened in the center of the screen.
   * @param opts Dialog options.
   * @returns Promise resolving to MessageBoxReturnValue
   */
  static show(parent: BaseWindow | null, opts: DialogOptions): Promise<MessageBoxReturnValue> {
    return new Dialog().show(parent, opts);
  }

  /**
   * Show confirmation dialog. This is a promise-based method that will resolve when the modal is closed.
   * @param parent Parent window to attach the modal to. If null, the modal will be opened in the center of the screen.
   * @param opts Confirmation options.
   * @returns True if confirmed, false if cancelled.
   */
  static confirm(parent: BaseWindow | null, opts?: ConfirmOptions): Promise<boolean> {
    return new Dialog().confirm(parent, opts);
  }

  /**
   * Show alert dialog. This is a promise-based method that will resolve when the modal is closed.
   * @param parent Parent window to attach the modal to. If null, the modal will be opened in the center of the screen.
   * @param opts Alert options.
   */
  static alert(parent: BaseWindow | null, opts: AlertOptions): Promise<void> {
    return new Dialog().alert(parent, opts);
  }

  static #setWidth(window: BrowserWindow, width: number): void {
    window.setContentSize(width, window.getContentSize()[1]);
  }

  static #setHeight(window: BrowserWindow, height: number): void {
    window.setContentSize(window.getContentSize()[0], height);
  }
}

export default Dialog;
