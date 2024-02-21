app.component('WindowSettings', {
    template: /*html*/ `
        <template v-if="inputs">
            <div class="h6 mt-2">General</div>
            <template v-for="(input) in inputs.general" :key="input.id">
                <hr class="text-black-50">
                <inline-input :input="input" @update="emitUpdate(input)"></inline-input>
            </template>
            
            <div class="h6 mt-4">Bounds</div>
            <template v-for="(input) in inputs.bounds" :key="input.id">
                <hr class="text-black-50">
                <inline-input :input="input" @update="emitUpdate(input)"></inline-input>
            </template>

            <div class="h6 mt-4">Shortcuts</div>
            <template v-for="(input) in inputs.shortcuts" :key="input.id">
                <hr class="text-black-50">
                <inline-input :input="input" @update="emitUpdate(input)"></inline-input>
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
            this.$emit('update', this.$clone(input))
        },

        capitalize(str) {
            return str.replace(/\b\w/g, (c) => c.toUpperCase())
        },

        async loadSettings() {
            const storage = this.$remote.storage
            const options = []
            Object.keys(this.$const.Positions).forEach(key => {
                const value = this.$const.Positions[key]
                options.push({ label: this.capitalize(value.replace('\W', ' ')), value: value })
            })
    
            this.inputs = { 
                general: [
                    {
                        id: this.$const.WindowSettings.SHOW_FRAME,
                        label: 'Show frame',
                        data: { type: 'bool', value: await storage.getSettings(this.$const.WindowSettings.SHOW_FRAME) }
                    },
                    {
                        id: this.$const.WindowSettings.ACTION_AREA,
                        label: 'Action area height',
                        description: 'Denotes the height, in pixels, of the region situated atop the window, designated for maximize and move a frameless windows. Automatically disabled when the frame is enabled.',
                        data: { type: 'number', min: 0, value: await storage.getSettings(this.$const.WindowSettings.ACTION_AREA), unit: 'px' }
                    },
                    {
                        id: this.$const.WindowSettings.BACKGROUND_COLOR,
                        label: 'Background color',
                        description: 'Background color for loading windows.',
                        data: { type: 'color', value: await storage.getSettings(this.$const.WindowSettings.BACKGROUND_COLOR) }
                    },
                    {
                        id: this.$const.WindowSettings.FOCUS_OPACITY,
                        label: 'Opacity when focused',
                        description: 'Opacity when window is focused. Linux is not supported.',
                        data: { type: 'number', min: 10, max: 100, value: await storage.getSettings(this.$const.WindowSettings.FOCUS_OPACITY), unit: '%' }
                    },
                    {
                        id: this.$const.WindowSettings.BLUR_OPACITY,
                        label: 'Opacity when blurred',
                        description: 'Opacity when window is blurred. Linux is not supported.',
                        data: { type: 'number', min: 10, max: 100, value: await storage.getSettings(this.$const.WindowSettings.BLUR_OPACITY), unit: '%' }
                    },
                    {
                        id: this.$const.WindowSettings.TRAY_LONGPRESS,
                        label: 'Tray icon long-press timeout',
                        description: 'Specify the duration, in milliseconds, for triggering the context menu when performing a long-press on the tray icon.',
                        data: { type: 'number', min: 200, value: await storage.getSettings(this.$const.WindowSettings.TRAY_LONGPRESS), unit: 'ms' }
                    },
                ],
                bounds: [
                    {
                        id: this.$const.WindowSettings.RESET_BOUNDS,
                        label: 'Reset bounds to defaults on restart',
                        description: 'On restart the app, reset windows to default state. Choose "None" to disable it.',
                        data: { type: 'select', value: await storage.getSettings(this.$const.WindowSettings.RESET_BOUNDS), 
                            options: [
                                { label: 'None',            value: ''         },
                                { label: 'Position',        value: 'position' },
                                { label: 'Size/Position',   value: 'bounds'   }
                            ]
                        }
                    },
                    {
                        id: this.$const.WindowSettings.SHARE_BOUNDS,
                        label: 'Share size and position',
                        description: 'If enabled, all windows will share the same size and position when swapping between them.',
                        data: { type: 'bool', value: await storage.getSettings(this.$const.WindowSettings.SHARE_BOUNDS) }
                    },
                    {
                        id: this.$const.WindowSettings.DEFAULT_POSITION,
                        label: 'Default Position',
                        description: 'New window default positioning.',
                        data: { type: 'select', value: await storage.getSettings(this.$const.WindowSettings.DEFAULT_POSITION), options: options }
                    },
                    {
                        id: this.$const.WindowSettings.DEFAULT_WIDTH,
                        label: 'Default width',
                        description: 'New window default width.',
                        data: { type: 'number', value: await storage.getSettings(this.$const.WindowSettings.DEFAULT_WIDTH), unit: 'px' }
                    },
                    {
                        id: this.$const.WindowSettings.DEFAULT_HEIGHT,
                        label: 'Default height',
                        description: 'New window default height.',
                        data: { type: 'number', value: await storage.getSettings(this.$const.WindowSettings.DEFAULT_HEIGHT), unit: 'px' }
                    }
                ],
                shortcuts: [
                    {
                        id: this.$const.WindowSettings.HIDE_SHORTCUT,
                        label: 'Hide when focused',
                        description: 'Shortcut to hide when window is focused',
                        data: { type: 'key', value: await storage.getSettings(this.$const.WindowSettings.HIDE_SHORTCUT) }
                    },
                    {
                        id: this.$const.WindowSettings.GLOBAL_SHORTCUT,
                        label: 'Toggle window',
                        description: '[EXPERIMENTAL] Shortcut to toggle window visibility.',
                        data: { type: 'key', value: await storage.getSettings(this.$const.WindowSettings.GLOBAL_SHORTCUT) }
                    }
                ]
            }
        }
    }
})