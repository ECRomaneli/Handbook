const { app } = require('electron')
const { Manager } = require('./modules/manager')

const IS_DARWIN = process.platform === 'darwin'

app.whenReady().then(() => new Manager())

if (IS_DARWIN) {
  app.dock.hide()
  app.on('window-all-closed', () => {console.log('window-all-closed')})
}
