/**
 * Bridge to communicate with main process
 * Encapsulates IPC communication in a clean API
 */
const $bridge = ((ipc, EventEmitter) => {
    const $bus = new EventEmitter()
    ipc.on('storage.settings.updated', (_e, id, value) => $bus.emit(`settings.${id}.updated`, value))
    return {
        onSettingsUpdated: (id, fn) => $bus.on(`settings.${id}.updated`, fn),
        getSettings: async (id) => await ipc.invoke('storage.settings', id),
        notifyManager: (e, ...args) => ipc.send(`manager.currentPage.${e}`, ...args)
    }
})(require('electron').ipcRenderer, require('node:events'))

/**
 * Initialize preload functionality after DOM is ready
 */
async function initialize() {
    const showFrame = await $bridge.getSettings('show_frame')
    if (!showFrame) { registerActions() }

    console.trace('Preloaded')
}

/**
 * Registers all window action handlers
 */
async function registerActions() {
    let actionArea = await $bridge.getSettings('action_area')
    $bridge.onSettingsUpdated('action_area', (value) => actionArea = value)

    setupMaximizeOnDoubleClick(actionArea)
    setupWindowDrag(actionArea)
}

/**
 * Registers maximize on double click
 * @param {number} actionArea - Height of the action area
 */
function setupMaximizeOnDoubleClick(actionArea) {
    document.addEventListener('dblclick', (e) => {
        if (!isLeftClickInActionArea(e, actionArea)) { return }
        e.preventDefault()
        e.stopImmediatePropagation()
        $bridge.notifyManager('toggleMaximize')
    }, true)
}

function setOverlay(status) {
    const id = 'handbook-drag-overlay'
    let overlay = document.getElementById(id)
    if (status && !overlay) {
        overlay = document.createElement('div')
        overlay.id = id
        overlay.style.position = 'fixed'
        overlay.style.top = '0'
        overlay.style.left = '0'
        overlay.style.width = '100%'
        overlay.style.height = '100%'
        overlay.style.zIndex = '2147483647'
        overlay.style.cursor = 'move'
        overlay.style.userSelect = 'none'
        document.body.appendChild(overlay)
    } else if (!status && overlay) {
        document.body.removeChild(overlay)
    }
}

/**
 * Registers window drag handlers
 * @param {number} actionArea - Height of the action area
 */
function setupWindowDrag(actionArea) {
    let isDragging = false
    
    document.addEventListener('mousedown', (e) => {
        if (!isLeftClickInActionArea(e, actionArea) || isDragging) { return }

        const style = document.body.style
        const originalUserSelect = style.userSelect
    
        const onMouseMove = (e) => {
            if ((e.buttons & 1) === 0) { onMouseUp(e); return }
            e.preventDefault()
            e.stopImmediatePropagation()
            if (!isDragging) {
                setOverlay(true)
                style.setProperty('user-select', 'none', 'important')
                isDragging = true
                $bridge.notifyManager('dragStart')
            }
            
            $bridge.notifyManager('dragging')
        }
    
        const onMouseUp = (e) => {
            e.preventDefault()
            e.stopImmediatePropagation()
            style.setProperty('user-select', originalUserSelect)
            document.removeEventListener('mousemove', onMouseMove, true)
            document.removeEventListener('mouseup', onMouseUp, true)
            isDragging = false
            setOverlay(false)
        }
    
        document.addEventListener('mousemove', onMouseMove, true)
        document.addEventListener('mouseup', onMouseUp, true)
    }, true)
}

/**
 * Checks if the click event is in the action area
 * @param {MouseEvent} e - Mouse event
 * @param {number} height - Height of action area
 * @returns {boolean} True if event is a left click in action area
 */
function isLeftClickInActionArea(e, height) {
    return e.button === 0 && e.clientY <= height;
}

document.addEventListener('DOMContentLoaded', initialize, true)