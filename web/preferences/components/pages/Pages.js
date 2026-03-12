app.component('Pages', {
  template: /*html*/ `
    <div v-if="pages" class="d-flex flex-column align-items-center">
        <div class="table-container my-3">
            <page-table class="overflow-hidden m-0" :pages="pages" @update="storePages" @remove="storePages"></page-table>
        </div>
    </div>
    <span v-else>Loading...</span>
    `,
  emits: ['update'],
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