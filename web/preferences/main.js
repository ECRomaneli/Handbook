const Vue = require("vue")
window.addEventListener('load', async () => {
    await loadScripts('../util/providers')
    await loadScripts('../util/plugins')
    await loadScripts('components')
    app.mount('#app')
})

const app = Vue.createApp({
    template: /*html*/ `
        <div class="exit-btn" @click="$remote.window.close()">
            <svg class="square-16" xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'>
                <path d='M.293.293a1 1 0 0 1 1.414 0L8 6.586 14.293.293a1 1 0 1 1 1.414 1.414L9.414 8l6.293 6.293a1 1 0 0 1-1.414 1.414L8 9.414l-6.293 6.293a1 1 0 0 1-1.414-1.414L6.586 8 .293 1.707a1 1 0 0 1 0-1.414z'/>
            </svg>
        </div>
        <div class="w-100 d-flex flex-column pt-4">
            <div>
                <span class="h5 ps-4">Preferences</span>
            </div>
            <ul class="inline-tabs mt-3 px-4">
                <li @click="tab = 'pages'">
                    <button class="tab" :class="{ active: tab === 'pages' }">Pages</button>
                </li>
                <li @click="tab = 'settings'">
                    <button class="tab" :class="{ active: tab === 'settings' }">Settings</button>
                </li>
                <li @click="tab = 'about'">
                    <button class="tab" :class="{ active: tab === 'about' }">About</button>
                </li>
            </ul>

            <div class="tab-content p-3 overflow-auto">
                <div class="tab-pane show" :class="{ active: tab === 'pages' }">
                    <page-settings></page-settings>
                </div>
                <div class="tab-pane container" :class="{ active: tab === 'settings' }">
                    <settings @update="onSettingsUpdate"></settings>
                </div>
                <div class="tab-pane container" :class="{ active: tab === 'about' }">
                    <about-tab v-if="tab === 'about'"></about-tab>
                </div>
            </div>
        </div>
    `,

    inject: [ '$remote', '$const' ],
    data() { return { tab: 'pages', appEl: document.getElementById('app') } },
    created() {
        this.setupLinuxSpecificStyles()
        this.loadTheme()
        this.setupWindowDrag()
    },
    methods: {
        async loadTheme() {
            this.setTheme(await this.$remote.storage.getSettings(this.$const.Settings.APP_THEME))
        },

        setupLinuxSpecificStyles() {
            if (!this.$const.OS.IS_LINUX) { return }
            this.appEl.style.setProperty('border', '1px solid var(--border-color)')
        },

        onSettingsUpdate(input, value) {
            if (input.id === this.$const.Settings.APP_THEME) { setTimeout(() => this.setTheme(value), 100) }
        },

        setTheme(theme) {
            switch (theme) {
                case 'system': theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; break
                case 'dark': theme = 'dark'; break
                default: theme = 'light'
            }
            this.appEl.setAttribute('data-bs-theme', theme)
            this.appEl.setAttribute('data-theme', theme)
        },

        setupWindowDrag() {
            let isDragging = false

            document.addEventListener('mousedown', (e) => {
                if (e.button !== 0 || e.pageY > 100 || isDragging) { return }
        
                const style = document.body.style
            
                const onMouseMove = (e) => {
                    if ((e.buttons & 1) === 0) { onMouseUp(); return }
                    e.preventDefault()
                    e.stopImmediatePropagation()
                    if (!isDragging) {
                        isDragging = true
                        this.$remote.window.dragstart()
                        style.setProperty('cursor', 'move', 'important')
                        style.setProperty('user-select', 'none', 'important')
                    }
                    this.$remote.window.dragging()
                }
            
                const onMouseUp = () => {
                    style.removeProperty('cursor')
                    style.removeProperty('user-select')
                    document.removeEventListener('mousemove', onMouseMove, true)
                    document.removeEventListener('mouseup', onMouseUp, true)
                    isDragging = false
                }
            
                document.addEventListener('mousemove', onMouseMove, true)
                document.addEventListener('mouseup', onMouseUp, true)
            }, true)
        }
    }
})