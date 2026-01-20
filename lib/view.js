import { clipboard, dialog, shell, WebContentsView } from 'electron'
import path from 'node:path'
import Storage from './storage.js'
import { Settings, Path } from './constants.js'
import Findbar from 'electron-findbar'
import contextMenu from 'electron-context-menu'
import { getAcceleratorByEvent } from './util/eventKeyCapture.js'
import { writeFileSync } from 'node:fs'
import { getExtensionForMime, getFiltersForMime } from './util/mimeTypes.js';
import EventEmitter from 'node:events'

class ViewWrapper extends EventEmitter {

    /** @type {Electron.WebContentsViewConstructorOptions} */
    #options

    /** @type {() => Electron.Menu} */
    #contextMenuProvider

    /** @type {Electron.WebContentsView} */
    rawView

    /** @type {Electron.WebContents} */
    webContents

    /**
     * Create a new Handbook window overriding some options with the standards.
     * @param {Electron.WebContentsViewConstructorOptions | undefined} options
     * @param {void | () => Electron.Menu} contextMenuProvider Function that returns an array of menu items to be added to the context menu.
     */
    constructor (options, contextMenuProvider = (() => [])) {
        super()
        this.#options = options
        this.#contextMenuProvider = contextMenuProvider
        this.#bindView(new WebContentsView(ViewWrapper.#setStandardOptions(options)))
    }

    #bindView(view) {
        this.rawView = view
        this.webContents = view.webContents

