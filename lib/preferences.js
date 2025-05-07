import { BrowserWindow, ipcMain, screen } from 'electron'
import { HandbookWindow } from './window.js'
import path from 'node:path'
import contextMenu from 'electron-context-menu'
import { OS, Path } from './constants.js'

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
            },
            transparent: OS.IS_LINUX
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
        let startPos

        ipcMain.on('preferences.dragStart', () => {
            const windowPos = this.#window.getPosition()
            startPos = screen.getCursorScreenPoint()
            startPos.x -= windowPos[0]
            startPos.y -= windowPos[1]
        })

        ipcMain.on('preferences.dragging', () => {
            const currentPos = screen.getCursorScreenPoint()
            this.#window.setPosition(currentPos.x - startPos.x, currentPos.y - startPos.y)
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