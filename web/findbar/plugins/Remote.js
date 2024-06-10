app.use({
    install: (app) => {
        if (!require) { console.warn('Require is not defined'); return }
        const { ipcRenderer } = require('electron')

        const $remote = {
            getInitialInput: async () => ipcRenderer.invoke('findbar.initial-input'),
            inputChange: (value) => { ipcRenderer.send('findbar.input-change', value) },
            previous: () => { ipcRenderer.send('findbar.previous') },
            next: () => { ipcRenderer.send('findbar.next') },
            close: () => { ipcRenderer.send('findbar.close') },
            onMatchesChange: (listener) => { ipcRenderer.on('findbar.matches', listener) },
        }

        app.provide('$remote', $remote)
        window.$remote = $remote
    }
})