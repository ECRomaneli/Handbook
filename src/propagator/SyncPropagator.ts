import AppState from '@/AppState';
import RenderablePropagator from '@/propagator/RenderablePropagator';
import { BrowserWindow } from 'electron';

export class SyncPropagator extends RenderablePropagator<BrowserWindow> {

  protected getEventPrefix(): string { return 'sync'; }

  protected getWebContents() {
    const preferences = AppState.preferences;
    return preferences ? preferences.webContents : undefined;
  }

  protected registerEvents(): void { }

  protected registerIpcEvents(): void {
    this.propagateIpcEvent('import-file');
    this.propagateIpcEvent('export-file');
    this.propagateIpcEvent('set-settings');
  }
}

export default new SyncPropagator();
