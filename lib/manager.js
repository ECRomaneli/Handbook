import { screen, Notification, Tray, Menu, globalShortcut, ipcMain, clipboard, app, nativeTheme, MenuItem, shell } from 'electron'
import Storage from './storage.js'
import { Settings, OS, Path } from './constants.js'
import Preferences from './preferences.js'
import path from 'node:path'
import Page from './page.js'
import PermissionManager from './permissions.js'
import Dialog from './modal/dialog.js'
import AutoLaunch from 'auto-launch'
import WindowManager from './window.js'

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

    /** @type {AutoLaunch} */
    #autoLauncher = new AutoLaunch({ name: 'Handbook' })

    constructor () {
        this.#initialize()
        this.#setupTray()
        this.#setupAutoLaunch()
        this.#updateAndRefresh()
        this.#setupAccelerators()
        this.#registerDynamicContextMenu()
        this.#registerGlobalShortcut()
        this.#registerPreferencesListeners()
        this.#registerWindowActionAreaListeners()
        OS.IS_WIN32 && this.#tray.focus()
    }

    #initialize() {
        PermissionManager.initialize()
        const winManager = WindowManager.initialize(() => this.#currentPage)
        
        winManager.on('state-change', () => {
            this.#refreshContextMenu()
            this.#updateTrayIcon()
        })

        Manager.#systemTheme = nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
        this.#fromClipboardPage = new Page(void 0, 'Clipboard URL')
        nativeTheme.themeSource = Storage.getSettings(Settings.APP_THEME)
        Manager.setGoogleApiKey(Storage.getSettings(Settings.GOOGLE_API_KEY))
    }

    #updateAndRefresh() {
        this.#updatePages()
        this.#refreshContextMenu()
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
        Preferences.onPagesUpdated(() => this.#updateAndRefresh())
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
            bounds = WindowManager.getInstance().getRawWindow().getBounds()
            startPos = screen.getCursorScreenPoint()
            startPos.x -= bounds.x
            startPos.y -= bounds.y
        })

        ipcMain.on('manager.currentPage.dragging', () => {
            const currentPos = screen.getCursorScreenPoint()
            bounds.x = currentPos.x - startPos.x
            bounds.y = currentPos.y - startPos.y
            WindowManager.getInstance().getRawWindow().setBounds(bounds)
        })

        ipcMain.on('manager.currentPage.toggleMaximize', () => WindowManager.getInstance().toggleMaximize())
        ipcMain.on('manager.currentPage.hide', () => WindowManager.getInstance().getRawWindow().hide())
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

        if (!this.#currentPage.hasView()) {
            this.#setupCurrentPage()
            return
        }

        WindowManager.getInstance().toggleVisibility()
    }

    /**
     * Set up the window page, creating it if it does not exist, and set the window bounds.
     */
    #setupCurrentPage() {
        const winManager = WindowManager.getInstance()

        if (!this.#currentPage.hasView()) {
            this.#currentPage.open(() => this.getViewContextMenu())
            this.#refreshContextMenu()
            this.#updateTrayIcon()
        }
        winManager.updateView(true)
    }

    /**
     * Update tray icon according to the current page visibility.
     */
    #updateTrayIcon() {
        const win = WindowManager.getInstance()
        this.#tray.setImage(Manager.#getTrayIcon(win.isVisible(true)))
    }

    /**
     * Add new pages, and if already exists, copy the changes to the existing one removing those that not.
     * The updated pages (compared by label) will keep the same reference to not invalidate the window
     * event listeners using it.
     */
    #updatePages() {
        const newPages = Page.fromList(Storage.getPages())

        if (!newPages.some(p => p.isValid())) {
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
            p.close()
            return false
        })

        this.#pages = newPages.map(newPage => {
            const page = updatedPages.filter(updatedPage => updatedPage.getId() === newPage.getId())[0]
            if (!page) { return newPage }
            page.copyFrom(newPage)
            WindowManager.getInstance().updateView()
            return page
        })
    }

    #setupAccelerators() {
        const ifVisible = (viewAction) => () => {
            const view = this.#currentPage?.getView()
            const win = WindowManager.getInstance().getRawWindow()
            win?.isVisible() && (view.webContents.isFocused() || view.isFindbarFocused()) && viewAction(view)
        }

        const pageMenu = new MenuItem({ label: 'Page', submenu: [
            { label: 'Find...', click: ifVisible(view => view.toggleFindbar(true)), accelerator: 'CommandOrControl+F' },
            { label: 'Dismiss', visible: false, click: ifVisible(view => { view.toggleFindbar(false); view.webContents.focus() }), accelerator: 'Esc' },
            { label: 'Back', click: ifVisible(view => view.goBack()), accelerator: 'CommandOrControl+Left' },
            { label: 'Forward', click: ifVisible(view => view.goForward()), accelerator: 'CommandOrControl+Right' },
            { label: 'Refresh', click: ifVisible(view => view.webContents.reload()), accelerator: 'CommandOrControl+R' },
            { label: 'Open DevTools', click: ifVisible(view => view.webContents.openDevTools()), accelerator: 'CommandOrControl+Shift+I' },
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

        this.#pages.filter(p => p.isValid()).forEach(p => 
            windowMenuItems.push({
                type: 'radio',
                checked: this.#isCurrentPage(p),
                label: p.getLabelWithStatus(), 
                click: async () => this.#selectPage(p)
            })
        )

        windowMenuItems.push({
            id: 'clipboard-url',
            type: 'radio',
            checked: this.#isCurrentPage(this.#fromClipboardPage),
            label: this.#fromClipboardPage.getLabelWithStatus(), 
            click: () => {
                let url = Manager.#getClipboardImage() ?? Manager.#getClipboardUrl()
                
                const page = this.#fromClipboardPage
                const wasChanged = page.changeUrl(url)
                    
                if (page.hasView() && wasChanged) {
                    WindowManager.getInstance().toggleVisibility()
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

            // If there is a current page, create its submenu.
            // Void Scenario: The old current page was removed
            if (this.#currentPage?.hasView()) {
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
                    otherActivePages.forEach(p => p.close())
                })
            }
        }

        windowMenuItems.push({ label: 'Close All Pages', enabled: !!activePages.length, click: () => {
            WindowManager.getInstance().forceClose()
            activePages.forEach(p => p.close())
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
            this.#windowContextMenu = [
                { label: 'Window', submenu: currentPageSubmenu },
                { label: 'Handbook', submenu: Menu.buildFromTemplate(windowMenuItems) },
            ]
        }

        this.#contextMenu = Menu.buildFromTemplate(menuItems)

        if (OS.IS_LINUX) { this.#tray.setContextMenu(this.#contextMenu) }
    }

    /**
     * Create page submenu in the context menu.
     * @param {Page} page
     * @returns {MenuItem[]}
     */
    #createPageSubmenu(page) {
        const win = WindowManager.getInstance()
        const view = page.getView()
        
        return this.#isCurrentPage(page) ?
            [
                { label: win.isVisible(true) ? 'Hide' : 'Show', click: () => win.toggleVisibility() },
                { label: view.isMuted() ? 'Unmute' : 'Mute', click: () => view.toggleMute() },
                { label: 'Close', click: () => { page.close(); win.forceClose() } },
                { type: 'separator' },
                { label: 'Find...', click: () => view.toggleFindbar(true), visible: win.isVisible(true) },
                { label: 'Back', click: () => view.goBack() },
                { label: 'Forward', click: () => view.goForward() },
                { type: 'separator' },
                { label: 'Refresh', click: () => view.reload() },
                { label: 'Home', click: () => view.reset() },
                { type: 'separator' },
                { label: 'Reset Window', click: () => { win.recreateWindow(); this.#refreshContextMenu() } },
                { label: 'Reset Bounds', click: () => { win.resetBounds() } },
                { type: 'separator' },
                { label: 'Copy URL', click: () => clipboard.writeText(view.webContents.getURL()) },
                { label: 'Open in Browser', click: () => { shell.openExternal(view.webContents.getURL()) } },
                { label: 'Create Page from URL', click: () => { this.#createNewPageFromUrl() } },
                { type: 'separator' },
                { label: 'Open DevTools', click: () => view.webContents.openDevTools() },
                { label: 'Permissions', click: () => this.#openPermissions(view.webContents.getURL()) }
            ] : 
            [
                { label: 'Show', click: () => this.#selectPage(page) },
                { label: view.isMuted() ? 'Unmute' : 'Mute', click: () => view.toggleMute() },
                { label: 'Close', click: () => page.close() },
                { type: 'separator' },
                { label: 'Permissions', click: () => this.#openPermissions(view.webContents.getURL()) }
            ]
    }

    #openPermissions(rawUrl) {
        const url = new URL(rawUrl)
        const query = 'url: ' + (url.protocol === 'file:' ? url.pathname : url.origin)
        Preferences.openAndExecute(() => Preferences.queryPermissions(query))
    }

    #createNewPageFromUrl() {
        Storage.setPage(this.#currentPage.createNewPageFromUrl())
        this.#updateAndRefresh()
    }

    #registerDynamicContextMenu() {
        if (OS.IS_LINUX) { return }

        const popUpMenu = () => {
            this.#contextMenu.getMenuItemById('clipboard-url').visible = 
                this.#isCurrentPage(this.#fromClipboardPage) || Manager.#getClipboardUrl() || Manager.#hasClipboardImage()
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

        const win = WindowManager.getInstance()
        !win.isVisible() && win.show()

        if (oldPage?.hasView() && !oldPage.shouldPersist()) {
            win.isMaximized() && win.toggleMaximize()
            oldPage.close()
        }
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
                if (this.#currentPage?.getView()?._isVisible()) {
                    this.#currentPage.getView().emit('blur')
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
                break
            case Settings.AUTO_LAUNCH:
                this.#setupAutoLaunch()
                break
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
        this.#getAllActivePages().forEach(p => p.recreateView(true))
        this.#refreshContextMenu()
        WindowManager.getInstance().recreateWindow()
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
        return this.#getAllPages(excludeCustomPages).filter(p => p.hasView())
    }

    /**
     * Check if there is any active page.
     * @param {true | void} excludeCustomPages Exclude custom pages (e.g. "Clipboard URL" page).
     * @returns {boolean} True if there is any active page.
     */
    #hasAnyActivePage(excludeCustomPages) {
        return this.#getAllPages(excludeCustomPages).some(p => p.hasView())
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
        return this.#getAllActivePages().find(p => p.getView().webContents === webContents)
    }

    /**
     * Get the current window context menu.
     * @returns {Electron.Menu} window context menu.
     */
    getViewContextMenu() {
        this.#windowContextMenu[1].submenu.getMenuItemById('clipboard-url').visible = 
                this.#isCurrentPage(this.#fromClipboardPage) || Manager.#getClipboardUrl() || Manager.#hasClipboardImage()
        
        return this.#windowContextMenu
    }

    async #setupAutoLaunch() {
        try {
            const isEnabled = await this.#autoLauncher.isEnabled()
            let autoLaunchEnabled = Storage.getSettings(Settings.AUTO_LAUNCH)

            if (!isEnabled && autoLaunchEnabled === void 0) {
                autoLaunchEnabled = await Dialog.confirm(Preferences.getWindow(), {
                    title: 'Launch on Startup',
                    message: 'Do you want Handbook to launch automatically on startup?',
                    defaultId: 0
                })
                Preferences.updateSettings(Settings.AUTO_LAUNCH, autoLaunchEnabled)
            }
            
            if (autoLaunchEnabled && !isEnabled) {
                await this.#autoLauncher.enable()
            } else if (!autoLaunchEnabled && isEnabled) {
                await this.#autoLauncher.disable()
            }
        } catch (err) {
            console.error('Error setting up auto launch:', err)

            const confirmed = await Dialog.confirm(Preferences.getWindow(), {
                title: 'Failed to set Auto Launch',
                message: 'Unfortunately, Handbook could not be set to launch automatically on startup. ' +
                         'Do you want to disable it?',
                defaultId: 0
            })

            if (confirmed) {
                Preferences.updateSettings(Settings.AUTO_LAUNCH, false)
                await this.#autoLauncher.disable()
            }
        }
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
        return Page.isValidUrl(cb) ? cb : null
    }

    static #hasClipboardImage() {
        return !clipboard.readImage().isEmpty()
    }

    static #getClipboardImage() {
        const image = clipboard.readImage()
        return !image.isEmpty() ? image.toDataURL() : null
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
        return path.join(Path.ASSETS, 'img', 'icons', 'tray', theme, `${open ? 'open' : 'closed'}Template.png`)
    }
}

export default (() => {
    /** @type {Manager} */ let instance
    return { start: () => instance ?? (instance = new Manager()), getInstance: () => instance }
})()