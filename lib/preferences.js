import { BrowserWindow, ipcMain, screen, shell } from 'electron'
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
        this.#window.webContents.setWindowOpenHandler(({ url }) => {
            shell.openExternal(url); return { action: 'deny' } })
        this.#window.loadFile(path.join(Path.ROOT, 'web', 'preferences', 'index.html'))
        this.#window.on('closed', () => { this.#window = null })
    }

    close() {
        if (!this.#window.isDestroyed()) { this.#window.close() }
    }

    getWindow() {
        return this.#window
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