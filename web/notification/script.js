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
            ready: () => ipc.send('notification.ready'),
            close: (...args) => ipc.send('notification.close', ...args)
        }
    }) (require('electron').ipcRenderer, require('node:events'))

    const title = document.getElementById('title')
    const message = document.getElementById('message')
    const optionLabel = document.getElementById('option-label')
    const buttons = document.getElementById('buttons')
    let optionCheckbox = document.getElementById('option-checkbox')

    function render(data) {
        let defaultBtn = null
        title.innerText = data.title
        message.innerHTML = data.message
        buttons.innerHTML = ''
        data.buttons.forEach((btn, i) => {
            const button = document.createElement('button')
            button.classList.add('btn')
            button.tabIndex = i + 1
            button.innerText = btn
            button.addEventListener('click', () => {
                $bridge.close({ response: i, checkboxChecked: optionCheckbox?.checked })
            })
            buttons.appendChild(button)
            if (data.cancelId === i) { button.id = 'cancel-btn' }
            if (data.defaultId === i) { defaultBtn = button }
        })
        if (data.checkboxLabel) {
            optionCheckbox.checked = data.checkboxChecked ?? false
            optionLabel.innerText = data.checkboxLabel
        } else {
            optionCheckbox.parentElement.innerHTML = ''
            optionCheckbox = void 0
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
        if (process.platform === 'linux') { document.body.classList.add('linux-border') }
        $bridge.onOpen((data) => { render(data) })
        $bridge.ready()
    })
}) ()