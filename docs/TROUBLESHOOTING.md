# Troubleshooting

Common issues and solutions for Handbook.

## Table of Contents

- [macOS Security Warning](#macos-security-warning)
- [Tray Icon Not Visible](#tray-icon-not-visible)
- [Page Not Loading](#page-not-loading)
- [Shortcuts Not Working](#shortcuts-not-working)
- [Opacity Not Working (Linux)](#opacity-not-working-linux)
- [Permission Issues](#permission-issues)
- [Sync Issues](#sync-issues)

---

## macOS Security Warning

Handbook is not code-signed, so macOS may block it from opening with a message like *"Handbook can't be opened because it is from an unidentified developer"*.

The steps to bypass this depend on your macOS version. For the most up-to-date instructions, refer to the official [Apple Support Guide](https://support.apple.com/en-gb/guide/mac-help/mh40616/mac).

### macOS Sonoma 14+ / Sequoia 15+

1. Open **Apple menu > System Settings**.
2. Click **Privacy & Security** in the sidebar (scroll down if needed).
3. Under Security, find the message about Handbook being blocked and click **Open**.
4. Click **Open Anyway**.
5. Enter your login password and click **OK**.

> This button is available for about an hour after attempting to open the app.

### macOS Ventura 13 or Earlier

1. Open the **Applications** folder in Finder.
2. Hold <kbd>Ctrl</kbd> and click the Handbook icon.
3. Select **Open** from the context menu.
4. Click **Open** on the security warning dialog.

After these steps, the warning will not appear again.

> If the **Open** button doesn't appear the first time, try the process twice.

### Alternative: Build from Source

For full code integrity assurance, you can [build Handbook from source](BUILD.md).

---

## Tray Icon Not Visible

### Windows

The tray icon may be hidden by default:

1. Click the **upward arrow (^)** in the system tray area (bottom-right corner).
2. Find the Handbook icon in the expanded area.
3. **Drag** it to the main tray area to pin it for permanent visibility.

### Linux

Some desktop environments may not show tray icons by default. Ensure your desktop environment supports the system tray (also known as `StatusNotifierItem` or `AppIndicator`).

For GNOME-based desktops, you may need to install an extension like [AppIndicator Support](https://extensions.gnome.org/extension/615/appindicator-support/).

---

## Page Not Loading

- **Check the URL** — Ensure the URL is correct and accessible in a regular browser.
- **Check your network** — Verify your internet connection is active.
- **Session conflict** — If multiple pages share a session and one redirects, it may affect others. Try using a different Session ID.
- **Clear session data** — Remove the page, create it again with a new Session ID to start fresh.

---

## Shortcuts Not Working

Global shortcuts may fail if:

- **Another app** has registered the same shortcut. Try a different key combination.
- **OS permissions** — On macOS, ensure Handbook has accessibility permissions: **System Settings > Privacy & Security > Accessibility**.
- **The shortcut is invalid** — Use Electron-compatible accelerator format (e.g., `CmdOrCtrl+Shift+H`).

---

## Opacity Not Working (Linux)

Window opacity (focus/blur transparency) is **not supported on Linux** due to compositor limitations on most desktop environments. The opacity settings will be ignored.

---

## Permission Issues

If a page isn't working correctly (e.g., can't access clipboard, camera, or microphone):

1. Go to **Settings > Permissions**.
2. Find the relevant session and URL.
3. Check if the permission is set to **Deny**.
4. Change it to **Allow** or **Ask**.

You can also revoke all permissions for a URL or session and re-grant them.

---

## Sync Issues

### GitHub Gist Sync

- **Token errors** — Ensure your GitHub personal access token has the `gist` scope.
- **Gist not found** — Verify the Gist ID is correct. Leave it empty to create a new one.
- **Push fails** — Check your internet connection and token validity.

### Local File Import

- **Invalid file** — Ensure the file is a valid JSON exported by Handbook.
- **Missing pages** — The import replaces your current configuration. Export a backup before importing.

---

## Getting Help

If your issue isn't listed here:

1. Check the [GitHub Issues](https://github.com/ECRomaneli/Handbook/issues) for similar reports.
2. Open a new issue with:
   - Your OS and version
   - Handbook version
   - Steps to reproduce
   - Expected vs. actual behavior
   - Screenshots, if applicable
