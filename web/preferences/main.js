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
        <nav class="sidebar">
            <div class="sidebar-header">
                <span class="sidebar-title">{{ $i18n.preferences.title }}</span>
            </div>
            <ul class="sidebar-menu">
                <li class="sidebar-item" :class="{ active: tab === 'pages' }" @click="tab = 'pages'">
                    <span class="icon sidebar-icon icon-pages"></span>
                    <span>{{ $i18n.preferences.tabs.pages }}</span>
                </li>
                <li class="sidebar-item" :class="{ active: tab === 'quick-actions' }" @click="tab = 'quick-actions'">
                    <span class="icon sidebar-icon icon-quick-actions"></span>
                    <span>{{ $i18n.preferences.tabs.quickActions }}</span>
                </li>
                <li class="sidebar-item" :class="{ active: tab === 'permissions' }" @click="tab = 'permissions'">
                    <span class="icon sidebar-icon icon-shield"></span>
                    <span>{{ $i18n.preferences.tabs.permissions }}</span>
                </li>
                <li class="sidebar-item" :class="{ active: tab === 'settings' }" @click="tab = 'settings'">
                    <span class="icon sidebar-icon icon-gear"></span>
                    <span>{{ $i18n.preferences.tabs.settings }}</span>
                </li>
                <li class="sidebar-item" :class="{ active: tab === 'sync' }" @click="tab = 'sync'">
                    <span class="icon sidebar-icon icon-sync"></span>
                    <span>{{ $i18n.preferences.tabs.sync }}</span>
                </li>
                <li class="sidebar-item" :class="{ active: tab === 'about' }" @click="tab = 'about'">
                    <span class="icon sidebar-icon icon-info"></span>
                    <span>{{ $i18n.preferences.tabs.about }}</span>
                </li>
            </ul>
        </nav>
        <div class="main-content">
            <div class="main-header" :class="{ scrolled: isScrolled }">
                <div class="exit-btn" @click="$remote.window.close()">
                    <svg class="square-12" xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'>
                        <path d='M.293.293a1 1 0 0 1 1.414 0L8 6.586 14.293.293a1 1 0 1 1 1.414 1.414L9.414 8l6.293 6.293a1 1 0 0 1-1.414 1.414L8 9.414l-6.293 6.293a1 1 0 0 1-1.414-1.414L6.586 8 .293 1.707a1 1 0 0 1 0-1.414z'/>
                    </svg>
                </div>
            </div>
            <div class="tab-content" @scroll="onContentScroll">
                <div class="tab-pane" :class="{ active: tab === 'pages' }">
                    <pages @navigate="navigateToTab"></pages>
                </div>
                <div class="tab-pane" :class="{ active: tab === 'quick-actions' }">
                    <quick-actions></quick-actions>
                </div>
                <div class="tab-pane" :class="{ active: tab === 'permissions' }">
                    <permissions></permissions>
                </div>
                <div class="tab-pane" :class="{ active: tab === 'settings' }">
                    <settings></settings>
                </div>
                <div class="tab-pane" :class="{ active: tab === 'sync' }">
                    <sync-tab></sync-tab>
                </div>

                <div class="tab-pane" :class="{ active: tab === 'about' }">
                    <about-tab v-if="tab === 'about'"></about-tab>
                </div>
            </div>
        </div>
    `,

  inject: ['$remote', '$const', '$i18n'],
  data() { return { tab: 'pages', isScrolled: false, appEl: document.getElementById('app'), themeChangeListener: null } },
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

    onContentScroll(e) {
      this.isScrolled = e.target.scrollTop > 0
    },

    navigateToTab(tab) {
      this.tab = tab
      this.isScrolled = false
    },

    setupBootstrapTheme() {
      const matchMedia = window.matchMedia('(prefers-color-scheme: dark)')
      this.themeChangeListener = (ev) => this.appEl.setAttribute('data-bs-theme', ev.matches ? 'dark' : 'light')
      matchMedia.addEventListener('change', this.themeChangeListener)
      this.themeChangeListener(matchMedia)
    },
  }
})