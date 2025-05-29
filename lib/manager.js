import { screen, Notification, Tray, Menu, globalShortcut, ipcMain, clipboard, app, nativeTheme, MenuItem } from 'electron';
import Storage from './storage.js';
import { Settings, OS, Path } from './constants.js';
import Preferences from './preferences.js';
import path from 'node:path';
import Page from './page.js';
import PermissionManager from './permissions.js';
import Dialog from './modal/dialog.js';

class Manager {
    /** @type {string} */
    static #systemTheme

    /** @type {Tray} */
    #tray

    /** @type {Menu} */
    #contextMenu

    /** @type {Menu} */
    #windowContextMenu

    /** @type {Page[]} */
    #pages

    /** @type {Page} */
    #fromClipboardPage

    /** @type {Page} */
    #currentPage

    /** @type {string} */
    #globalShortcut

    /** @type {bool} */
    #scheduledModals = []

    constructor () {
        PermissionManager.start()
        Manager.#systemTheme = nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
        this.#fromClipboardPage = new Page(void 0, 'Clipboard URL')
        nativeTheme.themeSource = Storage.getSettings(Settings.APP_THEME)
        Manager.setGoogleApiKey(Storage.getSettings(Settings.GOOGLE_API_KEY))
        this.#setupTray()
        this.#updatePages()
        this.#setupAccelerators()
        this.#refreshContextMenu()
        this.#registerDynamicContextMenu()
        this.#registerGlobalShortcut()
        this.#registerPreferencesListeners()
        this.#registerWindowActionAreaListeners()
        OS.IS_WIN32 && this.#tray.focus()
    }

    #setupTray() {
        this.#tray = new Tray(Manager.#getTrayIcon(false))
        const title = 'Handbook is ready!'
        let message = 'Handbook has started successfully. '

        if (OS.IS_WIN32) {
            message += 'You can pin it to the tray bar and click on the icon to access options.'
        } else {
            message += 'Click on the tray bar icon to access options.'
        }

        this.#notify(title, message)

        app.on('second-instance', () => {
            const title = 'Handbook already running!'
            const message = 'Handbook is already running. Please use the tray icon.'
            this.#notify(title, message)
        })

