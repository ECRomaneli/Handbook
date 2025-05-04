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
    // Detect platform
    const getOS = () => {
        // Try userAgentData (modern API)
        if (navigator.userAgentData) {
            const platform = navigator.userAgentData.platform
            if (platform === 'macOS') return 'mac'
            if (platform === 'Windows') return 'windows'
            if (platform === 'Linux') return 'linux'
        }
        
        // Fallback to userAgent (more compatible)
        const userAgent = navigator.userAgent
        if (/Mac/.test(userAgent)) return 'mac'
        if (/Linux/.test(userAgent)) return 'linux'
        if (/Windows/.test(userAgent)) return 'windows'
        
        return 'unknown'
    }
    
    const os = getOS()
    const isMac = os === 'mac'
    const isLinux = os === 'linux'
    
    // Handle the "Process" key issue on Linux
    let key = event.key
    if (key === 'Process') {
        // On Linux, when IME processing occurs, try to get the real key from event.code
        if (event.code) {
            // Convert code format (like "KeyA") to actual key value
            if (event.code.startsWith('Key')) {
                key = event.code.slice(3) // Extract "A" from "KeyA"
            } else if (event.code.startsWith('Digit')) {
                key = event.code.slice(5) // Extract "1" from "Digit1"
            } else switch (event.code) {
                case 'Backquote':   key = '`'; break
                case 'Minus':       key = '-'; break
                case 'Equal':       key = '='; break
                case 'BracketLeft': key = '['; break
                case 'BracketRight':key = ']'; break
                case 'Semicolon':   key = ';'; break
                case 'Quote':       key = "'"; break
                case 'Backslash':   key = '\\'; break
                case 'Comma':       key = ','; break
                case 'Period':      key = '.'; break
                case 'Slash':       key = '/'; break
                // For other keys, use the code directly but format it
                default: key = event.code.replace(/([A-Z])/g, ' $1').trim()
            }
        } else { key = '' }
    }
    
    // Normalize key names across platforms
    if (key.toLowerCase().startsWith('arrow')) { key = key.slice(5) }
    else if (key === ' ') { key = 'Space' } 
    else if (key === 'Control') { key = 'Ctrl' }
    else if (key === 'Escape') { key = 'Esc' }
    else if (key === 'Dead') { return '' }
    
    // Format key display
    if (key.length === 1) {
        key = key.toUpperCase()
    } else if (!['Shift', 'Alt', 'Ctrl', 'Meta', 'Command', 'Option', 'Win'].includes(key)) {
        key = key.charAt(0).toUpperCase() + key.slice(1).toLowerCase()
    }
    
    // Build modifier combination with platform-specific ordering
    const modifiers = []
    
    if (event.ctrlKey && key !== 'Ctrl') modifiers.push('Ctrl')
    if (event.shiftKey && key !== 'Shift') modifiers.push('Shift')

    if (isMac) {
        if (event.altKey && key !== 'Alt' && key !== 'Option') modifiers.push('Option')
        if (event.metaKey && key !== 'Meta' && key !== 'Command') modifiers.push('Command')
    } else {
        if (event.altKey && key !== 'Alt') modifiers.push('Alt')
        if (event.metaKey && key !== 'Win' && key !== 'Super') { modifiers.push(isLinux ? 'Super' : 'Win') }
    }
    
    return modifiers.length > 0 ? [...modifiers, key].join('+') : key
}