import { screen } from 'electron';
import { Positions, Settings } from './constants.js';
import { HandbookWindow } from './window.js';
import { Storage } from './storage.js';

class Page {

    /** @type {"" | "position" | "bounds"} */
    static #resetType = Storage.getSettings(Settings.RESET_BOUNDS)

    /** @type {{ x: number, y: number }} */
    static #margin = { x: 30, y: 30 }

    /** @type {number} */
    #id
    
    /** @type {string} */
    #label

    /** @type {string} Home URL. */
    #url

    /** @type {HandbookWindow} Window attached to the page. */
    #window

    /** @type {string} */
    #session

    /** @type {boolean} If the page is or not persisted when the current page change. */
    #persist

    /** @type {boolean} If the bounds was set at least once in this session. */
    #hasBounds

    constructor (id, label, url, session, persist) {
        this.#id = id
        this.#label = label
        this.#url = url
        this.#session = session !== void 0 && session !== '' ? session : 'default'
        this.#persist = persist
    }

    /**
     * Create window.
     */
    createWindow() {
        if (this.hasWindow()) { throw new Error('Unexpected window replacement.') }
        this.#window = new HandbookWindow(this.#createWindowOptions())
        this.#window.prependListener('closed', () => this.#window = void 0)
        this.#window.setExternalId(this.#id)
        this.#window.loadURL(this.#url)
    }

    /**
     * Recreate the internal window.
     * @param {true | void} recreateWindowOptions If true, the window options are going to be recreated (may change dynamic options).
     * @throws {Error} If there is no window to recreate.
     */
    recreateWindow(recreateWindowOptions) {
        if (!this.hasWindow()) {
            throw new Error('No window to recreate.')
        }
        
        const oldWindow = this.#window

        this.#window = recreateWindowOptions ? 
            this.#window.clone(this.#createWindowOptions()) : 
            this.#window.clone()
    
        oldWindow.removeAllListeners()
        oldWindow.forceClose()
    }

    /**
     * Hide page's window or if page is not persistent, (force) close the window.
     */
    suspendWindow() {
        if (this.#persist) {
            this.#window.isMaximized() && this.#window.unmaximize()
            this.#window.hide()
        } else {
            this.closeWindow()
        }
    }

    /**
     * Try to close window normally, if it fails, then destroy the window.
     */
    closeWindow() {
        this.#window.forceClose()
    }

    /**
     * Retrieve bounds and apply it according to the settings.
     */
    updateWindowBounds() {
        this.#window.setBounds(this.#getPageBounds())
    }

    /**
     * Change the page's window URL. If the URL is the same or equivalent to false, nothing happens.
     * @param {string} url 
     * @returns {boolean} True if the URL was changed, false if not.
     */
    changeUrl(url) {
        if (!url || this.#url === url) { return false }

        this.#url = url
        
        if (this.hasWindow()) {
            this.#window.loadURL(this.#url)
        }
        return true
    }

    /**
     * Get page label with status symbols.
     */
    getLabelWithStatus() {
        let label = this.#label
        if (this.hasWindow()) {
            label += ' ❏'
            this.#window.isMuted() && (label += ' ✕')
        }
        return label
    }

    getId() {
        return this.#id
    }

    getLabel() {
        return this.#label
    }

    getUrl() {
        return this.#url
    }

    getWindow() {
        return this.#window
    }

    /**
     * Copy fields from another page. If the URL is different and there is an active window, the new URL is loaded.
     * @param {Page} page Page to copy fields.
     */
    copyFrom(page) {
        this.#hasBounds = page.#hasBounds
        this.#persist = page.#persist

        const urlChanged = this.#url !== page.#url
        const sessionChanged = this.#session !== page.#session

        this.#session = page.#session
        this.#url = page.#url

        if (this.hasWindow()) {
            if (sessionChanged) {
                this.recreateWindow(true)
            } else if (urlChanged) {
                this.#window.loadURL(this.#url)
            }
        }
    }

    /**
     * Return whether the page has a window or not.
     * @returns {boolean} True, if there is a window associated to this page.
     */
    hasWindow() {
        return this.#window !== void 0
    }

    /**
     * Verify if the page has all required fields to create a window.
     * @returns {boolean}
     */
    canCreateWindow() {
        return this.#label && this.#url && this.#url.includes('://')
    }

    /**
     * Send event to the internal window. Be sure to have an active page, otherwise
     * it will trigger an error.
     * @param {string} eventName Event name.
     * @param  {...any} args Arguments.
     */
    sendToWindow(eventName, ...args) {
        this.#window.webContents.send(eventName, ...args)
    }

    /**
     * Return the default window options.
     * @returns {Electron.BrowserWindowConstructorOptions} options.
     */
    #createWindowOptions() {
        return { webPreferences: { partition: `persist:handbook_${this.#session}` } }
    }

