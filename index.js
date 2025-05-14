import { app, globalShortcut } from 'electron'

import { OS } from './lib/constants.js'
import { Manager } from './lib/manager.js'

if (app.isPackaged) { console.trace = console.debug = () => {} }

app.whenReady().then(() => {
  if (!app.requestSingleInstanceLock()) {
    console.error('Another instance is already running')
    app.quit()
    return
  }

  if (!OS.IS_WIN32) {
    if (OS.IS_DARWIN) { app.dock.hide() }
    startManager()
  } else {
    // Squirrel startup handling
    import('electron-squirrel-startup').then(m => { m.default ? app.quit() : startManager() })
  }
})

function startManager() {
  app.on('window-all-closed', () => {})
  app.on('quit', () => { globalShortcut.unregisterAll() })
  Manager.start()
}