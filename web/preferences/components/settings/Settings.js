app.component('Settings', {
    template: /*html*/ `
        <template v-if="inputs" v-for="(section, i) in Object.keys(inputs)" :key="section">
            <div v-if="hasEnabledInputs(section)" class="h6" :class="{ 'mt-3': !i, 'mt-5': i }">{{ section }}</div>
            <template v-for="(input) in inputs[section]" :key="input.id">
                <template v-if="!input.disabled">
                    <hr class="input-divider">
                    <inline-input :input="input" @update="emitUpdate(input)"></inline-input>
                </template>
            </template>
        </template>
        <span v-else>Loading...</span>
    `,
    emits: [ 'update' ],
    inject: [ '$remote', '$const', '$clone' ],
    props: { settings: Object },
    data() { return { inputs: null } },
    created() { this.loadSettings() },
    methods: {
        emitUpdate(input) {
            this.$remote.storage.setSettings(input.id, input.data.value)
            this.$emit('update', this.$clone(input), input.data.value)
        },

        capitalize(str) {
            return str.replace(/\b\w/g, (c) => c.toUpperCase())
        },

        async loadSettings() {
            const storage = this.$remote.storage
            const options = []
            Object.keys(this.$const.Positions).forEach(key => {
                const value = this.$const.Positions[key]
                options.push({ label: this.capitalize(value), value: value })
            })
    
            this.inputs = { 
                General: [
                    {
                        id: this.$const.Settings.TRAY_LONGPRESS,
                        label: 'Tray icon long-press timeout',
                        description: 'Specify the duration, in milliseconds, for triggering the context menu when performing a long-press on the tray icon.',
                        disabled: !this.$const.OS.IS_DARWIN,
                        data: { type: 'number', min: 200, value: await storage.getSettings(this.$const.Settings.TRAY_LONGPRESS), unit: 'ms' }
                    },
                    {
                        id: this.$const.Settings.ACTION_AREA,
                        label: 'Action area height',
                        description: 'Denotes the height, in pixels, of the region situated atop the window, designated for maximize and move a frameless windows. Automatically disabled when the frame is enabled.',
                        data: { type: 'number', min: 0, value: await storage.getSettings(this.$const.Settings.ACTION_AREA), unit: 'px' }
                    },
                    {
                        id: this.$const.Settings.APP_THEME,
                        label: 'Preferred theme',
                        description: 'Specify the favorite appearance. It may take a few minutes to affect websites.',
                        data: { type: 'select', value: await storage.getSettings(this.$const.Settings.APP_THEME), 
                            options: [
                                { label: 'System', value: 'system' },
                                { label: 'Light',  value: 'light'  },
                                { label: 'Dark',   value: 'dark'   }
                            ]
                        }
                    },
                    {
                        id: this.$const.Settings.TRAY_ICON_THEME,
                        label: 'Tray icon theme',
                        description: 'Force the tray icon appearance.',
                        disabled: this.$const.OS.IS_DARWIN,
                        data: { type: 'select', value: await storage.getSettings(this.$const.Settings.TRAY_ICON_THEME), 
                            options: [
                                { label: 'System',    value: 'system'    },
                                { label: 'Preferred', value: 'preferred' },
                                { label: 'Light',     value: 'light'     },
                                { label: 'Dark',      value: 'dark'      },
                                { label: 'Gray',      value: 'gray'      }
                            ]
                        }
                    }
                ],
                Appearance: [
                    {
                        id: this.$const.Settings.SHOW_FRAME,
                        label: 'Show frame',
                        data: { type: 'bool', value: await storage.getSettings(this.$const.Settings.SHOW_FRAME) }
                    },
                    {
                        id: this.$const.Settings.BACKGROUND_COLOR,
                        label: 'Background color',
                        description: 'Background color for loading windows.',
                        data: { type: 'color', value: await storage.getSettings(this.$const.Settings.BACKGROUND_COLOR) }
                    },
                    {
                        id: this.$const.Settings.FOCUS_OPACITY,
                        label: 'Opacity when focused',
                        description: 'Opacity when window is focused.',
                        disabled: this.$const.OS.IS_LINUX,
                        data: { type: 'number', min: 10, max: 100, value: await storage.getSettings(this.$const.Settings.FOCUS_OPACITY), unit: '%' }
                    },
                    {
                        id: this.$const.Settings.BLUR_OPACITY,
                        label: 'Opacity when blurred',
                        description: 'Opacity when window is blurred.',
                        disabled: this.$const.OS.IS_LINUX,
                        data: { type: 'number', min: 10, max: 100, value: await storage.getSettings(this.$const.Settings.BLUR_OPACITY), unit: '%' }
                    },
                    {
                        id: this.$const.Settings.KEEP_OPACITY_WHEN_MAXIMIZED,
                        label: 'Keep opacity when maximized',
                        description: 'Ignore the blur opacity if the window is maximized.',
                        disabled: this.$const.OS.IS_LINUX,
                        data: { type: 'bool', value: await storage.getSettings(this.$const.Settings.KEEP_OPACITY_WHEN_MAXIMIZED) }
                    },
                    {
                        id: this.$const.Settings.ALLOW_FULLSCREEN,
                        label: 'Allow fullscreen',
                        description: 'Allow the window to enter fullscreen mode. If disabled, the media, when in fullscreen, will fit the window.',
                        data: { type: 'bool', value: await storage.getSettings(this.$const.Settings.ALLOW_FULLSCREEN) }
                    }
                ],
                Bounds: [
                    {
                        id: this.$const.Settings.RESET_BOUNDS,
                        label: 'Reset bounds to defaults on restart',
                        description: 'On restart the app, reset windows to default state. Choose "None" to disable it.',
                        data: { type: 'select', value: await storage.getSettings(this.$const.Settings.RESET_BOUNDS), 
                            options: [
                                { label: 'None',            value: ''         },
                                { label: 'Position',        value: 'position' },
                                { label: 'Size/Position',   value: 'bounds'   }
                            ]
                        }
                    },
                    {
                        id: this.$const.Settings.SHARE_BOUNDS,
                        label: 'Share size and position',
                        description: 'If enabled, all windows will share the same size and position when swapping between them.',
                        data: { type: 'bool', value: await storage.getSettings(this.$const.Settings.SHARE_BOUNDS) }
                    },
                    {
                        id: this.$const.Settings.DEFAULT_POSITION,
                        label: 'Default Position',
                        description: 'New window default positioning.',
                        data: { type: 'select', value: await storage.getSettings(this.$const.Settings.DEFAULT_POSITION), options: options }
                    },
                    {
                        id: this.$const.Settings.DEFAULT_WIDTH,
                        label: 'Default width',
                        description: 'New window default width.',
                        data: { type: 'number', value: await storage.getSettings(this.$const.Settings.DEFAULT_WIDTH), unit: 'px' }
                    },
                    {
                        id: this.$const.Settings.DEFAULT_HEIGHT,
                        label: 'Default height',
                        description: 'New window default height.',
                        data: { type: 'number', value: await storage.getSettings(this.$const.Settings.DEFAULT_HEIGHT), unit: 'px' }
                    }
                ],
                Shortcuts: [
                    {
                        id: this.$const.Settings.HIDE_SHORTCUT,
                        label: 'Hide when focused',
                        description: 'Shortcut to hide when window is focused. Minimum of two keys. The supported keys vary by OS.',
                        data: { type: 'key', value: await storage.getSettings(this.$const.Settings.HIDE_SHORTCUT) }
                    },
                    {
                        id: this.$const.Settings.GLOBAL_SHORTCUT,
                        label: 'Toggle window',
                        description: 'Shortcut to toggle window visibility. Minimum of two keys. The supported keys vary by OS.',
                        data: { type: 'key', value: await storage.getSettings(this.$const.Settings.GLOBAL_SHORTCUT) }
                    }
                ]
            }
        },

        hasEnabledInputs(section) {
            return this.inputs[section].some(i => i.disabled !== true)
        }
    }
})