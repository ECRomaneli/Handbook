const { BrowserWindow, ipcMain, nativeTheme } = require('electron')
const { WindowSettings } = require('./constants')
const { Storage } = require('./storage')
const { HandbookWindow } = require('./window')
const path = require('node:path')
const contextMenu = require('electron-context-menu')

class HandbookSettings {
    /** @type {BrowserWindow} */
    #window

    constructor () {
        this.#registerRenderListeners()
    }

    open() {
        if (this.#window) { return }
        
        this.#window = new BrowserWindow({
            icon: HandbookWindow.getLogo(),
            width: 700,
            height: 640,
            show: false,
            frame: false,
            alwaysOnTop: true,
            webPreferences: {
              nodeIntegration: true,
              contextIsolation: false
            }
        })

        this.#window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
        this.#buildContextMenu()
        this.#window.loadFile(path.join(__dirname, '..', 'web', 'settings', 'settings.html'))
        this.#window.show()
    }

    close() {
        if (!this.#window.isDestroyed()) {
            this.#window.close()
        }
        this.#window = null
    }

    getWindow() {
        return this.#window
    }

    #registerRenderListeners() {
        let position

        ipcMain.on('settings.dragStart', () => {
            position = this.#window.getPosition()
        })

        ipcMain.on('settings.dragging', (_e, offset) => {
            this.#window.setPosition(position[0] + offset.x, position[1] + offset.y)
        })

        // Handle UI [x] button
        ipcMain.on('settings.close', () => Settings.close())
    }

    #buildContextMenu() {
        contextMenu({
            window: this.#window,
            append: () => [
                { role: 'toggleDevTools' },
                { role: 'close' }
            ]
        })
    }

    /**
     * @param { (event: Electron.IpcMainEvent, pages: object[]) => void } listener 
     */
    onPagesUpdated(listener) {
        ipcMain.on('storage.pages.updated', listener)
    }

    /**
     * @param { (event: Electron.IpcMainEvent, id: string, value: string) => void } listener 
     */
    onSettingsUpdated(listener) {
        ipcMain.on('storage.settings.updated', listener)
    }
}

const Settings = new HandbookSettings()
module.exports = { Settings }