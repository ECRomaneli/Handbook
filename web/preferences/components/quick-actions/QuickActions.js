app.component('QuickActions', {
  template: /*html*/ `
    <div class="d-flex flex-column" style="gap: 6px;">

      <!-- Empty state -->
      <template v-if="items && items.length === 0">
        <div class="empty-state">
          <i class="icon icon-quick-actions empty-state-icon" style="width: 80px; height: 80px;"></i>
          <span class="empty-state-title">{{ $i18n.preferences.quickActions.emptyTitle }}</span>
          <span class="empty-state-desc">{{ $i18n.preferences.quickActions.emptyDesc }}</span>
        </div>
      </template>

      <!-- Search bar -->
      <div v-if="items && items.length > 0" class="perm-search">
        <i class="icon icon-search perm-search-icon"></i>
        <input type="search" class="perm-search-input" :placeholder="$i18n.preferences.quickActions.search" v-model="searchQuery" spellcheck="false">
      </div>

      <quick-actions-table :items="filteredItems" :readonly="isFiltered" @update="store" @remove="store"></quick-actions-table>

      <!-- Variables reference (collapsible) -->
      <div v-if="items" class="ws-variables-section">
        <div class="ws-variables-header ws-variables-toggle" @click="showVariables = !showVariables">
          <div class="ws-variables-toggle-row">
            <i class="icon icon-chevron-right perm-chevron" :class="{ 'perm-chevron-open': showVariables }"></i>
            <span class="ws-variables-title">{{ $i18n.preferences.quickActions.variablesTitle }}</span>
          </div>
          <span class="ws-variables-desc">{{ $i18n.preferences.quickActions.variablesDesc }}</span>
        </div>
        <div v-show="showVariables" class="ws-variables-body">
          <table class="table mb-0">
            <thead>
              <tr>
                <th style="width: 160px;">Variable</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(desc, key) in $i18n.preferences.quickActions.variables" :key="key">
                <td><code class="ws-var-code">\${<span>{{ key }}</span>}</code></td>
                <td>{{ desc }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

    </div>
  `,
  inject: ['$remote', '$i18n', '$searchEngine'],
  data() {
    return {
      items: null,
      searchQuery: '',
      showVariables: false,
    }
  },
  computed: {
    isFiltered() { return this.searchQuery.trim().length > 0 },
    filteredItems() {
      if (!this.isFiltered) { return this.items }
      return this.$searchEngine.search(this.items, this.searchQuery, { excludeKeys: ['.id'] })
    },
  },
  created() {
    this.retrieve()
  },
  methods: {
    async retrieve() {
      this.items = await this.$remote.storage.getQuickActions()
    },

    store() {
      this.$remote.storage.setQuickActions(Vue.toRaw(this.items))
    },
  }
})
