import { ipcMain, WebContentsView, clipboard } from 'electron'
import { Path } from './config/Constants.js'
import path from 'node:path'
import WindowManager from './WindowManager.js'
import PreferencesManager from './PreferencesManager.js'
import debounce from './util/Debounce.js'

class NavManager {

    /** @type {string} */
    static #NAVIGATION_BAR_EVENT_PREFIX = 'navigation-bar/'

    /** @type {() => Electron.Menu} */
    #contextMenuProvider

    /** @type {WebContentsView} */
    #navView

    /** @type {WebContentsView} */
    #currentView

    /** @type {string} */
    #homeURL = 'about:blank'

    constructor() {
        this.#contextMenuProvider = () => {}
        this.#registerIpcListeners()
    }

    createView() {
        this.#navView = new WebContentsView({
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                preload: path.join(Path.WEB, 'navigation-bar', 'preload.js')
            }
        })

        this.#registerNavbarListeners()
        this.#navView.webContents.loadFile(path.join(Path.WEB, 'navigation-bar', 'index.html'))
        return this.#navView
    }

    #getCurrentUrl() {
        return this.#currentView ? this.#currentView.webContents.getURL() : ''
    }

    /**
     * Change the current view being controlled by the navigation bar
     * @param {WebContentsView} view 
     * @param {string} pageLabel
     * @param {string} homeUrl
     */
    changeView(pageLabel, homeUrl, view) {
        this.#currentView = view
        this.#homeURL = homeUrl        

        if (this.#navView.webContents.isLoading()) {
            this.#navView.webContents.once('did-stop-loading', () => {
                this.#registerViewListeners(pageLabel)
            })
        } else {
            this.#registerViewListeners(pageLabel)
        }
    }

    #registerViewListeners(label) {
        const webContents = this.#currentView.webContents

        const didNavigateHandler = () => {
            this.#sendToView('did-navigate', {
                url: this.#getCurrentUrl() || this.#homeURL,
                canGoBack: webContents.navigationHistory.canGoBack(),
                canGoForward: webContents.navigationHistory.canGoForward()
            })
        }

        didNavigateHandler()
        this.#sendToView('view-updated', label)
        this.#sendToView(webContents.isLoading() ? 'did-start-loading' : 'did-stop-loading')
        this.#sendToView('mute-status-changed', webContents.isAudioMuted())

        if (this.#currentView._isNavigationRegistered) { return }
        this.#currentView._isNavigationRegistered = true

        const executeIfCurrentView = (fn) => () => webContents === this.#currentView?.webContents && fn()

        webContents.once('destroyed', executeIfCurrentView(() => { this.#currentView = null }))

        webContents.on('mute-status-changed', status => executeIfCurrentView(() => this.#sendToView('mute-status-changed', status)))
        webContents.on('did-navigate', executeIfCurrentView(didNavigateHandler))
        webContents.on('did-navigate-in-page', executeIfCurrentView(didNavigateHandler))
        webContents.on('did-start-loading', executeIfCurrentView(() => { this.#sendToView('did-start-loading') }))
        webContents.on('did-stop-loading',  executeIfCurrentView(() => { this.#sendToView('did-stop-loading') }))
    }

    #registerNavbarListeners() {
        this.#navView.webContents.once('destroyed', () => { this.#navView = null })
        this.#navView.webContents.on('focus', debounce(() => { this.#currentView?.webContents.isDestroyed() || this.#currentView?.webContents.focus(); console.debug('focus transferred') }, 200))
    }

    #registerIpcListeners() {
        ipcMain.on(NavManager.#NAVIGATION_BAR_EVENT_PREFIX + 'previous', () => {
            this.#currentView.webContents.navigationHistory.goBack()
        })
        ipcMain.on(NavManager.#NAVIGATION_BAR_EVENT_PREFIX + 'next', () => {
            this.#currentView.webContents.navigationHistory.goForward()
        })
        ipcMain.on(NavManager.#NAVIGATION_BAR_EVENT_PREFIX + 'home', () => {
            this.#currentView.webContents.loadURL(this.#homeURL)
        })
        ipcMain.on(NavManager.#NAVIGATION_BAR_EVENT_PREFIX + 'refresh', () => {
            const webContents = this.#currentView.webContents
            webContents.isLoading() ? webContents.stop() : webContents.reload()
        })
        ipcMain.on(NavManager.#NAVIGATION_BAR_EVENT_PREFIX + 'copy-url', () => {
            clipboard.writeText(this.#getCurrentUrl())
        })
        ipcMain.on(NavManager.#NAVIGATION_BAR_EVENT_PREFIX + 'open-permissions', () => {
            this.#openPermissions(this.#getCurrentUrl())
        })
        ipcMain.on(NavManager.#NAVIGATION_BAR_EVENT_PREFIX + 'list-pages', () => {
            this.#contextMenuProvider().popup({ window: WindowManager.getInstance().getRawWindow() })
        })
        ipcMain.on(NavManager.#NAVIGATION_BAR_EVENT_PREFIX + 'hide', () => {
            WindowManager.getInstance().hide()
        })
        ipcMain.on(NavManager.#NAVIGATION_BAR_EVENT_PREFIX + 'toggle-mute', () => {
            const webContents = this.#currentView.webContents
            const newStatus = !webContents.isAudioMuted()
            webContents.setAudioMuted(newStatus)
            webContents.emit('mute-status-changed', newStatus)
            this.#sendToView('mute-status-changed', newStatus)
        })
        ipcMain.on(NavManager.#NAVIGATION_BAR_EVENT_PREFIX + 'close', () => {
            WindowManager.getInstance().forceClose()
        })
    }

    #openPermissions(rawUrl) {
        const url = new URL(rawUrl)
        const query = 'url: ' + (url.protocol === 'file:' ? url.pathname : url.origin)
        PreferencesManager.openAndExecute(() => PreferencesManager.queryPermissions(query))
    }

    hasView() {
        return this.#navView
    }

    close() {
        if (this.#navView) {
            this.#navView.webContents.close()
            this.#navView = null
        }
    }

    getView() {
        return this.#navView
    }

    updateContextMenuProvider(contextMenuProvider) {
        this.#contextMenuProvider = contextMenuProvider
    }

    #sendToView(eventName, ...args) {
        if (!this.#navView || this.#navView.webContents.isDestroyed()) { return }
        this.#navView.webContents.send(NavManager.#NAVIGATION_BAR_EVENT_PREFIX + eventName, ...args)
    }
}

export default (() => {
    /** @type {NavManager} */ let instance
    return {
        initialize: () => instance ?? (instance = new NavManager()),
        getInstance: () => instance,
        isInitialized: () => !!instance
    }
})()