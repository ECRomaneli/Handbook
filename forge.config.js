const pkg = require('./package.json'),
      data = {
        homepage: pkg.homepage,
        license: pkg.license,
        author: pkg.author,
        version: pkg.version,
        description: pkg.description,
        name: pkg.name,
        productName: 'Handbook',
        genericName: 'Web Browser',
        // icon: 'assets/img/iconTemplate.png',
        category: 'Network'
      }

module.exports = {
  packagerConfig: {
    asar: true
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
        // icon: data.icon,
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
        // icon: data.icon,
        name: data.name,
        productName: data.productName,
        categories: [data.category],
        version: data.version,
        license: data.license
      }
    },
    {
      name: '@electron-forge/maker-squirrel',
      platforms: ['win32'],
      config: {
        description: data.description,
        // iconUrl: data.icon,
        // setupIcon: data.icon,
        name: data.productName,
        version: data.version,
        owners: data.author,
        authors: data.author,
        copyright: data.license
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
