import { BaseWindow, screen } from 'electron'
import Storage from './Storage.js'
import { Settings } from './config/Constants.js'
import Findbar from 'electron-findbar'
import { getAcceleratorByEvent } from './util/EventKeyCapture.js'
import EventEmitter from 'node:events'
import NavManager from './NavManager.js'
import debounce from './util/Debounce.js'

/** @typedef {import('./Page.js').default} Page */

class WindowManager extends EventEmitter { // TODO: Error on close

    /** @type {number} */
    static NAVBAR_HEIGHT = 40
    
    /** @type {Electron.BaseWindow} */
    #rawWindow = null

    /** @type {Electron.WebContentsView} */
    #navView = null

    /** @type {Electron.WebContentsView} */
    #currentView = null

    /** @type {() => Page} */
    #currentPageProvider = null

    /** @const {number} */
    static #CANCELABLE_INTERVAL = 200

    constructor(currentPageProvider) {
        super()
        if (currentPageProvider === null || currentPageProvider === void 0) {
            throw new Error("WindowManager requires a currentPageProvider function")
        }
        NavManager.initialize()
        this.#registerInstanceEvents()
        this.#currentPageProvider = currentPageProvider
    }

    getRawWindow(createIfNotExists = true) {
        if (!this.#rawWindow && createIfNotExists) { this.#createWindow() }
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
        this.forceClose(false)
        this.#createWindow()
        this.#currentView = null
        this.updateView(isVisible)
    }

    #unbindWindow() {
        this.#rawWindow.removeAllListeners()
        this.#rawWindow = null
    }

    /**
     * Update the current view with a new one.
     * @param {boolean} show Whether to show the window after updating the view.
     */
    updateView(show = false) {
        const page = this.#getCurrentPage()
        const newView = page.getView().rawView

        if (newView === this.#currentView) { return }

        this.#unbindView()
        this.#currentView = newView

        this.#setupNavViewForPage(page) 

        const bounds = page.getPageBounds()
        this.#setBounds(bounds, newView)

        this.#navView && this.#rawWindow.contentView.addChildView(this.#navView)
        if (newView.webContents.isLoading()) {
            newView.webContents.prependOnceListener('dom-ready', () => {
                if (newView !== this.#currentView) { return } // View changed while loading
                this.#rawWindow.contentView.addChildView(newView)
            })
        } else {
            this.#rawWindow.contentView.addChildView(newView)
        }

        if (!newView.webContents._isViewEventsRegistered) {
            newView.webContents._isViewEventsRegistered = true
            this.#registerWebContentsEvents(newView.webContents)
            this.#buildViewFindbar(newView)
        }
        
        show && this.show()
    }

    #unbindView() {
        if (this.#rawWindow) {
            if (!this.#currentView) { return }
            this.#currentView.emit('hide')
            this.#rawWindow.contentView.removeChildView(this.#currentView)
            this.#currentView = null
        }
    }

    /**
     * 
     * @param {Page} page 
     * @returns 
     */
    #setupNavViewForPage(page) {
        const navManager = NavManager.getInstance()
        if (!Storage.getSettings(Settings.SHOW_FRAME)) {
            if (this.#navView) {
                this.#rawWindow.contentView.removeChildView(this.#navView)
                this.#navView = null
            }
            navManager.close()
            return
        }

        if (!navManager.hasView()) {
            this.#navView = navManager.createView()
        }

        navManager.changeView(page.getLabel(), page.getUrl(), page.getView().rawView)
    }

    /**
     * Build findbar for the given view.
     * @param {Electron.WebContentsView} view 
     */
    #buildViewFindbar(view) {
        const findbar = Findbar.from(this.#rawWindow, view.webContents)
        findbar.followVisibilityEvents(false)

        findbar.setWindowOptions({ alwaysOnTop: true })

        findbar.setWindowHandler(bar => {
            const showCascade = () => bar.isVisible() || bar.show()
            const hideCascade = () => bar.isVisible() && bar.hide()
        
            bar.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
            bar.prependListener('focus', () => this.getRawWindow().emit('modal-focus'))
            bar.prependListener('blur', () => this.getRawWindow().emit('modal-blur'))
            bar.once('closed', () => {
                view.removeListener('show', showCascade)
                view.removeListener('hide', hideCascade)
            })
            view.prependListener('show', showCascade)
            view.prependListener('hide', hideCascade)
        })
    }

    #setBounds(bounds, view = this.#currentView, isFullScreen = false) {
        if (this.#navView && !isFullScreen) {
            this.#navView.setBounds({ x: 0, y: 0, width: bounds.width, height: WindowManager.NAVBAR_HEIGHT })
            view.setBounds({ x: 0, y: WindowManager.NAVBAR_HEIGHT, width: bounds.width, height: bounds.height - WindowManager.NAVBAR_HEIGHT })
        } else {
            view.setBounds({ x: 0, y: 0, width: bounds.width, height: bounds.height })
        }
        this.getRawWindow().setBounds(bounds)
    }

