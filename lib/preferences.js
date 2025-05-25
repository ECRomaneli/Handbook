import { BrowserWindow, ipcMain, screen, shell } from 'electron'
import path from 'node:path'
import contextMenu from 'electron-context-menu'
import { OS, Path } from './constants.js'
import Storage from './storage.js'
import Dialog from './modal/dialog.js'

class Preferences {
    /** @type {BrowserWindow} */
    #window

    /** @type {Dialog} */
    #dialog = new Dialog()

    constructor () {
        this.#registerRenderListeners()
    }

    open() {
        if (this.#window) { return }
        
        this.#window = new BrowserWindow({
            icon: Path.LOGO,
            title: 'Preferences',
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
        this.#window.once('ready-to-show', () => { this.#window.show() })
        this.#window.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' } })
        this.#window.loadFile(path.join(Path.WEB, 'preferences', 'index.html'))
        this.#window.on('closed', () => { this.#window = null })
    }

    queryPermissions(query) {
        this.#sendToWindow('preferences.permissions.query', query)
    }

    permissionsUpdated() {
        this.#sendToWindow('preferences.permissions.updated', Storage.getPermissions())
    }

    isOpen() {
        return this.#window && !this.#window.isDestroyed()
    }

    close() {
        if (!this.#window.isDestroyed()) { this.#window.close() }
    }

    getWindow() {
        return this.#window
    }

    onceReady(listener) {
        ipcMain.once('preferences.ready', listener)
        return this
    }

    /**
     * Register listeners for the renderer process.
     * Bugfix: Use setBounds instead of setPosition to avoid resizing when moving from one screen to another on Windows.
     */
    #registerRenderListeners() {
        let bounds
        let startPos

        ipcMain.on('preferences.dragStart', () => {
            bounds = this.#window.getBounds()
            startPos = screen.getCursorScreenPoint()
            startPos.x -= bounds.x
            startPos.y -= bounds.y
        })

        ipcMain.on('preferences.dragging', () => {
            const currentPos = screen.getCursorScreenPoint()
            bounds.x = currentPos.x - startPos.x
            bounds.y = currentPos.y - startPos.y
            this.#window.setBounds(bounds)
        })

        // Handle UI [x] button
        ipcMain.on('preferences.close', () => this.close())

        ipcMain.handle('preferences.confirm', async (event, message) => {
            if (!this.#isThisWindow(event)) { return false }
            return await this.#dialog.confirm(this.#window, { message })
        })
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

    #sendToWindow(eventName, ...args) {
        if (!this.#window) { return }
        this.#window.webContents.send(eventName, ...args)
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

    #isThisWindow(e) {
        const webContents = this.#window?.webContents
        if (webContents === void 0) {
            console.error("Preferences window is not open")
            return false
        }

        if (e.sender !== webContents) {
            console.error("Sender is not the preferences window")
            return false
        }

        return true
    }
}

export default new Preferences()