import { app, globalShortcut } from 'electron';

function guaranteeSingleInstance(): boolean {
  if (!app.requestSingleInstanceLock()) {
    console.error('Another instance is already running');
    app.quit();
    return false;
  }
  return true;
}

function configElectronApp(): void {
  process.platform === 'darwin' && app.dock!.hide();
  if (process.env.NODE_ENV === 'production') { console.trace = console.debug = () => { }; }
  app.on('window-all-closed', () => { });
  app.on('quit', () => { globalShortcut.unregisterAll(); });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.whenReady().then(async () => {
  if (!guaranteeSingleInstance()) { return; }
  configElectronApp();
  (await import('@/Bootstrap'));
});
