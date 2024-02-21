const { BrowserWindow } = require('electron')

app.whenReady().then(() => {
  const window = new BrowserWindow({
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  })
  
  window.loadURL('about:blank')
  window.webContents.openDevTools()
})
