import { app, BrowserWindow } from 'electron';
import { autoUpdater, UpdateInfo, ProgressInfo } from 'electron-updater';

// Auto-updater configuration
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

/**
 * Setup auto-updater event handlers
 * @param getMainWindow Function to get the current main window
 */
export function setupAutoUpdater(getMainWindow: () => BrowserWindow | null): void {
  autoUpdater.on('checking-for-update', () => {
    console.log('Checking for updates...');
  });

  autoUpdater.on('update-available', (info: UpdateInfo) => {
    console.log('Update available:', info.version);
    getMainWindow()?.webContents.send('update-available', info);
  });

  autoUpdater.on('update-not-available', () => {
    console.log('No updates available');
  });

  autoUpdater.on('download-progress', (progress: ProgressInfo) => {
    console.log(`Download progress: ${progress.percent.toFixed(2)}%`);
    getMainWindow()?.webContents.send('update-progress', progress);
  });

  autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
    console.log('Update downloaded:', info.version);
    getMainWindow()?.webContents.send('update-downloaded', info);
  });

  autoUpdater.on('error', (err: Error) => {
    console.error('Auto-updater error:', err);
  });
}

// /**
//  * Register auto-updater IPC handlers
//  */
// export function registerAutoUpdaterIPC(): void {
//   ipcMain.handle('check-for-updates', async () => {
//     try {
//       const result = await autoUpdater.checkForUpdates();
//       return result?.updateInfo;
//     } catch (error) {
//       console.error('Error checking for updates:', error);
//       return null;
//     }
//   });

//   ipcMain.handle('download-update', async () => {
//     try {
//       await autoUpdater.downloadUpdate();
//       return true;
//     } catch (error) {
//       console.error('Error downloading update:', error);
//       return false;
//     }
//   });

//   ipcMain.handle('install-update', () => {
//     autoUpdater.quitAndInstall(false, true);
//   });
// }

/**
 * Check for updates (should only be called in production)
 */
export function checkForUpdates(): void {
  if (app.isPackaged) {
    autoUpdater.checkForUpdates();
  }
}
