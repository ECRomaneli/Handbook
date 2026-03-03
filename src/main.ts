import Bootstrap from '@/Bootstrap';
import { IsPackaged, OS } from '@/data/Constants';
import { app, globalShortcut } from 'electron';

function guaranteeSingleInstance(): void {
  if (!app.requestSingleInstanceLock()) {
    console.error('Another instance is already running');
    app.quit();
    return;
  }
}

function configElectronApp(): void {
  guaranteeSingleInstance();
  OS.IS_DARWIN && app.dock!.hide();
  if (IsPackaged) { console.trace = console.debug = () => { }; }
  app.on('window-all-closed', () => { });
  app.on('quit', () => { globalShortcut.unregisterAll(); });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.whenReady().then(() => {
  configElectronApp();
  Bootstrap.initialize();
});
