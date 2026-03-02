app.use({
  install: async (app) => {
    if (!require) { console.warn('Require is not defined'); return }
    const { ipcRenderer } = require('electron')
    const { version } = require('../../../package.json')

    const $remote = {
      storage: {
        getPages: async () => ipcRenderer.invoke('preferences:get-pages'),
        setPages: (pages) => { ipcRenderer.send('preferences:pages-updated', pages) },

        getSettings: async (id) => ipcRenderer.invoke('preferences:get-settings', id),
        setSettings: (id, newValue) => { ipcRenderer.send('preferences:settings-updated', id, newValue) },

        getPermissions: async (session, url, permission) => ipcRenderer.invoke('preferences:get-permissions', session, url, permission),
        setPermission: (session, url, permission, value) => ipcRenderer.send('preferences:permissions-updated', session, url, permission, value),
        revokePermissions: (session, url, permission) => ipcRenderer.send('preferences:permissions-revoke', session, url, permission)
      },

      preferences: {
        emitReady: () => { ipcRenderer.send('preferences:ready') },
        onPermissionsUpdated: (callback) => { ipcRenderer.on('preferences:permissions-updated', (_, permissions) => { callback(permissions) }) },
        onPermissionsQuery: (callback) => { ipcRenderer.on('preferences:permissions-query', (_, query) => { callback(query) }) },
        onUpdateRenderer: (callback) => { ipcRenderer.on('preferences:settings-updated', (_, id, value) => { callback(id, value) }) },
        confirm: (data) => ipcRenderer.invoke('preferences:confirm', data),
        getConstants: () => ipcRenderer.invoke('preferences:constants')
      },

      updater: {
        checkForUpdates: () => { ipcRenderer.send('updater:check-for-updates') },
        downloadUpdate: () => { ipcRenderer.send('updater:download-update') },
        installUpdate: () => { ipcRenderer.send('updater:install-update') },
        getStatus: () => { ipcRenderer.send('updater:get-status') },
        onStatusChanged: (callback) => { ipcRenderer.on('updater:status-changed', (_, status) => { callback(status) }) }
      },

      window: {
        dragstart: () => { ipcRenderer.send('preferences:dragStart') },
        dragging: () => { ipcRenderer.send('preferences:dragging') },
        close: () => { ipcRenderer.send('preferences:close') }
      },

      version: version
    }

    app.provide('$remote', $remote)
    app.provide('$const', await $remote.preferences.getConstants())
    window.$remote = $remote
  }
})