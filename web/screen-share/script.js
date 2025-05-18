(function () {
    /**
     * Bridge to communicate with main process
     * Encapsulates IPC communication in a clean API
     */
    const $bridge = ((ipc, EventEmitter) => {
        const $bus = new EventEmitter()
        ipc.on('screenShare.open', (_e, data) => { $bus.emit('screenShare.open', data) })
        return {
            onOpen: (fn) => $bus.on('screenShare.open', fn),
            ready: () => ipc.send('screenShare.ready'),
            close: (...args) => ipc.send('screenShare.close', ...args)
        }
    }) (require('electron').ipcRenderer, require('node:events'))

    const INVALID_BASE64 = 'data:image/png;base64,'
    const title = document.getElementById('title')
    const tabs = document.querySelectorAll('.tab')
    const content = document.getElementById('content')
    const audioCheckbox = document.getElementById('audioCheckbox')
    const cancelBtn = document.getElementById('cancelBtn')
    const shareBtn = document.getElementById('shareBtn')
    let selectedSource = null

    function renderTab(tabData) {
        content.innerHTML = ''
        selectedSource = null
        shareBtn.disabled = true
        tabData.forEach(item => {
            const div = document.createElement('div')
            div.classList.add('item')
            div.dataset.id = item.id
            div.title = item.name
            const iconImg = item.icon && item.icon !== INVALID_BASE64 ? `<img src="${item.icon}" alt="icon">` : ''
            div.innerHTML = `
                <div class="item-preview"><img src="${item.thumbnail}" alt="preview"></div>
                <div class="item-label">${iconImg}<span>${item.name}</span></div>
            `
            div.addEventListener('click', () => {
                document.querySelectorAll('.item.selected').forEach(el => el.classList.remove('selected'))
                div.classList.add('selected')
                selectedSource = item
                shareBtn.disabled = false
            })
            content.appendChild(div)
        })
    }

    function disableAudioCheckbox() {
        audioCheckbox.checked = false
        audioCheckbox.parentElement.innerHTML = ''
    }

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelector('.tab.active').classList.remove('active');
            tab.classList.add('active')
            renderTab(sources[tab.dataset.tab])
        })
    })

    cancelBtn.addEventListener('click', () => { $bridge.close() })
    shareBtn.addEventListener('click', () => { selectedSource !== null && $bridge.close({ id: selectedSource.id, name: selectedSource.name, shareAudio: audioCheckbox?.checked }) })

    // Add keyboard event listener for ESC key
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            $bridge.close()
        }
    })

    let sources = { 'screen': [], 'window': [] }

    document.addEventListener('DOMContentLoaded', () => {
        if (process.platform === 'linux') { document.body.classList.add('linux-border') }
        $bridge.onOpen((data) => {
            if (!data.shareAudioBtn) { disableAudioCheckbox() }
            if (data.requesterUrl) { title.innerText = `Choose what to share with ${data.requesterUrl}` }
            sources = data.sources
            renderTab(sources['screen'])
        })
        $bridge.ready()
        cancelBtn.focus()
    })
}) ()