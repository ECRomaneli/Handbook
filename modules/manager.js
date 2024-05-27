const { Tray, Menu, dialog, globalShortcut, ipcMain, clipboard, app, nativeTheme } = require('electron')
const { Storage } = require('./storage')
const { WindowSettings, OS } = require('./constants')
const { Settings } = require('./settings')
const path = require('node:path')
const { Page } = require('./page')
const { parasiteIt } = require('./debug')

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

        if (!newPages.length) {
            this.pages = []
            Settings.open()
            return
        }

        if (!this.pages) {
            this.pages = newPages
            return
        }

        const updatedPages = this.getAllActivePages().filter(p => {
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
        const activePages = this.getAllActivePages()
        const cb = clipboard.readText()

        const menuItems = []

        if (OS.IS_LINUX) {
            menuItems.push({ label: 'Show/Hide Page', click: () => this.togglePage() })
            menuItems.push({ type: 'separator' })
        }

        this.pages.filter(p => p.label && p.url).forEach(p => menuItems.push({
            type: 'radio', 
            checked: this.isCurrentPage(p),
            label: p.label + getSymbols(p), 
            click: () => this.selectPage(p, true)
        }))

        menuItems.push({
            id: 'clipboard-url',
            type: 'radio', 
            checked: this.isCurrentPage(this.fromClipboardPage),
            label: this.fromClipboardPage.label, 
            visible: cb.startsWith('http://') || cb.startsWith('https://') || cb.startsWith('file://'),
            click: () => {
                const page = this.fromClipboardPage
                const oldUrl = page.url
                page.url = clipboard.readText()
                if (page.hasWindow() && page.url !== oldUrl) {
                    page.window.loadURL(page.url)
                    page.window.show()
                } else {
                    this.selectPage(page, true)
                }
            }
        })

        menuItems.push({ type: 'separator' })

        menuItems.push({ id: 'window', label: 'Current Window', enabled: !!this.currentPage?.hasWindow(), submenu: [
            { label: 'Back', click: () => this.currentPage.window.webContents.goBack() },
            { label: 'Forward', click: () => this.currentPage.window.webContents.goForward() },
            { type: 'separator' },
            { label: 'Refresh', click: () => this.currentPage.window.reload() },
            { label: 'Reload', click: () => this.currentPage.window.reset() },
            { type: 'separator' },
            { label: 'Open DevTools', click: () => this.currentPage.window.webContents.openDevTools() },
            { label: 'Show/Hide', click: () => this.currentPage.window.toggleVisibility() },
            { label: 'Close', click: () => this.currentPage.closeWindow() },
        ]})

        if (activePages.length > 0) {
            menuItems.push({ type: 'separator' })

            if (activePages.length > 1) {
                menuItems.push({ id: 'close-other-windows', label: 'Close Other Windows', click: () => 
                    activePages.filter(p => !this.isCurrentPage(p)).forEach(p => p.closeWindow())
                })
            }

            menuItems.push({ id: 'close-all-windows', label: 'Close All Windows', click: () => {
                activePages.forEach(p => p.closeWindow())
            }})
        }
        
        menuItems.push({ type: 'separator' })

        menuItems.push({ label: 'Settings', click: () => Settings.open() })
        menuItems.push({ label: 'Quit', click: () => app.quit() })

        this.contextMenu = Menu.buildFromTemplate(menuItems)

        if (OS.IS_LINUX) { this.tray.setContextMenu(this.contextMenu) }
    }

    registerDynamicContextMenu() {
        if (OS.IS_LINUX) { return }

        OS.IS_DARWIN && this.setupLongPressEvent()

        const popUpMenu = () => this.tray.popUpContextMenu(this.contextMenu)

        this.tray.on('right-click', popUpMenu)
        OS.IS_DARWIN && this.tray.on('mouse-longpress', popUpMenu)
        this.tray.on('click', () => this.togglePage())
    }

    /**
     * Select the page, configure the window, and show it if necessary. If trying to select the current page,
     * only toggle the visibility.
     * @param {Page} page Page to be selected.
     * @param {boolean} show If true, the page is shown. Otherwise, the page visibility will not be changed.
     */
    selectPage(page, show) {
        if (this.isCurrentPage(page)) { return this.togglePage() }

        this.setupPageWindow(page)

        const oldPage = this.currentPage
        this.currentPage = page

        show && !page.window.isVisible() && this.togglePage()
        oldPage?.hasWindow() && oldPage.closeWindow(true)
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
        return this.getAllPages().filter(p => p.hasWindow())
    }
    
    isCurrentPage(page) {
        return page && this.currentPage === page
    }
}

/**
 * Get page symbols based on the page status.
 * @param {Page} page Page.
 */
function getSymbols(page) {
    let symbols = ''
    if (page.hasWindow()) {
        symbols += ' ❏'
    }
    return symbols
}

function getTrayIcon(open) {
    return path.join(__dirname, '..', 'assets', 'img', 'tray', `icon${open ? 'Open' : 'Closed'}Template.png`)
}

module.exports = { Manager }