const { ipcRenderer } = require('electron')
const getSettings = async (id) => await ipcRenderer.invoke('storage.settings', id)
const isLeftClickInActionArea = (event, actionAreaHeight) => event.button === 0 && event.clientY <= actionAreaHeight

// Mini event bus to capture settings changes and call the listeners
const fns = {}
ipcRenderer.on('storage.settings.updated', (_e, id, value) => fns[id]?.forEach(fn => fn.call(this, value)))
const onSettingsUpdated = (id, fn) => (fns[id] ?? (fns[id] = [])).push(fn)

// Register actions after DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    const showFrame = await getSettings('show_frame')

    setupShortcut()
    !showFrame && registerActions()
    console.info('Preloaded')
})

// Actions Logic

async function registerActions() {
    let actionArea = await getSettings('action_area')
    onSettingsUpdated('action_area', (value) => actionArea = value)

    const originalCursor = document.body.style.cursor

    document.addEventListener('dblclick', (e) => {
        if (!isLeftClickInActionArea(e, actionArea)) { return }
        e.preventDefault()
        e.stopImmediatePropagation()
        ipcRenderer.send('manager.currentPage.toggleMaximize')
    }, true)

    document.addEventListener('mousedown', (e) => {
        if (!isLeftClickInActionArea(e, actionArea)) { return }

        ipcRenderer.send('manager.currentPage.dragStart')

        const offsetX = e.screenX
        const offsetY = e.screenY

        document.body.style.setProperty('cursor', 'move', 'important')
    
        const onMouseMove = (e) => {
            e.preventDefault()
            ipcRenderer.send('manager.currentPage.dragging', { x: e.screenX - offsetX, y: e.screenY - offsetY })
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
    let hideShortcut = await getSettings('hide_shortcut')
    onSettingsUpdated('hide_shortcut', (value) => hideShortcut = value)

    document.addEventListener('keydown', (e) => {
        if (hideShortcut && hideShortcut === getKeyCombination(e)) {
            e.preventDefault()
            ipcRenderer.send('manager.currentPage.hide')
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