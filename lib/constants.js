const path = require('node:path')

const WindowSettings = {
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
    ACTION_AREA: 'action_area',
    TRAY_LONGPRESS: 'tray_longpress',
    WINDOW_THEME: 'window_theme'
}

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

const ROOT = path.join(__dirname, '..')
const Path = {
    ROOT,
    WEB: path.join(ROOT, 'web'),
    ASSETS: path.join(ROOT, 'assets')
}

module.exports = { WindowSettings, Positions, OS, Path }