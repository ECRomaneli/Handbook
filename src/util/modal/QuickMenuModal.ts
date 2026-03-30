import { Path } from '@/data/Constants';
import Modal from '@/util/modal/Modal';
import { BaseWindow, BrowserWindow } from 'electron';
import { EventEmitter } from 'events';
import path from 'node:path';

export interface QuickMenuItem {
  label: string;
  [key: string]: unknown;
}

export interface QuickMenuData {
  items: QuickMenuItem[];
  strings?: Record<string, string>;
}

class QuickMenuModal extends EventEmitter {
  private static readonly ROOT_PATH = path.join(Path.WEB, 'quick-menu');
  private static readonly WIDTH = 560;
  private static readonly HEIGHT = 400;

  private modal: Modal;
  private pendingData?: QuickMenuData;

  constructor() {
    super();
    this.modal = new Modal({
      filePath: path.join(QuickMenuModal.ROOT_PATH, 'index.html'),
    })
      .setWindowOptions({
        width: QuickMenuModal.WIDTH,
        height: QuickMenuModal.HEIGHT,
        alwaysOnTop: true,
        movable: false,
        resizable: false,
        show: false,
        transparent: true,
        webPreferences: {
          preload: path.join(QuickMenuModal.ROOT_PATH, 'preload.js'),
        },
      })
      .setBoundsHandler((parentBounds) => ({
        x: parentBounds.x + parentBounds.width / 2 - QuickMenuModal.WIDTH / 2,
        y: parentBounds.y + Math.round(parentBounds.height * 0.2),
      }))
      .setWindowHandler((window: BrowserWindow) => {
        window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
        window.on('blur', () => this.close());
        window.setOpacity(0.97);
        this.modal
          .onRenderer<[QuickMenuItem]>('quickMenu:select', (item) => this.emit('select', item))
          .onRenderer<[string]>('quickMenu:filter', (query) => this.emit('filter', query))
          .onRenderer('quickMenu:close', () => this.close());

        window.webContents.once('dom-ready', () => {
          if (this.pendingData) {
            this.modal.sendToRenderer('quickMenu:open', {
              items: this.pendingData.items,
              strings: this.pendingData.strings,
            });
          }
          window.show();
        });
      });
  }

  open(data: QuickMenuData, parent?: BaseWindow | BrowserWindow): void {
    if (this.modal.isOpen()) {
      this.modal.close();
      return;
    }
    this.pendingData = data;
    this.modal.open({ parent });
  }

  close(): void {
    this.modal.hideAndClose();
  }

  isOpen(): boolean {
    return this.modal.isOpen();
  }

  sendFilterResults(items: QuickMenuItem[]): void {
    this.modal.sendToRenderer('quickMenu:filterResults', items);
  }
}

export default QuickMenuModal;
