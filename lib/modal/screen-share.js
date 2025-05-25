import { desktopCapturer } from 'electron'
import path from 'node:path'
import { Path } from '../constants.js'
import Modal from './modal.js'

class ScreenShareModal {
    static #capturerOptions = { types: ['screen', 'window'], fetchWindowIcons: true, thumbnailSize: { width: 240, height: 100 } }
    static #ROOT_PATH = path.join(Path.WEB, 'screen-share')
    #options = null
    #sources = null

    /** @type {Modal} */
    #modal = null

    constructor() {
        this.#modal = new Modal({
            filePath: path.join(ScreenShareModal.#ROOT_PATH, 'index.html'), 
            disableParentEvents: true, 
            lockModalToWindow: true
        })
        .setWindowOptions({
            width: 600,
            height: 380,
            alwaysOnTop: true,
            movable: true,
            resizable: false,
            show: false,
            transparent: process.platform === 'linux',
            webPreferences: { preload: path.join(ScreenShareModal.#ROOT_PATH, 'preload.js') }
        })
        .setWindowHandler((window) => {
            // window.webContents.openDevTools()
            window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
            this.onceClose(() => { this.#modal.close() })
            this.#sendData(this.#options)
            window.show()
        })
    }

    /**
     * Used by the request() method to open the modal. Do not call this method directly.
     * @param {{ requesterUrl: String, shareAudioBtn?: Boolean, parent?: BrowserWindow }} opts 
     */
    async #open(opts) {
        if (!this.#modal.isOpen()) { this.#options = opts }
        this.#sources = await this.getSources()
        this.#modal.open({ parent: this.#options.parent })
    }

    /**
     * Request Screen Share. This is a promise-based method that will resolve when the modal is closed.
     * @param {{ requesterUrl?: String, shareAudioBtn?: Boolean, parent?: BrowserWindow }} opts
     * @returns {Promise<{ id: String, name: String, shareAudio?: Boolean } | void>}
     */
    request(opts) {
        return new Promise((resolve, reject) => {
            try {
                this.onceClose((source) => {
                        if (!source || !source.id) { return resolve(void 0) }
                        source.shareAudio = opts.shareAudioBtn ? source.shareAudio : false
                        resolve(source)
                    })
                    .#open(opts)
                    .catch((err) => { throw err })
            } catch (err) { reject(err) }
        })
    }

    #sendData(opts) {
        this.#modal.sendToRenderer('screenShare.open', {
            requesterUrl: opts.requesterUrl,
            shareAudioBtn: opts.shareAudioBtn,
            sources: this.#sources,
        })
    }

    onceReady(listener) { this.#modal.onceRenderer('screenShare.ready', listener); return this }
    onceClose(listener) { this.#modal.onceRenderer('screenShare.close', listener); return this }

    getSources() {
        return new Promise((resolve, reject) => {
            desktopCapturer
                .getSources(ScreenShareModal.#capturerOptions)
                .then((sources) => resolve(ScreenShareModal.#groupSourcesByType(sources)))
                .catch(reject)
        })
    }

    static #groupSourcesByType(sources) {
        return sources.reduce((result, item) => {
            (item.id.startsWith('window:') ? result.window : result.screen).push({
                id: item.id,
                name: item.name,
                thumbnail: item.thumbnail.toDataURL(),
                icon: item.appIcon ? item.appIcon.toDataURL() : void 0,
            })
            return result
        }, { screen: [], window: [] })
    }
}

export default ScreenShareModal