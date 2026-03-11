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
    wc.on('enter-html-full-screen', () => { this.emitCurrentEvent(wc, 'enter-html-full-screen'); });
    wc.on('leave-html-full-screen', () => { this.emitCurrentEvent(wc, 'leave-html-full-screen'); });
    wc.on('did-navigate-in-page', () => { this.emitCurrentEvent(wc, 'did-navigate-in-page'); });
    wc.on('did-navigate', () => { this.emitCurrentEvent(wc, 'did-navigate'); });
    wc.on('did-navigate-in-page', () => { this.emitCurrentEvent(wc, 'did-navigate-in-page'); });
    wc.on('did-start-loading', () => { this.emitCurrentEvent(wc, 'did-start-loading'); });
    wc.on('did-stop-loading', () => { this.emitCurrentEvent(wc, 'did-stop-loading'); });
    wc.on('did-finish-load', () => { this.emitCurrentEvent(wc, 'did-finish-load'); });
    wc.prependListener('dom-ready', () => { this.emitCurrentEvent(wc, 'dom-ready'); });
    // @ts-expect-error Custom event emitted when the view is attached to a frame
    emitter.on('attached', () => { this.emit('attached', wc); });
    // @ts-expect-error Custom event emitted when the view mute/unmute
    wc.on('mute-status-changed', () => {
      this.emit('mute-status-changed', wc);
      this.emitCurrentEvent(wc, 'mute-status-changed');
    });
    wc.on('destroyed', () => {
      this.emit('destroyed', wc);
    });
  }

  // public onView(view: WebContentsView, eventName: string, listener: (...args: unknown[]) => void): void {
  //   this.on(this.getContentEvent(view, eventName), listener);
  // }

  // public offView(view: WebContentsView, eventName: string, listener: (...args: unknown[]) => void): void {
  //   this.off(this.getContentEvent(view, eventName), listener);
  // }

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

  // private emitViewEvent(view: WebContentsView, eventName: string, ...args: unknown[]): void {
  //   this.emit(this.getContentEvent(view, eventName), ...args);
  // }

  // private getContentEvent(view: WebContentsView, eventName: string): string {
  //   return `webContents(${view.webContents.id}):${eventName}`;
  // }

  private getCurrentEvent(eventName: string): string {
    return `current:${eventName}`;
  }

  private getCurrentView(): WebContentsView | undefined {
    return AppState.currentPage?.view;
  }
}

export default new ViewPropagator();
