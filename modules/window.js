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
        fixUserAgent(this)
        this.options = options
        this.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
        this.buildContextMenu()
        this.registerDefaultEventListeners()
        this.handleChildWindows()
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
                    { label: 'Close', click: () => this.forceClose() }
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
        this.loaded = { url: url, options: options }
        super.loadURL(url, options)
    }

    /**
     * 
     * @param {string} filePath 
     * @param {Electron.LoadFileOptions | undefined} options 
     * @returns {Promise<void>}
     */
    loadFile(filePath, options) {
        this.loaded = { filePath: url, options: options }
        super.loadFile(filePath, options)
    }

    /**
     * Reset window to the starting loaded content.
     */
    reset() {
        if (!this.loaded) {
            console.warn('Nothing loaded')
        } else if (this.loaded.url) {
            super.loadURL(this.loaded.url, this.loaded.options)
        } else {
            super.loadFile(this.loaded.filePath, this.loaded.options)
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
     * @param {Electron.BrowserWindowConstructorOptions | void} options New options. If not present, the same options are going to be used.
     * @returns {HandbookWindow} New Window.
     */
    clone(options) {
        const newWindow = new HandbookWindow(options ? setStandardOptions(options) : this.options)
        newWindow.setExternalId(this.getExternalId())
        newWindow.setBounds(this.getBounds())
        
        if (this.loaded?.url) {
            // Keep current URL
            newWindow.loadURL(this.webContents.getURL(), this.loaded.options)
            newWindow.loaded = this.loaded
        } else if(this.loaded?.filePath) {
            newWindow.loadFile(this.loaded.filePath, this.loaded.options)
        }

        this.isVisible() && newWindow.show()

        Object.keys(this.listenerMap).forEach(eventName => {
            this.listenerMap[eventName].forEach(listener => {
                const cfg = listener.__handbook__
                if (!cfg) {
                    newWindow.on(eventName, listener)
                } else if (cfg.prepend) {
                    cfg.once ? 
                        newWindow.prependOnceListener(eventName, listener) :
                        newWindow.prependListener(eventName, listener)
                } else if (cfg.once) {
                    newWindow.once(eventName, listener)
                } else {
                    throw new Error('Unknown listener type', cfg)
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
    toggleVisibility(ignoreDestroyedError) {
        if (!(ignoreDestroyedError && this.isDestroyed())) {
            super.isVisible() ? this.hide() : this.show()
        }
    }

    /**
     * Toggle maximize.
     * @param {boolean} ignoreDestroyedError Ignore error when trying to check the visibility of a destroyed window.
     */
    toggleMaximize(ignoreDestroyedError) {
        if (!(ignoreDestroyedError && this.isDestroyed())) {
            super.isMaximized() ? this.unmaximize() : this.maximize()
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

    /**
     * Try to close window normally, if it fails, then destroy the window.
     * This method call the "close" event even when destroyed.
     */
    forceClose() {
        this.close()
        if (!this.isDestroyed()) {
            this.emit('close')
            this.destroy()
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

    handleChildWindows() {
        super.webContents
            .on('did-create-window', (window) => {
                const showHandler = () => window.show()
                const hideHandler = () => window.hide()
                super.on('show', showHandler)
                super.on('hide', hideHandler)

                window.on('close', () => {
                    super.off('show', showHandler)
                    super.off('hide', hideHandler)
                })

                contextMenu({ window: window })
                fixUserAgent(window)
            })
            .setWindowOpenHandler(() => {
                return {
                    action: 'allow',
                    overrideBrowserWindowOptions: {
                        alwaysOnTop: true,
                        backgroundColor: Storage.getSettings(WindowSettings.BACKGROUND_COLOR),
                        minimizable: false,
                        enableLargerThanScreen: true,
                        skipTaskbar: true
                    }
                }
            })
    }

    registerDefaultEventListeners() {
        super.on('move', setCancelableListener(e => this.emit('custom-moved', e), HandbookWindow.DEFAULT_INTERVAL))
        super.on('resize', setCancelableListener(e => this.emit('custom-resized', e), HandbookWindow.DEFAULT_INTERVAL))

        // As these events are asynchronous and delayed, they can occur after the window is destroyed.
        super.on('custom-moved', this.boundsListener)
        super.on('custom-resized', this.boundsListener)
    
        super.on('focus', () => this.setOpacity(Storage.getSettings(WindowSettings.FOCUS_OPACITY) / 100))
        super.on('blur', () => this.setOpacity(Storage.getSettings(WindowSettings.BLUR_OPACITY) / 100))

        super.on('show', e => this.emit('state-change', ...['show', e]))
        super.on('hide', e => this.emit('state-change', ...['hide', e]))
        super.on('closed', e => this.emit('state-change', ...['closed', e]))

        // Workaround to only capture user made events 
        // otherwise the electron listeners will be tracked during the construction

        this.on = (event, listener) => {
            this.trackListener(event, listener)
            return super.on(event, listener)
        }

        this.off = (event, listener) => {
            this.untrackListener(event, listener)
            return super.off(event, listener)
        }
    
        this.once = (event, listener) => {
            const onceListener = (...args) => {
                this.off(event, onceListener)
                listener(...args)
            }
            listener.__handbook__ = { once: true }
            this.trackListener(event, listener)
            return super.once(event, onceListener)
        }

        this.prependListener = (event, listener) => {
            listener.__handbook__ = { prepend: true }
            this.trackListener(event, listener)
            return super.prependListener(event, listener)
        }

        this.prependOnceListener = (event, listener) => {
            const onceListener = (...args) => {
                this.off(event, onceListener)
                listener(...args)
            }
            onceListener.__handbook__ = { once: true, prepend: true }
            this.trackListener(event, listener)
            return super.prependOnceListener(event, onceListener)
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
 * Fix the window userAgent removing the app tag. Some websites disallow features based on this.
 * @param {BrowserWindow} window 
 */
function fixUserAgent(window) {
    window.webContents.setUserAgent(window.webContents.getUserAgent().replace(/\shandbook[^\s]+/g, ''))
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
    options.enableLargerThanScreen = true
    options.skipTaskbar = true
    if (!options.webPreferences) { options.webPreferences = {} }
    options.webPreferences.preload = path.join(__dirname, 'windowPreload.js')
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