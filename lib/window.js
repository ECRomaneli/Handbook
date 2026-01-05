import { BrowserWindow, clipboard, dialog, shell, screen } from 'electron'
import path from 'node:path'
import Storage from './storage.js'
import { Settings, Path } from './constants.js'
import Findbar from 'electron-findbar'
import contextMenu from 'electron-context-menu'
import { getAcceleratorByEvent } from './util/eventKeyCapture.js'
import { writeFileSync } from 'node:fs'
import { getExtensionForMime, getFiltersForMime } from './util/mimeTypes.js';
import EventEmitter from 'node:events'
// import Page from "./page.js"

class WindowManager extends EventEmitter {    
    /** @type {Electron.BaseWindow} */
    rawWindow = null

    /** @type {() => Page} */
    #currentPageProvider = null

    /** @const {number} */
    static #CANCELABLE_INTERVAL = 200

    static #PAGE_INDEX = 0

    constructor(currentPageProvider) {
        super()
        this.#currentPageProvider = currentPageProvider
        const options = WindowManager.#setStandardOptions()
        this.rawWindow = new BaseWindow(options)
        this.rawWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
        this.#registerEvents(this.rawWindow)
        // const viewTest = new WebContentsView()
        // viewTest.webContents.loadURL('https://github.com/electron/electron')
        // const b = this.rawWindow.getBounds()
        // viewTest.setBounds({ x: 0, y: 0, width: b.width, height: b.height })
        // this.rawWindow.contentView.addChildView(viewTest)
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
     * Update the current view with a new one.
     * @param {Electron.WebContentsView} newView 
     */
    updateView(newView, bounds) {
        this.unbindView(false)
        this.rawWindow.contentView.addChildView(newView, WindowManager.#PAGE_INDEX)
        newView.setBounds({ x: 0, y: 0, width: bounds.width, height: bounds.height })
        this.setBounds(bounds)
        
        this.emit('view-updated', newView)
    }

    unbindView(hideWindow = true) {
        const oldView = this.rawWindow.contentView.children[WindowManager.#PAGE_INDEX]
        oldView && this.rawWindow.contentView.removeChildView(oldView)
        hideWindow && this.hide()
    }

    isMaximized() {
        return this.rawWindow.isMaximized()
    }

    toggleMaximize() {
        this.isMaximized() ? this.rawWindow.unmaximize() : this.rawWindow.maximize()
    }

    isVisible(ignoreDestroyedError = false) {
        if (ignoreDestroyedError && this.rawWindow.isDestroyed()) { return false }
        return this.rawWindow.isVisible()
    }

    toggleVisibility() {
        this.rawWindow.isVisible() ? this.rawWindow.hide() : this.rawWindow.show()
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
    getBounds() { return this.rawWindow.getBounds() }
    setBounds(bounds) { this.rawWindow.setBounds(bounds) }
    isFocused() { return this.rawWindow.isFocused() }
    focus() { this.rawWindow.focus() }

    

    /**
     * Hide page's window or if page is not persistent, (force) close the window.
     */
    suspendWindow() {
        const page = this.#currentPageProvider()
        if (page.shouldPersist()) {
            this.rawWindow.isMaximized() && this.toggleMaximize()
            this.rawWindow.hide()
        } else {
            page.close()
        }
    }

    closeWindow() {
        // TODO: check if window can be closed, verify if it is still needed
        const page = this.#currentPageProvider()
        page.close()
    }

    /**
     * Try to close window normally, if it fails, then destroy the window.
     * This method call the "close" event even when destroyed.
     */
    forceClose() {
        // TODO: check if window can be closed, verify if it is still needed
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
            const view = win.contentView.children[win.contentView.children.length - 1]
            if (!view) { return }
            const size = win.getSize()
            view.setBounds({ x: 0, y: 0, width: size[0], height: size[1] })
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
        this.bus.on('window-moved', () => this.#ensureWindowVisible(win))
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
     * Register state change events.
     * @param {Electron.BrowserWindow} win 
     */
    #registerStateChangeEvent(win) {
        const registerStateEvent = (event) => {
            win.on(event, e => {
                this.emit(event, e)
                this.emit('state-change', event, e)
            })
        }
        
        registerStateEvent('show')
        registerStateEvent('hide')
        registerStateEvent('closed')

        this.on('view-updated', /** @param {Electron.WebContentsView} newView */ newView => {
            const propagateMuted = () => this.emit('state-change', 'view-muted')
            const propagateUnmuted = () => this.emit('state-change', 'view-unmuted')

            newView.on('bounds-changed', () => {
                this.setParentBounds(newView.getBounds())
            })
            newView.webContents.on('muted', propagateMuted)
            newView.webContents.on('unmuted', propagateUnmuted)
            newView.webContents.on('destroyed', () => this.emit('state-change', 'view-destroyed'))
        })

        this.on('state-change', (state) => {
            console.debug(`WindowManager: State changed: ${state}`)
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
function createCancelableListener(listener, cancelTimeout) {
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