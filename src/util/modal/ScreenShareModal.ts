import AppState from '@/AppState';
import { Path } from '@/data/Constants';
import Modal from '@/util/modal/Modal';
import { BaseWindow, BrowserWindow, desktopCapturer, DesktopCapturerSource, SourcesOptions } from 'electron';
import path from 'node:path';

interface ScreenShareOptions {
  requesterUrl?: string;
  shareAudioBtn?: boolean;
  parent?: BaseWindow | BrowserWindow;
}

interface ScreenShareSource {
  id: string;
  name: string;
  thumbnail?: string;
  icon?: string;
  shareAudio?: boolean;
}

interface GroupedSources {
  screen: ScreenShareSource[];
  window: ScreenShareSource[];
}

class ScreenShareModal {
  private static readonly capturerOptions: SourcesOptions = {
    types: ['screen', 'window'] as const,
    fetchWindowIcons: true,
    thumbnailSize: { width: 240, height: 100 },
  };

  private static readonly ROOT_PATH = path.join(Path.WEB, 'screen-share');

  private options: ScreenShareOptions | null = null;

  private sources: GroupedSources | null = null;

  private modal: Modal;

  constructor() {
    this.modal = new Modal({
      filePath: path.join(ScreenShareModal.ROOT_PATH, 'index.html'),
      injectOverlay: true,
    })
      .setWindowOptions({
        width: 600,
        height: 380,
        alwaysOnTop: true,
        movable: true,
        resizable: false,
        show: false,
        backgroundColor: '#222222',
        transparent: process.platform === 'linux',
        webPreferences: {
          preload: path.join(ScreenShareModal.ROOT_PATH, 'preload.js'),
        },
      })
      .setWindowHandler((window: BrowserWindow) => {
        // window.webContents.openDevTools()
        window.setContentProtection(AppState.contentProtection);
        window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
        window.setAlwaysOnTop(true, 'modal-panel', 2);
        this.onceClose(() => { this.modal.close(); });
        this.sendData(this.options!);
        window.show();
      });
  }

  request(opts: ScreenShareOptions): Promise<ScreenShareSource | void> {
    return new Promise((resolve, reject) => {
      const closeHandler = (source: ScreenShareSource | void) => {
        if (!source || !source.id) { return resolve(undefined); }
        source.shareAudio = opts.shareAudioBtn ? source.shareAudio : false;
        resolve(source);
      };
      try {
        this.onceClose(closeHandler).open(opts).catch((err: unknown) => {
          this.modal.removeListener('screenShare.close', closeHandler);
          throw err;
        });
      } catch (err) { reject(err); }
    });
  }

  private async open(opts: ScreenShareOptions): Promise<void> {
    if (!this.modal.isOpen()) {
      this.options = opts;
    }
    this.sources = await ScreenShareModal.getSources();
    this.modal.open({ parent: this.options?.parent });
  }

  private sendData(opts: ScreenShareOptions): void {
    this.modal.sendToRenderer('screenShare.open', {
      requesterUrl: opts.requesterUrl,
      shareAudioBtn: opts.shareAudioBtn,
      sources: this.sources,
      strings: AppState.strings.screenShare,
    });
  }

  private onceClose(listener: (source: ScreenShareSource | void) => void): this {
    this.modal.onceRenderer('screenShare.close', listener);
    return this;
  }

  private static getSources(): Promise<GroupedSources> {
    return new Promise((resolve, reject) => {
      desktopCapturer
        .getSources(ScreenShareModal.capturerOptions)
        .then((sources: DesktopCapturerSource[]) =>
          resolve(ScreenShareModal.groupSourcesByType(sources))).catch(reject);
    });
  }

  private static groupSourcesByType(sources: DesktopCapturerSource[]): GroupedSources {
    return sources.reduce((result: GroupedSources, item: DesktopCapturerSource) => {
      const source: ScreenShareSource = {
        id: item.id,
        name: item.name,
        thumbnail: item.thumbnail.toDataURL(),
        icon: item.appIcon ? item.appIcon.toDataURL() : undefined,
      };
      if (item.id.startsWith('window:')) {
        result.window.push(source);
      } else {
        result.screen.push(source);
      }
      return result;
    }, { screen: [], window: [] });
  }
}

export default ScreenShareModal;
