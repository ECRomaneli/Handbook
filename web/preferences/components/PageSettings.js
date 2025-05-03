app.component('PageSettings', {
    template: /*html*/ `
    <div v-if="pages" class="d-flex flex-column align-items-center">
        <page-table class="overflow-hidden rounded" :pages="pages" @update="storePages" @remove="storePages"></page-table>
        <div class="w-100 d-flex justify-content-center">
            <button type="button" class="btn btn-sm btn-secondary w-25 me-2" @click="importPages()">Import</button>
            <button type="button" class="btn btn-sm btn-secondary w-25" @click="exportPages()">Export</button>
        </div>
    </div>
    <span v-else>Loading...</span>
    `,
    emits: [ 'update' ],
    inject: [ '$exporter', '$remote' ],
    data() { return { pages: null } },
    created() { this.retrievePages() },
    methods: {
        async retrievePages() {
            this.pages = await this.$remote.storage.getPages()
        },

        storePages(page) {
            this.$remote.storage.setPages(Vue.toRaw(this.pages))
            this.$emit('update', page)
        },

        importPages() {
            this.$exporter.import('.json', (status, data) => {
                if (!status) { return }

                const importedPages = JSON.parse(data)
                this.pages.splice(0, this.pages.length)
                Array.prototype.forEach.call(importedPages, p => this.pages.push(p))
                this.storePages()
            })
        },

        exportPages() {
            this.$exporter.export('application/json', JSON.stringify(this.pages, null, 2))
        }
    }
})