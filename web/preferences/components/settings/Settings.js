app.component('Settings', {
  template: /*html*/ `
      <div id="settings-tab">
        <template v-if="inputs" v-for="(section, i) in Object.keys(inputs)" :key="section">
            <div v-if="hasEnabledInputs(section)" class="h6" :class="{ 'mt-3': !i, 'mt-5': i }">{{ section }}</div>
            <template v-for="(input) in inputs[section]" :key="input.id">
                <template v-if="!input.disabled">
                    <hr class="input-divider">
                    <inline-input :input="input" @update="emitUpdate(input)"></inline-input>
                </template>
            </template>
        </template>
      </div>
    `,
  emits: ['update'],
  inject: ['$remote', '$const', '$clone', '$i18n'],
  props: { settings: Object },
  data() { return { inputs: null } },
  created() {
    this.loadSettings()
    this.setupEventListeners()
  },
  methods: {
    setupEventListeners() {
      this.$remote.preferences.onUpdateRenderer((id, value) => {
        for (const section of Object.keys(this.inputs)) {
          const inputs = this.inputs[section].filter(i => i.id === id)
          if (!inputs.length) { continue }
          const input = inputs[0]
          input.data.value = value
        }
      })
    },

    emitUpdate(input) {
      // if (input.data.type === 'button') {
      //   this.$remote.preferences.buttonClick(input.id, input.data.value)
      // } else {
      //   this.$remote.storage.setSettings(input.id, input.data.value)
      // }
      this.$remote.storage.setSettings(input.id, input.data.value)
      this.$emit('update', this.$clone(input), input.data.value)
    },

    async loadSettings() {
      const storage = this.$remote.storage
      const s = this.$i18n.preferences.settings
      const options = []
      Object.keys(this.$const.Positions).forEach(key => {
        const value = this.$const.Positions[key]
        options.push({ label: s.screenPositions[value], value: value })
      })

      this.inputs = {
        [s.general]: [
          {
            id: this.$const.Settings.APP_LANGUAGE,
            label: s.appLanguage,
            description: s.appLanguageDesc,
            data: {
              type: 'select', value: await storage.getSettings(this.$const.Settings.APP_LANGUAGE),
              options: [
                { label: s.langDefault, value: '' },
                { label: 'English', value: 'en' },
                { label: 'Deutsch', value: 'de' },
                { label: 'Español', value: 'es' },
                { label: 'Français', value: 'fr' },
                { label: 'Italiano', value: 'it' },
                { label: 'Português (Brasil)', value: 'pt-BR' },
                { label: 'Português (Portugal)', value: 'pt-PT' },
                { label: 'Русский', value: 'ru' }
              ]
            }
          },
          {
            id: this.$const.Settings.AUTO_LAUNCH,
            label: s.launchAtStartup,
            description: s.launchAtStartupDesc,
            data: { type: 'bool', value: await storage.getSettings(this.$const.Settings.AUTO_LAUNCH) }
          },
          {
            id: this.$const.Settings.TRAY_LONGPRESS,
            label: s.trayLongpress,
            description: s.trayLongpressDesc,
            disabled: !this.$const.OS.IS_DARWIN,
            data: { type: 'number', min: 200, value: await storage.getSettings(this.$const.Settings.TRAY_LONGPRESS), unit: 'ms' }
          },
          {
            id: this.$const.Settings.ACTION_AREA,
            label: s.actionArea,
            description: s.actionAreaDesc,
            data: { type: 'number', min: 0, value: await storage.getSettings(this.$const.Settings.ACTION_AREA), unit: 'px' }
          },
          {
            id: this.$const.Settings.APP_THEME,
            label: s.appTheme,
            description: s.appThemeDesc,
            data: {
              type: 'select', value: await storage.getSettings(this.$const.Settings.APP_THEME),
              options: [
                { label: s.themeSystem, value: 'system' },
                { label: s.themeLight, value: 'light' },
                { label: s.themeDark, value: 'dark' }
              ]
            }
          },
          {
            id: this.$const.Settings.TRAY_ICON_THEME,
            label: s.trayIconTheme,
            description: s.trayIconThemeDesc,
            disabled: this.$const.OS.IS_DARWIN,
            data: {
              type: 'select', value: await storage.getSettings(this.$const.Settings.TRAY_ICON_THEME),
              options: [
                { label: s.themeSystem, value: 'system' },
                { label: s.trayPreferred, value: 'preferred' },
                { label: s.themeLight, value: 'light' },
                { label: s.themeDark, value: 'dark' },
                { label: s.trayGray, value: 'gray' }
              ]
            }
          },
          {
            id: this.$const.Settings.USE_EXTERNAL_BROWSER,
            label: s.useExternalBrowser,
            description: s.useExternalBrowserDesc,
            data: { type: 'bool', value: await storage.getSettings(this.$const.Settings.USE_EXTERNAL_BROWSER) }
          },
          {
            id: this.$const.Settings.GROUP_PAGES_BY_SESSION,
            label: s.groupPagesBySession,
            description: s.groupPagesBySessionDesc,
            data: { type: 'bool', value: await storage.getSettings(this.$const.Settings.GROUP_PAGES_BY_SESSION) }
          }
        ],
        [s.appearance]: [
          {
            id: this.$const.Settings.SHOW_FRAME,
            label: s.showFrame,
            data: { type: 'bool', value: await storage.getSettings(this.$const.Settings.SHOW_FRAME) }
          },
          {
            id: this.$const.Settings.BACKGROUND_COLOR,
            label: s.backgroundColor,
            description: s.backgroundColorDesc,
            data: { type: 'color', value: await storage.getSettings(this.$const.Settings.BACKGROUND_COLOR) }
          },
          {
            id: this.$const.Settings.FOCUS_OPACITY,
            label: s.focusOpacity,
            description: s.focusOpacityDesc,
            disabled: this.$const.OS.IS_LINUX,
            data: { type: 'number', min: 10, max: 100, value: await storage.getSettings(this.$const.Settings.FOCUS_OPACITY), unit: '%' }
          },
          {
            id: this.$const.Settings.BLUR_OPACITY,
            label: s.blurOpacity,
            description: s.blurOpacityDesc,
            disabled: this.$const.OS.IS_LINUX,
            data: { type: 'number', min: 10, max: 100, value: await storage.getSettings(this.$const.Settings.BLUR_OPACITY), unit: '%' }
          },
          {
            id: this.$const.Settings.KEEP_OPACITY_WHEN_MAXIMIZED,
            label: s.keepOpacity,
            description: s.keepOpacityDesc,
            disabled: this.$const.OS.IS_LINUX,
            data: { type: 'bool', value: await storage.getSettings(this.$const.Settings.KEEP_OPACITY_WHEN_MAXIMIZED) }
          },
          {
            id: this.$const.Settings.ALLOW_FULLSCREEN,
            label: s.allowFullscreen,
            description: s.allowFullscreenDesc,
            data: { type: 'bool', value: await storage.getSettings(this.$const.Settings.ALLOW_FULLSCREEN) }
          }
        ],
        [s.bounds]: [
          {
            id: this.$const.Settings.RESET_BOUNDS,
            label: s.resetBounds,
            description: s.resetBoundsDesc,
            data: {
              type: 'select', value: await storage.getSettings(this.$const.Settings.RESET_BOUNDS),
              options: [
                { label: s.boundsNone, value: '' },
                { label: s.boundsPosition, value: 'position' },
                { label: s.boundsSizePosition, value: 'bounds' }
              ]
            }
          },
          {
            id: this.$const.Settings.SHARE_BOUNDS,
            label: s.shareBounds,
            description: s.shareBoundsDesc,
            data: { type: 'bool', value: await storage.getSettings(this.$const.Settings.SHARE_BOUNDS) }
          },
          {
            id: this.$const.Settings.DEFAULT_POSITION,
            label: s.defaultPosition,
            description: s.defaultPositionDesc,
            data: { type: 'select', value: await storage.getSettings(this.$const.Settings.DEFAULT_POSITION), options: options }
          },
          {
            id: this.$const.Settings.DEFAULT_WIDTH,
            label: s.defaultWidth,
            description: s.defaultWidthDesc,
            data: { type: 'number', value: await storage.getSettings(this.$const.Settings.DEFAULT_WIDTH), unit: 'px' }
          },
          {
            id: this.$const.Settings.DEFAULT_HEIGHT,
            label: s.defaultHeight,
            description: s.defaultHeightDesc,
            data: { type: 'number', value: await storage.getSettings(this.$const.Settings.DEFAULT_HEIGHT), unit: 'px' }
          }
        ],
        [s.shortcuts]: [
          {
            id: this.$const.Settings.HIDE_SHORTCUT,
            label: s.hideShortcut,
            description: s.hideShortcutDesc,
            data: { type: 'key', value: await storage.getSettings(this.$const.Settings.HIDE_SHORTCUT) }
          },
          {
            id: this.$const.Settings.GLOBAL_SHORTCUT,
            label: s.globalShortcut,
            description: s.globalShortcutDesc,
            data: { type: 'key', value: await storage.getSettings(this.$const.Settings.GLOBAL_SHORTCUT) }
          }
        ],
        [s.advanced]: [
          {
            id: this.$const.Settings.PREFERRED_LANGUAGE,
            label: s.preferredLanguage,
            description: s.preferredLanguageDesc,
            data: {
              type: 'select', value: await storage.getSettings(this.$const.Settings.PREFERRED_LANGUAGE),
              options: [
                { label: s.langDefault, value: '' },
                { label: s.langFollowApp, value: 'app' },
                { label: 'English (US)', value: 'en-US' },
                { label: 'English (UK)', value: 'en-GB' },
                { label: 'Português (Brasil)', value: 'pt-BR' },
                { label: 'Português (Portugal)', value: 'pt-PT' },
                { label: 'Español', value: 'es' },
                { label: 'Français', value: 'fr' },
                { label: 'Deutsch', value: 'de' },
                { label: 'Italiano', value: 'it' },
                { label: '日本語', value: 'ja' },
                { label: '한국어', value: 'ko' },
                { label: '中文 (简体)', value: 'zh-CN' },
                { label: '中文 (繁體)', value: 'zh-TW' },
                { label: 'Русский', value: 'ru' },
                { label: 'العربية', value: 'ar' },
                { label: 'हिन्दी', value: 'hi' }
              ]
            }
          },
          {
            id: this.$const.Settings.GOOGLE_API_KEY,
            label: s.googleApiKey,
            description: s.googleApiKeyDesc,
            data: { type: 'secret', value: await storage.getSettings(this.$const.Settings.GOOGLE_API_KEY) }
          }
        ]
      }
    },

    hasEnabledInputs(section) {
      return this.inputs[section].some(i => i.disabled !== true)
    }
  }
})