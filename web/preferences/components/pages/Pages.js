app.component('Pages', {
  template: /*html*/ `
    <div v-if="pages" class="d-flex flex-column" style="gap: 6px;">

        <!-- Empty state -->
        <template v-if="pages.length === 0">
            <div class="pages-empty-state">
                <i class="icon icon-globe pages-empty-icon" style="width: 80px; height: 80px;"></i>
                <span class="pages-empty-title">{{ $i18n.preferences.pages.emptyTitle }}</span>
                <span class="pages-empty-desc">{{ $i18n.preferences.pages.emptyDesc }}</span>
            </div>
        </template>

        <div v-if="pages.length > 0" class="perm-search">
            <i class="icon icon-search perm-search-icon"></i>
            <input type="search" class="perm-search-input" :placeholder="$i18n.preferences.pages.search" v-model="searchQuery" spellcheck="false">
        </div>
        <page-table :pages="filteredPages" :readonly="isFiltered" @update="storePages" @remove="storePages"></page-table>
        <div v-if="!isFiltered" class="page-card page-card-add" @click="$emit('navigate', 'sync')">
            <svg class="me-2" width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M11.534 7h3.932a.25.25 0 0 1 .192.41l-1.966 2.36a.25.25 0 0 1-.384 0l-1.966-2.36a.25.25 0 0 1 .192-.41zm-11 2h3.932a.25.25 0 0 0 .192-.41L2.692 6.23a.25.25 0 0 0-.384 0L.342 8.59A.25.25 0 0 0 .534 9z"/><path fill-rule="evenodd" d="M8 3c-1.552 0-2.94.707-3.857 1.818a.5.5 0 1 1-.771-.636A6.002 6.002 0 0 1 13.917 7H12.9A5.002 5.002 0 0 0 8 3zM3.1 9a5.002 5.002 0 0 0 8.757 2.182.5.5 0 1 1 .771.636A6.002 6.002 0 0 1 2.083 9H3.1z"/></svg>
            <span>{{ $i18n.preferences.pages.syncHint }}</span>
        </div>

    </div>
    `,
  emits: ['navigate'],
  inject: ['$const', '$remote', '$i18n', '$searchEngine'],
  data() {
    return {
      pages: null, searchQuery: '', defaultSession: this.$i18n.preferences.pages.defaultSession
    }
  },
  computed: {
    isFiltered() { return this.searchQuery.trim().length > 0 },
    filteredPages() {
      if (!this.isFiltered) { return this.pages }
      return this.$searchEngine.search(this.pages, this.searchQuery, { matchChildKeysAsValues: true, excludeKeys: ['.id', '.session'] })
    },
  },
  created() {
    this.$remote.storage.onPagesUpdated(this.onPagesUpdated)
    this.retrievePages();
  },
  methods: {
    async retrievePages() {
      this.onPagesUpdated(await this.$remote.storage.getPages())
    },

    storePages() {
      const pages = Vue.toRaw(this.pages)
      pages.forEach(p => delete p._session)
      this.$remote.storage.setPages(pages)
    },

    addFirstPage() {
      this.pages.push({ id: `${Date.now()}0`, label: '', url: '', session: '', persist: false })
    },

    onPagesUpdated(pages) {
      pages.forEach(p => p._session = p.session || this.defaultSession)
      this.pages = pages
    }
  }
})