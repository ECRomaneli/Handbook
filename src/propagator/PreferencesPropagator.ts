import AppState from '@/AppState';
import RenderablePropagator from '@/propagator/RenderablePropagator';
import { BrowserWindow } from 'electron';

export class PreferencesPropagator extends RenderablePropagator<BrowserWindow> {

  protected getEventPrefix(): string { return 'preferences'; }

  protected getWebContents() {
    const preferences = AppState.preferences;
    return preferences ? preferences.webContents : undefined;
  }

  protected registerEvents(emitter: BrowserWindow): void {
    emitter.on('closed', () => { this.emit('closed'); });
  }

  protected registerIpcEvents(): void {
    this.propagateIpcEvent('ready');
    this.propagateIpcEvent('close');
    this.propagateIpcEvent('pages-updated');
    this.propagateIpcEvent('settings-updated');
    this.propagateIpcEvent('permissions-updated');
    this.propagateIpcEvent('permissions-revoke');
    this.propagateIpcEvent('button-click');
  }
}

export default new PreferencesPropagator();
