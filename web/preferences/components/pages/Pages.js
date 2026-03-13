app.component('Pages', {
  template: /*html*/ `
    <div v-if="pages" class="d-flex flex-column align-items-center" style="margin-top: -12px;">
        <div class="table-container my-3">
            <page-table class="overflow-hidden m-0" :pages="pages" @update="storePages" @remove="storePages"></page-table>
        </div>
        <div class="pages-sync-hint">
            <svg class="me-2" width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M11.534 7h3.932a.25.25 0 0 1 .192.41l-1.966 2.36a.25.25 0 0 1-.384 0l-1.966-2.36a.25.25 0 0 1 .192-.41zm-11 2h3.932a.25.25 0 0 0 .192-.41L2.692 6.23a.25.25 0 0 0-.384 0L.342 8.59A.25.25 0 0 0 .534 9z"/><path fill-rule="evenodd" d="M8 3c-1.552 0-2.94.707-3.857 1.818a.5.5 0 1 1-.771-.636A6.002 6.002 0 0 1 13.917 7H12.9A5.002 5.002 0 0 0 8 3zM3.1 9a5.002 5.002 0 0 0 8.757 2.182.5.5 0 1 1 .771.636A6.002 6.002 0 0 1 2.083 9H3.1z"/></svg>
            <span @click="$emit('navigate', 'sync')">or import your pages from a backup using the <code>Sync</code> tab</span>
        </div>
    </div>
    <span v-else>Loading...</span>
    `,
  emits: ['update', 'navigate'],
  inject: ['$const', '$remote'],
  data() { return { pages: null } },
  created() { this.retrievePages() },
  methods: {
    async retrievePages() {
      this.pages = await this.$remote.storage.getPages()
    },

    storePages(page) {
      this.$remote.storage.setPages(Vue.toRaw(this.pages))
      this.$emit('update', page)
    }
  }
})