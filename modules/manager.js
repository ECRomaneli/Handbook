const { Tray, Menu, dialog, globalShortcut, ipcMain, clipboard, app, nativeTheme } = require('electron')
const { Storage } = require('./storage')
const { WindowSettings, OS } = require('./constants')
const { Settings } = require('./settings')
const path = require('node:path')
const { Page } = require('./page')

const Manager = (() => {
    /** @type {HandbookManager} */ let instance
    return { getInstance: () => instance ?? (instance = new HandbookManager()) }
})()

class HandbookManager {
    /** @type {Tray} */
    tray = new Tray(getTrayIcon())

    /** @type {Menu} */
    contextMenu

    /** @type {Page[]} */
    pages

    /** @type {Page} */
    fromClipboardPage = new Page('Clipboard URL')

    /** @type {Page} */
    currentPage

    /** @type {string} */
    globalShortcut

    constructor () {
        nativeTheme.themeSource = Storage.getSettings(WindowSettings.WINDOW_THEME)
        this.updatePages()
        this.refreshContextMenu()
        this.registerDynamicContextMenu()
        this.registerGlobalShortcut()
        this.registerSettingsListeners()
        this.registerWindowActionAreaListeners()
        OS.IS_WIN32 && this.tray.focus()
    }

    registerSettingsListeners() {
        Settings.onPagesUpdated(() => {
            this.updatePages()
            this.refreshContextMenu()
        })
        Settings.onSettingsUpdated((_e, id, value) => this.updateSettings(id, value))
    }

    /**
     * Setup longpress event on Darwin.
     * @platform darwin
     */
    setupLongPressEvent() {
        let longPress
        this.tray.on('mouse-down', () => { 
            longPress = setTimeout(() => this.tray.emit('mouse-longpress'), Storage.getSettings(WindowSettings.TRAY_LONGPRESS))
        })

        this.tray.on('mouse-up', () => clearTimeout(longPress))
    }

    registerWindowActionAreaListeners() {
        let position

        ipcMain.on('manager.currentPage.dragStart', () => { position = this.currentPage.window.getPosition() })

        ipcMain.on('manager.currentPage.dragging', (_e, offset) => {
            this.currentPage.window.setPosition(position[0] + offset.x, position[1] + offset.y)
        })

        ipcMain.on('manager.currentPage.toggleMaximize', () => this.currentPage.window.toggleMaximize())
        ipcMain.on('manager.currentPage.hide', () => this.currentPage.window.hide())
    }

    registerGlobalShortcut() {
        if (this.globalShortcut) { globalShortcut.unregister(this.globalShortcut) }
        
        this.globalShortcut = Storage.getSettings(WindowSettings.GLOBAL_SHORTCUT)
        if (!this.globalShortcut) { return }

        try {
            globalShortcut.register(this.globalShortcut, () => { this.togglePage() })
        } catch(e) {
            console.error('Failed to create the shortcut: ', e)
            dialog.showMessageBox(Settings.window, {
                type: 'error',
                title: 'Failed to create the shortcut',
                message: `Failed to register [${this.globalShortcut}] as a global shortcut, removing it.`,
                buttons: ['OK']
                })
            Storage.setSettings(WindowSettings.GLOBAL_SHORTCUT, '')
            this.globalShortcut = ''
        }
    }

    /**
     * Toggle window visibility. If no page is selected and there is at least one page, select the first one.
     */
    togglePage() {
        if (!this.pages.length) {
            Settings.open()
            return
        }

        if (!this.currentPage) {
            this.selectPage(this.pages[0])
        } else if (!this.currentPage.hasWindow()) {
            this.setupPageWindow(this.currentPage)
        }

        this.currentPage.window.toggleVisibility()
    }

    /**
     * Set up the window page, creating it if it does not exist, and set the window bounds.
     * @param {Page} page 
     */
    setupPageWindow(page) {
        if (!page.hasWindow()) {
            page.createWindow()
            page.window.on('state-change', () => {
                this.refreshContextMenu()
                this.updateTrayIcon()
            })
        }
        page.defineWindowBounds()
    }

    /**
     * Update tray icon according to the current page visibility.
     */
    updateTrayIcon() {
        this.tray.setImage(getTrayIcon(this.currentPage?.window?.isVisible(true)))
    }

