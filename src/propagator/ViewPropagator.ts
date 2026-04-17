import AppState from '@/AppState';
import { WebContents, WebContentsView } from 'electron';
import Propagator from './Propagator';

export class ViewPropagator extends Propagator<WebContentsView> {
  protected getEventPrefix(): string { return 'view'; }

  protected registerEvents(emitter: WebContentsView): void {
    const wc = emitter.webContents;
    wc.on('before-input-event', (e, inp) => {
      if (inp.type !== 'keyDown') { return; }
      if (!(inp.control || inp.alt || inp.meta || inp.shift)) { return; }
      this.emitCurrentEvent(wc, 'before-special-keydown', e, inp);
    });
    // @ts-expect-error Electron v41+ before-mouse-event
    wc.on('before-mouse-event', (_e: unknown, mouseEvent: { type: string }) => {
      if (mouseEvent.type === 'mouseMove') {
        this.emitCurrentEvent(wc, 'mouse-enter');
      } else if (mouseEvent.type === 'mouseLeave') {
        this.emitCurrentEvent(wc, 'mouse-leave');
      }
    });
    wc.on('did-navigate-in-page', () => { this.emitCurrentEvent(wc, 'did-navigate-in-page'); });
    wc.on('did-start-loading', () => { this.emitCurrentEvent(wc, 'did-start-loading'); });
    wc.on('did-stop-loading', () => { this.emitCurrentEvent(wc, 'did-stop-loading'); });
    wc.on('did-navigate', () => { this.emitCurrentEvent(wc, 'did-navigate'); });
    wc.on('destroyed', () => { this.emit('destroyed', wc); });
    // @ts-expect-error Custom event emitted when the view is attached to a frame
    emitter.on('attached', () => { this.emit('attached', wc); });
    // @ts-expect-error Custom event emitted when the view mute/unmute
    wc.on('mute-status-changed', () => {
      this.emit('mute-status-changed', wc);
      this.emitCurrentEvent(wc, 'mute-status-changed');
    });
  }

  public onCurrentView(eventName: string, listener: (...args: unknown[]) => void): void {
    this.on(this.getCurrentEvent(eventName), listener);
  }

  public onceCurrentView(eventName: string, listener: (...args: unknown[]) => void): void {
    this.once(this.getCurrentEvent(eventName), listener);
  }

  public sendToAllRenders(eventName: string, ...args: unknown[]): void {
    for (const page of AppState.pages) {
      page.view?.webContents.send(this.getEventName(eventName), ...args);
    }
  }

  private emitCurrentEvent(wc: WebContents, eventName: string, ...args: unknown[]): void {
    if (wc === this.getCurrentView()?.webContents) {
      this.emit(this.getCurrentEvent(eventName), ...args);
    }
  }

  private getCurrentEvent(eventName: string): string {
    return `current:${eventName}`;
  }

  private getCurrentView(): WebContentsView | undefined {
    return AppState.currentPage?.view;
  }
}

export default new ViewPropagator();
