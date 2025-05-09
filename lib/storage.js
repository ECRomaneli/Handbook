import Store from 'electron-store';
import { Settings, DefaultSettings } from './constants.js';
import { app, ipcMain } from 'electron';

class Vault {
    static #store = new Store()
    static #cache = {}
    static #prefix = !app.isPackaged ? (() => {
        console.debug('Store path:', this.#store.path)
        return 'debug.'
    })() : ''

    static get(key, defaultValue) {
        key = Vault.#prefix + key
        return clone(Vault.#cache[key] ?? (Vault.#cache[key] = Vault.#store.get(key) ?? defaultValue))
    }

    static set(key, value) {
        key = Vault.#prefix + key
        Vault.#store.set(key, clone(Vault.#cache[key] = value))
    }

    static delete(key) {
        key = Vault.#prefix + key
        Vault.#store.delete(key)
        delete Vault.#cache[key]
    }
}

class Storage {
    static getSharedBounds() {
        return Vault.get('SharedBounds', { 
            width: Storage.getSettings(Settings.DEFAULT_WIDTH), 
            height: Storage.getSettings(Settings.DEFAULT_HEIGHT) 
        })
    }
    static getSharedSize() {
        const bounds = Storage.getSharedBounds()
        return { width: bounds.width, height: bounds.height }
    }
    static setSharedBounds(value) { Vault.set('SharedBounds', value) }

    static getWindowBounds(id) {
        return Vault.get(`WindowBounds.${id}`, { 
            width: Storage.getSettings(Settings.DEFAULT_WIDTH), 
            height: Storage.getSettings(Settings.DEFAULT_HEIGHT) 
        })
    }
    static setWindowBounds(id, value) { Vault.set(`WindowBounds.${id}`, value) }

    static getPages() {
        return Storage.#migratePages(Vault.get('Pages', []))
    }
    
    static setPages(pages) {
        Vault.set('Pages', pages || (pages = []))

        // Clean deleted window bounds
        Object.keys((Vault.get('WindowBounds') ?? {}))
            .filter(id => !pages.some(p => p.id === id))
            .forEach(id => Vault.delete(`WindowBounds.${id}`))
    }

    static getDefaultSize() {
        return {
            width: Storage.getSettings(Settings.DEFAULT_WIDTH),
            height: Storage.getSettings(Settings.DEFAULT_HEIGHT)
        }
    }

    static getSettings(id) { return Vault.get(`Settings.${id}`, DefaultSettings[id]) }
    static setSettings(id, settings) { Vault.set(`Settings.${id}`, settings) }

    /**
     * Method to migrate pages to the new version with ID.
     * @deprecated To be removed in the 1.0.0 release.
     */
    static #migratePages(pages) {
        const pagesWithoutId = pages.filter(p => p.id === void 0)

        pagesWithoutId.forEach((p, i) => {
            p.id = `${Date.now()}${i}`

            const windowBounds = Storage.getWindowBounds(p.label)
            windowBounds && Storage.setWindowBounds(p.id, windowBounds)
            Storage.setWindowBounds(p.label, void 0)
        })

        Storage.setPages(pages)
        return pages
    }
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

ipcMain.handle('storage.pages', (_e) => Storage.getPages())
ipcMain.handle('storage.settings', (_e, id) => Storage.getSettings(id))
ipcMain.on('storage.pages.updated', (_e, pages) => Storage.setPages(pages))
ipcMain.on('storage.settings.updated', (_e, id, value) => Storage.setSettings(id, value))

export { Storage }