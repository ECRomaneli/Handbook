import Store from 'electron-store';
import { Settings, DefaultSettings, Permission } from './constants.js';
import { app, ipcMain, session } from 'electron';
import Preferences from './preferences.js';

class Vault {
    static #isDebug = !app.isPackaged
    static #store = new Store(Vault.#isDebug ? void 0 : {  encryptionKey: 'handbook', fileExtension: '' })
    static #verbose = Vault.#isDebug && false
    static #prefix = Vault.#isDebug ? (() => {
        console.debug('Store path:', this.#store.path)
        return 'debug.'
    })() : ''

    static get(key, defaultValue) {
        key = Vault.#prefix + key
        let value = Vault.#store.get(key)
        if (value === void 0) { value = defaultValue }
        if (Vault.#verbose) { console.debug(`Store get: ${key} = ${JSON.stringify(value)}`) }
        return structuredClone(value)
    }

    static set(key, value) {
        key = Vault.#prefix + key
        Vault.#store.set(key, structuredClone(value))
        if (Vault.#verbose) { console.debug(`Store set: ${key} = ${JSON.stringify(value)}`) }
    }

    static delete(key) {
        key = Vault.#prefix + key
        Vault.#store.delete(key)
        if (Vault.#verbose) { console.debug(`Store delete: ${key}`) }
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
        return Vault.get('Pages', [])
    }
    
    static setPages(pages) {
        const oldPages = Storage.getPages()        
        Vault.set('Pages', pages || (pages = []))

        // Clean deleted session data
        clearUnusedSessionData(oldPages, pages)

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

    static getPermissions(session, url, permission) {
        let key = 'Permissions'

        if (!session) {
            const permissions = Vault.get(key, {})
            for (const session in permissions) {
                const sessionPermissions = permissions[session]
                for (const url in sessionPermissions) {
                    sessionPermissions[revertDots(url)] = sessionPermissions[url]
                    delete sessionPermissions[url]
                }
            }
            return permissions
        }

        key += `.${session}`

        if (!url) {
            const permissions = Vault.get(key, {})
            for (const url in permissions) {
                permissions[revertDots(url)] = permissions[url]
                delete permissions[url]
            }
            return permissions
        }

        key += `.${replaceDots(url)}`

        if (!permission) { return Vault.get(key, {}) }

        key += `.${permission}`

        return Vault.get(key, Permission.Status.ASK)
    }

    static revokePermissions(session, url, permission) {
        if (!session) { Vault.delete('Permissions'); return }
        if (!url) { Vault.delete(`Permissions.${session}`); return }
        if (!permission) { Vault.delete(`Permissions.${session}.${replaceDots(url)}`); return }
        Vault.delete(`Permissions.${session}.${replaceDots(url)}.${permission}`)
    }

    static setPermission(session, url, permission, value) {
        Vault.set(`Permissions.${session}.${replaceDots(url)}.${permission}`, value)
    }

    static getSettings(id) { return Vault.get(`Settings.${id}`, DefaultSettings[id]) }
    static setSettings(id, settings) { Vault.set(`Settings.${id}`, settings) }

    static getPartitionName(sessionName) { return `persist:handbook_${sessionName}` }
}

function clearUnusedSessionData(oldPages, newPages) {
    const oldSessions = new Set(oldPages.map(p => p.session))
    const newSessions = new Set(newPages.map(p => p.session))
    const removedSessions = oldSessions.difference(newSessions)

    // Remove sessions that are not used anymore
    removedSessions.forEach(s => session.fromPartition(Storage.getPartitionName(s)).clearData())
    removedSessions.forEach(s => Storage.revokePermissions(s))
}

const replaceDots = s => s.replaceAll('.', "'")
const revertDots =  s => s.replaceAll("'", '.')
const executeIfPreferences = (e, fn) => {
    const webContents = Preferences.getWindow()?.webContents
    if (webContents === void 0) {
        console.error("Preferences window is not open")
        return
    }

    if (e.sender !== webContents) {
        console.error("Sender is not the preferences window")
        return
    }

    fn()
}

ipcMain.handle('storage.pages', (_e) => Storage.getPages())
ipcMain.handle('storage.settings', (_e, id) => Storage.getSettings(id))
ipcMain.handle('storage.permissions', (_e, session, url, permission) => Storage.getPermissions(session, url, permission))
ipcMain.on('storage.pages.updated', (e, pages) => executeIfPreferences(e, () => Storage.setPages(pages)))
ipcMain.on('storage.settings.updated', (e, id, value) => executeIfPreferences(e, () => Storage.setSettings(id, value)))
ipcMain.on('storage.permissions.updated', (e, session, url, permission, value) => executeIfPreferences(e, () => Storage.setPermission(session, url, permission, value)))
ipcMain.on('storage.permissions.revoke', (e, session, url, permission) => executeIfPreferences(e, () => Storage.revokePermissions(session, url, permission)))

export default Storage