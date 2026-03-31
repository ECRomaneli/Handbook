app.use({
  install: async (app) => {
    if (!require) { console.warn('Require is not defined'); return }
    const { ipcRenderer } = require('electron')

    const $remote = {
      storage: {
        getPages: () => ipcRenderer.invoke('preferences:get-pages'),
        setPages: (pages) => { ipcRenderer.send('preferences:pages-updated', pages) },
        onPagesUpdated: (callback) => { ipcRenderer.on('preferences:pages-updated', (_, pages) => { callback(pages) }) },

        getSettings: (id) => ipcRenderer.invoke('preferences:get-settings', id),
        setSettings: (id, newValue) => { ipcRenderer.send('preferences:settings-updated', id, newValue) },

        getPermissions: (session, url, permission) => ipcRenderer.invoke('preferences:get-permissions', session, url, permission),
        setPermission: (session, url, permission, value) => ipcRenderer.send('preferences:permissions-updated', session, url, permission, value),
        revokePermissions: (session, url, permission) => ipcRenderer.send('preferences:permissions-revoke', session, url, permission)
      },

      preferences: {
        emitReady: () => { ipcRenderer.send('preferences:ready') },
        // buttonClick: (id, value) => { ipcRenderer.send('preferences:button-click', id, value) },
        onPermissionsUpdated: (callback) => { ipcRenderer.on('preferences:permissions-updated', (_, permissions) => { callback(permissions) }) },
        onPermissionsQuery: (callback) => { ipcRenderer.on('preferences:permissions-query', (_, query) => { callback(query) }) },
        onUpdateRenderer: (callback) => { ipcRenderer.on('preferences:settings-updated', (_, id, value) => { callback(id, value) }) },
        confirm: (data) => ipcRenderer.invoke('preferences:confirm', data),
        getConstants: () => ipcRenderer.invoke('preferences:constants'),
        i18n: () => ipcRenderer.invoke('preferences:i18n')
      },

      updater: {
        checkForUpdates: () => { ipcRenderer.send('updater:check-for-updates') },
        downloadUpdate: () => { ipcRenderer.send('updater:download-update') },
        installUpdate: () => { ipcRenderer.send('updater:install-update') },
        openDownloadUrl: () => { ipcRenderer.send('updater:open-download-url') },
        getStatus: () => { ipcRenderer.send('updater:get-status') },
        onStatusChanged: (callback) => { ipcRenderer.on('updater:status-changed', (_, status) => { callback(status) }) }
      },

      window: {
        close: () => { ipcRenderer.send('preferences:close') }
      },

      keyCapture: {
        parseToOSKeyCombination: (accelerator) => ipcRenderer.invoke('preferences:parse-to-os-key-combination', accelerator),
        parseToAccelerator: (parsedValue) => ipcRenderer.invoke('preferences:parse-to-accelerator', parsedValue),
        getOSKeyCombinationByEvent: (e) => ipcRenderer.invoke('preferences:get-os-key-combination-by-event', {
          key: e.key, code: e.code, altKey: e.altKey, ctrlKey: e.ctrlKey, metaKey: e.metaKey, shiftKey: e.shiftKey
        })
      },

      sync: {
        importFromFile: () => ipcRenderer.send('sync:import-file'),
        exportToFile: () => ipcRenderer.send('sync:export-file'),
        setSettings: (settings) => ipcRenderer.send('sync:set-settings', settings),
        getSettings: () => ipcRenderer.invoke('sync:get-settings'),
        gistPush: () => ipcRenderer.invoke('sync:gist-push'),
        gistPull: () => ipcRenderer.invoke('sync:gist-pull')
      }
    }

    app.provide('$remote', $remote)
    app.provide('$const', await $remote.preferences.getConstants())
    app.provide('$i18n', await $remote.preferences.i18n());
    window.$remote = $remote
  }
})