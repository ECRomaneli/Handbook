import AppState from '@/AppState';
import RenderablePropagator from '@/propagator/RenderablePropagator';
import { WebContents, WebContentsView } from 'electron';

export class NavbarPropagator extends RenderablePropagator<WebContentsView> {
  protected getEventPrefix(): string { return 'navbar'; }

  protected getWebContents(): WebContents | undefined {
    const navbar = AppState.navbar;
    return navbar ? navbar.webContents : undefined;
  }

  protected registerEvents(emitter: WebContentsView): void {
    const wc = emitter.webContents;
    wc.on('did-stop-loading', () => { this.emit('did-stop-loading'); });
  }

  protected registerIpcEvents(): void {
    this.propagateIpcEvent('back');
    this.propagateIpcEvent('forward');
    this.propagateIpcEvent('home');
    this.propagateIpcEvent('refresh');
    this.propagateIpcEvent('copy-url');
    this.propagateIpcEvent('open-permissions');
    this.propagateIpcEvent('list-pages');
    this.propagateIpcEvent('hide');
    this.propagateIpcEvent('toggle-mute');
    this.propagateIpcEvent('close');
  }
}

export default new NavbarPropagator();
