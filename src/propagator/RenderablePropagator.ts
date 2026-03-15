import Propagator, { EventListener } from '@/propagator/Propagator';
import { ipcMain, IpcMainEvent, IpcMainInvokeEvent, WebContents } from 'electron';
import { EventEmitter } from 'events';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type RenderEventListener = (event: IpcMainEvent, ...args: any[]) => void;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type RenderEventHandler = (event: IpcMainInvokeEvent, ...args: any[]) => Promise<any> | any;

abstract class RenderablePropagator<T extends EventEmitter = EventEmitter> extends Propagator<T> {
  protected getWebContents(): WebContents | undefined { return undefined; }
  protected registerIpcEvents(): void { }

  constructor() {
    super();
    this.registerIpcEvents();
  }

  protected propagateIpcEvent(eventName: string, verifyContent?: false): void {
    ipcMain.on(this.getEventName(eventName), (e: IpcMainEvent, ...args: unknown[]) => {
      if (e.sender === this.getWebContents() || verifyContent === false) {
        this.emit('render:' + eventName, e, ...args);
      }
    });
  }

  public handleRender(eventName: string, handler: RenderEventHandler): void {
    ipcMain.handle(this.getEventName(eventName), handler);
  }

  public sendToRender(eventName: string, ...args: unknown[]): void {
    const wc = this.getWebContents();
    if (!wc || wc.isDestroyed()) {
      console.error('Event ignored, no render available:', this.getEventName(eventName));
      return;
    }
    Propagator.IS_DEBUG && console.debug(`Sending event to render: ${this.getEventName(eventName)}`);
    wc.send(this.getEventName(eventName), ...args);
  }

  public onRender(eventName: string, listener: RenderEventListener): void {
    this.on('render:' + eventName, listener as EventListener);
  }

  public onceRender(eventName: string, listener: RenderEventListener): void {
    this.once('render:' + eventName, listener as EventListener);
  }

  public offRender(eventName: string, listener: RenderEventListener): void {
    this.off('render:' + eventName, listener as EventListener);
  }
}

export default RenderablePropagator;
