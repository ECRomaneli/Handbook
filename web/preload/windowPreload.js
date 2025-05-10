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
    setupShortcut()

    const showFrame = await $bridge.getSettings('show_frame')
    if (!showFrame) { registerActions() }

    console.trace('Preloaded')
}

/**
 * Sets up keyboard shortcuts
 */
async function setupShortcut() {
    let hideShortcut = await $bridge.getSettings('hide_shortcut')
    $bridge.onSettingsUpdated('hide_shortcut', (value) => hideShortcut = value)

    document.addEventListener('keydown', (e) => {
        if (hideShortcut && hideShortcut === getKeyCombination(e)) {
            e.preventDefault()
            e.stopImmediatePropagation()
            $bridge.notifyManager('hide')
        }
    }, true)
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

/**
 * Registers window drag handlers
 * @param {number} actionArea - Height of the action area
 */
function setupWindowDrag(actionArea) {
    let isDragging = false
    
    document.addEventListener('mousedown', (e) => {
        if (!isLeftClickInActionArea(e, actionArea) || isDragging) { return }

        const style = document.body.style
        const originalCursor = style.cursor
        const originalUserSelect = style.userSelect
    
        const onMouseMove = (e) => {
            if ((e.buttons & 1) === 0) { onMouseUp(); return }
            e.preventDefault()
            e.stopImmediatePropagation()
            if (!isDragging) {
                isDragging = true
                $bridge.notifyManager('dragStart')
                style.setProperty('cursor', 'move', 'important')
                style.setProperty('user-select', 'none', 'important')
            }
            $bridge.notifyManager('dragging')
        }
    
        const onMouseUp = () => {
            style.setProperty('cursor', originalCursor)
            style.setProperty('user-select', originalUserSelect)
            document.removeEventListener('mousemove', onMouseMove, true)
            document.removeEventListener('mouseup', onMouseUp, true)
            isDragging = false
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

const OS = detectOperatingSystem()
const IS_DARWIN = OS === 'mac'
const IS_LINUX = OS === 'linux'
const KEY_MAP = {
    'Meta': IS_DARWIN ? 'Command' : IS_LINUX ? 'Super' : 'Win',
    'Alt': IS_DARWIN ? 'Option' : 'Alt',
}
    

/**
 * Gets the key combination string from a keyboard event
 * @param {KeyboardEvent} event - Keyboard event
 * @returns {string} Key combination (e.g., "Ctrl+A")
 */
function getKeyCombination(event) {    
    // Handle the "Process" key issue on Linux
    let key = event.key
    if (key === 'Process' && event.code) {
        key = resolveKeyFromCode(event.code)
    }
    
    // Normalize key names
    key = normalizeKeyName(key)
    
    // Build modifier combination with platform-specific ordering
    const modifiers = []

    if (key === 'Meta') { key = KEY_MAP['Meta'] }
    else if (key === 'Alt') { key = KEY_MAP['Alt'] }

    if (event.ctrlKey && key !== 'Ctrl') modifiers.push('Ctrl')
    if (event.shiftKey && key !== 'Shift') modifiers.push('Shift')
    if (event.metaKey && key !== KEY_MAP['Meta']) { modifiers.push(KEY_MAP['Meta']) }
    if (event.altKey && key !== KEY_MAP['Alt']) modifiers.push(KEY_MAP['Alt'])
    
    return modifiers.length > 0 ? [...modifiers, key].join('+') : key
}

/**
 * Resolves a key from the event code
 * @param {string} code - Event code (e.g., "KeyA", "Digit1")
 * @returns {string} Resolved key
 */
function resolveKeyFromCode(code) {
    if (code.startsWith('Key')) {
        return code.slice(3) // Extract "A" from "KeyA"
    } else if (code.startsWith('Digit')) {
        return code.slice(5) // Extract "1" from "Digit1"
    }
    
    switch (code) {
        case 'Backquote':    return '`'
        case 'Minus':        return '-'
        case 'Equal':        return '='
        case 'BracketLeft':  return '['
        case 'BracketRight': return ']'
        case 'Semicolon':    return ';'
        case 'Quote':        return "'"
        case 'Backslash':    return '\\'
        case 'Comma':        return ','
        case 'Period':       return '.'
        case 'Slash':        return '/'
        // For other keys, use the code directly but format it
        default: return code.replace(/([A-Z])/g, ' $1').trim()
    }
}

/**
 * Normalizes key names across platforms
 * @param {string} key - Raw key name from event
 * @returns {string} Normalized key name
 */
function normalizeKeyName(key) {
    if (key.toLowerCase().startsWith('arrow')) return key.slice(5)
    if (key === ' ') return 'Space'
    if (key === 'Control') return 'Ctrl'
    if (key === 'Escape') return 'Esc'
    if (key === 'Dead') return ''
    
    // Format key display
    if (key.length === 1) {
        return key.toUpperCase()
    } else if (!['Shift', 'Alt', 'Ctrl', 'Meta', 'Command', 'Option', 'Win'].includes(key)) {
        return key.charAt(0).toUpperCase() + key.slice(1).toLowerCase()
    }
    
    return key
}

/**
 * Detects current operating system
 * @returns {string} 'mac', 'windows', 'linux', or 'unknown'
 */
function detectOperatingSystem() {
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

document.addEventListener('DOMContentLoaded', initialize, true)