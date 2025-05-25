app.use({
    install: (app) => {
        if (!require) { console.warn('Require is not defined'); return }
        const { ipcRenderer } = require('electron')

        const $remote = {
            storage: {
                getPages: async () => ipcRenderer.invoke('storage.pages'),
                setPages: (pages) => { ipcRenderer.send('storage.pages.updated', pages) },

                getSettings: async (id) => ipcRenderer.invoke('storage.settings', id),
                setSettings: (id, newValue) => { ipcRenderer.send('storage.settings.updated', id, newValue) },

                getPermissions: async (session, url, permission) => ipcRenderer.invoke('storage.permissions', session, url, permission),
                setPermission: (session, url, permission, value) => ipcRenderer.send('storage.permissions.updated', session, url, permission, value),
                revokePermissions: (session, url, permission) => ipcRenderer.send('storage.permissions.revoke', session, url, permission)
            },

            preferences: {
                emitReady: () => { ipcRenderer.send('preferences.ready') },
                onPermissionsUpdated: (callback) => { ipcRenderer.on('preferences.permissions.updated', (_, permissions) => { callback(permissions) }) },
                onPermissionsQuery: (callback) => { ipcRenderer.on('preferences.permissions.query', (_, query) => { callback(query) }) },
                confirm: (data) => ipcRenderer.invoke('preferences.confirm', data)
            },

            window: {
                dragstart: () => { ipcRenderer.send('preferences.dragStart') },
                dragging: () => { ipcRenderer.send('preferences.dragging') },
                close: () => { ipcRenderer.send('preferences.close') }
            }
        }

        app.provide('$remote', $remote)
        window.$remote = $remote
    }
})