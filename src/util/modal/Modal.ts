import {
  BaseWindow,
  BrowserWindow,
  BrowserWindowConstructorOptions,
  ipcMain, IpcMainEvent,
  Rectangle,
  WebContents,
  WebContentsView,
} from 'electron';
import { Draggable } from 'electron-draggable';

/**
 * Modal options interface
 */
export interface ModalOptions {
  /** File path to be loaded in the modal. MUST be provided during the construction and/or overridden during open */
  filePath?: string;
  /** Parent window. Used to track position and visibility.
   * If not available, the modal will be shown on the center of the screen */
  parent?: BaseWindow | BrowserWindow;
  /** Inject overlay on parent window when modal is open. Default is false */
  injectOverlay?: boolean;
}

/**
 * Bounds handler function type
 */
export type BoundsHandler = (parentBounds: Rectangle, modalBounds: Rectangle) => Partial<Rectangle>;

/**
 * IPC listener with event name
 */
interface IpcListener {
  (event: IpcMainEvent, ...args: unknown[]): void;
  eventName: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  originalListener: (...args: any[]) => void;
}

class Modal {
  private window?: BrowserWindow;
  private boundsHandler: BoundsHandler = Modal.setDefaultBounds;
  private customOptions?: BrowserWindowConstructorOptions;
  private windowHandler?: ((modalWindow: BrowserWindow) => void);
  private modalOptions: ModalOptions;
  private ipcListeners: IpcListener[] = [];

  /**
   * Construct modal.
   * @param modalOptions Modal options
   */
  constructor(modalOptions: ModalOptions) {
    this.modalOptions = modalOptions;
  }

  /**
   * Open the modal. If the modal is already opened, focus it.
   * @param overrideModalOptions Override options. If no file path was provided during the construction,
   * it MUST be provided here.
   */
  open(overrideModalOptions?: ModalOptions): void {
    if (this.isOpen()) {
      this.window!.focus();
      return;
    }

    const modalOptions: ModalOptions = { ...this.modalOptions, ...overrideModalOptions };

    try {
      if (!modalOptions.filePath) {
        throw new Error('File path is required to open the modal');
      }

      this.window = new BrowserWindow(
        Modal.mergeStandardOptions(this.customOptions, modalOptions.parent),
      );
      this.windowHandler?.(this.window);

      if (modalOptions.parent !== undefined && modalOptions.parent !== null) {
        this.updateBounds(modalOptions.parent);
        this.registerListeners(modalOptions.parent, modalOptions.injectOverlay);
      }

      this.window.loadFile(modalOptions.filePath);
    } catch (err) {
      this.window?.destroy();
      console.error('Failed to open modal:', err);
      throw err;
    }
  }

  /**
   * Close the modal.
   */
  close(): void {
    if (this.isOpen()) {
      this.window!.close();
    }
  }

  /**
   * Hide the modal and after 100 ms close it.
   */
  hideAndClose(): void {
    if (this.isOpen()) {
      this.window!.isVisible() && this.window!.hide();
      setTimeout(() => this.window?.close(), 100);
    }
  }

  /**
   * Whether the modal is opened.
   * @returns True, if the modal is open. Otherwise, false.
   */
  isOpen(): boolean {
    return this.window !== undefined && !this.window.isDestroyed();
  }

  /**
   * Whether the modal is focused. If the modal is closed, false will be returned.
   * @returns True, if the modal is focused. Otherwise, false.
   */
  isFocused(): boolean {
    return this.window?.isFocused() === true;
  }

  /**
   * Whether the modal is visible to the user in the foreground of the app.
   * If the modal is closed, false will be returned.
   * @returns True, if the modal is visible. Otherwise, false.
   */
  isVisible(): boolean {
    return this.window?.isVisible() === true;
  }

  /**
   * Provides a customized set of options to modal window before open. Note
   * that the options below are necessary for the correct functioning and cannot
   * be overridden:
   * - options.parent (value: parentWindow)
   * - options.frame (value: false)
   * - options.transparent (value: true)
   * - options.maximizable (value: false)
   * - options.minimizable (value: false)
   * - options.skipTaskbar (value: true)
   * - options.autoHideMenuBar (value: true)
   * - options.fullscreenable (value: false)
   * - options.webPreferences.nodeIntegration (value: false)
   * - options.webPreferences.contextIsolation (value: true)
   * @param customOptions Custom window options.
   * @returns self reference
   */
  setWindowOptions(customOptions: BrowserWindowConstructorOptions): this {
    this.customOptions = customOptions;
    return this;
  }

  /**
   * Set a window handler capable of changing the modal window settings after opening and before loading the content.
   * @param windowHandler Window handler.
   * @returns self reference
   */
  setWindowHandler(windowHandler: (modalWindow: BrowserWindow) => void): this {
    this.windowHandler = windowHandler;
    return this;
  }

