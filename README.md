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

- Always-on-top windows, even atop fullscreen content, allowing quick retrieval of information.
- Increased focus, avoiding the need to navigate to a web browser for quick searches.
- Reduction in the number of tabs by adding pages that are typically used once but are often forgotten, leading to the opening of new instances.
- Low RAM usage, despite using Chromium. There is only one instance shared by all non-isolated pages and one instance per isolated page.
- Configurability, allowing transparent windows when blurred, customization of default size, position, and shortcuts to show and hide anywhere, among other options.

## Installing

Download the right version for the OS on [releases](https://github.com/ECRomaneli/Handbook/releases) section and follow the instructions below.

Read about the app signature on "[About App Signature](#about-app-signature)".

### Mac OS

Download the zip file for the right architecture of the processor, unzip it, and copy the `handbook.app` to the "Application" folder.

#### Troubleshooting

As the Handbook has no signature, it may not open directly and trigger a security warning. To bypass it:

1. Open the "Application" folder;
2. Press Ctrl+{Left Click} on the handbook icon;
3. Select "Open" in the context menu;
4. Proceed to "Open" the app in the security warning screen.

After these few steps, the app will no longer present the message.

Source: [Apple Support](https://support.apple.com/pt-br/guide/mac-help/mh40616/mac).

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

To toggle the window visibility, just click on the tray icon or configure the shortcuts (disabled by default).

To change the page, right-click on the tray icon and simply select it.

Have Fun :)

### Settings

To access the settings, simply right-click on the tray icon and select **"Settings"**.

### Pages

The **"Pages"** tab enables users to add, sort, customize, or remove pages. The user can also import or export the pages as JSON.

<p align='center'>
    <img width="600" src="https://i.postimg.cc/9fqq0rZh/settings-page.png" alt='Pages'>
</p>

#### Isolated pages

Isolated pages has its own window. This means that if there are any unfinished tasks still loading, the user can change the page and come back later without lose it or reload the URL.

#### Non-isolated pages

On the other hand, non-isolated pages will always share the same window, meaning that once the user changes the page, the content will be reloaded, and all progress will be lost.

#### Session

The session is maintained according to Electron/Chromium standards, which means it is not lost upon restarting the app or when using a non-isolated page. This functionality is particularly useful for keeping users logged in. However, it's important to note that if the application path is changed, the session will be lost as well.

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


## Package

There are some scripts configured to package the application:

| Description                                            | Command                           |
|--------------------------------------------------------|-----------------------------------|
| Make for macOS x64 DMG (Only Available on MacOS)       | `npm run make:darwin-x64-dmg`     |
| Make for macOS arm64 DMG (Only Available on MacOS)     | `npm run make:darwin-arm64-dmg`   |
| Make for macOS x64 APP                                 | `npm run make:darwin-x64`         |
| Make for macOS arm64 APP                               | `npm run make:darwin-arm64`       |
| Make for Linux x64 DEB                                 | `npm run make:linux-x64-deb`      |
| Make for Linux x64 RPM                                 | `npm run make:linux-x64-rpm`      |
| Make for Windows x64                                   | `npm run make:win32-x64`          |



## Next Steps

- Settings to configure auto close inactive windows;
- Create tests structure;
- Automated build process;
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