    /**
     * Add new pages, and if already exists, copy the changes to the existing one removing those that not.
     * The updated pages (compared by label) will keep the same reference to not invalidate the window
     * event listeners using it.
     */
    updatePages() {
        const newPages = Page.fromList(Storage.getPages())

        if (!newPages.some(p => p.canCreateWindow())) {
            this.pages = []
            Settings.open()
            return
        }

        if (!this.pages) {
            this.pages = newPages
            return
        }

        const updatedPages = this.getAllActivePages(true).filter(p => {
            if (newPages.some(np => np.label === p.label)) { return true }
            if (this.isCurrentPage(p)) { this.currentPage = null }
            p.closeWindow()
            return false
        })

        this.pages = newPages.map(newPage => {
            const page = updatedPages.filter(page => newPage.label === page.label)[0]
            if (!page) { return newPage }
            page.copyFrom(newPage)
            return page
        })
    }

    /**
     * Check for page changes and update the context menu.
     */
    refreshContextMenu() {
        const menuItems = []

        if (OS.IS_LINUX) {
            menuItems.push({ label: 'Show / Hide Page', click: () => this.togglePage() })
            menuItems.push({ type: 'separator' })
        }

        this.pages.filter(p => p.canCreateWindow()).forEach(p => menuItems.push({
            type: 'radio', 
            checked: this.isCurrentPage(p),
            label: p.getLabelWithStatus(), 
            click: () => this.selectPage(p, true)
        }))

        menuItems.push({
            id: 'clipboard-url',
            type: 'radio', 
            checked: this.isCurrentPage(this.fromClipboardPage),
            label: this.fromClipboardPage.getLabelWithStatus(), 
            click: () => {
                const page = this.fromClipboardPage
                let cpUrl = getClipboardUrl()

                if (!cpUrl) { cpUrl = page.url }

                const oldUrl = page.url
                page.url = cpUrl
                
                if (page.hasWindow() && page.url !== oldUrl) {
                    page.window.loadURL(page.url)
                    page.window.show()
                } else if (page.url) {
                    this.selectPage(page, true)
                }
            }
        })

        menuItems.push({ type: 'separator' })

        const activePages = this.getAllActivePages()

        if (activePages.length > 0) {
            const activePagesMenu = { label: 'Active Pages', submenu: [] }
            menuItems.push(activePagesMenu)

            if (this.currentPage.hasWindow()) {
                activePagesMenu.submenu.push({
                    label: this.currentPage.getLabelWithStatus(), 
                    submenu: this.createPageSubmenu(this.currentPage)
                })

                activePages.length > 1 && activePagesMenu.submenu.push({ type: 'separator' })
            }

            if (activePages.length > 1 || !this.isCurrentPage(activePages[0])) {
                const otherActivePages = activePages.filter(p => !this.isCurrentPage(p))
                
                otherActivePages.forEach(p => {
                    activePagesMenu.submenu.push({ label: p.getLabelWithStatus(), submenu: this.createPageSubmenu(p) })
                })

                menuItems.push({ label: 'Close Other Pages', click: () => 
                    otherActivePages.forEach(p => p.closeWindow())
                })
            }
        }

        menuItems.push({ label: 'Close All Pages', enabled: !!activePages.length, click: () => {
            activePages.forEach(p => p.closeWindow())
        }})
        
        menuItems.push({ type: 'separator' })

        menuItems.push({ label: 'Settings', click: () => Settings.open() })
        menuItems.push({ label: 'Quit', click: () => app.quit() })

        this.contextMenu = Menu.buildFromTemplate(menuItems)

        if (OS.IS_LINUX) { this.tray.setContextMenu(this.contextMenu) }
    }

    /**
     * Create page submenu in the context menu.
     * @param {Page} page 
     */
    createPageSubmenu(page) {
        const win = page.window
        
        return this.isCurrentPage(page) ?
            [
                { label: win.isVisible() ? 'Hide' : 'Show', click: () => win.toggleVisibility() },
                { label: win.isMuted() ? 'Unmute' : 'Mute', click: () => win.toggleMute() },
                { label: 'Close', click: () => page.closeWindow() },
                { type: 'separator' },
                { label: 'Back', click: () => win.webContents.goBack() },
                { label: 'Forward', click: () => win.webContents.goForward() },
                { type: 'separator' },
                { label: 'Refresh', click: () => win.reload() },
                { label: 'Reload', click: () => win.reset() },
                { type: 'separator' },
                { label: 'Copy URL', click: () => clipboard.writeText(win.webContents.getURL()) },
                { label: 'Open DevTools', click: () => win.webContents.openDevTools() },
            ] : 
            [
                { label: 'Show', click: () => this.selectPage(page, true) },
                { label: win.isMuted() ? 'Unmute' : 'Mute', click: () => win.toggleMute() },
                { label: 'Close', click: () => page.closeWindow() },
            ]

    }

