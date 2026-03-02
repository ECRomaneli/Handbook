import AppState from '@/AppState';
import RenderablePropagator from '@/propagator/RenderablePropagator';
import { BrowserWindow } from 'electron';

export class UpdatePropagator extends RenderablePropagator<BrowserWindow> {

  protected getEventPrefix(): string { return 'updater'; }

  protected getWebContents() {
    const preferences = AppState.preferences;
    return preferences ? preferences.webContents : undefined;
  }

  protected registerEvents(): void { }

  protected registerIpcEvents(): void {
    this.propagateIpcEvent('check-for-updates');
    this.propagateIpcEvent('download-update');
    this.propagateIpcEvent('install-update');
    this.propagateIpcEvent('get-status');
  }
}

export default new UpdatePropagator();
