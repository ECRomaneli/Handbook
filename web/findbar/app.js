const Vue = require("vue")
window.addEventListener('load', () => { app.mount('#app') })

const app = Vue.createApp({
    template: /*html*/ `
        <div id="find-bar" class="d-flex w-100 h-100 p-2 align-items-center">
            <input @keyup="inputChange" type="search" class="w-100" id="find-input">
            <div id="count" class="mx-2">
                <span id="current">{{ this.matches.active }}</span>/<span id="total">{{ this.matches.total }}</span>
            </div>
            <div class="divider mx-1"></div>
            <div id="control-btns" class="mx-1">
                <div @click="$remote.previous()" id="previous" class="svg-btn me-2">▲</div>
                <div @click="$remote.next()" id="next" class="svg-btn me-2">▼</div>
                <div @click="$remote.close()" id="exit" class="svg-btn">✕</div>
            </div>
        </div>
    `,

    inject: [ '$remote' ],
    data() { return { matches: { active: 0, total: 0 } } },
    created() {
        this.$remote.onMatchesChange((_e, m) => this.matches = m)
    },
    methods: {
        inputChange(e) {
            const el = e.target
            this.$remote.inputChange(el.value)
        }
    }
})