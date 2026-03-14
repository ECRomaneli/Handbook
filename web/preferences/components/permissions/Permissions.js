const SearchEngine = require("@ecromaneli/search-engine")

app.component('Permissions', {
  template: /*html*/ `
    <div v-if="permissions" class="perm-container">

      <div v-if="Object.keys(permissions).length > 0" class="perm-search">
        <svg class="perm-search-icon" width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z"/>
        </svg>
        <input type="search" class="perm-search-input" :placeholder="$i18n.preferences.permissions.search" v-model="searchQuery" @input="filterPermissions" spellcheck="false">
      </div>

      <div class="perm-list">
        <div v-for="(sessionData, session) in filteredPermissions" :key="session" class="perm-session-card">

          <!-- Session Header -->
          <div class="perm-session-header" @click="toggleSession(session)">
            <div class="perm-session-left">
              <svg class="perm-chevron" :class="{ 'perm-chevron-open': isSessionOpen(session) }" width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                <path fill-rule="evenodd" d="M4.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L10.293 8 4.646 2.354a.5.5 0 0 1 0-.708z"/>
              </svg>
              <svg class="perm-session-icon" width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                <path d="M5 0a.5.5 0 0 1 .5.5V2h5V.5a.5.5 0 0 1 1 0V2h1a2 2 0 0 1 2 2v1H1.5V4a2 2 0 0 1 2-2h1V.5A.5.5 0 0 1 5 0z"/>
                <path d="M1.5 6v8a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V6h-13z"/>
              </svg>
              <span class="perm-session-name">{{ session }}</span>
              <span class="perm-count-badge">{{ countSessionPermissions(sessionData) }}</span>
            </div>
            <button class="perm-action-btn perm-revoke-btn" :title="$i18n.preferences.permissions.revokeSession" @click.stop="revokeSessionPermissions(session)">
              <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
                <path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H5.5l1-1h3l1 1h2.5a1 1 0 0 1 1 1v1zM4.118 4L4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
              </svg>
            </button>
          </div>

          <!-- URLs (collapsible) -->
          <div v-if="isSessionOpen(session)" class="perm-session-body">
            <div v-for="(urlData, url) in sessionData" :key="url" class="perm-url-group">

              <!-- URL Header -->
              <div class="perm-url-header" @click="toggleUrl(session, url)">
                <div class="perm-url-left">
                  <svg class="perm-chevron perm-chevron-sm" :class="{ 'perm-chevron-open': isUrlOpen(session, url) }" width="10" height="10" viewBox="0 0 16 16" fill="currentColor">
                    <path fill-rule="evenodd" d="M4.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L10.293 8 4.646 2.354a.5.5 0 0 1 0-.708z"/>
                  </svg>
                  <svg class="perm-url-icon" width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8zm7.5-6.923c-.67.204-1.335.82-1.887 1.855A7.97 7.97 0 0 0 5.145 4H7.5V1.077zM4.09 4a9.267 9.267 0 0 1 .64-1.539 6.7 6.7 0 0 1 .597-.933A7.025 7.025 0 0 0 2.255 4H4.09zm-.582 3.5c.03-.877.138-1.718.312-2.5H1.674a6.958 6.958 0 0 0-.656 2.5h2.49zM4.847 5a12.5 12.5 0 0 0-.338 2.5H7.5V5H4.847zM8.5 5v2.5h2.99a12.495 12.495 0 0 0-.337-2.5H8.5zM4.51 8.5a12.5 12.5 0 0 0 .337 2.5H7.5V8.5H4.51zm3.99 0V11h2.653c.187-.765.306-1.608.338-2.5H8.5zM5.145 12c.138.386.295.744.468 1.068.552 1.035 1.218 1.65 1.887 1.855V12H5.145zm.182 2.472a6.696 6.696 0 0 1-.597-.933A9.268 9.268 0 0 1 4.09 12H2.255a7.024 7.024 0 0 0 3.072 2.472zM3.82 11a13.652 13.652 0 0 1-.312-2.5h-2.49c.062.89.291 1.733.656 2.5H3.82zm6.853 3.472A7.024 7.024 0 0 0 13.745 12H11.91a9.27 9.27 0 0 1-.64 1.539 6.688 6.688 0 0 1-.597.933zM8.5 12v2.923c.67-.204 1.335-.82 1.887-1.855.173-.324.33-.682.468-1.068H8.5zm3.68-1h2.146c.365-.767.594-1.61.656-2.5h-2.49a13.65 13.65 0 0 1-.312 2.5zm2.802-3.5a6.959 6.959 0 0 0-.656-2.5H12.18c.174.782.282 1.623.312 2.5h2.49zM11.27 2.461c.247.464.462.98.64 1.539h1.835a7.024 7.024 0 0 0-3.072-2.472c.218.284.418.598.597.933zM10.855 4a7.966 7.966 0 0 0-.468-1.068C9.835 1.897 9.17 1.282 8.5 1.077V4h2.355z"/>
                  </svg>
                  <span class="perm-url-name">{{ url }}</span>
                  <span class="perm-count-badge perm-count-badge-sm">{{ Object.keys(urlData).length }}</span>
                </div>
                <button class="perm-action-btn perm-revoke-btn" :title="$i18n.preferences.permissions.revokeUrl" @click.stop="revokeUrlPermissions(session, url)">
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
                    <path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H5.5l1-1h3l1 1h2.5a1 1 0 0 1 1 1v1zM4.118 4L4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
                  </svg>
                </button>
              </div>

              <!-- Permission Items -->
              <div v-if="isUrlOpen(session, url)" class="perm-items">
                <div v-for="(_, permission) in urlData" :key="permission" class="perm-item">
                  <div class="perm-item-left">
                    <span class="perm-item-name">{{ $i18n.permission.text[permission] ?? permission }}</span>
                  </div>
                  <div class="perm-item-right">
                    <div class="perm-status-group">
                      <button v-for="opt in ['allow', 'ask', 'deny']" :key="opt"
                        class="perm-status-btn"
                        :class="{ 'perm-status-active': urlData[permission] === opt, ['perm-status-' + opt]: urlData[permission] === opt }"
                        @click="updatePermission(session, url, permission, opt)">
                        {{ $i18n.permission[opt] }}
                      </button>
                    </div>
                    <button class="perm-action-btn perm-revoke-btn perm-revoke-inline" :title="$i18n.preferences.permissions.revoke" @click="revokePermission(session, url, permission)">
                      <svg class="square-14" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M.293.293a1 1 0 0 1 1.414 0L8 6.586 14.293.293a1 1 0 1 1 1.414 1.414L9.414 8l6.293 6.293a1 1 0 0 1-1.414 1.414L8 9.414l-6.293 6.293a1 1 0 0 1-1.414-1.414L6.586 8 .293 1.707a1 1 0 0 1 0-1.414z"></path>
                      </svg>
                    </button>
                  </div>
                </div>

                <div v-if="Object.keys(urlData).length === 0" class="perm-empty">
                  {{ $i18n.preferences.permissions.noPermissions }}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div v-if="Object.keys(filteredPermissions).length === 0" class="perm-empty-state">
          <svg width="32" height="32" viewBox="0 0 16 16" fill="currentColor" opacity=".2">
            <path d="M8 1a2 2 0 0 1 2 2v4H6V3a2 2 0 0 1 2-2zm3 6V3a3 3 0 0 0-6 0v4a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/>
          </svg>
          <span>{{ $i18n.preferences.permissions.noPermissionsGranted }}</span>
        </div>
      </div>
    </div>
    `,
  inject: ['$remote', '$image', '$const', '$i18n'],
  data() {
    return {
      permissions: null,
      filteredPermissions: null,
      permissionsList: null,
      searchQuery: '',
      openSessions: {},
      openUrls: {},
    }
  },
  created() {
    this.setupEventListeners()
    this.loadPermissions()
  },
  watch: {
    permissions: {
      handler() {
        this.updatePermissionsList()
        this.filterPermissions()
      },
      deep: true
    },

    searchQuery() {
      this.filterPermissions()
    }
  },
  methods: {
    setupEventListeners() {
      this.$remote.preferences.onPermissionsUpdated(p => { this.permissions = p })
      this.$remote.preferences.onPermissionsQuery(q => { this.searchQuery = q })
    },

    updatePermissionsList() {
      this.permissionsList = []
      for (const session in this.permissions) {
        const obj = {}
        obj[session] = {}
        const sessionData = this.permissions[session]
        for (const url in sessionData) {
          const permissions = sessionData[url]
          obj.data = { session, url, permissions }
          obj[session][url] = permissions
          this.permissionsList.push(obj)
        }
      }
    },

    filterPermissions() {
      const filterableList = []
      for (const session in this.permissions) {
        const sessionData = this.permissions[session]
        for (const url in sessionData) {
          const permissions = sessionData[url]
          filterableList.push({ session, url, permissions, permission: Object.keys(permissions).map(p => this.$i18n.permission.text[p] || p) })
        }
      }

      const filteredPermissions = {}
      SearchEngine.search(filterableList, this.searchQuery, { matchChildKeysAsValues: true }).forEach(data => {
        if (!data.permissions || Object.keys(data.permissions).length === 0) { return }
        filteredPermissions[data.session] = filteredPermissions[data.session] || {}
        filteredPermissions[data.session][data.url] = data.permissions
      })
      this.filteredPermissions = filteredPermissions

      // Auto-expand all when filtering
      if (this.isFiltered()) {
        for (const session in filteredPermissions) {
          this.openSessions[session] = true
          for (const url in filteredPermissions[session]) {
            this.openUrls[session + '::' + url] = true
          }
        }
      }
    },

    async loadPermissions() {
      try {
        this.permissions = await this.$remote.storage.getPermissions()
      } catch (error) {
        console.error("Error loading permissions:", error)
        this.permissions = {}
      }
    },

    toggleSession(session) {
      this.openSessions[session] = !this.openSessions[session]
    },

    isSessionOpen(session) {
      // Auto-open if only one session or is filtered
      if (this.openSessions[session] !== undefined) { return this.openSessions[session] }
      return this.isFiltered() || Object.keys(this.filteredPermissions).length === 1
    },

    toggleUrl(session, url) {
      const key = session + '::' + url
      this.openUrls[key] = !this.openUrls[key]
    },

    isUrlOpen(session, url) {
      const key = session + '::' + url
      if (this.openUrls[key] !== undefined) { return this.openUrls[key] }
      return this.isFiltered() || this.isSingle()
    },

    countSessionPermissions(sessionData) {
      let count = 0
      for (const url in sessionData) {
        count += Object.keys(sessionData[url]).length
      }
      return count
    },

    async revokeSessionPermissions(session) {
      if (await this.confirmModal(this.$i18n.preferences.permissions.revokeSessionDialog.replace('{session}', session))) {
        delete this.permissions[session]
        this.revokePermissions(session)
      }
    },

    async revokeUrlPermissions(session, url) {
      if (await this.confirmModal(this.$i18n.preferences.permissions.revokeUrlDialog.replace('{url}', url))) {
        delete this.permissions[session][url]
        if (Object.keys(this.permissions[session]).length === 0) {
          delete this.permissions[session]
        }
        this.revokePermissions(session, url)
      }
    },

    revokePermission(session, url, permission) {
      delete this.permissions[session][url][permission]
      if (Object.keys(this.permissions[session][url]).length === 0) {
        delete this.permissions[session][url]
        if (Object.keys(this.permissions[session]).length === 0) {
          delete this.permissions[session]
        }
      }
      this.revokePermissions(session, url, permission)
    },

    updatePermission(session, url, permission, value) {
      this.permissions[session][url][permission] = value
      this.$remote.storage.setPermission(session, url, permission, value)
      this.filterPermissions()
    },

    revokePermissions(session, url, permission) {
      this.$remote.storage.revokePermissions(session, url, permission)
      this.filterPermissions()
    },

    isFiltered() {
      if (!this.permissions || !this.filteredPermissions) { return false }
      const total = Object.keys(this.permissions).length
      return total === 1 || total > Object.keys(this.filteredPermissions).length
    },

    isSingle() {
      return Object.keys(this.filteredPermissions).length === 1
    },

    confirmModal(message) {
      return this.$remote.preferences.confirm(message)
    }
  }
})