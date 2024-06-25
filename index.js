const { app, globalShortcut } = require('electron')

// Squirrel startup handling
process.platform === 'win32' && require('electron-squirrel-startup') && app.quit()

const { OS } = require('./lib/constants')
const { Manager } = require('./lib/manager')

app.on('window-all-closed', () => {})
app.on('quit', () => { globalShortcut.unregisterAll() })

app.whenReady().then(() => {
  if (OS.IS_DARWIN) { app.dock.hide() }
  Manager.getInstance()
})