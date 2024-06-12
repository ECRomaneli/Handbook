const { app } = require('electron')
const { Manager } = require('./lib/manager')
const { OS } = require('./lib/constants')

const { Findbar } = require('./lib/findbar')

app.whenReady().then(() => {
  if (OS.IS_DARWIN) {
    app.dock.hide()
  }
  app.on('window-all-closed', () => {})
  testFindBar()

  Manager.getInstance()
})

function testFindBar() {
  const { BrowserWindow } = require('electron')
  const window = new BrowserWindow()
  window.loadURL('https://github.com')
  Findbar.open(window)
}
