app.use({
    install: (app) => {
        if (!require) { console.warn('Require is not defined'); return }
        const { ipcRenderer } = require('electron')

        const $remote = {
            storage: {
                getPages: async () => ipcRenderer.invoke('storage.pages'),
                setPages: (pages) => { ipcRenderer.send('storage.pages.updated', pages) },

                getSettings: async (id) => ipcRenderer.invoke('storage.settings', id),
                setSettings: (id, newValue) => { ipcRenderer.send('storage.settings.updated', id, newValue) }
            },

            window: {
                dragstart: () => { ipcRenderer.send('settings.dragStart') },
                dragging: (offset) => { ipcRenderer.send('settings.dragging', offset) },
                close: () => { ipcRenderer.send('settings.close') }
            }
        }

        app.provide('$remote', $remote)
        window.$remote = $remote
    }
})