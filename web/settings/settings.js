const Vue = require("vue")

const app = Vue.createApp({
    template: /*html*/ `
        <div class="exit-btn" @click="$remote.window.close()">
            <svg class="square-16" xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='#000'>
                <path d='M.293.293a1 1 0 0 1 1.414 0L8 6.586 14.293.293a1 1 0 1 1 1.414 1.414L9.414 8l6.293 6.293a1 1 0 0 1-1.414 1.414L8 9.414l-6.293 6.293a1 1 0 0 1-1.414-1.414L6.586 8 .293 1.707a1 1 0 0 1 0-1.414z'/>
            </svg>
        </div>
        <div class="w-100 d-flex flex-column pt-4">
            <div>
                <span class="h5 ps-4">Settings</span>
            </div>
            <ul class="inline-tabs mt-3 px-4">
                <li @click="tab = 'pages'">
                    <button class="tab" :class="{ active: tab === 'pages' }">Pages</button>
                </li>
                <li @click="tab = 'window'">
                    <button class="tab" :class="{ active: tab === 'window' }">Window</button>
                </li>
            </ul>

            <div class="tab-content p-3 overflow-auto">
                <div class="tab-pane show" :class="{ active: tab === 'pages' }">
                    <page-settings></page-settings>
                </div>

                <div class="tab-pane container" :class="{ active: tab === 'window' }">
                    <window-settings></window-settings>
                </div>
            </div>
        </div>
    `,

    inject: [ '$remote' ],
    data() { return { tab: 'pages' } },
    created() { this.enableDragWindow() },
    methods: {
        enableDragWindow() {
            document.addEventListener('mousedown', (e) => {
                if (e.button !== 0 || e.pageY > 100) { return }
        
                this.$remote.window.dragstart()
        
                const offsetX = e.screenX
                const offsetY = e.screenY
        
                document.body.style.cursor = 'move'
            
                const onMouseMove = (e) => {
                    e.preventDefault()
                    this.$remote.window.dragging({ x: e.screenX - offsetX, y: e.screenY - offsetY })
                }
            
                const onMouseUp = () => {
                    document.body.style.cursor = ''
                    document.removeEventListener('mousemove', onMouseMove)
                    document.removeEventListener('mouseup', onMouseUp)
                }
            
                document.addEventListener('mousemove', onMouseMove)
                document.addEventListener('mouseup', onMouseUp)
            })
        }
    }
})