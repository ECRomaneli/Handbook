import { app, globalShortcut } from 'electron';

function guaranteeSingleInstance(): boolean {
  if (!app.requestSingleInstanceLock()) {
    console.error('Another instance is already running');
    app.quit();
    return false;
  }
  return true;
}

// Wayland does not support always-on-top, window positioning, global shortcuts, etc.
// Relaunch under XWayland when running on a Wayland session, unless the user chose a platform explicitly.
// The ozone platform is initialized before this script runs, so appendSwitch is not enough.
function relaunchOnX11IfWayland(): boolean {
  if (process.platform !== 'linux') { return false; }
  if (process.argv.some((arg) => arg.startsWith('--ozone-platform'))) { return false; }
  const isWayland = process.env.XDG_SESSION_TYPE === 'wayland' || !!process.env.WAYLAND_DISPLAY;
  if (!isWayland || !process.env.DISPLAY) { return false; }
  app.relaunch({ args: [...process.argv.slice(1), '--ozone-platform=x11'] });
  app.exit(0);
  return true;
}

const isRelaunching = relaunchOnX11IfWayland();

function configElectronApp(): void {
  process.platform === 'darwin' && app.dock!.hide();
  if (process.env.NODE_ENV === 'production') { console.trace = console.debug = () => { }; }
  app.on('window-all-closed', () => { });
  app.on('quit', () => { globalShortcut.unregisterAll(); });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.whenReady().then(async () => {
  if (isRelaunching || !guaranteeSingleInstance()) { return; }
  configElectronApp();
  (await import('@/Bootstrap'));
});