        this.#tray.setToolTip('Click to toggle')
    }

    #notify(title, message) {
        if (OS.IS_WIN32) { this.#tray.displayBalloon({ iconType: 'info', title, content: message }) }
        else { new Notification({ title, body: message }).show() }
    }

    #registerPreferencesListeners() {
        Preferences.onPagesUpdated(() => {
            this.#updatePages()
            this.#refreshContextMenu()
        })
        Preferences.onSettingsUpdated((_e, id, value) => this.#updateSettings(id, value))
    }

    /**
     * Setup longpress event on Darwin.
     * @platform darwin
     */
    #setupLongPressEvent() {
        let longPress
        this.#tray.on('mouse-down', () => { 
            longPress = setTimeout(() => this.#tray.emit('mouse-longpress'), Storage.getSettings(Settings.TRAY_LONGPRESS))
        })

        this.#tray.on('mouse-up', () => clearTimeout(longPress))
    }

    /**
     * Register listeners for the window action area.
     * Bugfix: Use setBounds instead of setPosition to avoid resizing when moving from one screen to another on Windows.
     */
    #registerWindowActionAreaListeners() {
        let bounds
        let startPos

        ipcMain.on('manager.currentPage.dragStart', () => {
            bounds = this.#currentPage.getWindow().getBounds()
            startPos = screen.getCursorScreenPoint()
            startPos.x -= bounds.x
            startPos.y -= bounds.y
        })

        ipcMain.on('manager.currentPage.dragging', () => {
            const currentPos = screen.getCursorScreenPoint()
            bounds.x = currentPos.x - startPos.x
            bounds.y = currentPos.y - startPos.y
            this.#currentPage.getWindow().setBounds(bounds)
        })

        ipcMain.on('manager.currentPage.toggleMaximize', () => this.#currentPage.getWindow().toggleMaximize())
        ipcMain.on('manager.currentPage.hide', () => this.#currentPage.getWindow().hide())
    }

    #registerGlobalShortcut() {
        if (this.#globalShortcut) { globalShortcut.unregister(this.#globalShortcut) }
        
        this.#globalShortcut = Storage.getSettings(Settings.GLOBAL_SHORTCUT)
        if (!this.#globalShortcut) { return }

        try {
            const ok = globalShortcut.register(this.#globalShortcut, () => { this.#setupOrTogglePage() })
            if (!ok) { throw new Error('Not registered') }
        } catch(e) {
            console.error('Failed to create the shortcut: ', e)

            Dialog.confirm(null, {
                    title: 'Failed to create the shortcut',
                    message: `Failed to register [${this.#globalShortcut}] as a global shortcut. Remove the shortcut?`,
                }).then(confirmed => {
                    if (confirmed) {
                        Preferences.updateSettings(Settings.GLOBAL_SHORTCUT, '')
                        this.#globalShortcut = ''
                    }
                })
        }
    }

    /**
     * Toggle window visibility. Roles:
     * - If the is no pages, open "Settings".
     * - If there is no current page, select the first one and show.
     * - If there is no window in the current page, setup a window and show.
     * - Otherwise, toggle visibility.
     */
    #setupOrTogglePage() {
        if (!this.#pages.length) {
            Preferences.open()
            return
        }

        if (!this.#currentPage) {
            this.#selectPage(this.#pages[0])
            return
        }

        if (!this.#currentPage.hasWindow()) {
            this.#setupCurrentPage()
            return
        }

        this.#currentPage.getWindow().toggleVisibility()
    }

    /**
     * Set up the window page, creating it if it does not exist, and set the window bounds.
     */
    #setupCurrentPage() {
        if (!this.#currentPage.hasWindow()) {
            this.#currentPage.createWindow()
            this.#currentPage.getWindow().on('state-change', () => {
                this.#refreshContextMenu()
                this.#updateTrayIcon()
            })
            this.#refreshContextMenu()
            this.#updateTrayIcon()
        }
        this.#currentPage.updateWindowBounds()
    }

    /**
     * Update tray icon according to the current page visibility.
     */
    #updateTrayIcon() {
        this.#tray.setImage(Manager.#getTrayIcon(this.#currentPage?.getWindow()?.isVisible(true)))
    }

    /**
     * Add new pages, and if already exists, copy the changes to the existing one removing those that not.
     * The updated pages (compared by label) will keep the same reference to not invalidate the window
     * event listeners using it.
     */
    #updatePages() {
        const newPages = Page.fromList(Storage.getPages())

        if (!newPages.some(p => p.canCreateWindow())) {
            this.#pages = []
            Preferences.open()
            return
        }

        if (!this.#pages) {
            this.#pages = newPages
            return
        }

        const updatedPages = this.#getAllActivePages(true).filter(p => {
            if (newPages.some(np => np.getId() === p.getId())) { return true }
            if (this.#isCurrentPage(p)) { this.#currentPage = null }
            p.closeWindow()
            return false
        })

        this.#pages = newPages.map(newPage => {
            const page = updatedPages.filter(updatedPage => updatedPage.getId() === newPage.getId())[0]
            if (!page) { return newPage }
            page.copyFrom(newPage)
            return page
        })
    }

    #setupAccelerators() {
        const ifVisible = (windowAction) => () => {
            const win = this.#currentPage?.getWindow()
            win?.isVisible() && (win.isFocused() || win.isFindbarFocused()) && windowAction(win)
        }

        const pageMenu = new MenuItem({ label: 'Page', submenu: [
            { label: 'Show / Hide', click: ifVisible(win => win.toggleVisibility()) },
            { label: 'Mute / Unmute', click: ifVisible(win => win.toggleMute()) },
            { label: 'Close', click: ifVisible(() => this.#currentPage.closeWindow()) },
            { type: 'separator' },
            { label: 'Find...', click: ifVisible(win => win.openFindbar()), accelerator: 'CommandOrControl+F' },
            { label: 'Dismiss', visible: false, click: ifVisible(win => { win.closeFindbar(); win.focus() }), accelerator: 'Esc' },
            { label: 'Back', click: ifVisible(win => win.webContents.goBack()), accelerator: 'CommandOrControl+Left' },
            { label: 'Forward', click: ifVisible(win => win.webContents.goForward()), accelerator: 'CommandOrControl+Right' },
            { type: 'separator' },
            { label: 'Refresh', click: ifVisible(win => win.reload()), accelerator: 'CommandOrControl+R' },
            { label: 'Reload', click: ifVisible(win => win.reset()) },
            { type: 'separator' },
            { label: 'Copy URL', click: ifVisible(win => clipboard.writeText(win.webContents.getURL())) },
            { label: 'Open DevTools', click: ifVisible(win => win.webContents.openDevTools()), accelerator: 'CommandOrControl+Shift+I' },
        ]})

        const systemMenu = Menu.getApplicationMenu()
        systemMenu.append(pageMenu)
        Menu.setApplicationMenu(systemMenu)
    }

    /**
     * Check for page changes and update the context menu.
     */
    #refreshContextMenu() {
        /** @type {MenuItem[]} */
        const menuItems = []

        /** @type {MenuItem[]} */
        const windowMenuItems = []

        if (OS.IS_LINUX) {
            menuItems.push({ label: 'Show / Hide Page', click: () => this.#setupOrTogglePage() })
            menuItems.push({ type: 'separator' })
        }

        this.#pages.filter(p => p.canCreateWindow()).forEach(p => 
            windowMenuItems.push({
                type: 'radio',
                checked: this.#isCurrentPage(p),
                label: p.getLabelWithStatus(), 
                click: () => this.#selectPage(p)
            })
        )

        windowMenuItems.push({
            id: 'clipboard-url',
            type: 'radio',
            checked: this.#isCurrentPage(this.#fromClipboardPage),
            label: this.#fromClipboardPage.getLabelWithStatus(), 
            click: () => {
                const page = this.#fromClipboardPage
                let cpUrl = Manager.#getClipboardUrl()

                const wasChanged = page.changeUrl(cpUrl)

                if (page.hasWindow() && wasChanged) {
                    page.getWindow().show()
                } else if (page.getUrl()) {
                    this.#selectPage(page)
                }
            }
        })

        windowMenuItems.push({ type: 'separator' })

        const activePages = this.#getAllActivePages()
        let currentPageSubmenu

        if (activePages.length > 0) {
            const activePagesMenu = { label: 'Active Pages', submenu: [] }
            windowMenuItems.push(activePagesMenu)

            if (this.#currentPage.hasWindow()) {
                currentPageSubmenu = this.#createPageSubmenu(this.#currentPage)
                activePagesMenu.submenu.push({
                    label: this.#currentPage.getLabelWithStatus(),
                    submenu: currentPageSubmenu
                })

                activePages.length > 1 && activePagesMenu.submenu.push({ type: 'separator' })
            }

            if (activePages.length > 1 || !this.#isCurrentPage(activePages[0])) {
                const otherActivePages = activePages.filter(p => !this.#isCurrentPage(p))
                
                otherActivePages.forEach(p => {
                    activePagesMenu.submenu.push({ label: p.getLabelWithStatus(), submenu: this.#createPageSubmenu(p) })
                })

                windowMenuItems.push({ label: 'Close Other Pages', click: () => 
                    otherActivePages.forEach(p => p.closeWindow())
                })
            }
        }

        windowMenuItems.push({ label: 'Close All Pages', enabled: !!activePages.length, click: () => {
            activePages.forEach(p => p.closeWindow())
        }})
        
        windowMenuItems.push({ type: 'separator' })

        windowMenuItems.push({ label: 'Preferences...', click: () => Preferences.open() })

        menuItems.push(...windowMenuItems)
        menuItems.push({ label: 'Exit', click: () => {
            Manager.showConfirmationDialog({
                title: 'Exit',
                message: 'Are you sure you want to exit Handbook?',
                confirmBtn: 'Confirm',
                cancelBtn: 'Cancel',
                parent: null,
                confirmAction: () => { app.quit() }
            })
        } })

        if (currentPageSubmenu) {
            windowMenuItems.unshift({ type: 'separator' })
            windowMenuItems.unshift({
                label: 'Current Page', submenu: currentPageSubmenu
            })
        }

        windowMenuItems.splice(windowMenuItems.findIndex(i => i.id === 'clipboard-url'), 1)
        this.#contextMenu = Menu.buildFromTemplate(menuItems)
        this.#windowContextMenu = Menu.buildFromTemplate(windowMenuItems)

        if (OS.IS_LINUX) { this.#tray.setContextMenu(this.#contextMenu) }
    }

    /**
     * Create page submenu in the context menu.
     * @param {Page} page
     * @returns {MenuItem[]}
     */
    #createPageSubmenu(page) {
        const win = page.getWindow()
        
        return this.#isCurrentPage(page) ?
            [
                { label: win.isVisible() ? 'Hide' : 'Show', click: () => win.toggleVisibility() },
                { label: win.isMuted() ? 'Unmute' : 'Mute', click: () => win.toggleMute() },
                { label: 'Close', click: () => page.closeWindow() },
                { type: 'separator' },
                { label: 'Find...', click: () => win.openFindbar(), visible: win.isVisible() },
                { label: 'Back', click: () => win.webContents.navigationHistory.goBack() },
                { label: 'Forward', click: () => win.webContents.navigationHistory.goForward() },
                { type: 'separator' },
                { label: 'Refresh', click: () => win.reload() },
                { label: 'Reload', click: () => win.reset() },
                { label: 'Recreate', click: () => { page.recreateWindow(); this.#refreshContextMenu() } },
                { type: 'separator' },
                { label: 'Copy URL', click: () => clipboard.writeText(win.webContents.getURL()) },
                { label: 'Open DevTools', click: () => win.webContents.openDevTools() },
                { type: 'separator' },
                { label: 'Permissions', click: () => {
                    const url = new URL(win.webContents.getURL())
                    const query = 'url: ' + (url.protocol === 'file:' ? url.pathname : url.origin)
                    if (Preferences.isOpen()) {
                        Preferences.queryPermissions(query)
                    } else {
                        Preferences.onceReady(() => Preferences.queryPermissions(query)).open()
                    }
                }}
            ] : 
            [
                { label: 'Show', click: () => this.#selectPage(page) },
                { label: win.isMuted() ? 'Unmute' : 'Mute', click: () => win.toggleMute() },
                { label: 'Close', click: () => page.closeWindow() },
                { type: 'separator' },
                { label: 'Permissions', click: () => {
                    const query = 'url: ' + (new URL(win.webContents.getURL())).origin
                    if (Preferences.isOpen()) {
                        Preferences.queryPermissions(query)
                    } else {
                        Preferences.onceReady(() => Preferences.queryPermissions(query)).open()
                    }
                }}
            ]

    }

    #registerDynamicContextMenu() {
        if (OS.IS_LINUX) { return }

        const popUpMenu = () => {
            this.#contextMenu.getMenuItemById('clipboard-url').visible = 
                this.#isCurrentPage(this.#fromClipboardPage) || Manager.#getClipboardUrl()
            this.#tray.popUpContextMenu(this.#contextMenu)
        }

        if (OS.IS_DARWIN) {
            this.#setupLongPressEvent()
            this.#tray.on('mouse-longpress', popUpMenu)
        }

        this.#tray.on('right-click', popUpMenu)
        this.#tray.on('click', () => this.#setupOrTogglePage())
    }

    /**
     * Select the page, configure the window, and show it. If trying to select the current page,
     * only toggle the visibility.
     * @param {Page} page Page to be selected.
     */
    #selectPage(page) {
        if (this.#isCurrentPage(page)) { return this.#setupOrTogglePage() }

        const oldPage = this.#currentPage
        this.#currentPage = page
        this.#setupCurrentPage()

        !page.getWindow().isVisible() && page.getWindow().show()
        oldPage?.hasWindow() && oldPage.suspendWindow()
    }

    /**
     * Listen for settings updates and took actions based on their IDs.
     * @param {string} id Settings ID
     * @param {any} value Settings value
     */
    #updateSettings(id, value) {
        switch (id) {
            case Settings.SHOW_FRAME:
            case Settings.ALLOW_FULLSCREEN:
                if (!this.#hasAnyActivePage()) { return }
                this.#beforeCloseConfirm(
                    'recreate-all-windows', 
                    'Recreate all windows?', 
                    'Only new windows will receive the new configuration. Do you want to recreate all windows now?', 
                    () => this.#recreateAllWindows(),
                    () => this.#scheduledModals.length || Preferences.close()
                )
                break
            case Settings.FOCUS_OPACITY:
            case Settings.BLUR_OPACITY:
            case Settings.KEEP_OPACITY_WHEN_MAXIMIZED:
                if (this.#currentPage?.getWindow()?.isVisible()) {
                    this.#currentPage.getWindow().emit('blur')
                }
                break
            case Settings.ACTION_AREA:
            case Settings.HIDE_SHORTCUT:
                this.#sendToAllWindows('storage.settings.updated', id, value)
                break
            case Settings.GLOBAL_SHORTCUT:
                this.#registerGlobalShortcut()
                break
            case Settings.APP_THEME:
                nativeTheme.themeSource = value
                this.#updateTrayIcon()
                break
            case Settings.TRAY_ICON_THEME:
                this.#updateTrayIcon()
                break
            case Settings.GOOGLE_API_KEY:
                Manager.setGoogleApiKey(value)
                this.#beforeCloseConfirm(
                    'restart-application', 
                    'Restart app?', 
                    'A complete restart is required for the Google API key to take effect. Restart now?', 
                    () => { app.relaunch(); app.exit(0) },
                    () => this.#scheduledModals.length || Preferences.close()
                )
        }
    }

    #beforeCloseConfirm(id, title, message, confirmAction, onFinally) {
        if (this.#scheduledModals.includes(id)) { return }
        this.#scheduledModals.push(id)
        Preferences.getWindow().prependOnceListener('close', async e => {
            e.preventDefault()
            try {
                await Manager.showConfirmationDialog({
                    title: title, message: message, confirmBtn: 'Yes', cancelBtn: 'No', parent: Preferences.getWindow(),
                    confirmAction: confirmAction
                })
            } finally {
                this.#scheduledModals.splice(this.#scheduledModals.indexOf(id), 1)
                onFinally && onFinally()
            }
        })
    }

    #sendToAllWindows(eventName, ...args) {
        this.#getAllActivePages().forEach(p => p.sendToWindow(eventName, ...args))
    }

    /**
     * Clone all windows closing the old ones. Useful when changing window specs that cannot be updated.
     */
    #recreateAllWindows() {
        this.#getAllActivePages().forEach(p => p.recreateWindow())
        this.#refreshContextMenu()
    }

    /**
     * Return all pages.
     * @param {true | void} excludeCustomPages Exclude custom pages (e.g. "Clipboard URL" page).
     * @returns {Page[]} List containing all pages.
     */
    #getAllPages(excludeCustomPages) {
        const pages = [...this.#pages]
        if (!excludeCustomPages) {
            pages.push(this.#fromClipboardPage)
        }
        return pages
    }

    /**
     * Return all pages containing an active window.
     * @param {true | void} excludeCustomPages Exclude custom pages (e.g. "Clipboard URL" page).
     * @returns {Page[]} List of active pages.
     */
    #getAllActivePages(excludeCustomPages) {
        return this.#getAllPages(excludeCustomPages).filter(p => p.hasWindow())
    }

    /**
     * Check if there is any active page.
     * @param {true | void} excludeCustomPages Exclude custom pages (e.g. "Clipboard URL" page).
     * @returns {boolean} True if there is any active page.
     */
    #hasAnyActivePage(excludeCustomPages) {
        return this.#getAllPages(excludeCustomPages).some(p => p.hasWindow())
    }
    
    #isCurrentPage(page) {
        return page && this.#currentPage === page
    }

    getCurrentPage() {
        return this.#currentPage
    }

    /**
     * Return the page associated to the webContents.
     * @param {Electron.WebContents} webContents 
     * @returns {Page} Page associated to the webContents or undefined if there is no page associated.
     */
    getPageByWebContents(webContents) {
        return this.#getAllActivePages().find(p => p.getWindow().webContents === webContents)
    }

    /**
     * Get the current window context menu.
     * @returns {Electron.Menu} window context menu.
     */
    getWindowContextMenu() {
        return this.#windowContextMenu
    }

    static setGoogleApiKey(key) {
        process.env.GOOGLE_API_KEY = key
    }

    static async showConfirmationDialog(data) {
        const result = await Dialog.show(
            data.parent || null,
            {
                type: data.type || 'question',
                title: data.title || 'Confirmation',
                message: data.message || 'Are you sure?',
                buttons: [data.confirmBtn || 'Ok', data.cancelBtn || 'Cancel'],
                defaultId: 1,
                cancelId: 1
            }
        )

        setTimeout(() => {
            if (result.response === 0) {
                data.confirmAction && data.confirmAction()
            } else {
                data.cancelAction && data.cancelAction()
            }
        })
    }

    static #getClipboardUrl() {
        const cb = clipboard.readText()
        return Manager.#hasAllowedProtocol(cb) ? cb : null
    }

    static #getTrayIcon(open) {
        // Darwin changes automatically the icon when the app is in dark mode using the alpha channel
        if (OS.IS_DARWIN) { return Manager.#getTrayIconPath('light', open) }

        let theme = Storage.getSettings(Settings.TRAY_ICON_THEME)
        if (theme === 'system') {
            // On Windows, this property distinguishes between system and app light/dark theme
            // Other OSs, if the app theme is system, use the nativeTheme.shouldUseDarkColors
            // otherwise, use the cached theme
            theme = OS.IS_WIN32 ? nativeTheme.shouldUseDarkColorsForSystemIntegratedUI ? 'dark' : 'light' :
                    Storage.getSettings(Settings.APP_THEME) === 'system' ? nativeTheme.shouldUseDarkColors ? 'dark' : 'light' :
                    Manager.#systemTheme
        } else if (theme === 'preferred') {
            theme = nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
        }
        return Manager.#getTrayIconPath(theme, open)
    }

    static #getTrayIconPath(theme, open) {
        // if (!['light', 'dark', 'gray', 'system', 'preferred'].includes(theme)) {
        //     console.warn(`Invalid tray icon theme "${theme}", using "light" instead.`)
        //     theme = 'light'
        // }
        return path.join(Path.ASSETS, 'img', 'icons', 'tray', theme, `${open ? 'open' : 'closed'}Template.png`)
    }
    
    /**
     * Verify if URL has an allowed protocol.
     * @param {string} url URL.
     * @returns {boolean}
     */
    static #hasAllowedProtocol(url) {
        return url && (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('file://'))
    }
}

export default (() => {
    /** @type {Manager} */ let instance
    return { start: () => instance ?? (instance = new Manager()), getInstance: () => instance }
})()