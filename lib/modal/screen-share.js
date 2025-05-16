import { BrowserWindow, desktopCapturer, ipcMain } from 'electron'
import path from 'node:path'
import { Path } from '../constants.js'

class ScreenShareModal {
    /** @type {BrowserWindow} */
    #window

    /**
     * Open the screen-share modal. To use promise, use `requestScreenShare` instead.
     * @param {{ requesterUrl: String, shareAudioBtn?: Boolean, parent?: BrowserWindow }} opts 
     */
    open(opts) {
        if (this.#window) { return }
        
        this.#window = new BrowserWindow({
            parent: opts.parent,
            title: 'Screen Share',
            acceptFirstMouse: true,
            autoHideMenuBar: true,
            maximizable: false,
            minimizable: false,
            width: 600,
            height: 380,
            show: false,
            frame: false,
            alwaysOnTop: true,
            webPreferences: {
              nodeIntegration: true,
              contextIsolation: false
            },
            transparent: process.platform === 'linux'
        })

        this.#registerRenderListeners()
        this.#window.webContents.openDevTools()

        this.#window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
        this.onceReady(async () => { await this.#sendData(opts); this.#window.show() })
        this.#window.loadFile(path.join(Path.WEB, 'screen-share', 'index.html'))
        this.#window.on('closed', () => { this.#window = null })
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
        this.#sendToWindow('screenShare.open', {
            requesterUrl: opts.requesterUrl,
            shareAudioBtn: opts.shareAudioBtn,
            sources: await this.#getSources(),
        })
    }

    isOpen() {
        return this.#window && !this.#window.isDestroyed()
    }

    close() {
        if (!this.#window.isDestroyed()) { this.#window.close() }
    }
    
    getWindow() {
        return this.#window
    }

    onceReady(listener) { return this.#once('screenShare.ready', listener) }
    onceClose(listener) { return this.#once('screenShare.close', listener) }

    #getSources() {
        return new Promise((resolve, reject) => {
            desktopCapturer.getSources({ types: ['screen', 'window'], fetchWindowIcons: true })
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

    /**
     * Register listeners for the renderer process.
     */
    #registerRenderListeners() {
        this.onceClose(() => { this.close() })
    }

    #sendToWindow(eventName, ...args) {
        if (!this.#window) { return }
        this.#window.webContents.send(eventName, ...args)
    }

    #isThisWindow(webContents) {
        return this.#window && this.#window.webContents === webContents
    }

    #once(eventName, listener) {
        const wrappedListener = (e, ...args) => {
            if (this.#isThisWindow(e.sender)) {
                listener(...args)
            } else {
                ipcMain.once(eventName, wrappedListener)
            }
        }
        ipcMain.once(eventName, wrappedListener)
        return this
    }
}

export default ScreenShareModal