    /**
     * If the page has bounds, return its bounds. Otherwise, calculate the bounds based on user settings.
     * @returns {Electron.Rectangle} Window bounds.
     */
    #getPageBounds() {
        if (!this.#hasBounds) {
            this.#hasBounds = true
            if (Page.#resetType) { return this.#resetBounds() }
        }

        const bounds = Storage.getSettings(Settings.SHARE_BOUNDS) ? 
            Storage.getSharedBounds() :
            Storage.getWindowBounds(this.#id)

        // Verify if the stored bounds have position
        if (bounds.x !== void 0) { return bounds }

        return this.#getBoundsForDefaultPosition(bounds)
    }

    /**
     * Get the bounds based on the reset settings.
     * @returns {Electron.Rectangle} bounds.
     */
    #resetBounds() {
        const isShared = Storage.getSettings(Settings.SHARE_BOUNDS)
        
        let size

        if (Page.#resetType === 'bounds') {
            size = Storage.getDefaultSize()
        } else {
            size = isShared ? Storage.getSharedBounds() : Storage.getWindowBounds(this.#id)
        }

        // If the bounds are shared, then the bounds are reset only once
        isShared && (Page.#resetType = '')

        return this.#getBoundsForDefaultPosition(size)
    }

    /**
     * Calculate default position based on the window, offset, and screen size. 
     * @param {{ width: number, height: number }} windowSize Window size to be used in the returned 
     * bounds and for distance calculation.
     * @returns {Electron.Rectangle} Window bounds.
     */
    #getBoundsForDefaultPosition(windowSize) {
        const bounds = { width: windowSize.width, height: windowSize.height }

        // Get user position preference
        const position = Storage.getSettings(Settings.DEFAULT_POSITION)
        if (position === Positions.CENTER) { return bounds }

        // Get the available area
        const area = screen.getPrimaryDisplay().workAreaSize
        area.width -= bounds.width
        area.height -= bounds.height
        area.x = 0
        area.y = 0
 
         // Calc position
        switch (position) {
            case Positions.TOP_LEFT:      bounds.y = area.y + Page.#margin.y;      bounds.x = area.x + Page.#margin.x;     break
            case Positions.TOP_CENTER:    bounds.y = area.y + Page.#margin.y;      bounds.x = area.width / 2 | 0;          break
            case Positions.TOP_RIGHT:     bounds.y = area.y + Page.#margin.y;      bounds.x = area.width - Page.#margin.x; break
            case Positions.MIDDLE_LEFT:   bounds.y = area.height / 2 | 0;          bounds.x = area.x + Page.#margin.x;     break
            case Positions.CENTER:        bounds.y = area.height / 2 | 0;          bounds.x = area.width / 2 | 0;          break
            case Positions.MIDDLE_RIGHT:  bounds.y = area.height / 2 | 0;          bounds.x = area.width - Page.#margin.x; break
            case Positions.BOTTOM_LEFT:   bounds.y = area.height - Page.#margin.y; bounds.x = area.x + Page.#margin.x;     break
            case Positions.BOTTOM_CENTER: bounds.y = area.height - Page.#margin.y; bounds.x = area.width / 2 | 0;          break
            case Positions.BOTTOM_RIGHT:  bounds.y = area.height - Page.#margin.y; bounds.x = area.width - Page.#margin.x; break
        }
        
        return bounds
    }

    /**
     * Receive a list of plain pages and return as Page objects.
     * @param {object[]} rawPages Plain pages.
     * @returns {Page[]} Page objects.
     */
    static fromList(rawPages) {
        return rawPages.map(p => new Page(p.id, p.label, p.url, p.session, p.persist))
    }
}

export { Page }