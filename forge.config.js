import pkg from './package.json' with { type: 'json' }
const data = {
        homepage: pkg.homepage,
        license: pkg.license,
        copyright: `${pkg.license} license - Copyright (c) ${new Date().getFullYear()} Emerson Capuchi Romaneli`,
        author: pkg.author,
        version: pkg.version,
        description: pkg.description,
        name: pkg.name,
        productName: pkg.productName,
        genericName: 'Web Browser',
        category: 'Network',
        iconPng: 'assets/img/icons/app/book.png',
        iconIco: 'assets/img/icons/app/book.ico',
        iconIcns: 'assets/img/icons/app/book.icns',
        icon: 'assets/img/icons/app/book',
      }

// https://electron.github.io/packager/main/interfaces/Options.html
// https://www.electronforge.io/config/configuration

export default {
  packagerConfig: {
    icon: data.icon,
    executableName: process.platform === 'linux' ? data.name : data.productName,
    appCategoryType: 'public.app-category.utilities',
    appCopyright: data.copyright,
    asar: true,
    ignore: [
      '^/assets/img/docs',
      '^/assets/img/icons/app/book.xcf$',
      '^README.md$',
      '^/lib/debug.js$'
    ]
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin']
    },
    {
      name: '@electron-forge/maker-dmg',
      platforms: ['darwin'],
      config: {
        format: 'ULFO'
        // background: './assets/img/dmg-background.png',
      }
    },
    {
      name: '@electron-forge/maker-deb',
      platforms: ['linux'],
      config: {
        description: data.description,
        genericName: data.genericName,
        homepage: data.homepage,
        icon: data.iconPng,
        maintainer: data.author,
        name: data.productName,
        categories: [data.category]
      }
    },
    {
      name: '@electron-forge/maker-rpm',
      platforms: ['linux'],
      config: {
        description: data.description,
        productDescription: data.description,
        genericName: data.genericName,
        homepage: data.homepage,
        icon: data.iconPng,
        name: data.productName,
        productName: data.productName,
        categories: [data.category],
        version: data.version,
        license: data.copyright
      }
    },
    {
      name: '@electron-forge/maker-squirrel',
      platforms: ['win32'],
      config: {
        description: data.description,
        setupIcon: data.iconIco,
        name: data.productName,
        version: data.version,
        owners: data.author,
        authors: data.author,
        copyright: data.copyright
      }
    }
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-auto-unpack-natives',
      config: {}
    },
  ],
};
