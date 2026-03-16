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
                <span class="h6 ps-4 pe-none">{{ $i18n.preferences.title }}</span>
            </div>
            <ul class="inline-tabs px-4">
                <li @click="tab = 'pages'">
                    <button class="tab" :class="{ active: tab === 'pages' }">{{ $i18n.preferences.tabs.pages }}</button>
                </li>
                <li @click="tab = 'permissions'">
                    <button class="tab" :class="{ active: tab === 'permissions' }">{{ $i18n.preferences.tabs.permissions }}</button>
                </li>
                <li @click="tab = 'settings'">
                    <button class="tab" :class="{ active: tab === 'settings' }">{{ $i18n.preferences.tabs.settings }}</button>
                </li>
                <li @click="tab = 'sync'">
                    <button class="tab" :class="{ active: tab === 'sync' }">{{ $i18n.preferences.tabs.sync }}</button>
                </li>
                <li @click="tab = 'about'">
                    <button class="tab" :class="{ active: tab === 'about' }">{{ $i18n.preferences.tabs.about }}</button>
                </li>
            </ul>

            <div class="tab-content p-3 overflow-auto">
                <div class="tab-pane container active">
                    <pages v-if="tab === 'pages'" @navigate="navigateToTab"></pages>
                    <permissions v-else-if="tab === 'permissions'"></permissions>
                    <settings v-else-if="tab === 'settings'"></settings>
                    <sync-tab v-else-if="tab === 'sync'"></sync-tab>
                    <about-tab v-else-if="tab === 'about'"></about-tab>
                </div>
            </div>
        </div>
    `,

  inject: ['$remote', '$const', '$i18n'],
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