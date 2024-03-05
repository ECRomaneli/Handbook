const { app } = require('electron')
const { Manager } = require('./modules/manager')
const { OS } = require('./modules/constants')

app.whenReady().then(() => {
  if (OS.IS_DARWIN) {
    app.dock.hide()
  }
  app.on('window-all-closed', () => {})

  Manager.getInstance()
})
