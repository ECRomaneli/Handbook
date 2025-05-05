import { app, globalShortcut } from 'electron'

import { OS } from './lib/constants.js';
import { Manager } from './lib/manager.js';

app.on('window-all-closed', () => {})
app.on('quit', () => { globalShortcut.unregisterAll() })

app.whenReady().then(() => {
  if (!OS.IS_WIN32) {
    if (OS.IS_DARWIN) { app.dock.hide() }
    Manager.getInstance()
  } else {
    // Squirrel startup handling
    import('electron-squirrel-startup').then(m => { m.default ? app.quit() : Manager.getInstance() })
  }
})