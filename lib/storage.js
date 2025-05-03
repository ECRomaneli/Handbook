import Store from 'electron-store';
import { WindowSettings } from './constants.js';
import { ipcMain } from 'electron';

const store = new Store()
const cache = {}

const defaultSettings = {}
defaultSettings[WindowSettings.SHOW_FRAME] = false
defaultSettings[WindowSettings.BACKGROUND_COLOR] = '#171717'
defaultSettings[WindowSettings.FOCUS_OPACITY] = 100
defaultSettings[WindowSettings.BLUR_OPACITY] = 70
defaultSettings[WindowSettings.RESET_BOUNDS] = 'position'
defaultSettings[WindowSettings.SHARE_BOUNDS] = true
defaultSettings[WindowSettings.DEFAULT_POSITION] = 'top-right'
defaultSettings[WindowSettings.DEFAULT_WIDTH] = 1060
defaultSettings[WindowSettings.DEFAULT_HEIGHT] = 640
defaultSettings[WindowSettings.ACTION_AREA] = 20
defaultSettings[WindowSettings.HIDE_SHORTCUT] = ''
defaultSettings[WindowSettings.GLOBAL_SHORTCUT] = ''
defaultSettings[WindowSettings.TRAY_LONGPRESS] = 300
defaultSettings[WindowSettings.APP_THEME] = 'system'
defaultSettings[WindowSettings.TRAY_ICON_THEME] = 'system'

class Storage {
    static getSharedBounds() {
        return Storage.get('SharedBounds', { 
            width: Storage.getSettings(WindowSettings.DEFAULT_WIDTH), 
            height: Storage.getSettings(WindowSettings.DEFAULT_HEIGHT) 
        })
    }
    static getSharedSize() {
        const bounds = Storage.getSharedBounds()
        return { width: bounds.width, height: bounds.height }
    }
    static setSharedBounds(value) { Storage.set('SharedBounds', value) }

    static getWindowBounds(id) {
        return Storage.get(`WindowBounds.${id}`, { 
            width: Storage.getSettings(WindowSettings.DEFAULT_WIDTH), 
            height: Storage.getSettings(WindowSettings.DEFAULT_HEIGHT) 
        })
    }
    static setWindowBounds(id, value) { Storage.set(`WindowBounds.${id}`, value) }

    static getPages() {
        return migratePages(Storage.get('Pages', []))
    }
    
    static setPages(pages) {
        Storage.set('Pages', pages || (pages = []))

        // Clean deleted window bounds
        Object.keys((store.get('WindowBounds') ?? {}))
            .filter(id => !pages.some(p => p.id === id))
            .forEach(id => Storage.delete(`WindowBounds.${id}`))
    }

    static getDefaultSize() {
        return {
            width: Storage.getSettings(WindowSettings.DEFAULT_WIDTH),
            height: Storage.getSettings(WindowSettings.DEFAULT_HEIGHT)
        }
    }

    static getSettings(id) { return Storage.get(`WindowSettings.${id}`, defaultSettings[id]) }
    static setSettings(id, windowSettings) { Storage.set(`WindowSettings.${id}`, windowSettings) }

    static get(key, defaultValue) { return clone(cache[key] ?? (cache[key] = store.get(key) ?? defaultValue)) }
    static set(key, value) { store.set(key, clone(cache[key] = value)) }
    static delete(key) { store.delete(key); cache[key] = void 0 }
}

ipcMain.handle('storage.pages', (_e) => Storage.getPages())
ipcMain.handle('storage.settings', (_e, id) => Storage.getSettings(id))
ipcMain.on('storage.pages.updated', (_e, pages) => Storage.setPages(pages))
ipcMain.on('storage.settings.updated', (_e, id, value) => Storage.setSettings(id, value))

export { Storage }

/**
 * Method to migrate pages to the new version with ID.
 * @deprecated To be removed in the 1.0.0 release.
 */
function migratePages(pages) {
    const pagesWithoutId = pages.filter(p => p.id === void 0)

    pagesWithoutId.forEach((p, i) => {
        p.id = `${Date.now()}${i}`

        const oldKey = `WindowBounds.${p.label}`
        const windowBounds = store.get(oldKey)
        windowBounds && Storage.setWindowBounds(p.id, windowBounds)
    })

    Storage.setPages(pages)
    return pages
}

function clone(obj, memo = new WeakMap()) {
    if (obj === null || typeof obj !== 'object') {
        return obj
    }

    // Check if the object has already been cloned to avoid infinite loops
    if (memo.has(obj)) {
        return memo.get(obj)
    }

    if (Array.isArray(obj)) {
        // If the object is an array, create a new array and clone each element
        const arrCopy = []
        memo.set(obj, arrCopy)
    
        for (let i = 0; i < obj.length; i++) {
            arrCopy[i] = clone(obj[i], memo)
        }
    
        return arrCopy
    }

    // If the object is a plain object, create a new object and clone each property
    const objCopy = {}
    memo.set(obj, objCopy)

    for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
            objCopy[key] = clone(obj[key], memo)
        }
    }

    return objCopy
}