# Configuration Guide

This guide covers all of Handbook's configurable features: pages, window behavior, shortcuts, sessions, permissions, sync, and more.

## Table of Contents

- [Tray Icon](#tray-icon)
- [Pages](#pages)
- [Window Settings](#window-settings)
- [Permissions](#permissions)
- [Sync & Backup](#sync--backup)
- [Quick Menu](#quick-menu)
- [Themes & Language](#themes--language)
- [Auto-Updates](#auto-updates)

---

## Tray Icon

Handbook is a **tray application**. All primary interaction happens through the system tray icon.

| Action | Platform | Behavior |
|--------|----------|----------|
| Click | macOS / Windows | Toggle current page visibility |
| Click | Linux | Open context menu |
| Right-click | All | Open context menu |
| Long-press | macOS | Open context menu |

### Context Menu

The context menu provides access to:

- **Page list** — Click a page to switch to it. Clicking the current page toggles its visibility.
- **Clipboard URL** — Open a URL from the clipboard as a temporary (non-persistent) page.
- **Settings** — Open the preferences window.
- **Quit** — Exit the application.

### Context Menu Symbols

Symbols next to page names indicate their current status:

| Symbol | Meaning         |
|--------|-----------------|
| ❏      | Page is alive (loaded in memory) |
| ✕      | Page is muted   |

---

## Pages

Access via: **Tray Icon > Right-click > Settings > Pages**

Pages are the core concept in Handbook. Each page is a dedicated web view that loads a URL in an always-on-top overlay window.

### Adding a Page

Click the **"+"** button and provide:

- **Label** — Display name shown in the tray menu and quick menu
- **URL** — The web address to load
- **Session ID** — Session group identifier (see [Sessions](#sessions))

### Reordering Pages

Drag and drop pages in the list to reorder them. The order determines their position in the tray context menu.

### Persistent Pages

When **persistence** is enabled for a page, it remains loaded in memory when you switch to another page. This means:

- Unfinished tasks, form inputs, and media playback continue in the background
- Switching back is instant — no page reload
- Slightly higher memory usage per persistent page

When persistence is disabled, the page is destroyed on switch and reloaded from scratch when revisited.

### Sessions

The **Session ID** determines which cookies, cache, and storage a page uses.

- Pages with the **same Session ID** share login state, cookies, and cache.
- Pages with **different Session IDs** are fully isolated.

**Use cases:**

- **Shared login**: Assign the same session to Gmail, Google Drive, and YouTube so you only log into Google once.
- **Multiple accounts**: Use different sessions (e.g., `personal`, `work`) to stay logged into separate accounts simultaneously.
- **Isolation**: Give a page its own session to keep it completely separate.

If no Session ID is specified, the value `default` is automatically assigned.

---

## Window Settings

Access via: **Tray Icon > Right-click > Settings > Window**

### Frame

Toggle the native OS window frame (title bar, close/minimize/maximize buttons). When disabled, the window is frameless and must be moved using the action area.

### Action Area

When the frame is hidden, the **action area** is a draggable region at the top of the window that lets you move it. Configure its height in pixels.

### Opacity

Set separate opacity levels for:

- **Focus opacity** — When the window is active/focused
- **Blur opacity** — When the window is inactive/blurred (not supported on Linux)

This allows the window to become semi-transparent when you're not interacting with it, letting you see your work underneath.

### Position

Choose from 9 preset starting positions:

| | Left | Center | Right |
|---|---|---|---|
| **Top** | Top-Left | Top-Center | Top-Right |
| **Middle** | Middle-Left | Center | Middle-Right |
| **Bottom** | Bottom-Left | Bottom-Center | Bottom-Right |

### Size

Configure the default **width** and **height** for new windows.

### Shared Bounds

When enabled, all pages share the same window position and size. Moving or resizing one page affects all others.

When disabled, the window resets to the configured default position and size when switching pages.

### Fullscreen

Allow or prevent pages from entering fullscreen mode (e.g., for YouTube videos).

### Keyboard Shortcuts

Configure global hotkeys that work from anywhere, even when Handbook is not focused:

| Shortcut | Description |
|----------|-------------|
| **Toggle Window** | Show or hide the current page (disabled by default). **Highly recommended** for productivity. |
| **Hide Window** | Hide the current page without toggling |
| **Quick Menu** | Open the quick menu page switcher (default: `CmdOrCtrl+P`) |

---

## Permissions

Access via: **Tray Icon > Right-click > Settings > Permissions**

Handbook provides fine-grained permission control for web content. Permissions are organized hierarchically:

```
Session → URL → Permission
```

### Supported Permissions

Clipboard, geolocation, camera, microphone, notifications, MIDI, USB/HID devices, Bluetooth, screen sharing, and more.

### Permission Actions

| Status | Behavior |
|--------|----------|
| **Allow** | Permission is granted permanently |
| **Deny** | Permission is denied permanently |
| **Ask** | Prompt the user each time |

### Revoking Permissions

You can revoke permissions at multiple levels:

- **Individual permission** — Revoke a single permission for a specific URL
- **All permissions for a URL** — Reset all permissions for one origin
- **All permissions for a session** — Reset everything for an entire session

### Screen Sharing

When a page requests screen sharing, Handbook shows a native-feeling picker that lets you choose a screen or specific window, with an option to share audio.

---

## Sync & Backup

Access via: **Tray Icon > Right-click > Settings > Sync**

### Local File

- **Export** — Save your entire configuration (pages, settings, permissions) as a JSON file
- **Import** — Load a previously exported configuration file

### GitHub Gist

Sync your configuration to a GitHub Gist for cloud backup or cross-device sync:

1. **Token** — Enter a GitHub personal access token with `gist` scope
2. **Gist ID** — Optionally specify an existing Gist ID (a new one is created if left empty)
3. **Push** — Upload your current configuration to the Gist
4. **Pull** — Download and apply configuration from the Gist

---

## Quick Menu

**Default shortcut:** <kbd>Cmd/Ctrl</kbd> + <kbd>P</kbd>

The Quick Menu is a searchable command palette for switching between pages:

- Press the shortcut to open the floating search bar
- Type to filter pages by name or URL
- Use arrow keys to navigate and Enter to select
- Press Escape to close

The Quick Menu also provides access to Settings.

---

## Themes & Language

### Color Theme

Choose between **System** (follows OS), **Light**, and **Dark** themes. The theme affects the Settings window and UI elements.

### Tray Icon Theme

Choose between **Light**, **Dark**, and **Gray** tray icon styles to match your OS appearance.

### Language

Handbook supports 9 languages:

| Language | Code |
|----------|------|
| English | `en` |
| German | `de` |
| Spanish | `es` |
| French | `fr` |
| Italian | `it` |
| Portuguese (Brazil) | `pt-BR` |
| Portuguese (Portugal) | `pt-PT` |
| Russian | `ru` |

---

## Auto-Updates

Handbook automatically checks for updates. When an update is available:

1. It downloads in the background
2. A notification appears in the Settings (About tab)
3. The update installs automatically when you quit the app

You can also check for updates manually and access the [Releases page](https://github.com/ECRomaneli/Handbook/releases) from the About tab.

---

## Advanced Settings

| Setting | Description |
|---------|-------------|
| **Google API Key** | Custom API key for Google services |
| **External Browser** | Open links in the default browser instead of within Handbook |
| **Group Pages by Session** | Group pages by their Session ID in the tray context menu |
| **Mute Startup Sound** | Mute audio when pages load for the first time |
| **Auto-Launch** | Start Handbook automatically when you log into your computer |
| **Resize/Drag Refresh Rate** | Control how frequently the window updates during resize/drag operations |