    #toggleNavbar(visible) {
        const view = this.#currentView
        const bounds = this.#rawWindow.getBounds()

        if (visible) {
            this.#navView.setBounds({ x: 0, y: 0, width: bounds.width, height: WindowManager.NAVBAR_HEIGHT })
            view.setBounds({ x: 0, y: WindowManager.NAVBAR_HEIGHT, width: bounds.width, height: bounds.height - WindowManager.NAVBAR_HEIGHT })
        } else {
            view.setBounds({ x: 0, y: 0, width: bounds.width, height: bounds.height })
        }
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
    forceClose(closePage = true) {
        const win = this.#rawWindow
        win.close()
        if (!win.isDestroyed()) {
            win.emit('close')
            win.destroy()
        }
        closePage && this.#getCurrentPage().close()
        NavManager.getInstance().close()
    }

    /**
     * Ensure the window title bar is visible (not off-screen at the top)
     * @param {BaseWindow} win 
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
        this.on('window-moved', () => {
            this.#ensureWindowVisible(this.#rawWindow)
            this.#saveBounds()
        })
        this.on('window-resized', () => this.#saveBounds())

        this.on('state-change', (state) => {
            console.debug(`WindowManager: State changed: ${state}`)
        })
    }

    /**
     * Register web contents events.
     * @param {Electron.WebContents} webContents 
     */
    #registerWebContentsEvents(webContents) {
        this.#registerStateChangeEvent(webContents, 'mute-status-changed')
        this.#registerStateChangeEvent(webContents, 'destroyed', 'view-destroyed')
        
        webContents.on('before-input-event', (e, input) => {
            if (input.type !== 'keyDown') { return }
            if (!(input.control || input.alt || input.meta || input.shift)) { return }

            const hideShortcut = Storage.getSettings(Settings.HIDE_SHORTCUT)
            if (!hideShortcut) { return }
            
            const accelerator = getAcceleratorByEvent(input)
            if (accelerator === hideShortcut) {
                e.preventDefault()
                this.hide()
            }
        })

        webContents.on('enter-html-full-screen', () => {
            console.debug('Entering fullscreen, hiding navbar')
            this.#rawWindow.isFullScreenable() && this.#toggleNavbar(false)
        })

        webContents.on('leave-html-full-screen', () => {
            console.debug('Leaving fullscreen, restoring navbar')
            this.#rawWindow.isFullScreenable() && this.#toggleNavbar(true)
        })
    }

    /**
     * Register standard window events.
     * @param {BaseWindow} win 
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
            const view = this.#currentView
            if (!view) { throw new Error('No view to resize.') }
            const size = win.getSize()
            if (this.#navView) {
                this.#navView.setBounds({ x: 0, y: 0, width: size[0], height: WindowManager.NAVBAR_HEIGHT })
                view.setBounds({ x: 0, y: WindowManager.NAVBAR_HEIGHT, width: size[0], height: size[1] - WindowManager.NAVBAR_HEIGHT })
            } else {
                view.setBounds({ x: 0, y: 0, width: size[0], height: size[1] })
            }
        })
        win.on('closed', () => { this.#unbindWindow() })

        win.on('show', () => this.#currentView?.emit('show'))
        win.on('hide', () => this.#currentView?.emit('hide'))

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
        // options.icon = Path.LOGO
        options.frame = false
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

export default (() => {
    /** @type {WindowManager} */ let instance
    return {
        initialize: (currentPageProvider, debug) => instance ?? (instance = new WindowManager(currentPageProvider, debug)),
        getInstance: () => instance,
        isInitialized: () => !!instance
    }
})()