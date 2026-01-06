import { BrowserWindow, clipboard, dialog, shell } from 'electron'
import path from 'node:path'
import Storage from './storage.js'
import { Settings, Path } from './constants.js'
import Findbar from 'electron-findbar'
import contextMenu from 'electron-context-menu'
import { getAcceleratorByEvent } from './util/eventKeyCapture.js'
import { writeFileSync } from 'node:fs'
import { getExtensionForMime, getFiltersForMime } from './util/mimeTypes.js';
import EventEmitter from 'node:events'

class WindowWrapper {
    
    /** @const {string} */
    static #BLANK_URL = 'about:blank'

    /** @const {number} */
    static #CANCELABLE_INTERVAL = 200

    /** @type {Electron.BrowserWindowConstructorOptions} */
    #options

    /** @type {() => Electron.Menu} */
    #contextMenuProvider

    /** @type {string} */
    #externalId

    /** @type {Findbar} */
    #findbar

    /** @type {Electron.BrowserWindow} */
    rawWindow

    /** @type {Electron.WebContents} */
    webContents

    /** @type {EventEmitter} */
    bus

    /**
     * Create a new Handbook window overriding some options with the standards.
     * @param {Electron.BrowserWindowConstructorOptions | undefined} options
     * @param {void | () => Electron.Menu} contextMenuProvider Function that returns an array of menu items to be added to the context menu.
     */
    constructor (options, contextMenuProvider = (() => [])) {
        this.#options = options
        this.#contextMenuProvider = contextMenuProvider

        this.#initializeEventBus()

        const win = new BrowserWindow(WindowWrapper.#setStandardOptions(options))
        this.#bindWindow(win)
    }

    #initializeEventBus() {
        this.bus = new EventEmitter()
        this.bus.on('window-moved', this.#saveBounds.bind(this))
        this.bus.on('window-resized', this.#saveBounds.bind(this))
    }

    /**
     * 
     * @param {Electron.BrowserWindow} window 
     */
    #bindWindow(window) {
        this.rawWindow = window
        this.webContents = window.webContents
        window.webContents.parent = window
        window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
        WindowWrapper.#fixUserAgent(window)
        this.#buildContextMenu(window)
        this.#registerEvents(window)
        this.#handleChildWindows(window)
        this.#buildFindbar(window)
    }

    #unbindWindow() {
        this.rawWindow.removeAllListeners()
        this.forceClose()
        this.rawWindow = null
        this.webContents = null
    }

    /**
     * Build window right-click menu.
     */
    #buildContextMenu(window) {
        contextMenu({
            window,
            append: () => {
                return [
                {
                    label: 'Save...', 
                    visible: window.webContents.getURL().startsWith('data:'),
                    click: async () => { WindowWrapper.#saveBase64ToFile(window.webContents.getURL()) }
                },
                ...this.#contextMenuProvider()
            ]}
        })
    }

    #buildFindbar() {
        this.#findbar = Findbar.from(this.rawWindow)

        this.#findbar.setWindowOptions({ alwaysOnTop: true })

