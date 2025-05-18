import { BrowserWindow, ipcMain } from "electron"

class Modal {
    /** @type {Electron.BaseWindow} */
    #parent

    /** @type {BrowserWindow} */
    #window

    /** @type {{parentBounds: Electron.Rectangle, modalBounds: Electron.Rectangle} => Electron.Rectangle} */
    #boundsHandler = Modal.#setDefaultBounds

    /** @param {Electron.BrowserWindowConstructorOptions} */
    #customOptions

    /** @type {(modalWindow: BrowserWindow) => void} */
    #windowHandler

    /** @type {String} */
    #filePath

    /**
     * Construct modal.
     * @param {string} filePath File path to load.
     * @param {Electron.BaseWindow | void} parent Parent window.
     */
    constructor (filePath, parent) {
        this.#filePath = filePath
        this.#parent = parent
    }

    /**
     * Open the modal. If the modal is already opened, focus it.
     * @param {Electron.BaseWindow | void} overrideParent Override parent window if needed.
     */
    open(overrideParent) {
        if (this.#window) {
            this.#window.focus()
            return
        }
        const parent = overrideParent ?? this.#parent
        
        this.#window = new BrowserWindow(Modal.#mergeStandardOptions(this.#customOptions, parent))
        this.#registerListeners(parent)
        this.#updateBounds(parent)

        this.#windowHandler && this.#windowHandler(this.#window)
        
        this.#window.loadFile(this.#filePath)
    }

    /**
     * Close the modal.
     */
    close() {
        this.#window?.close()
    }

    /**
     * Whether the modal is opened.
     * @returns {boolean} True, if the modal is open. Otherwise, false.
     */
    isOpen() {
        return !!this.#window && !this.#window.isDestroyed()
    }

    /**
     * Whether the modal is focused. If the modal is closed, false will be returned.
     * @returns {boolean} True, if the modal is focused. Otherwise, false.
     */
    isFocused() {
        return !!this.#window?.isFocused()
    }

    /**
     * Whether the modal is visible to the user in the foreground of the app. If the modal is closed, false will be returned.
     * @returns {boolean} True, if the modal is visible. Otherwise, false.
     */
    isVisible() {
        return !!this.#window?.isVisible()
    }

    /**
     * Provides a customized set of options to modal window before open. Note
     * that the options below are necessary for the correct functioning and cannot
     * be overridden:
     * - options.parent (value: parentWindow)
     * - options.frame (value: false)
     * - options.transparent (value: true)
     * - options.maximizable (value: false)
     * - options.minimizable (value: false)
     * - options.skipTaskbar (value: true)
     * - options.autoHideMenuBar (value: true)
     * - options.fullscreenable (value: false)
     * - options.webPreferences.nodeIntegration (value: true)
     * - options.webPreferences.contextIsolation (value: false)
     * @param {Electron.BrowserWindowConstructorOptions} customOptions Custom window options.
     */
    setWindowOptions(customOptions) {
        this.#customOptions = customOptions
    }

    /**
     * Set a window handler capable of changing the modal window settings after opening and before loading the content.
     * @param {(modalWindow: BrowserWindow) => void} windowHandler Window handler.
     */
    setWindowHandler(windowHandler) {
        this.#windowHandler = windowHandler
    }

    /**
     * Set a bounds handler to calculate the modal bounds when the parent resizes.
     * @param {{parentBounds: Electron.Rectangle, modalBounds: Electron.Rectangle} => Electron.Rectangle} boundsHandler Bounds handler.
     */
    setBoundsHandler(boundsHandler) {
        this.#boundsHandler = boundsHandler
    }

    sendToRenderer(eventName, ...args) {
            this.isOpen() && this.#window.webContents.send(eventName, ...args)
        }
    
    #isThisWindow(webContents) {
        return this.#window && this.#window.webContents === webContents
    }

    /**
     * Once IPC renderer event.
     * @param {String} eventName 
     * @param {Function} listener 
     * @returns self reference
     */
    onceRenderer(eventName, listener) {
        const wrappedListener = (e, ...args) => {
            if (this.#isThisWindow(e.sender)) {
                ipcMain.removeListener(eventName, wrappedListener)
                listener(...args)
            }
        }
        ipcMain.on(eventName, wrappedListener)
        return this
    }

    /**
     * On IPC renderer event.
     * @param {String} eventName 
     * @param {Function} listener 
     * @returns self reference
     */
    onRenderer(eventName, listener) {
        const wrappedListener = (e, ...args) => { this.#isThisWindow(e.sender) && listener(...args) }
        ipcMain.on(eventName, wrappedListener)
        return this
    }

    /**
     * Register all event listeners.
     * @param {Electron.BaseWindow} parent Parent window.
     */
    #registerListeners(parent) {
        const showCascade = () => this.#window.isVisible() || this.#window.show()
        const hideCascade = () => this.#window.isVisible() && this.#window.hide()
        const boundsHandler = () => { this.#updateBounds(parent) }
        
        parent.prependListener('show', showCascade)
        parent.prependListener('hide', hideCascade)
        parent.prependListener('resize', boundsHandler)
        parent.prependListener('move', boundsHandler)

        this.#window.once('close', () => {
            parent.off('show', showCascade)
            parent.off('hide', hideCascade)
            parent.off('resize', boundsHandler)
            parent.off('move', boundsHandler)
            this.#window = void 0
        })
    }

    #updateBounds(parent) {
        const oldBounds = this.#window.getBounds()
        const newBounds = this.#boundsHandler(parent.getBounds(), oldBounds)
        if (newBounds.width === void 0) { newBounds.width = oldBounds.width }
        if (newBounds.height === void 0) { newBounds.height = oldBounds.height }
        this.#window.setBounds(newBounds)
    }

    /**
     * Merge custom, defaults, and fixed options.
     * @param {Electron.BrowserWindowConstructorOptions} options Custom options.
     * @param {Electron.BaseWindow | void} parent Parent window, if any.
     * @returns {Electron.BrowserWindowConstructorOptions} Merged options.
     */
    static #mergeStandardOptions(options, parent) {
        if (!options) { options = {} }
        options.width = options.width ?? 640
        options.height = options.height ?? 360
        options.resizable = options.resizable ?? false
        options.movable = options.movable ?? false
        options.acceptFirstMouse = options.acceptFirstMouse ?? true
        options.roundedCorners = options.roundedCorners ?? true
        options.parent = parent
        options.autoHideMenuBar = true
        options.frame = false
        options.maximizable = false
        options.minimizable = false
        options.skipTaskbar = true
        options.fullscreenable = false
        if (!options.webPreferences) { options.webPreferences = {} }
        options.webPreferences.nodeIntegration = true
        options.webPreferences.contextIsolation = false
        return options
    }

    /**
     * Set default position.
     * @param {Electron.Rectangle} parentBounds 
     * @param {Electron.Rectangle} modalBounds
     * @returns {x: number, y: number} position.
     */
    static #setDefaultBounds(parentBounds, modalBounds) {
        return {
            x: parentBounds.x + (parentBounds.width / 2) - (modalBounds.width / 2),
            y: parentBounds.y + 20
        }
    }
}

export default Modal