import { app, BaseWindow, BrowserWindow, globalShortcut, WebContentsView } from 'electron'

import { OS } from './lib/constants.js'
import Manager from './lib/manager.js'

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

function test() {
  const window = new BaseWindow({ width: 800, height: 600 })
  const browser = new BrowserWindow({ width: 800, height: 600 })

  const view = new WebContentsView()
  view.webContents.loadURL('https://github.com')
  window.contentView.addChildView(view)
  console.log('browser', BrowserWindow.getAllWindows().length)
  console.log('base', BaseWindow.getAllWindows().length)
  console.log(window.webContents)

  console.log('from webcontents', getBaseWindowFromWebContents(view.webContents) === window)
}

function getBaseWindowFromWebContents(webContents) {
  return BaseWindow.getAllWindows().find(win => win.webContents === webContents || win.contentView.children.some(child => child.webContents === webContents))
}