        this.#findbar.setWindowHandler(win => {
            win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
            win.prependListener('focus', () => this.bus.emit('modal-focus'))
            win.prependListener('blur', () => this.bus.emit('modal-blur'))
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
        this.rawWindow.loadURL(url, options)
    }

    /**
     * 
     * @param {string} filePath 
     * @param {Electron.LoadFileOptions | undefined} options 
     * @returns {Promise<void>}
     */
    loadFile(filePath, options) {
        this.loaded = { filePath, options }
        this.rawWindow.loadFile(filePath, options)
    }

    /**
     * Reset window to the starting loaded content.
     */
    reset() {
        if (!this.loaded) { console.warn('Nothing loaded') }
        else if (this.loaded.url) { this.loadURL(this.loaded.url, this.loaded.options) }
        else { this.loadFile(this.loaded.filePath, this.loaded.options) }
    }

    toggleFindbar() {
        const findbar = Findbar.from(this.rawWindow)
        findbar.isOpen() ? findbar.close() : findbar.open()
    }

    /**
     * Create a new internal window with the same external ID, URL, bounds, visibility, and listeners.
     * @param {Electron.BrowserWindowConstructorOptions | void} options New options. If not present, the same options are going to be used.
     */
    recreateWindow(options) {
        options = options ? WindowWrapper.#setStandardOptions(options) : this.#options

        const oldWindow = this.rawWindow
        options.show = oldWindow.isVisible()
        
        const newWindow = new BrowserWindow(options)
        newWindow.setBounds(oldWindow.getBounds())
        
        if (this.loaded?.url) {
            // Keep current URL
            newWindow.loadURL(oldWindow.webContents.getURL(), this.loaded.options)
        } else if(this.loaded?.filePath) {
            newWindow.loadFile(this.loaded.filePath, this.loaded.options)
        }

        this.isMuted() && newWindow.mute()
        this.#unbindWindow(oldWindow)
        this.#bindWindow(newWindow)
    }

    /**
     * Whether the window is visible to the user in the foreground of the app.
     * @param {boolean} ignoreDestroyedError Ignore error when the window is destroyed. 
     * @returns {boolean} If the window is visible or not.
     */
    isVisible(ignoreDestroyedError) {
        const win = this.rawWindow
        return !(ignoreDestroyedError && win.isDestroyed()) && win.isVisible()
    }

    /**
     * Return the mute state of the window.
     * @param {boolean} ignoreDestroyedError Ignore error when the window is destroyed. 
     * @returns {boolean} If the audio is muted.
     */
    isMuted(ignoreDestroyedError) {
        const win = this.rawWindow
        return !(ignoreDestroyedError && win.isDestroyed()) && win.webContents.isAudioMuted()
    }

    /**
     * Return the maximize state of the window.
     * @param {boolean} ignoreDestroyedError Ignore error when the window is destroyed.
     */
    isMaximized(ignoreDestroyedError) {
        const win = this.rawWindow
        return !(ignoreDestroyedError && win.isDestroyed()) && win.isMaximized()
    }

    /**
     * Toggle visibility of the window (show and hide).
     * @param {boolean} ignoreDestroyedError Ignore error when the window is destroyed.
     */
    toggleVisibility(ignoreDestroyedError) {
        const win = this.rawWindow
        if (!(ignoreDestroyedError && win.isDestroyed())) {
            this.isVisible() ? win.hide() : win.show()
        }
    }

    /**
     * Toggle the mute state of the window (mute and unmute).
     * @param {boolean} ignoreDestroyedError Ignore error when the window is destroyed.
     */
    toggleMute(ignoreDestroyedError) {
        const win = this.rawWindow
        if (!(ignoreDestroyedError && win.isDestroyed())) {
            win.webContents.isAudioMuted() ? this.#unmute() : this.#mute()
        }
    }

    /**
     * Toggle maximize.
     * @param {boolean} ignoreDestroyedError Ignore error when the window is destroyed.
     */
    toggleMaximize(ignoreDestroyedError) {
        const win = this.rawWindow
        if (!(ignoreDestroyedError && win.isDestroyed())) {
            win.isMaximized() ? win.unmaximize() : win.maximize()
        }
    }

    #mute() {
        this.rawWindow.webContents.setAudioMuted(true)
        this.bus.emit('state-change', 'muted')
    }

    #unmute() {
        this.rawWindow.webContents.setAudioMuted(false)
        this.bus.emit('state-change', 'unmuted')
    }

    getExternalId() {
        return this.#externalId
    }

    setExternalId(externalId) {
        this.#externalId = externalId
    }

    isFocused() { return this.rawWindow.isFocused() }
    focus() { this.rawWindow.focus() }
    openFindbar() { Findbar.from(this.rawWindow).open() }
    closeFindbar() { Findbar.from(this.rawWindow).close() }
    isFindbarFocused() { return Findbar.from(this.rawWindow).isFocused() }
    show() { this.rawWindow.show() }
    hide() { this.rawWindow.hide() }
    getTitle() { return this.rawWindow.getTitle() }
    getBounds() { return this.rawWindow.getBounds() }
    setBounds(bounds) { this.rawWindow.setBounds(bounds) }
    reload() { this.rawWindow.reload() }

    /**
     * Send event to the internal window.
     * @param {string} eventName Event name.
     * @param  {...any} args Arguments.
     */
    emitEvent(eventName, ...args) {
        this.webContents.send(eventName, ...args)
    }

    unload() {
        if (this.webContents?.getURL() !== WindowWrapper.#BLANK_URL) {
            this.rawWindow.loadURL(WindowWrapper.#BLANK_URL)
        }
    }

    /**
     * Try to close window normally, if it fails, then destroy the window.
     * This method call the "close" event even when destroyed.
     */
    forceClose() {
        const win = this.rawWindow
        win.close()
        if (!win.isDestroyed()) {
            win.emit('close')
            win.destroy()
        }
    }

    /**
     * Register standard events for the window.
     * @param {Electron.BrowserWindow} win 
     */
    #registerEvents(win) {
        // const actions = [
        //     { accelerator: Storage.getSettings(Settings.HIDE_SHORTCUT), action: this.toggleVisibility.bind(this) },
        //     { accelerator: OS.IS_DARWIN ? 'Meta+F' : 'Control+F', action: this.toggleFindbar.bind(this) }
        // ]

        win.on('focus', () => win.setOpacity(Storage.getSettings(Settings.FOCUS_OPACITY) / 100))
        win.on('blur', () => {
            if (win.isMaximized() && Storage.getSettings(Settings.KEEP_OPACITY_WHEN_MAXIMIZED)) {
                win.setOpacity(Storage.getSettings(Settings.FOCUS_OPACITY) / 100)
            } else {
                win.setOpacity(Storage.getSettings(Settings.BLUR_OPACITY) / 100)
            }
        })
        win.on('modal-focus', () => win.setOpacity(Storage.getSettings(Settings.FOCUS_OPACITY) / 100))
        win.on('modal-blur', () => win.setOpacity(Storage.getSettings(Settings.BLUR_OPACITY) / 100))

        win.webContents.on('before-input-event', (e, input) => {
            if (input.type !== 'keyDown') { return }
            if (!(input.control || input.alt || input.meta || input.shift)) { return }

            const hideShortcut = Storage.getSettings(Settings.HIDE_SHORTCUT)
            if (!hideShortcut) { return }
            
            const accelerator = getAcceleratorByEvent(input)
            if (accelerator === hideShortcut) {
                e.preventDefault()
                this.toggleVisibility()
            }            
        })

        this.#registerDelayedEvents(win)
        this.#registerStateChangeEvent(win)
    }

    /**
     * Register delayed events like move and resize.
     * @param {Electron.BrowserWindow} win 
     */
    #registerDelayedEvents(win) {
        // As these events are asynchronous and delayed, they can occur after the window is destroyed.
        win.on('move', createCancelableListener(e => this.bus.emit('window-moved', e), WindowWrapper.#CANCELABLE_INTERVAL))
        win.on('resize', createCancelableListener(e => this.bus.emit('window-resized', e), WindowWrapper.#CANCELABLE_INTERVAL))
    }

    /**
     * Register state change events.
     * @param {Electron.BrowserWindow} win 
     */
    #registerStateChangeEvent(win) {
        const registerStateEvent = (event) => {
            win.on(event, e => {
                this.bus.emit(event, e)
                this.bus.emit('state-change', event, e)
            })
        }
        
        registerStateEvent('show')
        registerStateEvent('hide')
        registerStateEvent('closed')
    }

    #saveBounds() {
        const win = this.rawWindow
        if (!win.isDestroyed() && !win.isMaximized()) {
            const windowBounds = this.getBounds()
            Storage.setSharedBounds(windowBounds)
            this.getExternalId() && Storage.setWindowBounds(this.getExternalId(), windowBounds)
        }
    }

    /**
     * Handle child windows.
     * @param {BrowserWindow} parentWindow 
     */
    #handleChildWindows(parentWindow) {
        parentWindow.webContents
        .on('did-create-window', (childWindow) => {
            const showHandler = () => !childWindow.isDestroyed() && childWindow.show()
            const hideHandler = () => !childWindow.isDestroyed() && childWindow.hide()
            parentWindow.on('show', showHandler)
            parentWindow.on('hide', hideHandler)

            childWindow.once('closed', () => {
                parentWindow.off('show', showHandler)
                parentWindow.off('hide', hideHandler)
            })

            const findbar = Findbar.from(childWindow)
            findbar.setWindowOptions({ alwaysOnTop: true })
            findbar.setWindowHandler(win => {
                win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
                win.webContents.on('before-input-event', (e, input) => {
                    if (input.type === 'keyDown' && input.code === 'Escape') {
                        e.preventDefault()
                        findbar.close()
                    }
                })
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
            WindowWrapper.#fixUserAgent(childWindow)
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
     * Fix the window userAgent removing the app tag. Some websites disallow features based on this.
     * @param {BrowserWindow} window 
     */
    static #fixUserAgent(window) {
        window.webContents.setUserAgent(window.webContents.getUserAgent().replace(/ handbook[^ ]+/i, ''))
    }

    /**
     * @param {Electron.BrowserWindowConstructorOptions | undefined} options 
     * @returns {Electron.BrowserWindowConstructorOptions} options
     */
    static #setStandardOptions(options) {
        if (!options) { options = {} }
        options.icon = Path.LOGO
        options.frame = Storage.getSettings(Settings.SHOW_FRAME)
        options.alwaysOnTop = true
        options.backgroundColor = Storage.getSettings(Settings.BACKGROUND_COLOR)
        options.fullscreenable = Storage.getSettings(Settings.ALLOW_FULLSCREEN)
        options.minimizable = false
        options.enableLargerThanScreen = true
        options.acceptFirstMouse = true
        options.skipTaskbar = true
        options.roundedCorners = true
        options.autoHideMenuBar = true
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

/**
 * Returns a listener that always cancel the previous call during the cancel timeout.
 * @param {Function} listener Listener to be wrapped.
 * @param {number} cancelTimeout time on which the listener can be canceled.
 * @returns {Function} Cancelable listener.
 */
function createCancelableListener(listener, cancelTimeout) {
    let timerId
    return (e) => {
        clearTimeout(timerId)
        timerId = setTimeout(() => { listener(e) }, cancelTimeout)
    }
}

function getFormatedDateString() {
    return new Date().toISOString().split('.')[0]
}

export default WindowWrapper