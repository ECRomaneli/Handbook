const { BrowserWindow, ipcMain } = require('electron')
const { WindowSettings } = require('./constants')
const { Storage } = require('./storage')
const { HandbookWindow } = require('./window')
const path = require('node:path')
const contextMenu = require('electron-context-menu')

class Settings {
    static open() {
        if (Settings.window) { return }
        
        Settings.window = new BrowserWindow({
            icon: HandbookWindow.getLogo(),
            width: 640,
            height: 640,
            show: false,
            frame: false,
            alwaysOnTop: true,
            backgroundColor: Storage.getSettings(WindowSettings.BACKGROUND_COLOR),
            webPreferences: {
              nodeIntegration: true,
              contextIsolation: false
            }
        })

        Settings.window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
        Settings.buildContextMenu()
        Settings.registerWindowMoveListeners()
        Settings.window.loadFile(path.join(__dirname, '..', 'web', 'settings', 'settings.html'))

        Settings.window.show()
    }

    static setupCrossSecurityPolicy() {
        
    }

    static registerWindowMoveListeners() {
        let position

        ipcMain.on('settings.dragStart', () => {
            position = Settings.window.getPosition()
        })

        ipcMain.on('settings.dragging', (_e, offset) => {
            Settings.window.setPosition(position[0] + offset.x, position[1] + offset.y)
        })
    }

    static close() {
        if (!Settings.window.isDestroyed()) {
            Settings.window.close()
        }
        Settings.window = null
    }

    static onPagesUpdated(listener) {
        ipcMain.on('storage.pages.updated', listener)
    }

    static onSettingsUpdated(listener) {
        ipcMain.on('storage.settings.updated', listener)
    }

    static buildContextMenu() {
        contextMenu({
            window: Settings.window,
            append: () => [
                { role: 'toggleDevTools' },
                { role: 'close' }
            ]
        })
    }
}

// Handle UI [x] button
ipcMain.on('settings.close', () => Settings.close())

module.exports = { Settings }