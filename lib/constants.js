import path from 'node:path'
import { fileURLToPath } from 'node:url'

const Settings = {
    SHOW_FRAME: 'show_frame',
    BACKGROUND_COLOR: 'background-color',
    RESET_BOUNDS: 'reset_bounds',
    SHARE_BOUNDS: 'share_bounds',
    DEFAULT_POSITION: 'default_position',
    DEFAULT_WIDTH: 'default_width',
    DEFAULT_HEIGHT: 'default_height',
    HIDE_SHORTCUT: 'hide_shortcut',
    GLOBAL_SHORTCUT: 'global_shortcut',
    FOCUS_OPACITY: 'focus_opacity',
    BLUR_OPACITY: 'blur_opacity',
    KEEP_OPACITY_WHEN_MAXIMIZED: 'keep_opacity_when_maximized',
    ALLOW_FULLSCREEN: 'allow_fullscreen',
    ACTION_AREA: 'action_area',
    TRAY_LONGPRESS: 'tray_longpress',
    APP_THEME: 'app_theme',
    TRAY_ICON_THEME: 'tray_icon_theme'
}

const DefaultSettings = {}
DefaultSettings[Settings.SHOW_FRAME] = false
DefaultSettings[Settings.BACKGROUND_COLOR] = '#171717'
DefaultSettings[Settings.FOCUS_OPACITY] = 100
DefaultSettings[Settings.BLUR_OPACITY] = 70
DefaultSettings[Settings.KEEP_OPACITY_WHEN_MAXIMIZED] = false
DefaultSettings[Settings.ALLOW_FULLSCREEN] = false
DefaultSettings[Settings.RESET_BOUNDS] = 'position'
DefaultSettings[Settings.SHARE_BOUNDS] = true
DefaultSettings[Settings.DEFAULT_POSITION] = 'top-right'
DefaultSettings[Settings.DEFAULT_WIDTH] = 640
DefaultSettings[Settings.DEFAULT_HEIGHT] = 480
DefaultSettings[Settings.ACTION_AREA] = 40
DefaultSettings[Settings.HIDE_SHORTCUT] = ''
DefaultSettings[Settings.GLOBAL_SHORTCUT] = ''
DefaultSettings[Settings.TRAY_LONGPRESS] = 300
DefaultSettings[Settings.APP_THEME] = 'system'
DefaultSettings[Settings.TRAY_ICON_THEME] = 'system'

const Positions = {
    TOP_LEFT:       'top-left',
    TOP_CENTER:     'top-center',
    TOP_RIGHT:      'top-right',
    MIDDLE_LEFT:    'middle-left',
    CENTER:         'center',
    MIDDLE_RIGHT:   'middle-right',
    BOTTOM_LEFT:    'bottom-left',
    BOTTOM_CENTER:  'bottom-center',
    BOTTOM_RIGHT:   'bottom-right'
}

const OS = {
    IS_DARWIN: process.platform === 'darwin',
    IS_LINUX: process.platform === 'linux',
    IS_WIN32: process.platform === 'win32'
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const ROOT = path.join(__dirname, '..')
const Path = {
    ROOT,
    WEB: path.join(ROOT, 'web'),
    ASSETS: path.join(ROOT, 'assets'),
    LOGO: path.join(ROOT, 'assets', 'img', 'icons', 'app', `logo.png`)
}

const Permission = {
    Type: {
        OPEN_EXTERNAL: 'openExternal',
        FILE_SYSTEM: 'fileSystem',
        MEDIA_ACCESS: 'mediaAccess',
        DEVICE: 'device',
        BLUETOOTH: 'bluetooth',
        DISPLAY_MEDIA: 'displayMedia',
        GENERIC: 'generic'
    },
    Status: {
        ALLOW:      'allow',
        ALLOW_ONCE: 'allow-once',
        DENY:       'deny',
        ASK:        'ask'
    },
    Text: {
        // Media permissions
        'media: video': 'Camera',
        'media: audio': 'Microphone',
        'speaker-selection': 'Speaker Selection',
        'media': 'Media Sharing',

        // Location and sensors
        'geolocation': 'Location',

        // System
        'notifications': 'Notifications',
        'midi': 'MIDI Devices',
        'midi-sysex': 'MIDI System Access',
        'idle-detection': 'User Activity Detection',
        'clipboard-read': 'Read from Clipboard',
        'clipboard-write': 'Write to Clipboard',
        'clipboard-sanitized-write': 'Write Text to Clipboard',

        // File system
        'file-system': 'File System Access',
        'file-system-write': 'Write to Files',
        'file-system-read': 'Read Files',
        
        // External resources
        'openExternal': 'Open External Applications',
        'protocol-register': 'Register Protocol Handler',
        
        // Device access
        'usb': 'USB Devices',
        'serial': 'Serial Ports',
        'bluetooth': 'Bluetooth Devices',
        'bluetooth-scanning': 'Bluetooth Scanning',
        'hid': 'Input Devices',
        'pointerLock': 'Lock Pointer',
        'keyboardLock': 'Lock Keyboard',

        // Window management
        'fullscreen': 'Fullscreen Mode',
        'automatic-fullscreen': 'Automatic Fullscreen',

        // Storage
        'persistent-storage': 'Persistent Storage',
        'background-sync': 'Background Sync',

        // Other
        'wake-lock': 'Prevent Sleep Mode'
    }
}

export { Settings, Positions, OS, Path, DefaultSettings, Permission }