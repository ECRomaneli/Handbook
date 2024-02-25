const { screen } = require("electron")
const { Positions, WindowSettings } = require("./constants")
const { HandbookWindow } = require("./window")
const { Storage } = require("./storage")

class Page {

    /** @type {"" | "position" | "bounds"} */
    static resetType = Storage.getSettings(WindowSettings.RESET_BOUNDS)

    /** @type {number} */
    static verticalMargin = 10

    /** @type {number} */
    static horizontalMargin = 10
    
    /** @type {string} */
    label

    /** @type {string} Home URL. */
    url

    /** @type {boolean} If the page is or not persisted when the current page change. */
    persist

    /** @type {boolean} If the bounds was set at least once in this session. */
    hasBounds

    /** @type {HandbookWindow} Window attached to the page. */
    window

    constructor (label, url, persist) {
        this.label = label
        this.url = url
        this.persist = persist
    }

    /**
     * Create window.
     */
    createWindow() {
        this.window = new HandbookWindow()
        this.window.on('closed', () => delete this.window)
        this.window.setExternalId(this.label)
        this.window.loadURL(this.url)
    }

    /**
     * Recreate the internal window.
     */
    recreateWindow() {
        const oldWindow = this.window
        this.window = this.window.clone()
    
        oldWindow.removeAllListeners('closed')
        oldWindow.close()
    }

    /**
     * Destroy page's window. If the "hideIfPersistent" is true, the window is going to be hidden instead.
     * @param {boolean} hideIfPersistent If true, persistent windows will be hidden instead of closed.
     */
    destroyWindow(hideIfPersistent) {
        if (hideIfPersistent && this.persist) {
            this.window.isMaximized() && this.window.unmaximize()
            this.window.hide()
        } else {
            this.window.close()
        }
    }

    defineWindowBounds() {
        this.window.setBounds(this.getPageBounds())
    }

    /**
     * Copy fields from another page. If the URL is different and there is an active window, the new URL is loaded.
     * @param {Page} page Page to copy fields.
     */
    copy(page) {
        this.hasBounds = page.hasBounds
        this.persist = page.persist
    
        if (this.window && this.url !== page.url) {
            this.window.loadURL(page.url)
        }

        this.url = page.url
    }

    /**
     * Return whether the page has a window or not.
     * @returns {boolean} True, if there is a window associated to this page.
     */
    hasWindow() {
        return this.window !== void 0
    }

    /**
     * Send event to the internal window. Be sure to have an active page, otherwise
     * it will trigger an error.
     * @param {string} eventName Event name.
     * @param  {...any} args Arguments.
     */
    sendToWindow(eventName, ...args) {
        this.window.webContents.send(eventName, ...args)
    }

    /**
     * If the page has bounds, return its bounds. Otherwise, calculate the bounds based on user settings.
     * @returns {Electron.Rectangle} Window bounds.
     */
    getPageBounds() {
        if (!this.hasBounds) {
            this.hasBounds = true
            if (Page.resetType) { return this.resetBounds() }
        }

        const bounds = Storage.getSettings(WindowSettings.SHARE_BOUNDS) ? 
            Storage.getSharedBounds() :
            Storage.getWindowBounds(this.label)

        // Verify if the stored bounds have position
        if (bounds.x !== void 0) { return bounds }

        return this.getBoundsForDefaultPosition(bounds)
    }

    /**
     * Get the bounds based on the reset settings.
     * @returns {Electron.Rectangle} bounds.
     */
    resetBounds() {
        const isShared = Storage.getSettings(WindowSettings.SHARE_BOUNDS)
        
        let size

        if (Page.resetType === 'bounds') {
            size = Storage.getDefaultSize()
        } else {
            size = isShared ? Storage.getSharedBounds() : Storage.getWindowBounds(this.label)
        }

        // If the bounds are shared, then the bounds are reset only once
        isShared && (Page.resetType = '')

        return this.getBoundsForDefaultPosition(size)
    }

    /**
     * Calculate default position based on the window, offset, and screen size. 
     * @param {{ width: number, height: number }} windowSize Window size to be used in the returned 
     * bounds and for distance calculation.
     * @returns {Electron.Rectangle} Window bounds.
     */
    getBoundsForDefaultPosition(windowSize) {
        const bounds = { width: windowSize.width, height: windowSize.height }

        // Get user position preference
        const position = Storage.getSettings(WindowSettings.DEFAULT_POSITION)
        if (position === Positions.CENTER) { return bounds }

        // Get the available area
        const area = screen.getPrimaryDisplay().workAreaSize
        area.width -= bounds.width
        area.height -= bounds.height
        area.x = 0
        area.y = 0
 
         // Calc position
        switch (position) {
            case Positions.TOP_LEFT:      bounds.y = area.y + Page.verticalMargin;      bounds.x = area.x + Page.horizontalMargin;     break
            case Positions.TOP_CENTER:    bounds.y = area.y + Page.verticalMargin;      bounds.x = area.width / 2 | 0;                 break
            case Positions.TOP_RIGHT:     bounds.y = area.y + Page.verticalMargin;      bounds.x = area.width - Page.horizontalMargin; break
            case Positions.MIDDLE_LEFT:   bounds.y = area.height / 2 | 0;               bounds.x = area.x + Page.horizontalMargin;     break
            case Positions.CENTER:        bounds.y = area.height / 2 | 0;               bounds.x = area.width / 2 | 0;                 break
            case Positions.MIDDLE_RIGHT:  bounds.y = area.height / 2 | 0;               bounds.x = area.width - Page.horizontalMargin; break
            case Positions.BOTTOM_LEFT:   bounds.y = area.height - Page.verticalMargin; bounds.x = area.x + Page.horizontalMargin;     break
            case Positions.BOTTOM_CENTER: bounds.y = area.height - Page.verticalMargin; bounds.x = area.width / 2 | 0;                 break
            case Positions.BOTTOM_RIGHT:  bounds.y = area.height - Page.verticalMargin; bounds.x = area.width - Page.horizontalMargin; break
        }
        
        return bounds
    }

    /**
     * Receive a list of plain pages and return as Page objects.
     * @param {Page[]} rawPages Plain pages.
     * @returns {Page[]} Page objects.
     */
    static fromList(rawPages) {
        return rawPages.map(p => new Page(p.label, p.url, p.persist))
    }
}

module.exports = { Page }