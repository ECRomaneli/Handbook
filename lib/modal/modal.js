import { BrowserWindow, ipcMain } from "electron"

/**
 * @typedef {Object} ModalOptions
 * @property {string} [filePath] - File path to be loaded in the modal. MUST be provided during the construction and/or overriden during the open
 * @property {number} [parent] - Parent window. Used to track position and visibility. If not available, the modal will be shown on the center of the screen
 * @property {boolean} [disableParentEvents=false] - Disable parent events when modal is open. Default is false
 * @property {boolean} [lockModalToWindow=false] - Lock the modal to the parent window. Default is false
 */

class Modal {
    static #MOVEMENT_TIMEOUT = 200

    /** @type {BrowserWindow} */
    #window

    /** @type {{parentBounds: Electron.Rectangle, modalBounds: Electron.Rectangle} => Electron.Rectangle} */
    #boundsHandler = Modal.#setDefaultBounds

    /** @param {Electron.BrowserWindowConstructorOptions} */
    #customOptions

    /** @type {(modalWindow: BrowserWindow) => void} */
    #windowHandler

    /** @type {ModalOptions} */
    #modalOptions

    /**
     * Construct modal.
     * @param {ModalOptions} modalOptions
     */
    constructor (modalOptions) {
        this.#modalOptions = modalOptions
    }

    /**
     * Open the modal. If the modal is already opened, focus it.
     * @param {ModalOptions} [overrideModalOptions] Override options. If no file path was provided during the construction, it MUST be provided here.
     */
    open(overrideModalOptions) {
        if (this.#window) {
            this.#window.focus()
            return
        }
        const modalOptions = { ...this.#modalOptions, ...overrideModalOptions }
        
        this.#window = new BrowserWindow(Modal.#mergeStandardOptions(this.#customOptions, modalOptions.parent))

        if (modalOptions.parent !== void 0) {
            this.#updateBounds(modalOptions.parent)
            this.#registerListeners(modalOptions.parent, modalOptions.lockModalToWindow, modalOptions.disableParentEvents)
        }

        this.#windowHandler && this.#windowHandler(this.#window)
        this.#window.loadFile(modalOptions.filePath)
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
     * @param {Electron.BaseWindow} parent Parent window
     * @param {boolean} [lockModalToWindow=false] Lock the modal to the parent window. Default is false
     * @param {boolean} [disableParentEvents=false] Disable parent events when modal is open. Default is false
     */
    #registerListeners(parent, lockModalToWindow = false, disableParentEvents = false) {
        // Track BOTH the origin AND last update time for each origin separately
        const moveState = {
            origin: null,
            lastUpdate: 0
        }

        const exclusiveMove = (origin, fn) => () => {
            const now = Date.now()

            if (moveState.origin === origin || (now - moveState.lastUpdate) > Modal.#MOVEMENT_TIMEOUT) {
                moveState.origin = origin
                moveState.lastUpdate = now
                fn.call(this, parent)
            }
        }

        const boundsHandler = exclusiveMove('modal', this.#updateBounds)
        const parentBoundsHandler = exclusiveMove('parent', this.#updateParentBounds)
        
        const showCascade = () => this.#window.isVisible() || this.#window.show()
        const hideCascade = () => this.#window.isVisible() && this.#window.hide()
    
        if (disableParentEvents) {
            this.#window.prependListener('close', () => { parent.setEnabled(true) })
            this.#window.prependListener('show', () => { parent.setEnabled(false) })
        }
    
        this.#window.prependListener('focus', () => { parent.emit('modal-focus', this) })
        this.#window.prependListener('blur',  () => { parent.emit('modal-blur', this) })
        this.#window.prependListener('close', () => { parent.emit('modal-close', this) })
        this.#window.prependListener('show',  () => { parent.emit('modal-show', this) })
        
        this.#customOptions.resizable && this.#window.prependListener('resize', parentBoundsHandler)
        this.#customOptions.movable && lockModalToWindow && this.#window.prependListener('move', parentBoundsHandler)
    
        parent.prependListener('show', showCascade)
        parent.prependListener('hide', hideCascade)
        disableParentEvents || parent.prependListener('resize', boundsHandler)
        disableParentEvents || parent.prependListener('move', boundsHandler)
    
        this.#window.once('close', () => {
            parent.off('show', showCascade)
            parent.off('hide', hideCascade)
            disableParentEvents || parent.off('resize', boundsHandler)
            disableParentEvents || parent.off('move', boundsHandler)
            this.#window = void 0
        })
    }

    /**
     * @param {Electron.BaseWindow} parent 
     */
    #updateBounds(parent) {
        const oldBounds = this.#window.getBounds()
        const newBounds = this.#boundsHandler(parent.getBounds(), oldBounds)
        if (newBounds.width === void 0) { newBounds.width = oldBounds.width }
        if (newBounds.height === void 0) { newBounds.height = oldBounds.height }
        Modal.boundsChanged(oldBounds, newBounds) && this.#window.setBounds(newBounds)
    }

    #updateParentBounds(parent) {
        const parentBounds = parent.getBounds()
        const newModalBounds = this.#window.getBounds()
        const oldModalBounds = this.#boundsHandler(parentBounds, newModalBounds)

        Modal.boundsChanged(oldModalBounds, newModalBounds) && parent.setBounds({
            x: parentBounds.x + (newModalBounds.x - oldModalBounds.x),
            y: parentBounds.y + (newModalBounds.y - oldModalBounds.y),
            width: parentBounds.width,
            height: parentBounds.height
        })
    }

    static boundsChanged(oldBounds, newBounds) {
        return  oldBounds.x !== newBounds.x || 
                oldBounds.y !== newBounds.y ||
                oldBounds.width !== newBounds.width || 
                oldBounds.height !== newBounds.height
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