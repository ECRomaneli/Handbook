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

    /** @type {Boolean} */
    #IS_DARWIN = process.platform === 'darwin'

    /** @type {Function[]} */
    #ipcListeners = []

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
        if (this.isOpen()) { this.#window.focus(); return }

        const modalOptions = { ...this.#modalOptions, ...overrideModalOptions }
        
        try {
            if (!modalOptions.filePath) {
                throw new Error('File path is required to open the modal')
            }
            
            this.#window = new BrowserWindow(Modal.#mergeStandardOptions(this.#customOptions, this.#IS_DARWIN ? null : modalOptions.parent))
            this.#windowHandler && this.#windowHandler(this.#window)

            if (modalOptions.parent !== void 0 && modalOptions.parent !== null) {
                this.#updateBounds(modalOptions.parent)
                this.#registerListeners(modalOptions.parent, modalOptions.lockModalToWindow, modalOptions.disableParentEvents)
            }
            
            this.#window.loadFile(modalOptions.filePath)
        } catch (err) {
            this.#window?.destroy()
            console.error('Failed to open modal:', err)
            throw err
        }
    }

    /**
     * Close the modal.
     */
    close() {
        if (!this.isOpen()) { return }

        this.#window.once('closed', () => {
            try { this.#ipcListeners.forEach(l => ipcMain.off(l.eventName, l)) }
            catch (err) { console.error('Error cleaning up IPC listeners:', err) }
            finally { this.#ipcListeners = [] }
        })

        this.#window.close()
    }

    /**
     * Whether the modal is opened.
     * @returns {boolean} True, if the modal is open. Otherwise, false.
     */
    isOpen() {
        return this.#window && !this.#window.isDestroyed()
    }

    /**
     * Whether the modal is focused. If the modal is closed, false will be returned.
     * @returns {boolean} True, if the modal is focused. Otherwise, false.
     */
    isFocused() {
        return this.#window?.isFocused() === true
    }

    /**
     * Whether the modal is visible to the user in the foreground of the app. If the modal is closed, false will be returned.
     * @returns {boolean} True, if the modal is visible. Otherwise, false.
     */
    isVisible() {
        return this.#window?.isVisible() === true
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
                this.#ipcListeners = this.#ipcListeners.slice(this.#ipcListeners.indexOf(wrappedListener), 1)
                listener(...args)
            }
        }
        wrappedListener.eventName = eventName
        ipcMain.on(eventName, wrappedListener)
        this.#ipcListeners.push(wrappedListener)
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
        wrappedListener.eventName = eventName
        this.#ipcListeners.push(wrappedListener)
        return this
    }

    #isThisWindow(webContents) {
        return this.#window.webContents === webContents
    }

    /**
     * Register all event listeners.
     * @param {Electron.BaseWindow} parent Parent window
     * @param {boolean} [lockModalToWindow=false] Lock the modal to the parent window. Default is false
     * @param {boolean} [disableParentEvents=false] Disable parent events when modal is open. Default is false
     */
    #registerListeners(parent, lockModalToWindow = false, disableParentEvents = false) {    
        this.#propagateModalEventsToParent(parent, disableParentEvents)
        this.#registerParentListeners(parent, lockModalToWindow)
    }

    #registerParentListeners(parent, lockModalToWindow) {
        // Track BOTH the origin AND last update time for each origin separately
        const moveState = { origin: null, lastUpdate: 0 }

        const exclusiveMove = (origin, fn) => () => {
            const now = Date.now()

            if (moveState.origin === origin || (now - moveState.lastUpdate) > Modal.#MOVEMENT_TIMEOUT) {
                moveState.origin = origin
                moveState.lastUpdate = now
                this.#window.isDestroyed() || fn.call(this, parent)
                if (this.#window.isDestroyed()) { // TODO: Remove this check when the bug is fixed
                    console.debug('Modal window destroyed, ignoring event')
                }
            }
        }

        const boundsHandler = exclusiveMove('modal', this.#updateBounds)
        const parentBoundsHandler = exclusiveMove('parent', this.#updateParentBounds)
        
        const showCascade = () => this.#window.isVisible() || this.#window.show()
        const hideCascade = () => this.#window.isVisible() && this.#window.hide()
            
        this.#customOptions.resizable && this.#window.prependListener('resize', parentBoundsHandler)
        this.#customOptions.movable && lockModalToWindow && this.#window.prependListener('move', parentBoundsHandler)

        parent.prependListener('resize', boundsHandler)
        parent.prependListener('move', boundsHandler)
        parent.prependListener('show', showCascade)
        parent.prependListener('hide', hideCascade)

        // Workaround for macOS parent infinite loop issue
        if (this.#IS_DARWIN) {
            const focusCascade = () => this.#window?.focus()
            parent.prependListener('focus', focusCascade)
            this.#window.on('closed', () => { parent.off('focus', focusCascade) })
        }
    
        this.#window.on('closed', () => {
            parent.off('resize', boundsHandler)
            parent.off('move', boundsHandler)
            parent.off('show', showCascade)
            parent.off('hide', hideCascade)
            this.#window = void 0
        })
    }

    #propagateModalEventsToParent(parent, disableParentEvents) {
        if (disableParentEvents) {
            let parentEnabled = true
            this.#window.prependListener('closed', () => { parentEnabled || parent.setEnabled(parentEnabled = true)  })
            this.#window.prependListener('show',   () => { parentEnabled && parent.setEnabled(parentEnabled = false) })
        }
    
        this.#window.prependListener('focus',  () => { parent.emit('modal-focus', this)  })
        this.#window.prependListener('blur',   () => { parent.emit('modal-blur', this)   })
        this.#window.prependListener('close',  () => { parent.emit('modal-close', this)  })
        this.#window.prependListener('closed', () => { parent.emit('modal-closed', this) })
        this.#window.prependListener('show',   () => { parent.emit('modal-show', this)   })
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
            x: parentBounds.x + (newModalBounds.x - oldModalBounds.x) | 0,
            y: parentBounds.y + (newModalBounds.y - oldModalBounds.y) | 0,
            width: parentBounds.width,
            height: parentBounds.height
        })
    }

    static boundsChanged(oldBounds, newBounds) {
        return  (oldBounds.x - newBounds.x) | 0 || 
                (oldBounds.y - newBounds.y) | 0 ||
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
        options.fullscreenable = options.fullscreenable ?? false
        options.backgroundColor = '#333'
        if (!options.webPreferences) { options.webPreferences = {} }
        options.webPreferences.nodeIntegration = options.webPreferences.nodeIntegration ?? false
        options.webPreferences.contextIsolation = options.webPreferences.contextIsolation ?? true
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