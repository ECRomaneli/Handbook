<p align='center'>
    <a href="https://github.com/ECRomaneli/handbook" style='text-decoration:none'>
        <img src="https://i.postimg.cc/RZ2Pvy5v/handbook.png" alt='Handbook'>
    </a>
</p>
<p align='center'>
    Handbook is a versatile app designed to create small, movable, and easily concealable windows for quick use
</p>
<p align='center'>
    <a href="https://github.com/ECRomaneli/handbook/tags" style='text-decoration:none'>
        <img src="https://img.shields.io/github/v/tag/ecromaneli/handbook?label=version&sort=semver&style=for-the-badge" alt="Version">
    </a>
    &nbsp;
    <a href="https://github.com/ECRomaneli/handbook/commits/master" style='text-decoration:none'>
        <img src="https://img.shields.io/github/last-commit/ecromaneli/handbook?style=for-the-badge" alt="Last Commit">
    </a>
    &nbsp;
    <a href="https://github.com/ECRomaneli/handbook/blob/master/LICENSE" style='text-decoration:none'>
        <img src="https://img.shields.io/github/license/ecromaneli/handbook?style=for-the-badge" alt="License">
    </a>
    &nbsp;
    <a href="https://github.com/ECRomaneli/handbook/issues" style='text-decoration:none'>
        <img src="https://img.shields.io/badge/contributions-welcome-brightgreen.svg?style=for-the-badge" alt="Contributions Welcome">
    </a>
</p>

## Objective

Handbook is a versatile app designed to create small, movable, and easily concealable windows for quick use. Its primary goal is to assist in managing RAM memory efficiently while providing quick access to essential information. With Handbook, users can seamlessly optimize their workflow by accessing necessary data without cluttering their screen space.

> "Handbook was created to assist me in my development process, providing quick-access tools in the most efficient manner while coding. Some of my favorites include ChatGPT, Copilot, Gemini, Notion, WhatsApp, and even YouTube."

### Some Advantages

- Always-on-top windows, even atop fullscreen content, allowing quick retrieval of information.
- Increased focus by avoiding the need to navigate to a web browser for quick searches.
- Reduction in the number of tabs by adding pages that are typically used once but are often forgotten, leading to the opening of new instances.
- Low RAM usage, despite using Chromium. There is only one instance per page.
- Configurability, allowing transparent windows when blurred, customization of default size, position, and shortcuts to show and hide anywhere, among other options.

## Installing

