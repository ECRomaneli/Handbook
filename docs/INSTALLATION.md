# Installation Guide

Download the appropriate version for your OS from the [Releases page](https://github.com/ECRomaneli/Handbook/releases).

> **Note:** Handbook is not code-signed. See [About App Signature](../README.md#about-app-signature) and the [Troubleshooting Guide](TROUBLESHOOTING.md) for more information.

---

## macOS

### Download

Download the ZIP file corresponding to your processor architecture:

| Processor      | File                                       |
|----------------|--------------------------------------------|
| Intel          | `Handbook-{version}-darwin-x64.zip`        |
| Apple Silicon  | `Handbook-{version}-darwin-arm64.zip`      |

### Install

1. Locate the downloaded ZIP file and double-click to unzip it. This creates a `Handbook.app` file.
2. Drag and drop `Handbook.app` into the **Applications** folder.
   - Alternatively: right-click `Handbook.app` > Copy, then navigate to Applications > Paste.
3. Launch Handbook from the Applications folder.

> **First launch:** macOS may block unsigned apps. See [Troubleshooting — macOS Security Warning](TROUBLESHOOTING.md#macos-security-warning) for instructions on bypassing this.

---

## Linux

### Download

Download the package suitable for your distribution:

| Distribution       | File                                    |
|--------------------|-----------------------------------------|
| Debian-based (Ubuntu, Mint, etc.) | `handbook_{version}_amd64.deb` |
| Red Hat-based (Fedora, CentOS, etc.) | `handbook-{version}.x86_64.rpm` |

### Install

Open a terminal and navigate to the download directory:

```bash
cd ~/Downloads
```

#### Debian-based (DEB)

```bash
sudo dpkg -i handbook_{version}_amd64.deb
```

#### Red Hat-based (RPM)

```bash
sudo rpm -i handbook-{version}.x86_64.rpm
```

### Launch

After installation, launch Handbook from the application menu.

#### Linux-Specific Behavior

Due to tray event limitations on Linux:

- **Clicking** the tray icon opens the context menu (instead of toggling page visibility).
- A **"Toggle Window"** item is added at the top of the context menu for quick access.

---

## Windows

### Download

Download `Handbook-Setup-{version}.exe` from the [Releases page](https://github.com/ECRomaneli/Handbook/releases).

### Install

1. Locate the downloaded `Handbook-Setup-{version}.exe` file.
2. Double-click to run the installer.
3. Follow the on-screen instructions.
4. Wait for the depackaging process to finish.
5. Handbook will be available on the desktop and in the Start menu.

### Verify Tray Icon

After installation, look for the Handbook icon in the **system tray** (bottom-right corner, near the clock).

If the icon is not visible:

1. Click the **upward arrow (^)** to expand hidden tray icons.
2. Find the Handbook icon.
3. **Drag** it from the expanded area to the main tray area for permanent visibility.

---

## First Launch

Handbook is a **tray application** — all interaction happens through the system tray icon.

On first launch, the **Preferences** window will open automatically since no pages are configured yet. Add your first page (e.g., `https://chat.openai.com`) to get started.

Once at least one page is configured, "Preferences" will no longer pop up automatically but will remain accessible via the tray icon's right-click menu.

---

## Next Steps

- [Configuration Guide](CONFIGURATION.md) — Set up pages, window behavior, shortcuts, and more
- [Troubleshooting](TROUBLESHOOTING.md) — Solutions for common issues
