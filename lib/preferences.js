import { BrowserWindow, ipcMain } from 'electron'
import { HandbookWindow } from './window.js'
import path from 'node:path'
import contextMenu from 'electron-context-menu'
import { Path } from './constants.js'

class HandbookPreferences {
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
        this.#window.loadFile(path.join(Path.ROOT, 'web', 'preferences', 'index.html'))
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

        ipcMain.on('preferences.dragStart', () => {
            position = this.#window.getPosition()
        })

        ipcMain.on('preferences.dragging', (_e, offset) => {
            this.#window.setPosition(position[0] + offset.x, position[1] + offset.y)
        })

        // Handle UI [x] button
        ipcMain.on('preferences.close', () => Preferences.close())
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

const Preferences = new HandbookPreferences()
export { Preferences }