  /**
   * Set a bounds handler to calculate the modal bounds when the parent resizes.
   * @param boundsHandler Bounds handler.
   * @returns self reference
   */
  setBoundsHandler(boundsHandler: BoundsHandler): this {
    this.boundsHandler = boundsHandler;
    return this;
  }

  /**
   * Send data to the renderer process.
   * @param eventName Event name.
   * @param args Arguments to send
   * @returns self reference
   */
  sendToRenderer(eventName: string, ...args: unknown[]): this {
    if (this.isOpen()) {
      this.window!.webContents.send(eventName, ...args);
    }
    return this;
  }

  /**
   * Once IPC renderer event.
   * @param eventName Event name
   * @param listener Listener function
   * @returns self reference
   */
  onceRenderer<T extends unknown[]>(eventName: string, listener: (...args: T) => void): this {
    const wrappedListener = ((e: IpcMainEvent, ...args: unknown[]) => {
      if (this.isThisWindow(e.sender)) {
        ipcMain.removeListener(eventName, wrappedListener);
        this.ipcListeners.splice(this.ipcListeners.indexOf(wrappedListener), 1);
        listener(...(args as T));
      }
    }) as IpcListener;
    wrappedListener.eventName = eventName;
    wrappedListener.originalListener = listener;
    ipcMain.on(eventName, wrappedListener);
    this.ipcListeners.push(wrappedListener);
    return this;
  }

  /**
   * On IPC renderer event.
   * @param eventName Event name
   * @param listener Listener function
   * @returns self reference
   */
  onRenderer<T extends unknown[]>(eventName: string, listener: (...args: T) => void): this {
    const wrappedListener = ((e: IpcMainEvent, ...args: unknown[]) => {
      if (this.isThisWindow(e.sender)) {
        listener(...(args as T));
      }
    }) as IpcListener;
    wrappedListener.eventName = eventName;
    this.ipcListeners.push(wrappedListener);
    ipcMain.on(eventName, wrappedListener);
    return this;
  }

  private isThisWindow(webContents: WebContents): boolean {
    return this.window?.webContents === webContents;
  }

  removeListener<T extends unknown[]>(eventName: string, listener: (...args: T) => void): this {
    const ipcListener = this.ipcListeners.find(
      (l) => l.eventName === eventName && l.originalListener === listener,
    );
    if (ipcListener) {
      ipcMain.removeListener(eventName, ipcListener);
      this.ipcListeners.splice(this.ipcListeners.indexOf(ipcListener), 1);
    }
    return this;
  }

  /**
   * Register all event listeners.
   * @param parent Parent window
   * @param injectOverlay Inject overlay on parent window when modal is open. Default is false
   */
  private registerListeners(parent: BaseWindow, injectOverlay?: boolean): void {
    this.propagateModalEventsToParent(parent, injectOverlay);
    this.registerParentListeners(parent);
    this.onClosedRemoveIpcListeners();
  }

  private onClosedRemoveIpcListeners(): void {
    this.window!.once('closed', () => {
      try {
        this.ipcListeners.forEach((l) => ipcMain.off(l.eventName, l));
      } catch (err) {
        console.error('Error cleaning up IPC listeners:', err);
      } finally {
        this.ipcListeners = [];
      }
    });
  }

  private propagateModalEventsToParent(parent: BaseWindow, injectOverlay?: boolean): void {
    if (injectOverlay) {
      const id = this.window!.id;
      this.window!.on('closed', () =>
        getWebContentsFromWindow(parent).forEach((w) => Modal.setContentOverlay(id, w, false)),
      );
      this.window!.on('ready-to-show', () =>
        getWebContentsFromWindow(parent).forEach((w) => Modal.setContentOverlay(id, w, true)),
      );
    }

    this.window!.on('focus', () => {
      parent.emit('modal-focus', this);
    });
    this.window!.on('blur', () => {
      parent.emit('modal-blur', this);
    });
    this.window!.on('close', () => {
      parent.emit('modal-close', this);
    });
    this.window!.on('closed', () => {
      parent.emit('modal-closed', this);
    });
    this.window!.on('show', () => {
      parent.emit('modal-show', this);
    });
  }

  private registerParentListeners(parent: BaseWindow): void {
    const closedHandler = () => this.isOpen() && this.window!.close();
    const showCascade = () => { !this.window!.isVisible() && this.window!.show(); };
    const hideCascade = () => { this.window!.isVisible() && this.window!.hide(); };
    const boundsCascade = () => { this.updateBounds(parent); };

    const draggable = Draggable.create(parent).attach(this.window!.webContents, { exclude: 'button' });
    parent.on('show', showCascade);
    parent.on('hide', hideCascade);
    parent.on('move', boundsCascade);
    parent.on('resize', boundsCascade);
    parent.on('closed', closedHandler);

    this.window!.on('closed', () => {
      parent.off('show', showCascade);
      parent.off('hide', hideCascade);
      parent.off('move', boundsCascade);
      parent.off('resize', boundsCascade);
      parent.off('closed', closedHandler);
      draggable.destroy();
      this.window = undefined;
    });
  }

