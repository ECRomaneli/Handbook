const { BrowserWindow } = require('electron')
const path = require('node:path')
const { Storage } = require('./storage')
const { WindowSettings } = require('./constants')
const contextMenu = require('electron-context-menu')

class HandbookWindow extends BrowserWindow {
    
    /** @const {string} */
    static BLANK_URL = 'about:blank'

    /** @const {number} */
    static DEFAULT_INTERVAL = 200

    /** @type {Electron.BrowserWindowConstructorOptions} */
    options

    /** @type {string} */
    externalId

    /** @type {object} */
    listenerMap = {}

    /** @type {Function} */
    boundsListener = () => {
        if (!this.isDestroyed() && !this.isMaximized()) {
            const windowBounds = this.getBounds()
            Storage.setSharedBounds(windowBounds)
            Storage.setWindowBounds(this.getExternalId(), windowBounds)
        }
    }

    /**
     * Create a new Handbook window overriding some options with the standards.
     * @param {Electron.BrowserWindowConstructorOptions | undefined} options
     */
    constructor (options) {
        super (setStandardOptions(options))
        this.options = options

        this.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
        this.buildContextMenu()
        this.registerDefaultEventListeners()
    }

    /**
     * Build window right-click menu.
     */
    buildContextMenu() {
        contextMenu({
            window: this,
            append: () => [
                { label: 'Window', submenu: [
                    { label: 'Back', click: () => this.webContents.goBack() },
                    { label: 'Forward', click: () => this.webContents.goForward() },
                    { type: 'separator' },
                    { label: 'Refresh', click: () => this.reload() },
                    { label: 'Reload', click: () => this.reset() },
                    { type: 'separator' },
                    { role: 'toggleDevTools' },
                    { label: 'Hide', click: () => this.hide() },
                    { label: 'Close', click: () => this.close() }
                ]}
            ]
        })
    }
    
    /**
     * 
     * @param {string} url 
     * @param {Electron.LoadURLOptions | undefined} options 
     * @returns {Promise<void>}
     */
    loadURL(url, options) {
        this._loaded = { url: url, options: options }
        super.loadURL(url, options)
    }

    /**
     * 
     * @param {string} filePath 
     * @param {Electron.LoadFileOptions | undefined} options 
     * @returns {Promise<void>}
     */
    loadFile(filePath, options) {
        this._loaded = { filePath: url, options: options }
        super.loadFile(filePath, options)
    }

    /**
     * Reset window to the starting loaded content.
     */
    reset() {
        const loaded = this._loaded
        if (!loaded) {
            console.warn('Nothing loaded')
        } else if (loaded.url) {
            super.loadURL(loaded.url, loaded.options)
        } else {
            super.loadFile(loaded.filePath, loaded.options)
        }
    }

    /**
     * Resizes and/or moves the window to the supplied bounds. Any properties that are not supplied 
     * will default to their current values.
     * @param {Rectangle} bounds
     */
    setBoundsIfExists(bounds) {
        this.setBounds()
        bounds.x !== void 0 && bounds.y !== void 0 && newWindow.setPosition(bounds.x, bounds.y)
        bounds.width !== void 0 && bounds.height !== void 0 && newWindow.setSize(bounds.width, bounds.height)    
    }

    /**
     * Return a new window with the same external ID, URL, bounds, visibility, and listeners.
     * @returns {HandbookWindow} New Window.
     */
    clone() {
       const newWindow = new HandbookWindow(this.options)
        newWindow.setBounds(this.getBounds())
        newWindow.loadURL(this.webContents.getURL())
        newWindow.setExternalId(this.getExternalId())

        this.isVisible() ? newWindow.show() : newWindow.hide()

        Object.keys(this.listenerMap).forEach(eventName => {
            this.listenerMap[eventName].forEach(listener => {
                if (listener._handbookOnce) {
                    newWindow.once(eventName, listener)
                } else {
                    newWindow.on(eventName, listener)
                }
            })
        })

        return newWindow
    }

    /**
     * Whether the window is visible to the user in the foreground of the app.
     * @param {boolean} ignoreDestroyedError Ignore error when trying to check the visibility of a destroyed window. 
     * @returns {boolean} If the window is visible or not.
     */
    isVisible(ignoreDestroyedError) {
        return !(ignoreDestroyedError && this.isDestroyed()) && super.isVisible()
    }

