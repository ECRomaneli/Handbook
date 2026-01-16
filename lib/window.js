import { BaseWindow, screen } from 'electron'
import Storage from './storage.js'
import { Settings, Path } from './constants.js'
import Findbar from 'electron-findbar'
import EventEmitter from 'node:events'
import Page from './page.js'

class WindowManager extends EventEmitter {    
    /** @type {Electron.BaseWindow} */
    #rawWindow = null

    /** @type {() => Page} */
    #currentPageProvider = null

    /** @const {number} */
    static #CANCELABLE_INTERVAL = 200

    static #PAGE_INDEX = 0

    constructor(currentPageProvider) {
        super()
        if (currentPageProvider === null || currentPageProvider === void 0) {
            throw new Error("WindowManager requires a currentPageProvider function")
        }
        this.#registerInstanceEvents()
        this.#currentPageProvider = currentPageProvider
    }

    getRawWindow() {
        if (!this.#rawWindow) { this.#createWindow() }
        return this.#rawWindow
    }

    /**
     * Get the current page.
     * @returns {Page} Current page.
     */
    #getCurrentPage() {
        const page = this.#currentPageProvider()
        if (!page) { throw new Error('No current page available.') }
        return page
    }

    #saveBounds() {
        if (this.#rawWindow && !this.#rawWindow.isMaximized()) {
            const windowBounds = this.#rawWindow.getBounds()
            const page = this.#getCurrentPage()
            Storage.setSharedBounds(windowBounds)
            page.getId() && Storage.setWindowBounds(page.getId(), windowBounds)
        }
    }

    #createWindow() {
        this.#rawWindow = new BaseWindow(WindowManager.#setStandardOptions())
        this.#rawWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
        this.#registerWindowEvents(this.#rawWindow)
    }

    recreateWindow() {
        const isVisible = this.isVisible()
        this.#rawWindow.removeAllListeners()
        this.forceClose()
        this.#createWindow()
        this.updateView(isVisible)
    }

    #unbindWindow() {
        this.#rawWindow.removeAllListeners()
        this.#currentPageProvider()?.close()
        this.#rawWindow = null
    }

    /**
     * Update the current view with a new one.
     * @param {Electron.WebContentsView} newView 
     */
    updateView(show = false) {
        this.#unbindView()
        this.#bindView()
        show && this.show()
    }

    #bindView(page = this.#getCurrentPage()) {
        const newView = page.getView().rawView
        const bounds = page.getPageBounds()

        this.getRawWindow().contentView.addChildView(newView, WindowManager.#PAGE_INDEX)
        this.#setBounds(bounds, newView)

        this.emit('view-updated', newView)
    }

    #unbindView() {
        if (this.#rawWindow) {
            const oldView = this.#getAttachedView()
            oldView && this.#rawWindow.contentView.removeChildView(oldView)
        }
    }

    #setBounds(bounds, view = this.#getAttachedView()) {
        view.setBounds({ x: 0, y: 0, width: bounds.width, height: bounds.height })
        this.#rawWindow.setBounds(bounds)
    }

    #getAttachedView() {
        return this.#rawWindow.contentView.children[WindowManager.#PAGE_INDEX]
    }

    resetBounds() {
        const page = this.#getCurrentPage()
        this.#setBounds(page.getDefaultBounds(true))
    }

    isMaximized() {
        return this.#rawWindow.isMaximized()
    }

    toggleMaximize() {
        this.isMaximized() ? this.#rawWindow.unmaximize() : this.#rawWindow.maximize()
    }

    isVisible(ignoreDestroyedError = false) {
        if (ignoreDestroyedError && !this.#rawWindow) { return false }
        return this.#rawWindow.isVisible()
    }

    toggleVisibility() {
        this.#rawWindow?.isVisible() ? this.hide() : this.show()
    }

    show() { this.getRawWindow().show() }
    hide() { this.getRawWindow().hide() }    

    /**
     * Hide page's window or if page is not persistent, (force) close the window.
     */
    suspendWindow() {
        const page = this.#currentPageProvider()
        if (page.shouldPersist()) {
            this.#rawWindow.isMaximized() && this.toggleMaximize()
            this.#rawWindow.hide()
        } else {
            page.close()
        }
    }

    /**
     * Try to close window normally, if it fails, then destroy the window.
     * This method call the "close" event even when destroyed.
     */
    forceClose() {
        const win = this.#rawWindow
        win.close()
        if (!win.isDestroyed()) {
            win.emit('close')
            win.destroy()
        }
    }

    /**
     * Ensure the window title bar is visible (not off-screen at the top)
     * @param {BrowserWindow} win 
     */
    #ensureWindowVisible(win) {
        if (win.isDestroyed() || win.isMaximized() || win.isFullScreen()) { return }
        
        const bounds = win.getBounds()
        const display = screen.getDisplayNearestPoint({ x: bounds.x, y: bounds.y })
        
        // Minimum pixels of window that should be visible at the top
        const minVisibleHeight = 30
        
        // Check if window is too far up (title bar not accessible)
        if (bounds.y < display.workArea.y) {
            win.setPosition(bounds.x, display.workArea.y)
        }
        
        // Check if window is too far down (completely below screen)
        const maxY = display.workArea.y + display.workArea.height - minVisibleHeight
        if (bounds.y > maxY) {
            win.setPosition(bounds.x, maxY)
        }
    }

    /**
     * Register instance events.
     */
    #registerInstanceEvents() {
        this.on('window-moved', () => this.#ensureWindowVisible(this.#rawWindow))
        this.on('window-moved', () => this.#saveBounds())
        this.on('window-resized', () => this.#saveBounds())

        this.on('view-updated', /** @param {Electron.WebContentsView} newView */ newView => {
            if (newView._isStateChangeRegistered) { return }
            newView._isStateChangeRegistered = true
            this.#registerStateChangeEvent(newView.webContents, 'muted')
            this.#registerStateChangeEvent(newView.webContents, 'unmuted')
            this.#registerStateChangeEvent(newView.webContents, 'destroyed', 'view-destroyed')
        })

        this.on('state-change', (state) => {
            console.debug(`WindowManager: State changed: ${state}`)
        })
    }

    /**
     * Register standard window events.
     * @param {Electron.BrowserWindow} win 
     */
    #registerWindowEvents(win) {
        win.on('modal-focus', () => win.setOpacity(Storage.getSettings(Settings.FOCUS_OPACITY) / 100))
        win.on('modal-blur', () => win.setOpacity(Storage.getSettings(Settings.BLUR_OPACITY) / 100))
        win.on('focus', () => win.setOpacity(Storage.getSettings(Settings.FOCUS_OPACITY) / 100))
        win.on('blur', () => {
            if (win.isMaximized() && Storage.getSettings(Settings.KEEP_OPACITY_WHEN_MAXIMIZED)) {
                win.setOpacity(Storage.getSettings(Settings.FOCUS_OPACITY) / 100)
            } else {
                win.setOpacity(Storage.getSettings(Settings.BLUR_OPACITY) / 100)
            }
        })
        win.on('resize', () => {
            const view = this.#getAttachedView()
            if (!view) { throw new Error('No view to resize.') }
            const size = win.getSize()
            view.setBounds({ x: 0, y: 0, width: size[0], height: size[1] })
        })
        win.on('closed', () => { this.#unbindWindow() })

        // Register state change events
        this.#registerStateChangeEvent(win, 'show')
        this.#registerStateChangeEvent(win, 'hide')
        this.#registerStateChangeEvent(win, 'closed')

        // As these events are asynchronous and delayed, they can occur after the window is destroyed.
        win.on('move', debounce(e => this.emit('window-moved', e), WindowManager.#CANCELABLE_INTERVAL))
        win.on('resize', debounce(e => this.emit('window-resized', e), WindowManager.#CANCELABLE_INTERVAL))
    }

    /**
     * Register a state change event from an event emitter.
     * @param {EventEmitter} eventEmitter Event emitter where to register the event.
     * @param {string} event Event name.
     * @param {string} stateName Name of the state to emit. Defaults to event name.
     */
    #registerStateChangeEvent(eventEmitter, event, stateName = event) {
        eventEmitter.on(event, e => this.emit('state-change', stateName, e))
    }

    /**
     * @param {Electron.BaseWindowConstructorOptions | undefined} options 
     * @returns {Electron.BaseWindowConstructorOptions} options
     */
    static #setStandardOptions(options = {}) {
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
        options.show = false
        return options
    }
}

/**
 * Returns a listener that always cancel the previous call during the cancel timeout.
 * @param {Function} listener Listener to be wrapped.
 * @param {number} cancelTimeout time on which the listener can be canceled.
 * @returns {Function} Cancelable listener.
 */
function debounce(listener, cancelTimeout) {
    let timerId
    return (e) => {
        clearTimeout(timerId)
        timerId = setTimeout(() => { listener(e) }, cancelTimeout)
    }
}

export default (() => {
    /** @type {WindowManager} */ let instance
    return {
        initialize: (currentPageProvider, debug) => instance ?? (instance = new WindowManager(currentPageProvider, debug)),
        getInstance: () => instance,
        isInitialized: () => !!instance
    }
})()