Download the appropriate version for your OS from the [releases](https://github.com/ECRomaneli/Handbook/releases) section and follow the instructions below.

Read about the app signature in "[About App Signature](#about-app-signature)".

### Mac OS

Download the zip file for the correct processor architecture, unzip it, and copy `handbook.app` to the "Applications" folder.

### Troubleshooting

#### Security Warning

As Handbook is not signed, it may not open directly and could trigger a security warning. To bypass it:

1. Open the "Applications" folder.
2. Press "Ctrl + Left Click" on the Handbook icon.
3. Select "Open" in the context menu.
4. Proceed to "Open" the app in the security warning screen.

After these steps, the app will no longer present the warning.

> If the "Open" button does not show, try it twice.

Source: [Apple Support](https://support.apple.com/en-us/guide/mac-help/mh40616/mac).

### Debian-based distributions

1. Download the .deb package.
2. Open a terminal window.
3. Navigate to the directory where the .deb package is located using the `cd` command.
4. Run the command `sudo dpkg -i handbook-x64.deb`.
5. Enter your password when prompted.
6. After installation, you can launch the application from the application menu.

### Red Hat-based distributions

1. Download the .rpm package.
2. Open a terminal window.
3. Navigate to the directory where the .rpm package is located using the `cd` command.
4. Run the command `sudo rpm -i handbook-x64.rpm`.
5. Enter your password when prompted.
6. After installation, you can launch the application from the application menu.

### Windows

Download the `.exe` executable, open it, and follow the steps.

## Getting Started

**Handbook** is a tray app and all interaction with it will be available there. Note that the first time the app is opened, the ["Settings"](#settings) will pop up as there is no page configured yet. Once the first page is set, the ["Settings"](#settings) will no longer pop up, but will be accessible through the tray icon.

<p align='center'>
    <img width="250" src="https://i.postimg.cc/3Nzq7y6c/tray-icon.png" alt='tray-icon'>
    <br/>
    Tray Icon
</p>

### Usage

To keep the user focused, **Handbook** shows a single window at a time, persistent and always-on-top. The user can move, resize, toggle visibility, configure opacity, etc. (see ["Window Settings"](#window-settings) for more). The app refers to these windows as **"Pages"**.

<p align='center'>
    <img width="600" src="https://i.postimg.cc/sDy8HdKP/example.png" alt='Example'>
    <br/>
    ChatGPT page overlaying the settings
</p>

#### Toggle Window Visibility

To toggle window visibility, click on the tray icon or configure the "Toggle Window" shortcut (disabled by default).

> The "Toggle Window" shortcut is a very useful feature. It is by far the most recommended way to toggle the window for productivity.

#### Change Page

To change the page, right-click on the tray icon and select the desired page. If the current page is selected, the page visibility will toggle.

> Mac OS also supports long-press to open the tray icon context menu.

#### Open from Clipboard

It is possible to open a URL directly from the clipboard. Just copy a URL, right-click on the tray icon, and select **"Clipboard URL"**. The page will act as a non-persistent one (see "[Persistent Pages](#persistent-pages)").

#### Linux Usage

Due to some limitations on tray events, there are some differences in the Linux experience:

- Clicking on the tray icon will open the context menu (instead of toggling page visibility).
- An item has been added at the top of the context menu to toggle the current window visibility.

#### Context Menu Symbols

There are symbols in the context menu that can be displayed alongside the page names to represent the current status:

| Icon | Description     |
|------|-----------------|
| ❏    | Page is alive   |
| ✕    | Page is muted   |

### Settings

To access the settings, right-click on the tray icon and select **"Settings"**.

### Pages

The **"Pages"** tab enables users to add, sort, customize, or remove pages. Users can also import or export pages as JSON.

<p align='center'>
    <img width="600" src="https://i.postimg.cc/bwrVw0tg/settings-page.png" alt='Pages'>
</p>

#### Session ID

Session ID configuration allows for the management of session data, including cache and storage. By specifying a "Session ID", pages sharing this identifier will access the same session. This functionality is particularly useful for maintaining user login status across multiple pages utilizing the same OAuth credentials (e.g., Google and Facebook OAuths). Moreover, it facilitates the simultaneous login of multiple accounts for distinct purposes, such as **"Personal" and "Business"**. If no "Session ID" is provided, the value "default" will be automatically assigned.

#### Persistent Pages

Persistent pages are not destroyed once the page is changed. This means that if there are any unfinished tasks still loading, the user can change the page and come back later without losing it or reloading the URL.

### Window Settings

The **"Window"** tab allows for window customizations, including:
- Displaying the window frame.
- Designating a movable area to drag the window.
- Setting opacity when focused or blurred (not supported in Linux).
- Adjusting the starting position and size of the windows.
- Specifying whether the windows will share their bounds when swapping between them.
- Defining shortcuts to show and hide the window from any location.

&nbsp;

<p align='center'>
    <img width="600" src="https://i.postimg.cc/PrYXCYFK/settings-window.png" alt='Pages'>
    <br/>
    "I've been using Alt+Esc (Option+Esc) as the global shortcut and Esc to hide when focused."
</p>

## Build

**Step 1: Clone the Repository**
- Open your terminal and navigate to the directory where you want to clone the project.
- Run the following command to clone the repository:

```bash
git clone https://github.com/ECRomaneli/Handbook.git
```

**Step 2: Navigate into the Cloned Project**
- Change your directory to the cloned project:

```bash
cd Handbook
```

**Step 3: Install Node**
- Ensure that Node is installed. This project has been tested with Node versions ranging from `16.x` to `21.x`, but it is designed to always be compatible with the latest version at the Handbook release date.
- For guidance on installing Node, please visit the [official Node website](https://nodejs.org/) for detailed instructions.

**Step 4: Install Dependencies**
- Once inside the project directory, install the necessary dependencies by running:

```bash
npm install
```

**Step 5: Run the Electron Application**
- After the installation is complete, you can start the Electron application by running:

```bash
npm start
```

That's it! The Electron application should launch, and you can explore and modify the existing codebase as needed.

## Creating the Artifacts

After setting up the project following the steps in the "[Build](#build)" section, choose the target version and execute one of the commands below.

| Target                                        | Command                             |
|-----------------------------------------------|-------------------------------------|
| MacOS x64 DMG (Available on MacOS ARM64)      | `npm run make:darwin-x64-dmg`       |
| MacOS arm64 DMG (Available on MacOS)          | `npm run make:darwin-arm64-dmg`     |
| MacOS Universal APP (Available on MacOS)      | `npm run make:darwin-universal-app` |
| MacOS x64 APP (Zipped App)                    | `npm run make:darwin-x64-app`       |
| MacOS arm64 APP (Zipped App)                  | `npm run make:darwin-arm64-app`     |
| Linux x64 DEB                                 | `npm run make:linux-x64-deb`        |
| Linux x64 RPM                                 | `npm run make:linux-x64-rpm`        |
| Windows x64 EXE                               | `npm run make:win32-x64-exe`        |

## Next Steps

- Implement Speech-to-Text and Text-to-Speech functionalities, at least in English (probably in v2.0).
- Explore other potential features.

## Out of Scope

To maintain the primary goal of enhancing user efficiency and focus while minimizing RAM memory usage, it was decided to abandon the idea of having multiple visible windows or tabs. The objective is not to serve as a widget or a web browser application, as there are many superior apps designed for these purposes. Such functionality would detract from the focus and potentially increase RAM consumption.

## About App Signature

Please note that, even though it is not recommended to bypass security warnings, Handbook is open-source and contains no malicious code. As an alternative, the build can be done manually to ensure code integrity. As a lone developer aiming to be more productive, I have no intention to sign this app for now.

## Author

- Created by [Emerson Capuchi Romaneli](https://github.com/ECRomaneli) (@ECRomaneli).

## License

[MIT License](https://github.com/ECRomaneli/handbook/blob/master/LICENSE)
