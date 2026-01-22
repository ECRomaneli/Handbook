import { ipcMain, WebContentsView, clipboard } from 'electron'
import { Path } from './config/Constants.js'
import path from 'node:path'
import WindowManager from './WindowManager.js'
import PreferencesManager from './PreferencesManager.js'

class NavManager {

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
        //this.#navView.webContents.openDevTools({ mode: 'detach' })
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

        const webContents = this.#currentView.webContents
        const didNavigateHandler = () => {
            this.#sendToView('navigation-bar/did-navigate', {
                url: this.#getCurrentUrl() || homeUrl,
                canGoBack: webContents.navigationHistory.canGoBack(),
                canGoForward: webContents.navigationHistory.canGoForward()
            })
        }

        //webContents.on('did-navigate', didNavigateHandler)
        webContents.on('did-navigate-in-page', didNavigateHandler)
        webContents.on('did-start-loading', () => { this.#sendToView('navigation-bar/did-start-loading') })
        webContents.on('did-stop-loading',  () => { this.#sendToView('navigation-bar/did-stop-loading') })
        this.#sendToView('navigation-bar/view-updated', pageLabel)

        didNavigateHandler()
        this.#sendToView('navigation-bar/' + (webContents.isLoading() ? 'did-start-loading' : 'did-stop-loading'))
    }

    #registerNavbarListeners() {
        this.#navView.once('closed', () => { this.#navView = null })
        this.#navView.webContents.once('destroyed', () => { this.#navView = null })
    }

    #registerIpcListeners() {
        ipcMain.on('navigation-bar/previous', () => {
            this.#currentView.webContents.navigationHistory.goBack()
        })
        ipcMain.on('navigation-bar/next', () => {
            this.#currentView.webContents.navigationHistory.goForward()
        })
        ipcMain.on('navigation-bar/home', () => {
            this.#currentView.webContents.loadURL(this.#homeURL)
        })
        ipcMain.on('navigation-bar/refresh', () => {
            const webContents = this.#currentView.webContents
            webContents.isLoading() ? webContents.stop() : webContents.reload()
        })
        ipcMain.on('navigation-bar/copy-url', () => {
            clipboard.writeText(this.#getCurrentUrl())
        })
        ipcMain.on('navigation-bar/open-permissions', () => {
            this.#openPermissions(this.#getCurrentUrl())
        })
        ipcMain.on('navigation-bar/list-pages', () => {
            this.#contextMenuProvider().popup({ window: WindowManager.getInstance().getRawWindow() })
        })
        ipcMain.on('navigation-bar/hide', () => {
            WindowManager.getInstance().hide()
        })

        ipcMain.on('navigation-bar/close', () => {
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
        this.#navView.webContents.send(eventName, ...args)
    }

    /**
     * @param { (event: Electron.IpcMainEvent, pages: object[]) => void } listener 
     */
    onPagesUpdated(listener) {
        ipcMain.on('storage.pages.updated', listener)
    }

    /**
     * @param { (event: Electron.IpcMainEvent, id: string, value: string) => void } listener 
     */
    onSettingsUpdated(listener) {
        ipcMain.on('storage.settings.updated', listener)
    }

    // #isThisWindow(senderWebContents) {
    //     const webContents = this.#window?.webContents
    //     if (webContents === void 0) {
    //         console.error("Preferences window is not open")
    //         return false
    //     }

    //     if (senderWebContents !== webContents) {
    //         console.error("Sender is not the preferences window")
    //         return false
    //     }

    //     return true
    // }
}

export default (() => {
    /** @type {NavManager} */ let instance
    return {
        initialize: () => instance ?? (instance = new NavManager()),
        getInstance: () => instance,
        isInitialized: () => !!instance
    }
})()