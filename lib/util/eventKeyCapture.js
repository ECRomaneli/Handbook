/**
 * Gets the accelerator string from a keyboard keydown event
 * @param {KeyboardEvent} event - Keyboard event
 * @returns {string} Key combination (e.g. "Ctrl+A")
 */
function getAcceleratorByEvent(event) {    
    return getKeysByEvent(event).join('+')
}

/**
 * Gets the OS key combination string from a keyboard keydown event
 * @param {KeyboardEvent} event - Keyboard event
 * @returns {string} Key combination (e.g. "Alt+A" => "Option+A")
 */
function getOSKeyCombinationByEvent(event) {    
    return getKeysByEvent(event).map(k => ACCELERATOR_TO_VIEW[k] ?? k).join('+')
}

function getKeysByEvent(event) {
    let key = CODE_TO_ACCELERATOR[event.code]
    if (!key) {
        console.error('Key not found:', event.code)
        return []
    }
    
    // Build modifier combination with platform-specific ordering
    const keys = []

    if ((event.ctrlKey || event.control) && key !== 'Ctrl') keys.push('Ctrl')
    if ((event.shiftKey || event.shift)  && key !== 'Shift') keys.push('Shift')
    if ((event.metaKey || event.meta) && key !== 'Meta') { keys.push('Meta') }
    if ((event.altKey || event.alt) && key !== 'Alt' && key !== 'AltGr') keys.push('Alt')
    
    keys.push(key)
    return keys
}

/**
 * Normalizes key names for Electron Accelerator compatibility
 * @param {string} keyCombination Key combination string (e.g., "Ctrl+A")
 * @returns {string} Normalized key combination for Electron Accelerator
 * @example Option+Shift+F1 => Alt+Shift+F1
 *          Cmd/Win+Shift+F1 => Meta+Shift+F1
 */
function parseToAccelerator(keyCombination) {
    const keys = keyCombination.split('+').map(k => k.trim())
    return keys.map(k => VIEW_TO_ACCELERATOR[k] ?? k).join('+')
}

/**
 * Normalizes key names for OS-specific compatibility
 * @param {string} accelerator Key combination string (e.g., "Ctrl+A")
 * @returns parsed key combination for OS
 * @example Alt+Shift+F1 => Option+Shift+F1
 *          Meta+Shift+F1 => Cmd/Win+Shift+F1
 */
function parseToOSKeyCombination(accelerator) {
    const keys = accelerator.split('+').map(k => k.trim())
    return keys.map(k => ACCELERATOR_TO_VIEW[k] ?? k).join('+')
}

/**
 * Detects current operating system
 * @returns {string} 'darwin', 'win32' or 'linux'
 */
function detectOperatingSystem() {
    if (process && process.platform) { return process.platform }

    if (navigator.userAgentData) {
        const platform = navigator.userAgentData.platform
        if (platform === 'macOS') return 'darwin'
        if (platform === 'Windows') return 'win32'
        if (platform === 'Linux') return 'linux'
    }
    
    const userAgent = navigator.userAgent
    if (/Mac/.test(userAgent)) return 'darwin'
    if (/Linux/.test(userAgent)) return 'linux'
    if (/Windows/.test(userAgent)) return 'win32'
    
    return 'unknown'
}

const OS = detectOperatingSystem()
const IS_DARWIN = OS === 'darwin'
const IS_WIN = OS === 'win32'

const CODE_TO_ACCELERATOR = {
    AltRight: 'AltGr',
    AltLeft: 'Alt',
    MetaLeft: 'Meta',
    MetaRight: 'Meta',
    ControlLeft: 'Ctrl',
    ControlRight: 'Ctrl',
    Escape: 'Esc',
    Tab: 'Tab',
    Space: 'Space',
    Backspace: 'Backspace',
    ShiftLeft: 'Shift',
    ShiftRight: 'Shift',
    NumLock: 'Numlock',
    CapsLock: 'Capslock',
    ScrollLock: 'ScrollLock',
    NumpadEnter: 'Enter',
    Enter: 'Enter',
    PrintScreen: 'PrintScreen',

    Quote: "'",
    Backquote: '`',
    Backslash: '\\',
    Slash: '/',
    Semicolon: ';',
    BracketLeft: '[',
    BracketRight: ']',
    Comma: ',',
    Period: '.',
    Minus: '-',
    Equal: '=',

    Insert: 'Insert', Delete: 'Delete', Home: 'Home', End: 'End', 
    PageUp: 'PageUp', PageDown: 'PageDown',

    ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right',

    F1: 'F1', F2: 'F2', F3: 'F3', F4: 'F4', F5: 'F5', F6: 'F6', 
    F7: 'F7', F8: 'F8', F9: 'F9', F10: 'F10', F11: 'F12', F12: 'F12',

    Digit0: '0', Digit1: '1', Digit2: '2', Digit3: '3', Digit4: '4',
    Digit5: '5', Digit6: '6', Digit7: '7', Digit8: '8', Digit9: '9',

    KeyA: 'A', KeyB: 'B', KeyC: 'C', KeyD: 'D', KeyE: 'E', KeyF: 'F', KeyG: 'G',
    KeyH: 'H', KeyI: 'I', KeyJ: 'J', KeyK: 'K', KeyL: 'L', KeyM: 'M', KeyN: 'N', 
    KeyO: 'O', KeyP: 'P', KeyQ: 'Q', KeyR: 'R', KeyS: 'S', KeyT: 'T', KeyU: 'U',
    KeyV: 'V', KeyW: 'W', KeyX: 'X', KeyY: 'Y', KeyZ: 'Z',

    Numpad0: 'num0', Numpad1: 'num1', Numpad2: 'num2', Numpad3: 'num3', Numpad4: 'num4',
    Numpad5: 'num5', Numpad6: 'num6', Numpad7: 'num7', Numpad8: 'num8', Numpad9: 'num9',
    NumpadAdd: 'numadd', NumpadDecimal: 'numdec', NumpadDivide: 'numdiv',
    NumpadMultiply: 'nummult', NumpadSubtract: 'numsub',
}

const ACCELERATOR_TO_VIEW = {
    Meta: IS_DARWIN ? 'Cmd' : IS_WIN ? 'Win' : 'Super',
    AltGr: IS_DARWIN ? 'ROption' : 'AltGr',
    Alt: IS_DARWIN ? 'Option' : 'Alt',
    Delete: 'Del',
    num0: 'Num 0', num1: 'Num 1', num2: 'Num 2', num3: 'Num 3', num4: 'Num 4',
    num5: 'Num 5', num6: 'Num 6', num7: 'Num 7', num8: 'Num 8', num9: 'Num 9',
    numdec: 'Num .', numadd: 'Num +', numsub: 'Num -', numdiv: 'Num /', nummult: 'Num *'
}

const VIEW_TO_ACCELERATOR = { Command: 'Meta', Windows: 'Meta' }
for (const [key, value] of Object.entries(ACCELERATOR_TO_VIEW)) { VIEW_TO_ACCELERATOR[value] = key }

export { getAcceleratorByEvent, getOSKeyCombinationByEvent, parseToAccelerator, parseToOSKeyCombination }
