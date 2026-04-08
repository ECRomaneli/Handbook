import { app } from 'electron';
import path from 'node:path';

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
  TRAY_ICON_THEME: 'tray_icon_theme',
  GOOGLE_API_KEY: 'google_api_key',
  USE_EXTERNAL_BROWSER: 'use_external_browser',
  AUTO_LAUNCH: 'auto_launch',
  PREFERRED_LANGUAGE: 'preferred_language',
  APP_LANGUAGE: 'app_language',
  GROUP_PAGES_BY_SESSION: 'group_pages_by_session',
  MUTE_STARTUP_SOUND: 'mute_startup_sound',
  RESIZE_REFRESH_RATE: 'resize_refresh_rate',
  DRAG_REFRESH_RATE: 'drag_refresh_rate',
  QUICK_MENU_SHORTCUT: 'quick_menu_shortcut',
};

const SyncSettings = {
  GIST_ID: 'gist_id',
  GIST_TOKEN: 'gist_token',
};

const Positions = {
  TOP_LEFT: 'topLeft',
  TOP_CENTER: 'topCenter',
  TOP_RIGHT: 'topRight',
  MIDDLE_LEFT: 'middleLeft',
  CENTER: 'center',
  MIDDLE_RIGHT: 'middleRight',
  BOTTOM_LEFT: 'bottomLeft',
  BOTTOM_CENTER: 'bottomCenter',
  BOTTOM_RIGHT: 'bottomRight',
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const DefaultSettings: Record<string, any> = {};
DefaultSettings[Settings.SHOW_FRAME] = true;
DefaultSettings[Settings.BACKGROUND_COLOR] = '#171717';
DefaultSettings[Settings.FOCUS_OPACITY] = 100;
DefaultSettings[Settings.BLUR_OPACITY] = 90;
DefaultSettings[Settings.KEEP_OPACITY_WHEN_MAXIMIZED] = false;
DefaultSettings[Settings.ALLOW_FULLSCREEN] = false;
DefaultSettings[Settings.RESET_BOUNDS] = 'position';
DefaultSettings[Settings.SHARE_BOUNDS] = true;
DefaultSettings[Settings.DEFAULT_POSITION] = Positions.TOP_RIGHT;
DefaultSettings[Settings.DEFAULT_WIDTH] = 620;
DefaultSettings[Settings.DEFAULT_HEIGHT] = 480;
DefaultSettings[Settings.ACTION_AREA] = 40;
DefaultSettings[Settings.HIDE_SHORTCUT] = '';
DefaultSettings[Settings.GLOBAL_SHORTCUT] = '';
DefaultSettings[Settings.TRAY_LONGPRESS] = 300;
DefaultSettings[Settings.APP_THEME] = 'system';
DefaultSettings[Settings.TRAY_ICON_THEME] = 'system';
DefaultSettings[Settings.GOOGLE_API_KEY] = '';
DefaultSettings[Settings.USE_EXTERNAL_BROWSER] = false;
DefaultSettings[Settings.AUTO_LAUNCH] = undefined;
DefaultSettings[Settings.PREFERRED_LANGUAGE] = '';
DefaultSettings[Settings.APP_LANGUAGE] = '';
DefaultSettings[Settings.GROUP_PAGES_BY_SESSION] = false;
DefaultSettings[Settings.MUTE_STARTUP_SOUND] = false;
DefaultSettings[Settings.RESIZE_REFRESH_RATE] = '';
DefaultSettings[Settings.DRAG_REFRESH_RATE] = '';
DefaultSettings[Settings.QUICK_MENU_SHORTCUT] = 'CmdOrCtrl+P';
DefaultSettings[SyncSettings.GIST_ID] = undefined;
DefaultSettings[SyncSettings.GIST_TOKEN] = undefined;

const OS = {
  IS_DARWIN: process.platform === 'darwin',
  IS_LINUX: process.platform === 'linux',
  IS_WIN32: process.platform === 'win32',
};

const ROOT = app.getAppPath();
const Path = {
  ROOT,
  WEB: path.join(ROOT, 'dist', 'web'),
  ASSETS: path.join(ROOT, 'dist', 'assets'),
};

const Permission = {
  Type: {
    OPEN_EXTERNAL: 'openExternal',
    FILE_SYSTEM: 'fileSystem',
    MEDIA_ACCESS: 'mediaAccess',
    DEVICE: 'device',
    BLUETOOTH: 'bluetooth',
    DISPLAY_MEDIA: 'displayMedia',
    GENERIC: 'generic',
  },
  Status: {
    ALLOW: 'allow',
    ALLOW_ONCE: 'allow-once',
    DENY: 'deny',
    ASK: 'ask',
  },
};

const IsProduction = process.env.NODE_ENV === 'production';
const IsDebug = {
  'propagator': !IsProduction && !true,
  'permissions': !IsProduction && !true,
  'storage': !IsProduction && !true,
  'state': !IsProduction && true,
};

export { DefaultSettings, IsDebug, IsProduction, OS, Path, Permission, Positions, Settings, SyncSettings };

