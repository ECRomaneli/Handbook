const { Tray, Menu, screen, dialog, globalShortcut, ipcMain, BrowserWindow } = require('electron')
const { HandbookWindow } = require('./window')
const { Storage } = require('./storage')
const { WindowSettings, Positions } = require('./constants')
const { Settings } = require('./settings')
const path = require('node:path')

/**
 * @typedef {object} Page
 * @property {string} label
 * @property {string} url
 * @property {boolean} persist
 * @property {HandbookWindow} window
 */

class Manager {
    /** @type {Tray} */
    tray = new Tray(getTrayIcon())

    /** @type {() => void} */
    contextMenuListener

    /** @type {Page[]} */
    pages

    /** @type {Page} */
    currentPage

    /** @type {string} */
    globalShortcut

    /** @type {object} */
    newWindowOptions = { onShow: () => this.updateTrayIcon(), onHide: () => this.updateTrayIcon() }

    constructor () {
        this.updatePages()
        this.registerGlobalShortcut()
        this.registerDefaultEventListeners()
        this.registerWindowActionAreaListeners()
    }

    registerDefaultEventListeners() {
        Settings.onPagesUpdated(() => this.updatePages())
        Settings.onSettingsUpdated((_e, id, value) => this.updateSettings(id, value))
        this.tray.on('click', () => this.toggleWindow())
        ipcMain.on('manager.currentPage.hide', () => this.currentPage.window.hide())
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

        ipcMain.on('manager.currentPage.toggleMaximize', () => {
            const window = this.currentPage.window
            window.isMaximized() ? window.unmaximize() : window.maximize()
        })
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
                });
            Storage.setSettings(WindowSettings.GLOBAL_SHORTCUT, '')
            this.globalShortcut = ''
        }
    }

    /**
     * Toggle window visibility. If no page is selected and there is at least one page, select the first one.
     */
    toggleWindow() {
        if (!this.currentPage) {
            if (this.pages[0]) { this.selectPage(this.pages[0], false) }
            else { return }
        }

       this.currentPage.window.toggle()
    }

    /**
     * Update tray icon according to the current page visibility.
     */
    updateTrayIcon() {
        this.tray.setImage(getTrayIcon(this.currentPage?.window.isVisible(true)))
    }

    /**
     * Check for page changes and update the context menu.
     */
    updatePages() {
        const oldPages = this.pages
        this.pages = Storage.getPages()
        if (oldPages) { this.copyOrClosePages(oldPages) }

        if (!this.pages.length) {
            Settings.open()
        }

        const menuItems = []

        this.pages.filter(p => p.label && p.url).forEach(p => menuItems.push({
            type: 'radio', 
            checked: this.isCurrentPage(p),
            label: p.label, 
            click: () => this.selectPage(p, true)
        }))

        if (this.pages.length > 0) {
            menuItems.push({ type: 'separator' })
        
            menuItems.push({ label: 'Window', submenu: [
                { label: 'Refresh',click: () => this.currentPage.window.reload() },
                { label: 'Reload', click: () => this.currentPage.window.reset() }
            ]})
        }

        menuItems.push({ type: 'separator' })

        menuItems.push({ label: 'Settings', click: () => Settings.open() })
        menuItems.push({ label: 'Quit', click: () => process.exit() })

        const contextMenu = Menu.buildFromTemplate(menuItems)
        
        this.contextMenuListener && this.tray.off('right-click', this.contextMenuListener)
        this.contextMenuListener = () => this.tray.popUpContextMenu(contextMenu)
        this.tray.on('right-click', this.contextMenuListener)
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
                oldPage.window.hide()
            } else {
                oldPage.window.close()
                delete oldPage.window
            }
        }
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
                this.pages.filter(p => p.window).forEach(p => p.window.setBackgroundColor(value))
                break
            case WindowSettings.BLUR_OPACITY:
                if (this.currentPage.window.isVisible()) { this.currentPage.window.setOpacity(value / 100) }
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
        this.pages.filter(p => p.window).forEach(p => p.window.webContents.send(eventName, ...args))
    }

    /**
     * Clone all windows closing the old ones. Useful when changing window specs that cannot be updated.
     */
    recreateAllWindows() {
        this.pages.filter(p => p.window).forEach(p => p.window = p.window.clone())
    }

    /**
     * If the window already exists, return its bounds. Otherwise, calculate the bounds based on user settings.
     * @param {Page} page Page to calculate boudns.
     * @returns {Electron.Rectangle} Window bounds.
     */
    getPageBounds(page) {
        const isSharedBounds = Storage.getSettings(WindowSettings.SHARE_BOUNDS)
        const currentWindow = this.currentPage?.window

        if (isSharedBounds) {
            if (currentWindow) {
                if (currentWindow.isMaximized()) {
                    currentWindow.unmaximize()
                }
                return currentWindow.getBounds()
            }
        } else {
            if (page.window) { return page.window.getBounds() }
        }
        
        const resetBounds = Storage.getSettings(WindowSettings.RESET_BOUNDS)
        
        if (resetBounds && !page.window) {
            const size = resetBounds === 'bounds' ? 
                Storage.getDefaultSize() :
                isSharedBounds ? Storage.getSharedBounds() : Storage.getWindowBounds(page.label)
            return this.getBoundsForDefaultPosition(size)
        }
        
        let windowBounds = isSharedBounds ? Storage.getSharedBounds() : Storage.getWindowBounds(page.label)

        if (windowBounds.x !== void 0) { return windowBounds }

        return this.getBoundsForDefaultPosition(windowBounds)
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

    isCurrentPage(page) {
        return page && this.currentPage === page
    }

    isCurrentWindow(page) {
        return this.currentPage?.window && this.currentPage.window === page?.window
    }

    /**
     * Once a new set of pages is set, copy old page windows to the new ones. If the old page 
     * does not match the new one, the old window is closed instead. The shared window is not 
     * closed but hidden and unloaded instead.
     * 
     * @param {Page[]} oldPages Old set of pages.
     */
    copyOrClosePages(oldPages) {
        oldPages.filter(op => op.window).forEach(oldPage => {
            const newPage = this.pages.filter(newPage => newPage.label === oldPage.label)[0]
            
            if (!newPage) {
                oldPage.window.close(true)

                if (this.isCurrentPage(oldPage)) {
                    this.currentPage = null
                    this.updateTrayIcon()
                }

                return
            }

            this.isCurrentPage(oldPage) && (this.currentPage = newPage)
            newPage.window = oldPage.window
        
            if (oldPage.url !== newPage.url) {
                newPage.window.loadURL(newPage.url)
            }
        })
    }
}

function getTrayIcon(open) {
    return path.join(__dirname, '..', 'assets', 'img', 'tray', `icon${open ? 'Open' : 'Closed'}Template.png`)
}

module.exports = { Manager }