  private updateBounds(parent: BaseWindow | BrowserWindow): void {
    const oldBounds = this.window!.getBounds();
    const newBounds = this.boundsHandler(parent.getBounds(), oldBounds);
    if (newBounds.width === undefined) { newBounds.width = oldBounds.width; }
    if (newBounds.height === undefined) { newBounds.height = oldBounds.height; }
    if (Modal.boundsChanged(oldBounds, newBounds as Rectangle)) {
      this.window!.setBounds(newBounds as Rectangle);
    }
  }

  private static boundsChanged(oldBounds: Rectangle, newBounds: Rectangle): boolean {
    return (
      Math.trunc(oldBounds.x - newBounds.x) !== 0 ||
      Math.trunc(oldBounds.y - newBounds.y) !== 0 ||
      oldBounds.width !== newBounds.width ||
      oldBounds.height !== newBounds.height
    );
  }

  /**
   * Merge custom, defaults, and fixed options.
   * @param options Custom options.
   * @param parent Parent window, if any.
   * @returns Merged options.
   */
  private static mergeStandardOptions(
    options?: BrowserWindowConstructorOptions,
    parent?: BaseWindow,
  ): BrowserWindowConstructorOptions {
    const opts: BrowserWindowConstructorOptions = options ? { ...options } : {};
    opts.width = opts.width ?? 640;
    opts.height = opts.height ?? 360;
    opts.resizable = opts.resizable ?? false;
    opts.movable = opts.movable ?? false;
    opts.acceptFirstMouse = opts.acceptFirstMouse ?? true;
    opts.roundedCorners = opts.roundedCorners ?? true;
    opts.parent = parent;
    opts.autoHideMenuBar = true;
    opts.frame = false;
    opts.maximizable = false;
    opts.minimizable = false;
    opts.skipTaskbar = true;
    opts.fullscreenable = opts.fullscreenable ?? false;
    if (!opts.webPreferences) {
      opts.webPreferences = {};
    }
    opts.webPreferences.nodeIntegration = opts.webPreferences.nodeIntegration ?? false;
    opts.webPreferences.contextIsolation = opts.webPreferences.contextIsolation ?? true;
    return opts;
  }

  /**
   * Set default position.
   * @param parentBounds Parent bounds
   * @param modalBounds Modal bounds
   * @returns position.
   */
  private static setDefaultBounds(parentBounds: Rectangle, modalBounds: Rectangle): Partial<Rectangle> {
    return {
      x: parentBounds.x + parentBounds.width / 2 - modalBounds.width / 2,
      y: parentBounds.y + 20,
    };
  }

  /**
   * Create/remove overlay on the window.
   * @param id Modal window id
   * @param webContents The web contents to create/remove the overlay on.
   * @param blocked true to create, false to remove
   */
  private static setContentOverlay(id: number, webContents: WebContents, blocked: boolean): void {
    if (webContents.isDestroyed()) {
      return;
    }

    const overlayId = 'modal-parent-overlay-' + id;

    if (blocked) {
      webContents.executeJavaScript(/*js*/ `
        (function() {
          const existingOverlay = document.getElementById('${overlayId}');
          if (existingOverlay) existingOverlay.remove();

          const overlay = document.createElement('div');
          overlay.id = '${overlayId}';
          overlay.style.cssText =
          'position: fixed !important; top: 0 !important; left: 0 !important; ' +
          'width: 100vw !important; height: 100vh !important; ' +
          'background-color: rgba(0, 0, 0, 0.7) !important; ' +
          'z-index: 2147483647 !important; cursor: not-allowed !important; ' +
          'user-select: none !important; -webkit-user-select: none !important; ' +
          '-moz-user-select: none !important; -ms-user-select: none !important; ' +
          'display: block !important; opacity: 1 !important; ' +
          'transition: opacity 0.2s ease-in-out !important;';

          document.body.appendChild(overlay);
          overlay.focus();
        })();
      `);
    } else {
      webContents.executeJavaScript(/*js*/ `
        (function() {
            const overlay = document.getElementById('${overlayId}');
            if (overlay) { overlay.remove(); }
            return true;
        })();
      `);
    }
  }
}

/**
 * Get web contents from a window.
 * @param window Window instance
 * @returns Web contents array.
 */
function getWebContentsFromWindow(window: BaseWindow | BrowserWindow): WebContents[] {
  if (!window || window.isDestroyed()) {
    return [];
  }

  if (window instanceof BrowserWindow) {
    return [window.webContents];
  }

  return window.contentView.children
    .filter((view) => view instanceof WebContentsView)
    .map((view) => view.webContents);
}

export default Modal;