        ViewWrapper.#fixUserAgent(view.webContents)
        this.#buildContextMenu(view)
        this.#handleChildWindows(view)
    }

    #unbindView(emitCloseEvent = true) {
        this.webContents.close()
        emitCloseEvent && this.emit('closed')
        this.rawView = null
        this.webContents = null
    }

    /**
     * Build window right-click menu.
     */
    #buildContextMenu(view) {
        contextMenu({
            window: view,
            append: () => {
                return [
                {
                    label: 'Save...', 
                    visible: view.webContents.getURL().startsWith('data:'),
                    click: async () => { ViewWrapper.#saveBase64ToFile(view.webContents.getURL()) }
                },
                ...this.#contextMenuProvider()
            ]}
        })
    }
    
    /**
     * 
     * @param {string} url 
     * @param {Electron.LoadURLOptions | undefined} options 
     * @returns {Promise<void>}
     */
    loadURL(url, options) {
        this.loaded = { url, options }
        this.webContents.loadURL(url, options)
        console.debug('Loaded URL:', url)
    }

    /**
     * 
     * @param {string} filePath 
     * @param {Electron.LoadFileOptions | undefined} options 
     * @returns {Promise<void>}
     */
    loadFile(filePath, options) {
        this.loaded = { filePath, options }
        this.webContents.loadFile(filePath, options)
    }

    /**
     * Reset window to the starting loaded content.
     */
    reset() {
        if (!this.loaded) { console.warn('Nothing loaded') }
        else if (this.loaded.url) { this.loadURL(this.loaded.url, this.loaded.options) }
        else { this.loadFile(this.loaded.filePath, this.loaded.options) }
    }

    toggleFindbar(open = true) {
        const findbar = Findbar.fromIfExists(this.rawView.webContents)
        open ? findbar.open() : findbar.close()
    }

    isFindbarFocused() {
        const findbar = Findbar.fromIfExists(this.rawView.webContents)
        return findbar?.isFocused() || false
    }

    /**
     * Create a new internal window with the same external ID, URL, bounds, visibility, and listeners.
     * @param {Electron.WebContentsViewConstructorOptions | void} options New options. If not present, the same options are going to be used.
     */
    recreateView(options) {
        options = options ? ViewWrapper.#setStandardOptions(options) : this.#options

        const oldView = this.rawView
        
        const newView = new WebContentsView(options)
        newView.setBounds(oldView.getBounds())
        
        if (this.loaded?.url) {
            // Keep current URL
            newView.webContents.loadURL(this.webContents.getURL(), this.loaded.options)
        } else if (this.loaded?.filePath) {
            newView.webContents.loadFile(this.loaded.filePath, this.loaded.options)
        }

        this.isMuted() && newView.webContents.setAudioMuted(true)
        this.#unbindView(false)
        this.#bindView(newView)
    }

    isMuted() {
        return this.webContents.isAudioMuted()
    }

    /**
     * Toggle the mute state of the window (mute and unmute).
     * @param {boolean | void} status If true, mute the window. If false, unmute the window. If void, toggle the current state.
     */
    toggleMute(status) {
        status = status ?? !this.webContents.isAudioMuted()
        this.webContents.setAudioMuted(status)
        this.webContents.emit(status ? 'muted' : 'unmuted')
    }

    getTitle() { return this.webContents.getTitle() }
    reload() { this.rawView.webContents.reload() }
    goBack() { this.rawView.webContents.navigationHistory.goBack() }
    goForward() { this.rawView.webContents.navigationHistory.goForward() }

    /**
     * Send event to the internal window.
     * @param {string} eventName Event name.
     * @param  {...any} args Arguments.
     */
    emitEvent(eventName, ...args) {
        this.webContents.send(eventName, ...args)
    }

    /**
     * Close view normally.
     */
    close() {
        this.#unbindView()
    }
    
    /**
     * Handle child windows.
     * @param {WebContentsView|BrowserWindow} parent 
     */
    #handleChildWindows(parent) {
        parent.webContents
        .on('did-create-window', (childWindow) => {
            const showHandler = () => !childWindow.isDestroyed() && childWindow.show()
            const hideHandler = () => !childWindow.isDestroyed() && childWindow.hide()
            parent.on('show', showHandler)
            parent.on('hide', hideHandler)

            childWindow.once('closed', () => {
                parent.off('show', showHandler)
                parent.off('hide', hideHandler)
            })

            const findbar = Findbar.from(childWindow)
            findbar.setWindowOptions({ alwaysOnTop: true })
            findbar.setWindowHandler(win => {
                win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
            })

            childWindow.webContents.on('before-input-event', (e, input) => {
                if (input.type !== 'keyDown') { return }
                if (!input.control && !input.meta && input.code !== 'Escape') { return }

                const accelerator = getAcceleratorByEvent(input)
                if (accelerator === 'Ctrl+F' || (process.platform === 'darwin' && accelerator === 'Meta+F')) {
                    e.preventDefault()
                    findbar.open()
                } else if (accelerator === 'Esc' && findbar.isOpen()) {
                    e.preventDefault()
                    findbar.close()
                }
            })

            contextMenu({ window: childWindow, append: () => [
                { label: 'Find...', click: () => findbar.open(), visible: childWindow.isVisible() },
                { label: 'Back', click: () => childWindow.webContents.navigationHistory.goBack() },
                { label: 'Forward', click: () => childWindow.webContents.navigationHistory.goForward() },
                { type: 'separator' },
                { label: 'Refresh', click: () => childWindow.reload() },
                { type: 'separator' },
                { label: 'Copy URL', click: () => { clipboard.writeText(childWindow.webContents.getURL()) } },
                { label: 'Open in Browser', click: () => { shell.openExternal(childWindow.webContents.getURL()) } },
                { label: 'Open DevTools', click: () => childWindow.webContents.openDevTools() },
            ]})
            ViewWrapper.#fixUserAgent(childWindow.webContents)
            childWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
            this.#handleChildWindows(childWindow)
        })
        .setWindowOpenHandler((details) => {
            if (Storage.getSettings(Settings.USE_EXTERNAL_BROWSER)) {
                shell.openExternal(details.url)
                return { action: 'deny' }
            }

            return {
                action: 'allow',
                overrideBrowserWindowOptions: {
                    alwaysOnTop: true,
                    minimizable: false,
                    fullscreenable: false,
                    enableLargerThanScreen: true,
                    skipTaskbar: true,
                    autoHideMenuBar: true,
                    acceptFirstMouse: true,
                    webPreferences: {
                        partition: this.#options.webPreferences?.partition
                    }
                }
            }
        })
    }

    /**
     * Fix the webcontents userAgent removing the app tag. Some websites disallow features based on this.
     * @param {Electron.WebContents} webContents 
     */
    static #fixUserAgent(webContents) {
        webContents.setUserAgent(webContents.getUserAgent().replace(/ handbook[^ ]+/i, ''))
    }

    /**
     * @param {Electron.WebContentsViewConstructorOptions | undefined} options 
     * @returns {Electron.WebContentsViewConstructorOptions} options
     */
    static #setStandardOptions(options = {}) {
        if (!options.webPreferences) { options.webPreferences = {} }
        options.webPreferences.preload = path.join(Path.WEB, 'preload', 'windowPreload.js')
        return options
    }

    static async #saveBase64ToFile(base64Data, suggestedName) {
        try {
            let buffer, fileName, filters
            
            // Check if it's a data URL with MIME type
            if (typeof base64Data === 'string' && base64Data.startsWith('data:')) {
                const matches = base64Data.match(/^data:([^;]+);base64,(.+)$/)
                if (matches && matches.length === 3) {
                    const mimeType = matches[1]
                    const base64 = matches[2]
                    let category = mimeType.split('/')[0]
                    if (category === 'application') { category = 'data' }
                    
                    const extension = getExtensionForMime(mimeType);
                    suggestedName = suggestedName || `${category}_${getFormatedDateString()}`
                    fileName = extension ? `${suggestedName}.${extension}` : suggestedName
                    filters = getFiltersForMime(mimeType)
                    
                    buffer = Buffer.from(base64, 'base64')
                } else {
                    throw new Error('Invalid data URL format')
                }
            } else {
                // Treat as plain base64
                buffer = Buffer.from(base64Data, 'base64')
                fileName = suggestedName ?? `data_${getFormatedDateString()}`
                filters = [{ name: 'All Files', extensions: ['*'] }]
            }
            
            // Show save dialog
            const result = await dialog.showSaveDialog({
                title: 'Save File',
                defaultPath: fileName,
                filters: filters
            })
            
            if (!result.canceled && result.filePath) {
                writeFileSync(result.filePath, buffer)
                return true
            }
            
            return false
        } catch (error) {
            console.error('Error saving base64 data:', error)
            return false
        }
    }
}

function getFormatedDateString() {
    return new Date().toISOString().split('.')[0]
}

export default ViewWrapper