import { BrowserWindow, clipboard } from 'electron'
import path from 'node:path'
import { Storage } from './storage.js'
import { Settings, Path } from './constants.js'
import { Findbar } from 'electron-findbar'
import contextMenu from 'electron-context-menu'



class HandbookWindow extends BrowserWindow {
    
    /** @const {string} */
    static #BLANK_URL = 'about:blank'

    /** @const {number} */
    static #CANCELABLE_INTERVAL = 200

    /** @type {Electron.BrowserWindowConstructorOptions} */
    #options

    /** @type {string} */
    #externalId

    /** @type {Findbar} */
    #findbar

    /**
     * Create a new Handbook window overriding some options with the standards.
     * @param {Electron.BrowserWindowConstructorOptions | undefined} options
     */
    constructor (options) {
        super (HandbookWindow.#setStandardOptions(options))
        HandbookWindow.#fixUserAgent(this)
        this.#options = options
        this.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
        this.#buildContextMenu()
        this.#registerEvents()
        this.#handleChildWindows(this)
        this.#buildFindbar()
    }

    /**
     * Build window right-click menu.
     */
    #buildContextMenu() {
        contextMenu({
            window: this,
            append: () => [
                { label: 'Window', submenu: [
                    { label: 'Find...', click: () => { this.#findbar.open() } },
                    { label: 'Back', click: () => this.webContents.navigationHistory.goBack() },
                    { label: 'Forward', click: () => this.webContents.navigationHistory.goForward() },
                    { type: 'separator' },
                    { label: 'Refresh', click: () => this.reload() },
                    { label: 'Reload', click: () => this.reset() },
                    { type: 'separator' },
                    { label: 'Copy URL', click: () => clipboard.writeText(this.webContents.getURL()) },
                    { role: 'toggleDevTools' },
                    { type: 'separator' },
                    { label: 'Mute / Unmute', click: () => this.toggleMute() },
                    { label: 'Show / Hide', click: () => this.hide() },
                    { label: 'Close', click: () => this.forceClose() }
                ]}
            ]
        })
    }

    #buildFindbar() {
        this.#findbar = new Findbar(this)

        this.#findbar.setWindowOptions({ alwaysOnTop: true })

        this.#findbar.setWindowHandler(win => {
            win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
            win.prependListener('focus', () => this.emit('findbar-focus'))
            win.prependListener('blur', () => this.emit('findbar-blur'))
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
        if (!this.loaded) { console.warn('Nothing loaded') }
        else if (this.loaded.url) { super.loadURL(this.loaded.url, this.loaded.options) }
        else { super.loadFile(this.loaded.filePath, this.loaded.options) }
    }

    openFindbar() {
        this.#findbar.open()
    }

    closeFindbar() {
        this.#findbar.close()
    }

    toggleFindbar() {
        this.#findbar.isOpen() ? this.#findbar.close() : this.#findbar.open()
    }

    isFindbarFocused() {
        return this.#findbar.isFocused()
    }

    /**
     * Return a new window with the same external ID, URL, bounds, visibility, and listeners.
     * @param {Electron.BrowserWindowConstructorOptions | void} options New options. If not present, the same options are going to be used.
     * @returns {HandbookWindow} New Window.
     */
    clone(options) {
        options = options ? HandbookWindow.#setStandardOptions(options) : this.#options
        options.show = this.isVisible()
        
        const newWindow = new HandbookWindow(options)
        newWindow.setExternalId(this.getExternalId())
        newWindow.setBounds(this.getBounds())
        
        if (this.loaded?.url) {
            // Keep current URL
            newWindow.loadURL(this.webContents.getURL(), this.loaded.options)
            newWindow.loaded = this.loaded
        } else if(this.loaded?.filePath) {
            newWindow.loadFile(this.loaded.filePath, this.loaded.options)
        }

        this.eventNames().forEach(event => {
            const listeners = this.rawListeners(event)
                .filter(l => l._hb || l.listener?._hb)
                .reduce((ls, l) => {
                    const cfg = l._hb || l.listener?._hb
                    cfg.prepend ? ls.prepend.unshift(l) : ls.append.push(l)
                    return ls
                }, { prepend: [], append: [] })
            listeners.prepend.forEach(l => newWindow.prependListener(event, l))
            listeners.append.forEach(l => newWindow.addListener(event, l))
        })

        return newWindow
    }

    /**
     * Whether the window is visible to the user in the foreground of the app.
     * @param {boolean} ignoreDestroyedError Ignore error when the window is destroyed. 
     * @returns {boolean} If the window is visible or not.
     */
    isVisible(ignoreDestroyedError) {
        return !(ignoreDestroyedError && this.isDestroyed()) && super.isVisible()
    }

    /**
     * Return the mute state of the window.
     * @param {boolean} ignoreDestroyedError Ignore error when the window is destroyed. 
     * @returns {boolean} If the audio is muted.
     */
    isMuted(ignoreDestroyedError) {
        return !(ignoreDestroyedError && this.isDestroyed()) && this.webContents.isAudioMuted()
    }

    /**
     * Toggle visibility of the window (show and hide).
     * @param {boolean} ignoreDestroyedError Ignore error when the window is destroyed.
     */
    toggleVisibility(ignoreDestroyedError) {
        if (!(ignoreDestroyedError && this.isDestroyed())) {
            this.isVisible() ? this.hide() : this.show()
        }
    }

    /**
     * Toggle the mute state of the window (mute and unmute).
     * @param {boolean} ignoreDestroyedError Ignore error when the window is destroyed.
     */
    toggleMute(ignoreDestroyedError) {
        if (!(ignoreDestroyedError && this.isDestroyed())) {
            this.webContents.isAudioMuted() ? this.unmute() : this.mute()
        }
    }

    /**
     * Toggle maximize.
     * @param {boolean} ignoreDestroyedError Ignore error when the window is destroyed.
     */
    toggleMaximize(ignoreDestroyedError) {
        if (!(ignoreDestroyedError && this.isDestroyed())) {
            this.isMaximized() ? this.unmaximize() : this.maximize()
        }
    }

    mute() {
        this.webContents.setAudioMuted(true)
        this.emit('muted')
    }

    unmute() {
        this.webContents.setAudioMuted(false)
        this.emit('unmuted')
    }

    getExternalId() {
        return this.#externalId
    }

    setExternalId(externalId) {
        this.#externalId = externalId
    }

    unload() {
        if (this.webContents?.getURL() !== HandbookWindow.#BLANK_URL) {
            this.loadURL(HandbookWindow.#BLANK_URL)
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

    #registerEvents() {
        this.once('ready-to-show', () => this.setBackgroundColor('#fff'))
        this.on('focus', () => this.setOpacity(Storage.getSettings(Settings.FOCUS_OPACITY) / 100))
        this.on('blur', () => this.setOpacity(Storage.getSettings(Settings.BLUR_OPACITY) / 100))
        this.on('findbar-focus', () => this.setOpacity(Storage.getSettings(Settings.FOCUS_OPACITY) / 100))
        this.on('findbar-blur', () => this.setOpacity(Storage.getSettings(Settings.BLUR_OPACITY) / 100))

        this.#registerDelayedEvents()
        this.#registerStateChangeEvent()

        // Workaround to only capture user made events 
        // otherwise the electron listeners will be tracked during the construction
        this.#overrideEventMethods()
    }

    #registerDelayedEvents() {
        this.on('move', createCancelableListener(e => this.emit('custom-moved', e), HandbookWindow.#CANCELABLE_INTERVAL))
        this.on('resize', createCancelableListener(e => this.emit('custom-resized', e), HandbookWindow.#CANCELABLE_INTERVAL))

        // As these events are asynchronous and delayed, they can occur after the window is destroyed.
        this.on('custom-moved', this.#saveBounds)
        this.on('custom-resized', this.#saveBounds)
    }

    #registerStateChangeEvent() {
        this.on('show', e => this.emit('state-change', ...['show', e]))
        this.on('hide', e => this.emit('state-change', ...['hide', e]))
        this.on('muted', e => this.emit('state-change', ...['muted', e]))
        this.on('unmuted', e => this.emit('state-change', ...['unmuted', e]))
        this.on('closed', e => this.emit('state-change', ...['closed', e]))
    }

    #overrideEventMethods() {
        const call = (fn, event, listener, prepend) => {
            if (!listener._hb && !listener.listener?._hb) {
                listener._hb = { prepend: prepend }
            }
            return fn.call(this, event, listener)
        }

        this.on = (e, l) => call(super.on, e, l, false)
        this.once = (e, l) => call(super.once, e, l, false)
        this.addListener = (e, l) => call(super.addListener, e, l, false)
        this.prependListener = (e, l) => call(super.prependListener, e, l, true)
        this.prependOnceListener = (e, l) => call(super.prependOnceListener, e, l, true)
    }

    #saveBounds() {
        if (!this.isDestroyed() && !this.isMaximized()) {
            const windowBounds = this.getBounds()
            Storage.setSharedBounds(windowBounds)
            this.getExternalId() && Storage.setWindowBounds(this.getExternalId(), windowBounds)
        }
    }

    /**
     * Handle child windows.
     * @param {BrowserWindow} window 
     */
    #handleChildWindows(window) {
        window.webContents
            .on('did-create-window', (childWindow) => {
                const showHandler = () => !childWindow.isDestroyed() && childWindow.show()
                const hideHandler = () => !childWindow.isDestroyed() &&  childWindow.hide()
                super.on('show', showHandler)
                super.on('hide', hideHandler)

                childWindow.on('close', () => {
                    super.off('show', showHandler)
                    super.off('hide', hideHandler)
                })

                contextMenu({ window: childWindow })
                HandbookWindow.#fixUserAgent(childWindow)
                childWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
                this.#handleChildWindows(childWindow)
            })
            .setWindowOpenHandler(() => {
                return {
                    action: 'allow',
                    overrideBrowserWindowOptions: {
                        alwaysOnTop: true,
                        minimizable: false,
                        fullscreenable: false,
                        enableLargerThanScreen: true,
                        skipTaskbar: true,
                        webPreferences: {
                            partition: this.#options.webPreferences?.partition
                        }
                    }
                }
            })
    }

    static getLogo() {
        return path.join(Path.ASSETS, 'img', 'icons', 'app', `book.png`)
    }

    /**
     * Fix the window userAgent removing the app tag. Some websites disallow features based on this.
     * @param {BrowserWindow} window 
     */
    static #fixUserAgent(window) {
        window.webContents.setUserAgent(window.webContents.getUserAgent().replace(/\s(H|h)andbook[^\s]+/g, ''))
    }

    /**
     * @param {Electron.BrowserWindowConstructorOptions | undefined} options 
     * @returns {Electron.BrowserWindowConstructorOptions} options
     */
    static #setStandardOptions(options) {
        if (!options) { options = {} }
        options.icon = HandbookWindow.getLogo()
        options.frame = Storage.getSettings(Settings.SHOW_FRAME)
        options.alwaysOnTop = true
        options.backgroundColor = Storage.getSettings(Settings.BACKGROUND_COLOR)
        options.fullscreenable = false
        options.minimizable = false
        options.enableLargerThanScreen = true
        options.skipTaskbar = true
        if (!options.webPreferences) { options.webPreferences = {} }
        options.webPreferences.preload = path.join(Path.WEB, 'preload', 'windowPreload.js')
        return options
    }
}

/**
 * Returns a listener that always cancel the previous call during the cancel timeout.
 * @param {Function} callback Listener to be wrapped.
 * @param {number} cancelTimeout time on which the listener can be canceled.
 * @returns {Function} Cancelable listener.
 */
function createCancelableListener(listener, cancelTimeout) {
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

export { HandbookWindow }