    registerDynamicContextMenu() {
        if (OS.IS_LINUX) { return }

        const popUpMenu = () => {
            this.contextMenu.getMenuItemById('clipboard-url').visible = 
                this.isCurrentPage(this.fromClipboardPage) || getClipboardUrl()
            this.tray.popUpContextMenu(this.contextMenu)
        }

        if (OS.IS_DARWIN) {
            this.setupLongPressEvent()
            this.tray.on('mouse-longpress', popUpMenu)
        }

        this.tray.on('right-click', popUpMenu)
        this.tray.on('click', () => this.togglePage())
    }

    /**
     * Select the page, configure the window, and show it if necessary. If trying to select the current page,
     * only toggle the visibility.
     * @param {Page} page Page to be selected.
     * @param {true | void} forceShow If true, the page is shown. Otherwise, the page's visibility will not be changed.
     */
    selectPage(page, forceShow) {
        if (this.isCurrentPage(page)) { return this.togglePage() }

        this.setupPageWindow(page)

        const oldPage = this.currentPage
        this.currentPage = page

        forceShow && !page.window.isVisible() && this.togglePage()
        oldPage?.hasWindow() && oldPage.hideWindow()
    }

    /**
     * Listen for settings updates and took actions based on their IDs.
     * @param {string} id Settings ID
     * @param {any} value Settings value
     */
    updateSettings(id, value) {
        switch (id) {
            case WindowSettings.SHOW_FRAME:
                this.recreateAllWindows()
                break
            case WindowSettings.BACKGROUND_COLOR:
                this.getAllActivePages().forEach(p => p.window.setBackgroundColor(value))
                break
            case WindowSettings.BLUR_OPACITY:
                if (this.currentPage?.window?.isVisible()) { this.currentPage.window.setOpacity(value / 100) }
                break
            case WindowSettings.ACTION_AREA:
            case WindowSettings.HIDE_SHORTCUT:
                this.sendToAllWindows('storage.settings.updated', id, value)
                break
            case WindowSettings.GLOBAL_SHORTCUT:
                this.registerGlobalShortcut()
                break
            case WindowSettings.WINDOW_THEME:
                nativeTheme.themeSource = value
                break
        }
    }

    sendToAllWindows(eventName, ...args) {
        this.getAllActivePages().forEach(p => p.sendToWindow(eventName, ...args))
    }

    /**
     * Clone all windows closing the old ones. Useful when changing window specs that cannot be updated.
     */
    recreateAllWindows() {
        this.getAllActivePages().forEach(p => p.recreateWindow())
    }

    /**
     * Return all pages.
     * @param {true | void} excludeCustomPages Exclude custom pages (e.g. "Clipboard URL" page).
     * @returns {Page[]} List containing all pages.
     */
    getAllPages(excludeCustomPages) {
        const pages = [...this.pages]
        if (!excludeCustomPages) {
            pages.push(this.fromClipboardPage)
        }
        return pages
    }

    /**
     * Return all pages containing an active window.
     * @param {true | void} excludeCustomPages Exclude custom pages (e.g. "Clipboard URL" page).
     * @returns {Page[]} List of active pages.
     */
    getAllActivePages(excludeCustomPages) {
        return this.getAllPages(excludeCustomPages).filter(p => p.hasWindow())
    }
    
    isCurrentPage(page) {
        return page && this.currentPage === page
    }
}

function getTrayIcon(open) {
    return path.join(__dirname, '..', 'assets', 'img', 'tray', `icon${open ? 'Open' : 'Closed'}Template.png`)
}

function getClipboardUrl() {
    const cb = clipboard.readText()
    return hasAllowedProtocol(cb) ? cb : null
}

/**
 * Verify if URL has an allowed protocol.
 * @param {string} url URL.
 * @returns {boolean}
 */
function hasAllowedProtocol(url) {
    return url && (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('file://'))
}

module.exports = { Manager }