# Build Guide

This guide covers building Handbook from source, running in development mode, and creating distribution artifacts.

## Prerequisites

- **Node.js** — Tested with versions `16.x` through `22.x`. Always designed to be compatible with the latest version at the Handbook release date.
  - Install from the [official Node.js website](https://nodejs.org/)
- **Git** — For cloning the repository

## Setup

### 1. Clone the Repository

```bash
git clone https://github.com/ECRomaneli/Handbook.git
cd Handbook
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Run the Application

```bash
npm start
```

The Electron application will launch and you can explore the app.

## Development

### Available Scripts

| Command             | Description                                      |
|---------------------|--------------------------------------------------|
| `npm start`         | Start the Electron application                   |
| `npm run build`     | Build the TypeScript source (production)         |
| `npm run build:dev` | Build the TypeScript source (development)        |
| `npm run watch`     | Build in watch mode (auto-rebuild on changes)    |

### Development Workflow

1. Run `npm run watch` in one terminal to auto-rebuild on file changes.
2. Run `npm start` in another terminal to launch the app.
3. After making changes to TypeScript files, restart the app to see changes.

> Web files (`web/` directory) are loaded directly and may not require a rebuild, depending on the change.

## Creating Distribution Artifacts

After setting up the project, choose the target for your platform and run the corresponding command:

| Target                                 | Command                   |
|----------------------------------------|---------------------------|
| macOS x64 APP (Zipped App)             | `npm run dist:mac-x64`   |
| macOS arm64 APP (Zipped App)           | `npm run dist:mac-arm64` |
| Linux x64 DEB (Debian-based)           | `npm run make:linux-deb` |
| Linux x64 RPM (Red Hat-based)          | `npm run make:linux-rpm` |
| Windows x64 EXE (Installer)           | `npm run make:win`        |

The resulting artifacts will be placed in the `dist/` directory.

## Project Structure

```
src/                    # Main process (TypeScript)
  ├── main.ts           # Entry point
  ├── Bootstrap.ts      # App initialization
  ├── AppState.ts       # Global state management
  ├── service/          # Core services
  │   ├── ApplicationService.ts   # App setup, shortcuts, themes
  │   ├── FrameService.ts         # Main window management
  │   ├── PageService.ts          # Page lifecycle and navigation
  │   ├── ViewService.ts          # Web content (WebContentsView)
  │   ├── TrayService.ts          # System tray integration
  │   ├── MenuService.ts          # Context menus and quick menu
  │   ├── NavbarService.ts        # Navigation bar
  │   ├── PreferencesService.ts   # Settings window
  │   ├── PermissionService.ts    # Permission handling
  │   ├── SyncService.ts          # Import/export and GitHub Gist sync
  │   └── AutoUpdaterService.ts   # Auto-update management
  ├── propagator/       # State propagation (main ↔ renderer)
  ├── model/            # Data models (Page)
  ├── data/             # Constants and persistent storage
  ├── locale/           # i18n translations (9 languages)
  └── util/             # Utilities, modals, debug tools
web/                    # Renderer process (HTML/CSS/JS)
  ├── preferences/      # Settings window UI
  ├── navigation-bar/   # Navigation bar UI
  ├── quick-menu/       # Quick page switcher UI
  ├── screen-share/     # Screen share picker UI
  ├── dialog/           # Dialog/alert UI
  └── assets/           # Styles, images, vendor libs
```

## Related

- [Contributing](../CONTRIBUTING.md) — Code style, PR guidelines
- [Configuration Guide](CONFIGURATION.md) — App settings reference