    /**
     * Toggle visibility of the window (show and hide).
     * @param {boolean} ignoreDestroyedError Ignore error when trying to check the visibility of a destroyed window.
     */
    toggle(ignoreDestroyedError) {
        if (!(ignoreDestroyedError && this.isDestroyed())) {
            super.isVisible() ? this.hide() : this.show()
        }
    }

    getExternalId() {
        return this.externalId
    }

    setExternalId(externalId) {
        this.externalId = externalId
    }

    unload() {
        if (this.webContents?.getURL() !== HandbookWindow.BLANK_URL) {
            this.loadURL(HandbookWindow.BLANK_URL)
        }
    }

    trackListener(event, listener) {
        (this.listenerMap[event] ?? (this.listenerMap[event] = [])).push(listener)
    }

    untrackListener(event, listener) {
        const listeners = this.listenerMap[event]
        if (listeners) {
            const index = listeners.indexOf(listener)
            if (index !== -1) { listeners.splice(index, 1) }
        }
    }

    registerDefaultEventListeners() {
        super.on('move', setCancelableListener(e => this.emit('custom-moved', e), HandbookWindow.DEFAULT_INTERVAL))
        super.on('resize', setCancelableListener(e => this.emit('custom-resized', e), HandbookWindow.DEFAULT_INTERVAL))

        // Since these events are asynchronous and delayed, they can occur after the window is destroyed.
        super.on('custom-moved', this.boundsListener)
        super.on('custom-resized', this.boundsListener)
    
        super.on('focus', () => this.setOpacity(Storage.getSettings(WindowSettings.FOCUS_OPACITY) / 100))
        super.on('blur', () => this.setOpacity(Storage.getSettings(WindowSettings.BLUR_OPACITY) / 100))

        // Workaround to only capture user made events
        this.on = (event, listener) => {
            this.trackListener(event, listener)
            return super.on(event, listener)
        }
    
        this.once = (event, listener) => {
            const onceListener = (...args) => {
                this.off(event, onceListener)
                listener(...args)
            }
            listener._handbookOnce = true
            this.trackListener(event, listener)
            return super.once(event, onceListener)
        }
    
        this.off = (event, listener) => {
            this.untrackListener(event, listener)
            return super.off(event, listener)
        }
    
        this.addListener = (event, listener) => this.on(event, listener)
        this.removeListener = (event, listener) => this.off(event, listener)
    
        this.removeAllListeners = (event) => {
            if (event) {
                this.listenerMap[event] = void 0
            } else {
                this.listenerMap = {}
            }
            return super.removeAllListeners(event)
        }
    }

    static getLogo(size) {
        return path.join(__dirname, '..', 'assets', 'img', `logo-${size ?? 128}px.png`)
    }
}

/**
 * @param {Electron.BrowserWindowConstructorOptions | undefined} options 
 * @returns {Electron.BrowserWindowConstructorOptions} options
 */
function setStandardOptions(options) {
    if (!options) { options = {} }
    options.icon = HandbookWindow.getLogo()
    options.show = false
    options.frame = Storage.getSettings(WindowSettings.SHOW_FRAME)
    options.alwaysOnTop = true
    options.backgroundColor = Storage.getSettings(WindowSettings.BACKGROUND_COLOR)
    options.fullscreenable = false
    options.minimizable = false
    options.webPreferences = { preload: path.join(__dirname, 'windowPreload.js') }
    return options
}

/**
 * Returns a listener that always cancel the previous call during the cancel timeout.
 * @param {Function} callback Listener to be wrapped.
 * @param {number} cancelTimeout time on which the listener can be canceled.
 * @returns {Function} Cancelable listener.
 */
function setCancelableListener(listener, cancelTimeout) {
    let intervalId, skip
    return (e) => {
        skip = true
        intervalId ?? (intervalId = setInterval(() => {
            if (skip) { skip = false; return }
            clearInterval(intervalId)
            intervalId = void 0
            listener(e)
        }, cancelTimeout))
    }
}

module.exports = { HandbookWindow }