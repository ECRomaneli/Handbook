(function () {
    /**
     * Bridge to communicate with main process
     * Encapsulates IPC communication in a clean API
     */
    const $bridge = ((ipc, EventEmitter) => {
        const $bus = new EventEmitter()
        ipc.on('notification.open', (_e, data) => { $bus.emit('notification.open', data) })
        return {
            setHeight: (height) => ipc.send('notification.setHeight', height),
            onOpen: (fn) => $bus.on('notification.open', fn),
            close: (...args) => ipc.send('notification.close', ...args)
        }
    }) (require('electron').ipcRenderer, require('node:events'))

    function render(els, data) {
        let defaultBtn = null
        els.title.innerText = data.title
        els.message.innerHTML = data.message
        els.buttons.innerHTML = ''
        data.buttons.forEach((btn, i) => {
            const button = document.createElement('button')
            button.classList.add('btn')
            button.tabIndex = i + 1
            button.innerText = btn
            button.addEventListener('click', () => {
                $bridge.close({ response: i, checkboxChecked: els.optionCheckbox?.checked })
            })
            els.buttons.appendChild(button)
            if (data.cancelId === i) { button.id = 'cancel-btn' }
            if (data.defaultId === i) { defaultBtn = button }
        })
        if (data.checkboxLabel) {
            els.optionCheckbox.checked = data.checkboxChecked ?? false
            els.optionLabel.innerText = data.checkboxLabel
        } else {
            els.optionCheckbox.parentElement.innerHTML = ''
            els.optionCheckbox = void 0
        }
        $bridge.setHeight(document.body.offsetHeight)
        defaultBtn?.focus()
    }

    // Add keyboard event listener for ESC key
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            document.getElementById('cancel-btn')?.click()
        }
    })

    document.addEventListener('DOMContentLoaded', () => {
        const elements = {
            title: document.getElementById('title'),
            message: document.getElementById('message'),
            optionLabel: document.getElementById('option-label'),
            optionCheckbox: document.getElementById('option-checkbox'),
            buttons: document.getElementById('buttons')
        }

        if (process.platform === 'linux') { document.body.classList.add('linux-border') }
        $bridge.onOpen((data) => { render(elements, data) })
    }, true)
}) ()