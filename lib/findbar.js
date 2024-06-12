const { BrowserWindow, ipcMain, WebContents } = require('electron')
const { Path } = require('./constants')
const path = require('node:path')
const contextMenu = require('electron-context-menu')

class HandbookFindbar {
    /** @type {BrowserWindow} */
    #window

    /** @type {WebContents} */
    #searchableContents

    #matchesUpdater = (_e, result) => this.#sendMatchesCount(result.activeMatchOrdinal, result.matches)
    #cascadeClose = () => { this.close() }

    constructor () {
        this.#registerRenderListeners()
    }

    open(window) {
        if (this.#searchableContents) { this.close() }

        this.#searchableContents = window.webContents
        this.#registerWebContentListeners()
        
        this.#window = new BrowserWindow({
            parent: window,
            width: 372,
            height: 52,
            frame: false,
            alwaysOnTop: true,
            resizable: false,
            transparent: true,
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: false
            }
        })

        this.#setDefaultPosition(window.getBounds())
        this.#window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
        this.#buildContextMenu()

        this.#window.loadFile(path.join(Path.WEB, 'findbar', 'findbar.html'))
    }

    close() {
        if (!this.#searchableContents?.isDestroyed()) {
            this.#unregisterWebContentListeners()
        }
        this.#window.close()
        this.#searchableContents = null
        this.#window = null
    }

    getWindow() {
        return this.#window
    }

    #setDefaultPosition(windowBounds) {
        const s = this.#window.getSize()
        Findbar.getWindow().setBounds({
            x: windowBounds.x + windowBounds.width - s[0] - 20,
            y: windowBounds.y - (s[1] / 2)
        })
    }

    #registerWebContentListeners() {
        this.#searchableContents.on('found-in-page', this.#matchesUpdater)
        this.#searchableContents.on('destroyed', this.#cascadeClose)
    }

    #unregisterWebContentListeners() {
        this.#searchableContents.off('found-in-page', this.#matchesUpdater)
        this.#searchableContents.off('destroyed', this.#cascadeClose)
    }

    #registerRenderListeners() {
        let currentValue

        ipcMain.on('findbar.input-change', (_e, value) => {
            currentValue = value
            if (currentValue) {
                this.#searchableContents.findInPage(currentValue, { findNext: true })
            } else {
                this.#searchableContents.stopFindInPage("clearSelection")
                this.#sendMatchesCount(0, 0)
            }
        })

        ipcMain.on('findbar.previous', () => {
            this.#searchableContents.findInPage(currentValue, { forward: false })
        })

        ipcMain.on('findbar.next', () => {
            this.#searchableContents.findInPage(currentValue, { forward: true })
        })

        ipcMain.on('findbar.close', () => {
            this.#searchableContents.stopFindInPage("clearSelection")
            Findbar.close()
        })
    }

    #sendMatchesCount(active, total) {
        this.#window.webContents.send('findbar.matches', { active, total })
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
}

const Findbar = new HandbookFindbar()
module.exports = { Findbar }