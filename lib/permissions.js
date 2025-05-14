import { app, dialog, session } from "electron"
import { Manager } from "./manager.js"
import { Storage } from "./storage.js"
import { Permission } from "./constants.js"
import { Page } from "./page.js"
import { HandbookWindow } from "./window.js"

const PermissionsHandler = (() => {
    /** @type {Permissions} */ let instance
    return { start: () => instance ?? (instance = new Permissions()) }
})()

class Permissions {
    constructor() {
        this.#denyPermissionsOnSession(session.defaultSession)
        this.#setupPermissionsHandler()
    }

    #setupPermissionsHandler() {
       
        app.prependListener('session-created', /** @param {Electron.Session} s */ s => {
            console.debug('Session created:', s.storagePath)
            this.#printDetails(s)
            s.setPermissionRequestHandler(this.#requestPermissions.bind(this))
            s.setPermissionCheckHandler(this.#checkPermissions.bind(this))
            // s.setDisplayMediaRequestHandler((_r, c) => {
            //     c({})
            //     //this.#isAllowed(r.webContents, r.requestingUrl, 'display:gesture')
            //     // Cluster of per``missions same window
            //     // desktopCapturer.getSources({ types: ['screen', 'window'] }).then((sources) => {
            //     //     console.log('Request: ', r)
            //     //     // Grant access to the first screen found.
            //     //     c({ video: sources[0] })
            //     //   }).catch((err) => {
            //     //     console.log('Error: ', err);
            //     //   })
            // })
        })
            // this.#printDetails(s)
        
    }

    #checkPermissions(webContents, permission, requestingOrigin, details) {
        const page = Manager.getInstance().getPageByWebContents(webContents)
        if (page === void 0) { return false }

        const url = this.#createValidURL(details.requestingUrl, details.embeddingOrigin,
            details.securityOrigin, requestingOrigin)
        if (url === void 0) {
            console.error('Permission request without URL or origin:', details.permission || 'unknown')
            return false
        }

        if (details.mediaType) { permission = this.#formatPermission(permission, details.mediaType) }

        const result = false !== this.#isAllowed(page, url.origin, permission)
        console.log('Permission check:', permission, 'for', url.origin, 'result:', result)
        return result
    }

    async #requestPermissions(webContents, permission, callback, details) {
        const page = Manager.getInstance().getPageByWebContents(webContents)
        if (page === void 0) { return callback(false) }

        const url = this.#createValidURL(details.requestingUrl, details.securityOrigin)

        if (url === void 0) {
            console.error('Permission request without URL or origin:', permission)
            return callback(false)
        }

        const type = this.#getRequestType(details)

        switch (type) {
            case Permission.Type.MEDIA_ACCESS:
                for (const mediaType of details.mediaTypes) {
                    if (true !== await this.#requestPermission(page, url.origin, this.#formatPermission(permission, mediaType))) {
                        return callback(false)
                    }
                }
                return callback(true)
            default: return callback(true === await this.#requestPermission(page, url.origin, permission))
        }
    }

    #isAllowed(page, url, permission) {
        const window = page.getWindow()
        if (this.#allowTemporaryPermission(window, permission)) { return true }

        const session = page.getSession()
        const status = Storage.getPermissions(session, url, permission)

        if (status === Permission.Status.ALLOW) { return true }
        if (status === Permission.Status.DENY) { return false }
        return void 0
    }

