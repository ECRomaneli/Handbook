import path from 'node:path'
import { Path } from '../constants.js'
import Modal from './modal.js'

/**
 * @typedef {Object} NotificationOptions
 * @property {string} [title] - Title of the message box, some platforms will not show it.
 * @property {number} [message] - Content of the message box.
 * @property {number} [textWidth] - Width in pixels of the message box. If not set, the width will be set to 400.
 * @property {boolean} [buttons] - 
     * Array of texts for buttons. On Windows, an empty array will result in one button labeled "OK".
 * @property {number} [defaultId] - 
     * Index of the button in the buttons array which will be selected by default when 
     * the message box opens.
 * @property {number} [cancelId] - 
     * The index of the button to be used to cancel the dialog, via the `Esc` key. By
     * default this is assigned to the first button with "cancel" or "no" as the label.
     * If no such labeled buttons exist and this option is not set, `0` will be used as
     * the return value.
 * @property {string} [checkboxLabel] - If provided, the message box will include a checkbox with the given label.
 * @property {boolean} [checkboxChecked] - Initial checked state of the checkbox. `false` by default.
 */

class NotificationModal extends Modal {
    static #DEFAULT_BUTTONS = ['OK']

    /** @type {NotificationOptions} */
    #options = null

    constructor() {
        super({ filePath: path.join(Path.WEB, 'notification', 'index.html'), disableParentEvents: true, lockModalToWindow: true })

        this.setWindowOptions({
            width: 400,
            height: 1,
            alwaysOnTop: true,
            movable: true,
            resizable: false,
            show: false,
            transparent: process.platform === 'linux'
        })

        this.setWindowHandler((window) => {
            window.webContents.openDevTools()
            window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
            this.onceClose(() => { this.close() })
                .#onceSetHeight(h => {
                    NotificationModal.#setHeight(window, h)
                    window.show()
                })
                .onceReady(() => {
                    if (this.#options.textWidth) { NotificationModal.#setWidth(window, this.#options.textWidth) }
                    this.#sendData(this.#options)
                })
        })
    }

    /**
     * Used by the show() method to open the modal. Do not call this method directly.
     * @param {NotificationOptions} opts
     * @param {Electron.BaseWindow} parent
     */
    async open(parent, opts) {
        if (!this.isOpen()) {
            this.#options = opts
            if (!this.#options.buttons || this.#options.buttons.length === 0) {
                this.#options.buttons = NotificationModal.#DEFAULT_BUTTONS
                this.#options.defaultId = 0
                this.#options.cancelId = 0
            } else if (!this.#options.cancelId) {
                this.#options.cancelId = 0
            }
        }
        super.open({ parent })
    }

    /**
     * Request notification. This is a promise-based method that will resolve when the modal is closed.
     * @param {Electron.BaseWindow} [parent] Parent window to attach the modal to. If null, the modal will be
     * opened in the center of the screen.
     * @param {NotificationOptions} opts Notification options.
     * @returns {Promise<Electron.MessageBoxReturnValue>}
     */
    show(parent, opts) {
        return new Promise((resolve, reject) => {
            try { this.onceClose(resolve).open(parent, opts).catch(reject) }
            catch (err) { reject(err) }
        })
    }

    /**
     * Request notification. This is a promise-based method that will resolve when the modal is closed.
     * @param {Electron.BaseWindow} [parent] Parent window to attach the modal to. If null, the modal will be
     * opened in the center of the screen.
     * @param {NotificationOptions} opts Notification options.
     * @returns {Promise<Electron.MessageBoxReturnValue>}
     */
    static show(parent, opts) {
        return (new NotificationModal()).show(parent, opts)
    }

    static #setWidth(window, width) {
        window.setContentSize(width, window.getContentSize()[1])
    }

    static #setHeight(window, height) {
        window.setContentSize(window.getContentSize()[0], height)
    }

    #sendData(opts) {
        this.sendToRenderer('notification.open', opts)
    }

    onceReady(listener) { return this.onceRenderer('notification.ready', listener) }
    onceClose(listener) { return this.onceRenderer('notification.close', listener) }
    #onceSetHeight(listener) { return this.onceRenderer('notification.setHeight', listener) }
}

export default NotificationModal