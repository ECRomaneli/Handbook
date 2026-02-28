import { OS } from '@/data/Constants';
import { Tray } from 'electron';
import Propagator from './Propagator';

export class TrayPropagator extends Propagator<Tray> {
  private static longPressDuration = 300;

  protected getEventPrefix(): string { return 'tray'; }

  public setLongPressDuration(durationInMillis: number): void {
    TrayPropagator.longPressDuration = durationInMillis;
  }

  protected registerEvents(tray: Tray): void {
    if (OS.IS_DARWIN) {
      this.registerLongPressEvent(tray);
    }

    tray.on('click', () => this.emit('click'));
    tray.on('right-click', () => this.emit('right-click'));
  }

  private registerLongPressEvent(tray: Tray): void {
    let longPress: NodeJS.Timeout;

    tray.on('mouse-down', () => {
      longPress = setTimeout(() => this.emit('mouse-longpress'), TrayPropagator.longPressDuration);
    });

    tray.on('mouse-up', () => clearTimeout(longPress));
  }
}

export default new TrayPropagator();
