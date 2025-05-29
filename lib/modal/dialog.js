import path from 'node:path'
import { Path } from '../constants.js'
import Modal from './modal.js'

/**
 * @typedef {Object} DialogOptions
 * @property {string} [title] - Title of the message box.
 * @property {number} [message] - Content of the message box.
 * @property {number} [textWidth] - Width in pixels of the message box. If not set, the width will be set to 400.
 * @property {boolean} [buttons] - 
     * Array of texts for buttons. By default, a single "OK" button will be used.
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

/**
 * @typedef {Object} AlertOptions
 * @property {string} [title] - Title of the message box.
 * @property {number} message - Content of the message box.
 * @property {number} [textWidth] - Width in pixels of the message box. If not set, the width will be set to 400.
 */

/**
 * @typedef {Object} ConfirmOptions
 * @property {string} [title] - Title of the message box.
 * @property {number} [message] - Content of the message box. By default, this will be set to "Confirm?".
 * @property {number} [textWidth] - Width in pixels of the message box. If not set, the width will be set to 400.
 * @property {boolean} [buttons] - 
     * Array of texts for buttons. By default, this will be set to `['Yes', 'No']`.
 * @property {number} [defaultId] - 
     * Index of the button in the buttons array which will be selected by default when 
     * the message box opens.
 * @property {number} [cancelId] - 
     * The index of the button to be used to cancel the dialog, via the `Esc` key. By
     * default this is assigned to the first button with "cancel" or "no" as the label.
     * If no such labeled buttons exist and this option is not set, `0` will be used as
     * the return value.
 */

class Dialog {
    static #DEFAULT_ALERT_BUTTONS = ['OK']
    static #DEFAULT_CONFIRM_BUTTONS = ['Yes', 'No']
    static #DEFAULT_WIDTH = 400
    static #ROOT_PATH = path.join(Path.WEB, 'dialog')

    /** @type {DialogOptions} */
    #options = null

    /** @type {Modal} */
    #modal = null

    constructor() {
        this.#modal = new Modal({
            filePath: path.join(Dialog.#ROOT_PATH, 'index.html'), 
            disableParentEvents: true, 
            lockModalToWindow: true 
        })
        .setWindowOptions({
            width: Dialog.#DEFAULT_WIDTH,
            height: 1,
            alwaysOnTop: true,
            movable: true,
            resizable: false,
            show: false,
            transparent: process.platform === 'linux',
            webPreferences: { preload: path.join(Dialog.#ROOT_PATH, 'preload.js') }
        })
        .setWindowHandler((window) => {
            // window.webContents.openDevTools()
            window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
            if (this.#options.textWidth) { Dialog.#setWidth(window, this.#options.textWidth) }
            this.onceClose(() => { this.#modal.close() })
                .#onceSetHeight(h => {
                    Dialog.#setHeight(window, h)
                    window.show()
                })
            this.#sendData(this.#options)
        })
    }

    /**
     * Used by the show() method to open the modal. Do not call this method directly.
     * @param {DialogOptions} opts
     * @param {Electron.BaseWindow} parent
     */
    #open(parent, opts) {
        if (!this.#modal.isOpen()) {
            this.#options = opts
            if (!this.#options.buttons || this.#options.buttons.length === 0) {
                this.#options.buttons = Dialog.#DEFAULT_ALERT_BUTTONS
                this.#options.defaultId = 0
                this.#options.cancelId = 0
            } else if (!this.#options.cancelId) {
                this.#options.cancelId = 0
            }
        }
        this.#modal.open({ parent })
    }

    /**
     * Show dialog. This is a promise-based method that will resolve when the modal is closed.
     * @param {Electron.BaseWindow} [parent] Parent window to attach the modal to. If null, the modal will be
     * opened in the center of the screen.
     * @param {DialogOptions} opts Dialog options.
     * @returns {Promise<Electron.MessageBoxReturnValue>}
     */
    show(parent, opts) {
        return new Promise((resolve, reject) => {
            try { this.onceClose(resolve).#open(parent, opts) }
            catch (err) { reject(err) }
        })
    }

    /**
     * Show alert dialog. This is a promise-based method that will resolve when the modal is closed.
     * @param {Electron.BaseWindow} [parent] Parent window to attach the modal to. If null, the modal will be
     * opened in the center of the screen.
     * @param {AlertOptions} opts Alert options.
     * @returns {Promise<void>}
     */
    async alert(parent, opts) {
        opts = opts || {}
        opts.textWidth = opts.textWidth || Dialog.#DEFAULT_WIDTH
        opts.buttons = opts.buttons || Dialog.#DEFAULT_ALERT_BUTTONS
        opts.defaultId = void 0
        if (!opts.message) { throw new Error('Dialog.alert() must have a message') }
        await this.show(parent, opts)
    }

    /**
     * Show confirmation dialog. This is a promise-based method that will resolve when the modal is closed.
     * @param {Electron.BaseWindow} [parent] Parent window to attach the modal to. If null, the modal will be
     * opened in the center of the screen.
     * @param {ConfirmOptions} opts Confirmation options.
     * @returns {Promise<Boolean>} True if confirmed, false if cancelled.
     */
    async confirm(parent, opts) {
        opts = opts || {}
        opts.message = opts.message || 'Confirm?'
        opts.textWidth = opts.textWidth || Dialog.#DEFAULT_WIDTH
        if (!opts.buttons) {
            opts.buttons = Dialog.#DEFAULT_CONFIRM_BUTTONS
            opts.defaultId = opts.defaultId ?? 1
            opts.cancelId = opts.cancelId ?? 1
        }

        if (opts.buttons.length > 2) { throw new Error('Dialog.confirm() only supports two buttons') }
        return (await this.show(parent, opts)).response !== opts.cancelId
    }

    #sendData(opts) {
        this.#modal.sendToRenderer('dialog.open', opts)
    }

    onceClose(listener) { this.#modal.onceRenderer('dialog.close', listener); return this }
    #onceSetHeight(listener) { this.#modal.onceRenderer('dialog.setHeight', listener); return this }

    /**
     * Request dialog. This is a promise-based method that will resolve when the modal is closed.
     * @param {Electron.BaseWindow} [parent] Parent window to attach the modal to. If null, the modal will be
     * opened in the center of the screen.
     * @param {DialogOptions} opts Dialog options.
     * @returns {Promise<Electron.MessageBoxReturnValue>}
     */
    static show(parent, opts) {
        return (new Dialog()).show(parent, opts)
    }

    /**
     * Show confirmation dialog. This is a promise-based method that will resolve when the modal is closed.
     * @param {Electron.BaseWindow} [parent] Parent window to attach the modal to. If null, the modal will be
     * opened in the center of the screen.
     * @param {ConfirmOptions} opts Confirmation options.
     * @returns {Promise<Boolean>} True if confirmed, false if cancelled.
     */
    static confirm(parent, opts) {
        return (new Dialog()).confirm(parent, opts)
    }

    /**
     * Show alert dialog. This is a promise-based method that will resolve when the modal is closed.
     * @param {Electron.BaseWindow} [parent] Parent window to attach the modal to. If null, the modal will be
     * opened in the center of the screen.
     * @param {AlertOptions} opts Alert options.
     * @returns {Promise<void>}
     */
    static alert(parent, opts) {
        return (new Dialog()).alert(parent, opts)
    }

    static #setWidth(window, width) {
        window.setContentSize(width, window.getContentSize()[1])
    }

    static #setHeight(window, height) {
        window.setContentSize(window.getContentSize()[0], height)
    }
}

export default Dialog