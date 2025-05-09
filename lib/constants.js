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
    KEEP_OPACITY_MAXIMIZED: 'keep_opacity_maximized',
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
DefaultSettings[Settings.KEEP_OPACITY_MAXIMIZED] = false
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
    ASSETS: path.join(ROOT, 'assets')
}

export { Settings, Positions, OS, Path, DefaultSettings }