const { app, BrowserWindow, Tray } = require('electron')
const path = require('node:path')


app.whenReady().then(() => {
  const window = new BrowserWindow({
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  })
  
  window.loadURL('about:blank')
  window.webContents.openDevTools()

  const tray = new Tray(path.join(__dirname, 'assets', 'img', 'tray', 'iconClosedTemplate.png'))
})


