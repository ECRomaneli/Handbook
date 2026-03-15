const SearchEngine = require("@ecromaneli/search-engine")

app.component('Permissions', {
  template: /*html*/ `
    <div v-if="permissions" class="perm-container">

      <div v-if="Object.keys(permissions).length > 0" class="perm-search">
        <i class="icon icon-search perm-search-icon"></i>
        <input type="search" class="perm-search-input" :placeholder="$i18n.preferences.permissions.search" v-model="searchQuery" @input="filterPermissions" spellcheck="false">
      </div>

      <div class="perm-list">
        <div v-for="(sessionData, session) in filteredPermissions" :key="session" class="perm-session-card">

          <!-- Session Header -->
          <div class="perm-session-header" @click="toggleSession(session)">
            <div class="perm-session-left">
              <i class="icon icon-chevron-right perm-chevron" :class="{ 'perm-chevron-open': isSessionOpen(session) }"></i>
              <i class="icon icon-session perm-session-icon"></i>
              <span class="perm-session-name">{{ getSession(session) }}</span>
              <span class="perm-count-badge">{{ countSessionPermissions(sessionData) }}</span>
            </div>
            <button class="perm-action-btn perm-revoke-btn" :title="$i18n.preferences.permissions.revokeSession" @click.stop="revokeSessionPermissions(session)">
              <i class="icon icon-trash" style="width:12px;height:12px"></i>
            </button>
          </div>

          <!-- URLs (collapsible) -->
          <div v-if="isSessionOpen(session)" class="perm-session-body">
            <div v-for="(urlData, url) in sessionData" :key="url" class="perm-url-group">

              <!-- URL Header -->
              <div class="perm-url-header" @click="toggleUrl(session, url)">
                <div class="perm-url-left">
                  <i class="icon icon-chevron-right perm-chevron perm-chevron-sm" :class="{ 'perm-chevron-open': isUrlOpen(session, url) }" style="width:10px;height:10px"></i>
                  <i class="icon icon-globe perm-url-icon"></i>
                  <span class="perm-url-name">{{ url }}</span>
                  <span class="perm-count-badge perm-count-badge-sm">{{ Object.keys(urlData).length }}</span>
                </div>
                <button class="perm-action-btn perm-revoke-btn" :title="$i18n.preferences.permissions.revokeUrl" @click.stop="revokeUrlPermissions(session, url)">
                  <i class="icon icon-trash" style="width:12px;height:12px"></i>
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
                      <i class="icon icon-x"></i>
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
          <i class="icon icon-lock" style="opacity:.2"></i>
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
          filterableList.push({ session, translatedSession: this.getSession(session), url, permissions, permission: Object.keys(permissions).map(p => this.$i18n.permission.text[p] || p) })
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
      if (await this.confirmModal(this.$i18n.preferences.permissions.revokeSessionDialog.replace('{session}', this.getSession(session)))) {
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

    getSession(session) {
      return session === 'Default' ? this.$i18n.preferences.pages.defaultSession : session
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