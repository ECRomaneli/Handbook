const $bridge = ((ipc, EventEmitter) => {
    const $bus = new EventEmitter()
    ipc.on('storage.settings.updated', (_e, id, value) => $bus.emit(`settings.${id}.updated`, value))
    return {
        onSettingsUpdated: (id, fn) => $bus.on(`settings.${id}.updated`, fn),
        getSettings: async (id) => await ipc.invoke('storage.settings', id),
        notifyManager: (e, ...args) => ipc.send(`manager.currentPage.${e}`, ...args)
    }
}) (require('electron').ipcRenderer, require('node:events'))

// Register actions after DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    setupShortcut()

    const showFrame = await $bridge.getSettings('show_frame')
    !showFrame && registerActions()

    console.info('Preloaded')
}, true)

// Actions Logic

async function registerActions() {
    let actionArea = await $bridge.getSettings('action_area')
    $bridge.onSettingsUpdated('action_area', (value) => actionArea = value)

    const originalCursor = document.body.style.cursor
    const isLeftClickInActionArea = (e, height) => e.button === 0 && e.clientY <= height

    document.addEventListener('dblclick', (e) => {
        if (!isLeftClickInActionArea(e, actionArea)) { return }
        e.preventDefault()
        e.stopImmediatePropagation()
        $bridge.notifyManager('toggleMaximize')
    }, true)

    document.addEventListener('mousedown', (e) => {
        if (!isLeftClickInActionArea(e, actionArea)) { return }

        $bridge.notifyManager('dragStart')

        const offsetX = e.screenX
        const offsetY = e.screenY

        document.body.style.setProperty('cursor', 'move', 'important')
    
        const onMouseMove = (e) => {
            e.preventDefault()
            $bridge.notifyManager('dragging', { x: e.screenX - offsetX, y: e.screenY - offsetY })
        }
    
        const onMouseUp = () => {
            document.body.style.cursor = originalCursor
            document.removeEventListener('mousemove', onMouseMove)
            document.removeEventListener('mouseup', onMouseUp)
        }
    
        document.addEventListener('mousemove', onMouseMove)
        document.addEventListener('mouseup', onMouseUp)
    }, true)
}

async function setupShortcut() {
    let hideShortcut = await $bridge.getSettings('hide_shortcut')
    $bridge.onSettingsUpdated('hide_shortcut', (value) => hideShortcut = value)

    document.addEventListener('keydown', (e) => {
        if (hideShortcut && hideShortcut === getKeyCombination(e)) {
            e.preventDefault()
            $bridge.notifyManager('hide')
        }
    })
}

function getKeyCombination(event) {
    let key = event.key.toLowerCase()

    // Handle arrows (e.g. ArrowLeft => Left)
    if (key.indexOf('arrow') === 0) { key = key.slice(5) }
    
    key = key.charAt(0).toUpperCase() + key.slice(1)

    // Handle dead keys that needs a second key to work properly
    if (key === 'Dead') { return '' }
    
    // Format some keys
    if (key === 'Control') { key = 'Ctrl' }
    else if (key === 'Escape') { key = 'Esc' }

    // Handle combinations
    let keyComb = key
    if (event.shiftKey && key !== 'Shift')  { keyComb = 'Shift+' + keyComb }
    if (event.metaKey && key !== 'Meta')    { keyComb = 'Meta+' + keyComb  }
    if (event.altKey && key !== 'Alt')      { keyComb = 'Alt+' + keyComb   }
    if (event.ctrlKey && key !== 'Ctrl')    { keyComb = 'Ctrl+' + keyComb  } 

    return keyComb
}