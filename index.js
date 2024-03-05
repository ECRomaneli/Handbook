const { app } = require('electron')
const { Manager } = require('./modules/manager')

const IS_DARWIN = process.platform === 'darwin'

app.whenReady().then(() => {
  if (IS_DARWIN) {
    app.dock.hide()
  }
  app.on('window-all-closed', () => {})

  Manager.getInstance()
})
