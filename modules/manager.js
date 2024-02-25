const { Tray, Menu, screen, dialog, globalShortcut, ipcMain, BrowserWindow, clipboard, app } = require('electron')
const { HandbookWindow } = require('./window')
const { Storage } = require('./storage')
const { WindowSettings, Positions } = require('./constants')
const { Settings } = require('./settings')
const path = require('node:path')

/**
 * @typedef {object} Page
 * @property {string} label
 * @property {string} url Home URL.
 * @property {boolean} persist If the page is or not persisted when the current page change.
 * @property {boolean} hasBounds If the bounds was set at least once in this session.
 * @property {HandbookWindow} window Window attached to the page.
 */

class Manager {
    /** @type {Tray} */
    tray = new Tray(getTrayIcon())

    /** @type {() => void} */
    contextMenuListener

    /** @type {Page[]} */
    pages

    /** @type {Page} */
    fromClipboardPage = { label: 'Clipboard URL' }

    /** @type {Page} */
    currentPage

    /** @type {string} */
    globalShortcut

    /** @type {"" | "position" | "bounds"} */
    resetType = Storage.getSettings(WindowSettings.RESET_BOUNDS)

    constructor () {
        this.refreshContextMenu()
        this.setupLongPressEvent()
        this.registerGlobalShortcut()
        this.registerDefaultEventListeners()
        this.registerWindowActionAreaListeners()
    }

    registerDefaultEventListeners() {
        Settings.onPagesUpdated(() => this.refreshContextMenu())
        Settings.onSettingsUpdated((_e, id, value) => this.updateSettings(id, value))
        this.tray.on('click', () => this.toggleWindow())
        ipcMain.on('manager.currentPage.hide', () => this.currentPage.window.hide())
    }

    setupLongPressEvent() {
        let longPress
        this.tray.on('mouse-down', () => { 
            longPress = setTimeout(() => this.tray.emit('mouse-longpress'), Storage.getSettings(WindowSettings.TRAY_LONGPRESS))
        })

        this.tray.on('mouse-up', () => clearTimeout(longPress))
    }

    registerWindowActionAreaListeners() {
        let position, window

        ipcMain.on('manager.currentPage.dragStart', (e) => {
            window = BrowserWindow.fromWebContents(e.sender)
            position = window.getPosition()
        })

        ipcMain.on('manager.currentPage.dragging', (_e, offset) => {
            window.setPosition(position[0] + offset.x, position[1] + offset.y)
        })

        ipcMain.on('manager.currentPage.toggleMaximize', () => this.currentPage.window.toggleMaximize())
    }

