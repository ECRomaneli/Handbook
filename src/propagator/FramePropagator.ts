import { Settings } from '@/data/Constants';
import Storage from '@/data/Storage';
import Propagator from '@/propagator/Propagator';
import debounce from '@/util/Debounce';
import { BaseWindow } from 'electron';

export class FramePropagator extends Propagator<BaseWindow> {
  private readonly CANCELABLE_INTERVAL = 300;

  protected getEventPrefix(): string { return 'frame'; }

  protected registerEvents(emitter: BaseWindow): void {
    this.registerDelayedEvents(emitter);
    emitter.on('show', () => { this.emit('show'); });
    emitter.on('hide', () => { this.emit('hide'); });
    emitter.on('focus', () => { this.emit('focus'); });
    emitter.on('blur', () => { this.emit('blur'); });
    emitter.on('closed', () => { this.emit('closed'); });
    // @ts-expect-error Custom event triggered by modals including the findbar
    emitter.on('modal-focus', () => { this.emit('modal-focus'); });
    // @ts-expect-error Custom event triggered by modals including the findbar
    emitter.on('modal-blur', () => { this.emit('modal-blur'); });
  }

  private registerDelayedEvents(emitter: BaseWindow): void {
    emitter.on('move', debounce(() => this.emit('moved'), this.CANCELABLE_INTERVAL));

    let resizeInterval = undefined as NodeJS.Timeout | null | undefined;
    const resizeDebounce = debounce(() => {
      if (resizeInterval) {
        clearInterval(resizeInterval!);
        this.emit('resize');
      }
      resizeInterval = undefined;
      this.emit('resized');
    }, this.CANCELABLE_INTERVAL);

    emitter.on('resize', () => {
      if (resizeInterval === null) {
        this.emit('resize');
      } else if (resizeInterval === undefined) {
        const fps = Storage.getSettings(Settings.RESIZE_REFRESH_RATE) as number || null;
        if (fps) {
          resizeInterval = setInterval(() => this.emit('resize'), Math.trunc(1000 / fps));
        } else {
          resizeInterval = null;
        }
        this.emit('resize');
      }
      resizeDebounce();
    });
  }
}

export default new FramePropagator();
