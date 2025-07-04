import { BrowserWindow, clipboard, dialog, shell } from 'electron'
import path from 'node:path'
import Storage from './storage.js'
import { Settings, Path } from './constants.js'
import Findbar from 'electron-findbar'
import contextMenu from 'electron-context-menu'
import Manager from './manager.js'
import { getAcceleratorByEvent } from './util/event-key-capture.js'
import { writeFileSync } from 'node:fs'
import { getExtensionForMime, getFiltersForMime } from './util/mimeTypes.js';

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
            append: () => {
                return [
                {
                    label: 'Save...', 
                    visible: this.webContents.getURL().startsWith('data:'),
                    click: async () => { HandbookWindow.#saveBase64ToFile(this.webContents.getURL()) }
                },
                ...Manager.getInstance().getWindowContextMenu()
            ]}
        })
    }

    #buildFindbar() {
        this.#findbar = new Findbar(this)

        this.#findbar.setWindowOptions({ alwaysOnTop: true })

        this.#findbar.setWindowHandler(win => {
            win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
            win.prependListener('focus', () => this.emit('modal-focus'))
            win.prependListener('blur', () => this.emit('modal-blur'))
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
        this.loaded = { filePath, options: options }
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

        this.isMuted() && newWindow.mute()

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
        // const actions = [
        //     { accelerator: Storage.getSettings(Settings.HIDE_SHORTCUT), action: this.toggleVisibility.bind(this) },
        //     { accelerator: OS.IS_DARWIN ? 'Meta+F' : 'Control+F', action: this.toggleFindbar.bind(this) }
        // ]

        this.once('ready-to-show', () => this.setBackgroundColor('#eee'))
        this.on('focus', () => this.setOpacity(Storage.getSettings(Settings.FOCUS_OPACITY) / 100))
        this.on('blur', () => {
            if (this.isMaximized() && Storage.getSettings(Settings.KEEP_OPACITY_WHEN_MAXIMIZED)) {
                this.setOpacity(Storage.getSettings(Settings.FOCUS_OPACITY) / 100)
            } else {
                this.setOpacity(Storage.getSettings(Settings.BLUR_OPACITY) / 100)
            }
        })
        this.on('modal-focus', () => this.setOpacity(Storage.getSettings(Settings.FOCUS_OPACITY) / 100))
        this.on('modal-blur', () => this.setOpacity(Storage.getSettings(Settings.BLUR_OPACITY) / 100))

        this.webContents.on('before-input-event', (e, input) => {
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
        this.on('show', e => this.emit('state-change', 'show', e))
        this.on('hide', e => this.emit('state-change', 'hide', e))
        this.on('muted', e => this.emit('state-change', 'muted', e))
        this.on('unmuted', e => this.emit('state-change', 'unmuted', e))
        this.on('closed', e => this.emit('state-change', 'closed', e))
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
            const hideHandler = () => !childWindow.isDestroyed() && childWindow.hide()
            super.on('show', showHandler)
            super.on('hide', hideHandler)

            childWindow.once('closed', () => {
                super.off('show', showHandler)
                super.off('hide', hideHandler)
            })

            const findbar = new Findbar(childWindow)
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
            HandbookWindow.#fixUserAgent(childWindow)
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
        window.webContents.setUserAgent(window.webContents.getUserAgent().replace(/\s(H|h)andbook[^\s]+/, ''))
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

export default HandbookWindow