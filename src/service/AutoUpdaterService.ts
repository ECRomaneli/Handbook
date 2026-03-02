import { IsPackaged } from '@/data/Constants';
import UpdatePropagator from '@/propagator/UpdatePropagator';
import { app } from 'electron';
import { autoUpdater, ProgressInfo, UpdateInfo } from 'electron-updater';

export interface UpdateStatus {
  state: 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error';
  version: string;
  currentVersion: string;
  progress: number;
  error: string;
}

class AutoUpdaterService {
  private status: UpdateStatus = {
    state: 'idle',
    version: '',
    currentVersion: app.getVersion(),
    progress: 0,
    error: '',
  };

  public initialize(): void {
    if (!IsPackaged) {
      console.debug('Auto-updater disabled in development mode');
      return;
    }

    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;

    this.registerUpdaterEvents();
    this.registerIpcEvents();
  }

  private registerUpdaterEvents(): void {
    autoUpdater.on('checking-for-update', () => {
      this.updateStatus({ state: 'checking', error: '' });
    });

    autoUpdater.on('update-available', (info: UpdateInfo) => {
      this.updateStatus({ state: 'available', version: info.version });
    });

    autoUpdater.on('update-not-available', (info: UpdateInfo) => {
      this.updateStatus({ state: 'not-available', version: info.version });
    });

    autoUpdater.on('download-progress', (progress: ProgressInfo) => {
      this.updateStatus({ state: 'downloading', progress: Math.round(progress.percent) });
    });

    autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
      this.updateStatus({ state: 'downloaded', version: info.version, progress: 100 });
    });

    autoUpdater.on('error', (err: Error) => {
      console.error('Auto-updater error:', err);
      this.updateStatus({ state: 'error', error: err.message });
    });
  }

  private registerIpcEvents(): void {
    UpdatePropagator.onRender('check-for-updates', () => this.checkForUpdates());
    UpdatePropagator.onRender('download-update', () => this.downloadUpdate());
    UpdatePropagator.onRender('install-update', () => this.installUpdate());
    UpdatePropagator.onRender('get-status', () => this.sendStatus());
  }

  public checkForUpdates(): void {
    if (this.status.state === 'checking' || this.status.state === 'downloading') { return; }
    autoUpdater.checkForUpdates().catch((err) => {
      console.error('Error checking for updates:', err);
      this.updateStatus({ state: 'error', error: err.message });
    });
  }

  public downloadUpdate(): void {
    if (this.status.state !== 'available') { return; }
    this.updateStatus({ state: 'downloading', progress: 0 });
    autoUpdater.downloadUpdate().catch((err) => {
      console.error('Error downloading update:', err);
      this.updateStatus({ state: 'error', error: err.message });
    });
  }

  public installUpdate(): void {
    if (this.status.state !== 'downloaded') { return; }
    autoUpdater.quitAndInstall(false, true);
  }

  private updateStatus(partial: Partial<UpdateStatus>): void {
    Object.assign(this.status, partial);
    this.sendStatus();
  }

  private sendStatus(): void {
    UpdatePropagator.sendToRender('status-changed', { ...this.status });
  }
}

export default new AutoUpdaterService();
