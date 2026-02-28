import Propagator from '@/propagator/Propagator';
import debounce from '@/util/Debounce';
import { BaseWindow } from 'electron';

export class FramePropagator extends Propagator<BaseWindow> {
  private readonly CANCELABLE_INTERVAL = 200;

  protected getEventPrefix(): string { return 'frame'; }

  protected registerEvents(emitter: BaseWindow): void {
    this.registerDelayedEvents(emitter);
    emitter.on('show', () => { this.emit('show'); });
    emitter.on('hide', () => { this.emit('hide'); });
    emitter.on('focus', () => { this.emit('focus'); });
    emitter.on('blur', () => { this.emit('blur'); });
    // @ts-expect-error Custom event triggered by modals including the findbar
    emitter.on('modal-focus', () => { this.emit('modal-focus'); });
    // @ts-expect-error Custom event triggered by modals including the findbar
    emitter.on('modal-blur', () => { this.emit('modal-blur'); });
  }

  private registerDelayedEvents(emitter: BaseWindow): void {
    const moveDebounce = debounce(() => this.emit('moved'), this.CANCELABLE_INTERVAL);
    const resizeDebounce = debounce(() => this.emit('resized'), this.CANCELABLE_INTERVAL);
    emitter.on('move', moveDebounce);
    emitter.on('resize', () => { this.emit('resize'); resizeDebounce(); });
  }
}

export default new FramePropagator();
