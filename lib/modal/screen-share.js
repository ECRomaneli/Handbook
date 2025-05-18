import { desktopCapturer } from 'electron'
import path from 'node:path'
import { Path } from '../constants.js'
import Modal from './modal.js'

class ScreenShareModal extends Modal {
    #options = null

    constructor() {
        super({ filePath: path.join(Path.WEB, 'screen-share', 'index.html'), disableParentEvents: true, lockModalToWindow: true })

        this.setWindowOptions({
            width: 600,
            height: 380,
            alwaysOnTop: true,
            movable: true,
            resizable: true,
            show: false,
            transparent: process.platform === 'linux'
        })

        this.setWindowHandler((window) => {
            // window.webContents.openDevTools()
            window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
            this.onceClose(() => { this.close(); this.#options.parent.setEnabled(true) })
            this.onceReady(async () => { await this.#sendData(this.#options); window.show() })
        })
    }

    /**
     * Open the screen-share modal. To use promise, use `requestScreenShare` instead.
     * @param {{ requesterUrl: String, shareAudioBtn?: Boolean, parent?: BrowserWindow }} opts 
     */
    open(opts) {
        if (!this.isOpen()) { this.#options = opts }
        super.open({ parent: this.#options.parent })
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
                }).open(opts)
            } catch (err) { reject(err) }
        })
    }

    async #sendData(opts) {
        this.sendToRenderer('screenShare.open', {
            requesterUrl: opts.requesterUrl,
            shareAudioBtn: opts.shareAudioBtn,
            sources: await this.#getSources(),
        })
    }

    onceReady(listener) { return this.onceRenderer('screenShare.ready', listener) }
    onceClose(listener) { return this.onceRenderer('screenShare.close', listener) }

    #getSources() {
        return new Promise((resolve, reject) => {
            desktopCapturer.getSources({ types: ['screen', 'window'], fetchWindowIcons: true, thumbnailSize: { width: 240, height: 100 } })
            .then((sources) => {
                resolve(sources.reduce((result, item) => {
                    (item.id.startsWith('window:') ? result.window : result.screen).push({
                        id: item.id,
                        name: item.name,
                        thumbnail: item.thumbnail.toDataURL(),
                        icon: item.appIcon ? item.appIcon.toDataURL() : void 0,
                    })
                    return result
                }, { screen: [], window: [] }))
            })
            .catch(reject)
        })
    }
}

export default ScreenShareModal