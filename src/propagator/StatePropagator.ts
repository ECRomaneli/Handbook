import FramePropagator from '@/propagator/FramePropagator';
import ViewPropagator from '@/propagator/ViewPropagator';
import EventEmitter from 'events';
import Propagator, { EventListener } from './Propagator';

export class StatePropagator extends Propagator {
  private static readonly EVENT = 'change';

  protected getEventPrefix(): string { return 'state'; }

  protected initialize() {
    this.registerStateChangeEvent(FramePropagator, 'show');
    this.registerStateChangeEvent(FramePropagator, 'hide');
    this.registerStateChangeEvent(FramePropagator, 'closed');
    this.registerStateChangeEvent(ViewPropagator, 'mute-status-changed');
    this.registerStateChangeEvent(ViewPropagator, 'destroyed');
  }

  public onChange(listener: EventListener, prepend?: true): void {
    if (prepend) {
      this.prependListener(StatePropagator.EVENT, listener);
    } else {
      this.on(StatePropagator.EVENT, listener);
    }
  }

  private registerStateChangeEvent(prop: Propagator, event: string, stateName = event) {
    prop.on(event, (e) => { this.emit(StatePropagator.EVENT, stateName, e); });
  }

  protected registerEvents(_: EventEmitter): void { }
}

export default new StatePropagator();
