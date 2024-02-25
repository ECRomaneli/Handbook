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

> "Handbook was created to assist me in my development process, providing quick-access tools in the most efficient manner while coding. Some of my favorites include ChatGPT, Copilot, Notion, and even Youtube."

### Some advantages

- Always-on-top windows, even atop fullscreen content, allowing quick retrieval of information;
- Increased focus, avoiding the need to navigate to a web browser for quick searches;
- Reduction in the number of tabs by adding pages that are typically used once but are often forgotten, leading to the opening of new instances;
- Low RAM usage, despite using Chromium. There is only one instance per page;
- Configurability, allowing transparent windows when blurred, customization of default size, position, and shortcuts to show and hide anywhere, among other options.

## Installing

Download the right version for the OS on [releases](https://github.com/ECRomaneli/Handbook/releases) section and follow the instructions below.

Read about the app signature on "[About App Signature](#about-app-signature)".

### Mac OS

Download the zip file for the right architecture of the processor, unzip it, and copy the `handbook.app` to the "Application" folder.

### Troubleshooting

#### Security Warning

As the Handbook has no signature, it may not open directly and trigger a security warning. To bypass it:

1. Open the "Application" folder;
2. Press Ctrl+{Left Click} on the handbook icon;
3. Select "Open" in the context menu;
4. Proceed to "Open" the app in the security warning screen.

After these few steps, the app will no longer present the warning.

Source: [Apple Support](https://support.apple.com/en-us/guide/mac-help/mh40616/mac).

#### Damaged App

Some ARM Macbook users are receiving an error stating that the `.app` is damaged. The work to fix it is in progress and can be followed in the issue [#1](https://github.com/ECRomaneli/Handbook/issues/1).

Meanwhile, try to use the `darwin-universal` version (and remember to follow the [Security Warning](#security-warning) steps).

### Debian-based distributions

1. Download the .deb package;
2. Open a terminal window;
3. Navigate to the directory where the .deb package is located using the `cd` command;
4. Run the command `sudo dpkg -i handbook-x64.deb`;
5. Enter your password when prompted;
6. After installation, you can launch the application from the application menu.

### Red Hat-based distributions

1. Download the .rpm package;
2. Open a terminal window;
3. Navigate to the directory where the .deb package is located using the `cd` command;
4. Run the command `sudo rpm -i handbook-x64.rpm`;
5. Enter your password when prompted;
6. After installation, you can launch the application from the application menu.

### Windows

Download the `.exe` executable, open it and follow the steps.

## Getting Started

<p align='center'>
    <img width="600" src="https://i.postimg.cc/sDy8HdKP/example.png" alt='Example'>
    <br/>
    ChatGPT page overlaying the settings
</p>

### Usage

#### Toggle Window Visibility

To toggle the window visibility, just click on the tray icon or configure the shortcuts (disabled by default).

#### Change page

To change the page, right-click on the tray icon and simply select it. 

#### Open from clipboard

There is also, the possibility to open a URL directly from the clipboard. Just copy a URL, right-click on the tray icon, and select **"Clipboard URL"**. The page will act as a non-persistent one (see "[Persistent Pages](#persistent-pages)").

#### Have Fun :)

### Settings

To access the settings, simply right-click on the tray icon and select **"Settings"**.

### Pages

The **"Pages"** tab enables users to add, sort, customize, or remove pages. The user can also import or export the pages as JSON.

<p align='center'>
    <img width="600" src="https://i.postimg.cc/bwrVw0tg/settings-page.png" alt='Pages'>
</p>

#### Session ID

Session ID configuration allows for the management of session data, including cache and storages. By specifying a "Session ID", pages sharing this identifier will access the same session. This functionality proves particularly useful for maintaining user login status across multiple pages utilizing the same OAuth credentials (e.g. Google and Facebook oAuths). Moreover, it facilitates the simultaneous login of multiple accounts for distinct purposes, such as **"Personal" and "Business"**. If no "Session ID" is provided, the value "default" will be automatically assigned.

#### Persistent pages

Persistent pages are not destroyed once the page is changed. This means that if there are any unfinished tasks still loading, the user can change the page and come back later without lose it or reload the URL.


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
- Ensure that the Node is installed. This project has been tested with Node versions ranging from `16.x` to `21.x`, but it is designed to always be compatible with the latest version at the Handbook release date.
- For guidance on installing Node, please visit the [official Node website](https://nodejs.org/) for detailed instructions.

**Step 3: Install Dependencies**
- Once inside the project directory, install the necessary dependencies by running:

```bash
npm install
```

**Step 4: Run the Electron Application**
- After the installation is complete, you can start the Electron application by running:

```bash
npm start
```

That's it! The Electron application should launch, and you can explore and modify the existing codebase as needed.


## Creating the Artifacts

After setup the project following the steps on "[Build](#build)" section, choose the target version and execute one of the commands below.

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

- Create tests structure;
- Implement a Speech-to-Text and a Text-to-Speech at least in english (v2.0 probably);
- Who knows...

## Out of Scope

In order to maintain the primary goal of enhancing user efficiency and focus while minimizing RAM memory usage, it was decided to abandon the idea of having multiple visible windows or tabs. The objective is not to serve as a widget or a web browser application, as there are many superior apps designed for these purposes. Such functionality would detract from the focus and potentially increase RAM consumption.

## About App Signature

Please note that, even though it is not recommended to bypass security warnings, the Handbook is open-source and has no malicious codes. As an alternative, the build can be done manually ensuring code integrity. As a lone developer only aiming for being more productive I have no intention to assign this app for now.

## Author

- Created by [Emerson Capuchi Romaneli](https://github.com/ECRomaneli) (@ECRomaneli).

## License

[MIT License](https://github.com/ECRomaneli/handbook/blob/master/LICENSE)
