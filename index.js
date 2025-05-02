import { app, globalShortcut } from 'electron'
import squirrel from 'electron-squirrel-startup'


// Squirrel startup handling
process.platform === 'win32' && squirrel && app.quit()

import { OS } from './lib/constants.js';
import { Manager } from './lib/manager.js';

app.on('window-all-closed', () => {})
app.on('quit', () => { globalShortcut.unregisterAll() })

app.whenReady().then(() => {
  if (OS.IS_DARWIN) { app.dock.hide() }
  Manager.getInstance()
})