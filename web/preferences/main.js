const Vue = require("vue")
const { loadScripts } = require('./dynamicLoad.js')

window.addEventListener('load', async () => {
  await loadScripts('providers')
  await loadScripts('plugins')
  await loadScripts('components')
  app.mount('#app')
})

const app = Vue.createApp({
  template: /*html*/ `
        <div class="exit-btn" @click="$remote.window.close()">
            <svg class="square-14" xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'>
                <path d='M.293.293a1 1 0 0 1 1.414 0L8 6.586 14.293.293a1 1 0 1 1 1.414 1.414L9.414 8l6.293 6.293a1 1 0 0 1-1.414 1.414L8 9.414l-6.293 6.293a1 1 0 0 1-1.414-1.414L6.586 8 .293 1.707a1 1 0 0 1 0-1.414z'/>
            </svg>
        </div>
        <div class="w-100 d-flex flex-column">
            <div class="mt-3 mb-2">
                <span class="h6 ps-4 pe-none">Preferences</span>
            </div>
            <ul class="inline-tabs px-4">
                <li @click="tab = 'pages'">
                    <button class="tab" :class="{ active: tab === 'pages' }">Pages</button>
                </li>
                <li @click="tab = 'permissions'">
                    <button class="tab" :class="{ active: tab === 'permissions' }">Permissions</button>
                </li>
                <li @click="tab = 'settings'">
                    <button class="tab" :class="{ active: tab === 'settings' }">Settings</button>
                </li>
                <li @click="tab = 'sync'">
                    <button class="tab" :class="{ active: tab === 'sync' }">Sync</button>
                </li>
                <li @click="tab = 'about'">
                    <button class="tab" :class="{ active: tab === 'about' }">About</button>
                </li>
            </ul>

            <div class="tab-content p-3 overflow-auto">
                <div class="tab-pane" :class="{ active: tab === 'pages' }">
                    <pages @navigate="navigateToTab"></pages>
                </div>
                <div class="tab-pane container" :class="{ active: tab === 'permissions' }">
                    <permissions></permissions>
                </div>
                <div class="tab-pane container" :class="{ active: tab === 'settings' }">
                    <settings></settings>
                </div>
                <div class="tab-pane container" :class="{ active: tab === 'sync' }">
                    <sync-tab></sync-tab>
                </div>
                <div class="tab-pane container" :class="{ active: tab === 'about' }">
                    <about-tab v-if="tab === 'about'"></about-tab>
                </div>
            </div>
        </div>
    `,

  inject: ['$remote', '$const'],
  data() { return { tab: 'pages', appEl: document.getElementById('app'), themeChangeListener: null } },
  beforeMount() {
    this.setupBootstrapTheme()
    this.setupLinuxSpecificStyles()
  },
  mounted() {
    this.setupPermissionsListener()
    this.$nextTick(this.emitReady)
  },
  methods: {
    emitReady() {
      this.$remote.preferences.emitReady()
    },

    setupPermissionsListener() {
      this.$remote.preferences.onPermissionsQuery(() => { this.tab = 'permissions' })
    },

    setupLinuxSpecificStyles() {
      if (!this.$const.OS.IS_LINUX) { return }
      this.appEl.style.setProperty('border', '1px solid var(--border-color)')
    },

    navigateToTab(tab) {
      this.tab = tab
    },

    setupBootstrapTheme() {
      const matchMedia = window.matchMedia('(prefers-color-scheme: dark)')
      this.themeChangeListener = (ev) => this.appEl.setAttribute('data-bs-theme', ev.matches ? 'dark' : 'light')
      matchMedia.addEventListener('change', this.themeChangeListener)
      this.themeChangeListener(matchMedia)
    },
  }
})