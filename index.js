const { app, globalShortcut } = require('electron')
const { Manager } = require('./lib/manager')
const { OS } = require('./lib/constants')

app.whenReady().then(() => {
  if (OS.IS_DARWIN) {
    app.dock.hide()
  }
  app.on('window-all-closed', () => {})
  app.on('quit', () => { globalShortcut.unregisterAll() })

  Manager.getInstance()
})