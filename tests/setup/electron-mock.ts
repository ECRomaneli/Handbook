import { EventEmitter } from 'node:events';
import { vi } from 'vitest';

class MockWebContents extends EventEmitter {
  private destroyed = false;

  public send = vi.fn();

  public isDestroyed(): boolean {
    return this.destroyed;
  }

  public destroy(): void {
    this.destroyed = true;
  }
}

class MockWebContentsView extends EventEmitter {
  public readonly webContents = new MockWebContents();
}

class MockBaseWindow extends EventEmitter {
  public readonly contentView = {
    addChildView: vi.fn(),
    removeChildView: vi.fn(),
    children: [] as unknown[],
  };

  public readonly webContents = new MockWebContents();

  public isDestroyed = vi.fn(() => false);
  public show = vi.fn();
  public hide = vi.fn();
  public focus = vi.fn();
  public blur = vi.fn();
}

const mockIpcMain = {
  on: vi.fn(),
  handle: vi.fn(),
  removeAllListeners: vi.fn(),
};

const mockApp = Object.assign(new EventEmitter(), {
  whenReady: vi.fn().mockResolvedValue(undefined),
  quit: vi.fn(),
  getAppPath: vi.fn(() => process.cwd()),
  getPath: vi.fn(() => process.cwd()),
  isPackaged: false,
});

vi.mock('electron', () => ({
  BaseWindow: MockBaseWindow,
  WebContentsView: MockWebContentsView,
  ipcMain: mockIpcMain,
  app: mockApp,
}));

export { mockApp, MockBaseWindow, mockIpcMain, MockWebContents, MockWebContentsView };