    async #requestPermission(page, url, permission) {
        const status = this.#isAllowed(page, url, permission)
        if (status !== void 0) { return status }
        return await this.#askPermissionAndSaveStatus(page, { session: page.getSession(), url, permission })
    }

    /**
     * 
     * @param {Page} page 
     * @param {Object} data 
     * @returns {Promise<String>} - Permission status
     */
    async #askPermissionAndSaveStatus(page, data) {
        const parent = page.getWindow()

        if (parent === void 0) {
            console.error('The window is no longer available for page:', page.getLabel())
            return false
        }

        const result = await dialog.showMessageBox(
            parent.isVisible() ? parent : null,
            {
                icon: HandbookWindow.getLogo(),
                type: 'question',
                title: 'Permission Request',
                message: `${data.url} wants to access the following permission:\n"${data.permission}"`,
                buttons: ['Allow', 'Allow this time', 'Deny', 'Ask Later'],
                defaultId: 3,
                cancelId: 1,
                noLink: true,
            }
        )

        const status =  result.response === 0 ? Permission.Status.ALLOW :
                        result.response === 1 ? Permission.Status.ALLOW_ONCE :
                        result.response === 2 ? Permission.Status.DENY :
                        Permission.Status.ASK

        console.debug('Permission request:', data.permission, 'for', data.url, 'result:', status)
        if (status !== Permission.Status.ALLOW_ONCE) {
            Storage.setPermission(data.session, data.url, data.permission, status)
            return status === Permission.Status.ALLOW
        }
        
        this.#setTemporaryPermission(parent, data.permission)
        Storage.setPermission(data.session, data.url, data.permission, Permission.Status.ASK)
        return true
    }

    #setTemporaryPermission(window, permission) {
        if (window._hb_permissions === void 0) {
            window._hb_permissions = []
            window.webContents.once('did-navigate', () => delete window._hb_permissions)
        }
        window._hb_permissions.push(permission)
    }

    #allowTemporaryPermission(window, permission) {
        if (!window) { return false }
        if (window._hb_permissions === void 0) { return false }
        return window._hb_permissions.includes(permission)
    }

    #getRequestType(details) {
        if (!details) { console.error('Permission details are undefined'); return Permission.Type.GENERIC }
        if ('externalURL' in details) { return Permission.Type.OPEN_EXTERNAL }
        if ('fileAccessType' in details && 'filePath' in details) { return Permission.Type.FILE_SYSTEM }
        if ('mediaTypes' in details) { return Permission.Type.MEDIA_ACCESS }
        if ('deviceType' in details && 'device' in details) { return Permission.Type.DEVICE }
        if ('pairingKind' in details && 'deviceId' in details) { return Permission.Type.BLUETOOTH }
        if ('videoRequested' in details || 'audioRequested' in details) { return Permission.Type.DISPLAY_MEDIA }
        return Permission.Type.GENERIC
    }

    /**
     * Deny all permissions on session.
     * @param {Electron.Session} session 
     */
    #denyPermissionsOnSession(session) {
        const handler = (p) => {
            console.error('Unauthorized permission requested in default session:', p)
            return false
        }
        session.setPermissionRequestHandler((_, p, c) => c(handler(p)))
        session.setPermissionCheckHandler((_, p) => handler(p))
        session.setDisplayMediaRequestHandler((_, c) => c(handler('displayMedia') || {}))
        session.setDevicePermissionHandler(() => handler('device'))
        session.setBluetoothPairingHandler((_, c) => c(handler('bluetooth') || { confirmed: false }))
    }

    /**
     * Deny all permissions on session and log it.
     * @param {Electron.Session} session 
     */
    #printDetails(session) {
        const handler = (t, p, d) => {
            console.log(t, 'permission: {', p, '}, with details:', JSON.stringify(d).replace(/\\n/g, ' '))
            return true
        }
        session.setPermissionRequestHandler((_, p, c, d) => c(handler('request', p, d)))
        session.setPermissionCheckHandler((_, p, o, d) => { d.requestingOrigin = o; handler('check', p, d) })
        session.setDisplayMediaRequestHandler((r, c) => c(handler('displayMedia', 'displayMedia', r) || null))
        session.setDevicePermissionHandler((d) => handler('device', 'device', d))
        session.setBluetoothPairingHandler((d, c) => c(handler('pairing', 'bluetooth', d) || { confirmed: false }))
    }

    #formatPermission(permission, type) {
        if (type === void 0) { return permission }
        return `${permission}:${type}`
    }

    /**
     * Creates a URL object from the first valid URL in the list
     * @param {...string} urls - List of URLs to try in order of preference
     * @returns {URL|undefined} - URL object if successful, undefined otherwise
     */
    #createValidURL(...urls) {
        try {
            const validUrlString = urls.find(url => url != null && url !== '')
            if (!validUrlString) { return void 0 }
            return new URL(validUrlString)
        } catch (e) {
            console.warn('Failed to create URL from provided values:', e)
            return void 0
        }
    }
}

export default PermissionsHandler