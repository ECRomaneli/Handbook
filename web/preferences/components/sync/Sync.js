app.component('SyncTab', {
  template: /*html*/ `
    <div id="sync-tab">

      <updates></updates>

      <!-- Local File -->
      <div class="sync-card">
        <div class="sync-card-header">
          <div class="d-flex align-items-center">
            <svg class="sync-icon me-2" viewBox="0 0 16 16" fill="currentColor"><path d="M4 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V4.414A2 2 0 0 0 13.414 3L11 .586A2 2 0 0 0 9.586 0H4zm5.586 1L13 4.414V14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h5.586z"/></svg>
            <span class="sync-card-title">Local File Backup</span>
          </div>
          <span class="sync-card-description">Export your configuration to a JSON file or import from a previously saved backup.</span>
        </div>
        <div class="sync-card-actions">
          <button class="btn btn-sm btn-secondary" :disabled="loading" @click="importFromFile">Import</button>
          <button class="btn btn-sm btn-secondary" :disabled="loading" @click="exportToFile">Export</button>
        </div>
      </div>

      <!-- GitHub Gist -->
      <div class="sync-card">
        <div class="sync-card-header">
          <div class="d-flex align-items-center">
            <svg class="sync-icon me-2" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z"/></svg>
            <span class="sync-card-title">GitHub Gist Backup</span>
          </div>
          <span class="sync-card-description">Sync your configuration using a secret GitHub Gist. Requires a personal access token with <code>gist</code> scope.</span>
        </div>
        <div class="sync-card-body">
          <div class="sync-field">
            <label>Personal Access Token</label>
            <div class="input-group input-group-sm">
              <input :type="showToken ? 'text' : 'password'" class="form-control" v-model="gist.token" placeholder="ghp_xxxxxxxxxxxxxxxxxxxx" @change="saveGistSettings">
              <button class="btn btn-secondary btn-sm" @click="showToken = !showToken" :title="showToken ? 'Hide' : 'Show'">
                <svg v-if="showToken" width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M16 8s-3-5.5-8-5.5S0 8 0 8s3 5.5 8 5.5S16 8 16 8zM1.173 8a13.133 13.133 0 0 1 1.66-2.043C4.12 4.668 5.88 3.5 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.133 13.133 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755C11.879 11.332 10.119 12.5 8 12.5c-2.12 0-3.879-1.168-5.168-2.457A13.134 13.134 0 0 1 1.172 8z"/><path d="M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM4.5 8a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0z"/></svg>
                <svg v-else width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M13.359 11.238C15.06 9.72 16 8 16 8s-3-5.5-8-5.5a7.028 7.028 0 0 0-2.79.588l.77.771A5.944 5.944 0 0 1 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.134 13.134 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755-.165.165-.337.328-.517.486l.708.709z"/><path d="M11.297 9.176a3.5 3.5 0 0 0-4.474-4.474l.823.823a2.5 2.5 0 0 1 2.829 2.829l.822.822zm-2.943 1.299l.822.822a3.5 3.5 0 0 1-4.474-4.474l.823.823a2.5 2.5 0 0 0 2.829 2.829z"/><path d="M3.35 5.47c-.18.16-.353.322-.518.487A13.134 13.134 0 0 0 1.172 8l.195.288c.335.48.83 1.12 1.465 1.755C4.121 11.332 5.881 12.5 8 12.5c.716 0 1.39-.133 2.02-.36l.77.772A7.029 7.029 0 0 1 8 13.5C3 13.5 0 8 0 8s.939-1.721 2.641-3.238l.708.709z"/><path d="M13.646 14.354l-12-12 .708-.708 12 12-.708.708z"/></svg>
              </button>
            </div>
          </div>
          <div class="sync-field">
            <label>Gist ID <span class="text-muted smallest">(optional, auto-created if empty)</span></label>
            <input type="text" class="form-control form-control-sm" v-model="gist.id" placeholder="Leave empty to create a new gist" @change="saveGistSettings">
          </div>
        </div>
        <div class="sync-card-actions">
          <button class="btn btn-sm btn-secondary" :disabled="!gist.token || loading" @click="gistPull">
            <span v-if="loading === 'gist-pull'" class="spinner-border spinner-border-sm me-1"></span>
            Import
          </button>
          <button class="btn btn-sm btn-secondary" :disabled="!gist.token || loading" @click="gistPush">
            <span v-if="loading === 'gist-push'" class="spinner-border spinner-border-sm me-1"></span>
             Export
          </button>
        </div>
      </div>

    </div>
  `,

  inject: ['$remote'],

  data() {
    return {
      showToken: false,
      loading: null,
      gist: { token: '', id: '' }
    }
  },

  async created() {
    await this.loadSettings()
  },

  methods: {
    async loadSettings() {
      const settings = await this.$remote.sync.getSettings()
      this.gist.token = settings.gistToken || ''
      this.gist.id = settings.gistId || ''
    },

    saveGistSettings() {
      this.$remote.sync.saveSyncSettings({ gistToken: this.gist.token, gistId: this.gist.id })
    },

    async importFromFile() {
      this.loading = 'import'
      try {
        await this.$remote.sync.importFromFile()
      } finally {
        this.loading = null
      }
    },

    async exportToFile() {
      this.loading = 'export'
      try {
        await this.$remote.sync.exportToFile()
      } finally {
        this.loading = null
      }
    },

    async gistPush() {
      this.loading = 'gist-push'
      try {
        const result = await this.$remote.sync.gistPush()
        if (result && result.gistId) { this.gist.id = result.gistId }
      } finally {
        this.loading = null
      }
    },

    async gistPull() {
      this.loading = 'gist-pull'
      try {
        await this.$remote.sync.gistPull()
      } finally {
        this.loading = null
      }
    }
  }
})