    registerGlobalShortcut() {
        if (this.globalShortcut) { globalShortcut.unregister(this.globalShortcut) }
        
        this.globalShortcut = Storage.getSettings(WindowSettings.GLOBAL_SHORTCUT)
        if (!this.globalShortcut) { return }

        try {
            globalShortcut.register(this.globalShortcut, () => { this.toggleWindow() })
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
    toggleWindow() {
        if (!this.pages.length) {
            Settings.open()
            return
        }

        if (!this.currentPage) {
            this.selectPage(this.pages[0], false)
        } else if (!this.currentPage.window) {
            this.setupWindow(this.currentPage)
        }

       this.currentPage.window.toggleVisibility()
    }

    /**
     * Update tray icon according to the current page visibility.
     */
    updateTrayIcon() {
        this.tray.setImage(getTrayIcon(this.currentPage?.window?.isVisible(true)))
    }

    /**
     * Check for page changes and update the context menu.
     */
    refreshContextMenu() {
        const newPages = Storage.getPages()
        this.pages = this.pages ? this.updatePages(newPages) : newPages

        if (!this.pages.length) { Settings.open() }

        const menuItems = []

        this.pages.filter(p => p.label && p.url).forEach(p => menuItems.push({
            type: 'radio', 
            checked: this.isCurrentPage(p),
            label: p.label, 
            click: () => this.selectPage(p, true)
        }))

        menuItems.push({
            id: 'clipboard-url',
            type: 'radio', 
            checked: this.isCurrentPage(this.fromClipboardPage),
            label: this.fromClipboardPage.label, 
            click: () => {
                const page = this.fromClipboardPage
                const oldUrl = page.url
                page.url = clipboard.readText()
                if (page.window && page.url !== oldUrl) {
                    page.window.loadURL(page.url)
                    page.window.show()
                } else {
                    this.selectPage(page, true)
                }
            }
        })

        menuItems.push({ type: 'separator' })

        menuItems.push({ id: 'window', label: 'Current Window', submenu: [
            { label: 'Back', click: () => this.currentPage.window.webContents.goBack() },
            { label: 'Forward', click: () => this.currentPage.window.webContents.goForward() },
            { type: 'separator' },
            { label: 'Refresh', click: () => this.currentPage.window.reload() },
            { label: 'Reload', click: () => this.currentPage.window.reset() },
            { type: 'separator' },
            { label: 'Open DevTools', click: () => this.currentPage.window.webContents.openDevTools() },
            { label: 'Show/Hide', click: () => this.selectPage(this.currentPage, true) },
            { label: 'Close', click: () => this.currentPage.window.close() },
        ]})

        menuItems.push({ type: 'separator' })

        menuItems.push({ id: 'close-other-windows', label: 'Close Other Windows', click: () => 
            this.pages.filter(p => !this.isCurrentPage(p) && p.window).forEach(p => p.window.close()) })

        menuItems.push({ id: 'close-all-windows', label: 'Close All Windows', click: () => {
            this.getAllActivePages().forEach(p => p.window.close())
        } })
        
        menuItems.push({ type: 'separator' })

        menuItems.push({ label: 'Settings', click: () => Settings.open() })
        menuItems.push({ label: 'Quit', click: () => app.quit() })

        const contextMenu = Menu.buildFromTemplate(menuItems)
        
        this.contextMenuListener && this.tray.off('right-click', this.contextMenuListener)
        this.contextMenuListener && this.tray.off('mouse-longpress', this.contextMenuListener)
        
        this.contextMenuListener = () => {
            let windows = this.getAllActivePages().length
            const cb = clipboard.readText()

            contextMenu.getMenuItemById('window').enabled = !!this.currentPage?.window
            contextMenu.getMenuItemById('close-other-windows').visible = windows > 1
            contextMenu.getMenuItemById('close-all-windows').visible = windows > 0
            contextMenu.getMenuItemById('clipboard-url').visible = cb.indexOf('http://') === 0 || cb.indexOf('https://') === 0

            this.tray.popUpContextMenu(contextMenu)
        }
        this.tray.on('right-click', this.contextMenuListener)
        this.tray.on('mouse-longpress', this.contextMenuListener)

    }

    /**
     * Select the page, configure the window, and show it if necessary. If trying to select the current page,
     * only toggle the visibility.
     * @param {Page} page Page to be selected.
     * @param {boolean} show If true, the page is shown. Otherwise, the page visibility will not be changed.
     */
    selectPage(page, show) {
        if (this.isCurrentPage(page)) { return this.toggleWindow() }

        this.setupWindow(page)

        const oldPage = this.currentPage
        this.currentPage = page

        show && !page.window.isVisible() && this.toggleWindow()

        if (oldPage?.window) {
            if (oldPage.persist) {
                oldPage.window.isMaximized() && oldPage.window.unmaximize()
                oldPage.window.hide()
            } else {
                oldPage.window.close()
            }
        }

        page.hasBounds || (page.hasBounds = true)
    }

    /**
     * Set up the window page creating it if not exist and set the window bounds.
     * @param {Page} page 
     */
    setupWindow(page) {
        // Note: Must be done before set window to calculate first time
        const bounds = this.getPageBounds(page)

        if (!page.window) {
            page.window = new HandbookWindow()
            page.window.on('show', () => this.updateTrayIcon())
            page.window.on('hide', () => this.updateTrayIcon())
            page.window.on('closed', () => delete page.window)
            page.window.on('closed', () => this.isCurrentPage(page) && this.updateTrayIcon())
            page.window.setExternalId(page.label)
            page.window.loadURL(page.url)
        }

        page.window.setBounds(bounds)
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
        }
    }

    sendToAllWindows(eventName, ...args) {
        this.getAllActivePages().forEach(p => p.sendToWindow(eventName, ...args))
    }

    /**
     * Clone all windows closing the old ones. Useful when changing window specs that cannot be updated.
     */
    recreateAllWindows() {
        this.getAllActivePages().forEach(cloneAndLinkPageWindow)
    }

    /**
     * If the window already exists, return its bounds. Otherwise, calculate the bounds based on user settings.
     * @param {Page} page Page to calculate boudns.
     * @returns {Electron.Rectangle} Window bounds.
     */
    getPageBounds(page) {
        if (!page.hasBounds) {
            page.hasBounds = true
            if (this.resetType) { return this.resetBounds(page.label) }
        }

        const bounds = Storage.getSettings(WindowSettings.SHARE_BOUNDS) ? 
            Storage.getSharedBounds() :
            Storage.getWindowBounds(page.label)

        // Verify if the stored bounds have position
        if (bounds.x !== void 0) { return bounds }

        return this.getBoundsForDefaultPosition(bounds)
    }

    /**
     * Get the bounds based on the reset settings.
     * @param {string} label Page label.
     * @returns {Electron.Rectangle} bounds.
     */
    resetBounds(label) {
        const isShared = Storage.getSettings(WindowSettings.SHARE_BOUNDS)
        
        let size

        if (this.resetType === 'bounds') {
            size = Storage.getDefaultSize()
        } else {
            size = isShared ? Storage.getSharedBounds() : Storage.getWindowBounds(label)
        }

        // If the bounds are shared, then the bounds are reset only once
        isShared && (this.resetType = '')

        return this.getBoundsForDefaultPosition(size)
    }

    /**
     * Calculate default position based on the window, tray, and screen size. 
     * @param {{ width: number, height: number }} windowSize Window size to be used in the returned 
     * bounds and for distance calculation.
     * @param {number} margin Minimum margin from the corners in pixels. Default: 10 (px).
     * @returns {Electron.Rectangle} Window bounds.
     */
    getBoundsForDefaultPosition(windowSize, margin) {
        !margin && (margin = 10)
        const bounds = { width: windowSize.width, height: windowSize.height }

        // Get user position preference
        const position = Storage.getSettings(WindowSettings.DEFAULT_POSITION)
        if (position === Positions.CENTER) { return bounds }

        // Get the available area
        const trayBounds = this.tray.getBounds()
        const area = screen.getPrimaryDisplay().workAreaSize
        area.width  -= bounds.width
        area.height -= bounds.height
        area.x = trayBounds.x === 0 ? trayBounds.width  : 0
        area.y = trayBounds.y === 0 ? trayBounds.height : 0
 
         // Calc position
        switch (position) {
            case Positions.TOP_LEFT:      bounds.y = area.y + margin;      bounds.x = area.x + margin;     break
            case Positions.TOP_CENTER:    bounds.y = area.y + margin;      bounds.x = area.width / 2 | 0;  break
            case Positions.TOP_RIGHT:     bounds.y = area.y + margin;      bounds.x = area.width - margin; break
            case Positions.MIDDLE_LEFT:   bounds.y = area.height / 2 | 0;  bounds.x = area.x + margin;     break
            case Positions.CENTER:        bounds.y = area.height / 2 | 0;  bounds.x = area.width / 2 | 0;  break
            case Positions.MIDDLE_RIGHT:  bounds.y = area.height / 2 | 0;  bounds.x = area.width - margin; break
            case Positions.BOTTOM_LEFT:   bounds.y = area.height - margin; bounds.x = area.x + margin;     break
            case Positions.BOTTOM_CENTER: bounds.y = area.height - margin; bounds.x = area.width / 2 | 0;  break
            case Positions.BOTTOM_RIGHT:  bounds.y = area.height - margin; bounds.x = area.width - margin; break
        }
        
        return bounds
    }

    /**
     * Add new pages, and if already exists, copy the changes to the existing one removing those that not.
     * The returned list will stay with the reference of the old pages updated in order to not invalidate
     * the window event listeners using it.
     * 
     * @param {Page[]} newPages New set of pages.
     */
    updatePages(newPages) {
        const pagesUpdated = this.getAllActivePages().filter(p => {
                if (newPages.some(np => np.label === p.label)) { return true }
                p.window.close()
                return false
            })

        return newPages.map(newPage => {
            const page = pagesUpdated.filter(page => newPage.label === page.label)[0]

            if (!page) { return newPage }

            page.hasBounds = newPage.hasBounds
            page.persist = newPage.persist
        
            if (page.window && page.url !== newPage.url) {
                page.window.loadURL(newPage.url)
            }

            page.url = newPage.url

            return page
        })
    }

    /**
     * Return all pages including not manageable ones (e.g. "Clipboard URL" page).
     * @returns {Page[]} List of all pages.
     */
    getAllPages() {
        return [...this.pages, this.fromClipboardPage]
    }

    /**
     * Return all pages, including not manageable ones, with an active window.
     * @returns {Page[]} List of active pages.
     */
    getAllActivePages() {
        return this.getAllPages().filter(p => p.window)
    }
    
    isCurrentPage(page) {
        return page && this.currentPage === page
    }
}

function cloneAndLinkPageWindow(page) {
    const oldWindow = page.window
    page.window = page.window.clone()

    oldWindow.removeAllListeners('closed')
    oldWindow.close()
}

function getTrayIcon(open) {
    return path.join(__dirname, '..', 'assets', 'img', 'tray', `icon${open ? 'Open' : 'Closed'}Template.png`)
}

module.exports = { Manager }