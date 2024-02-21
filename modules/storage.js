const Store = require('electron-store')
const { WindowSettings } = require('./constants')
const { ipcMain } = require('electron')

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

    static getWindowBounds(label) {
        return Storage.get('WindowBounds.' + label, { 
            width: Storage.getSettings(WindowSettings.DEFAULT_WIDTH), 
            height: Storage.getSettings(WindowSettings.DEFAULT_HEIGHT) 
        })
    }
    static setWindowBounds(label, value) { Storage.set('WindowBounds.' + label, value) }

    static getPages() { return Storage.get('Pages', []) }
    static setPages(value) { Storage.set('Pages', value) }

    static getDefaultSize() {
        return {
            width: Storage.getSettings(WindowSettings.DEFAULT_WIDTH),
            height: Storage.getSettings(WindowSettings.DEFAULT_HEIGHT)
        }
    }

    static getSettings(id) { return Storage.get('WindowSettings.' + id, defaultSettings[id]) }
    static setSettings(id, windowSettings) { Storage.set('WindowSettings.' + id, windowSettings) }

    static get(key, defaultValue) { return clone(cache[key] ?? (cache[key] = store.get(key) ?? defaultValue)) }
    static set(key, value) { store.set(key, clone(cache[key] = value)) }
}

ipcMain.handle('storage.pages', (_e) => Storage.getPages())
ipcMain.handle('storage.settings', (_e, id) => Storage.getSettings(id))
ipcMain.on('storage.pages.updated', (_e, pages) => Storage.setPages(pages))
ipcMain.on('storage.settings.updated', (_e, id, value) => Storage.setSettings(id, value))

module.exports = { Storage }

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