app.component('Updates', {
  template: /*html*/ `
        <div class="updates">
            <div class="d-flex align-items-center mb-4">
                <img class="me-2" :src="$image.src('book-open')" style="width: 22px">
                <span class="h5 mb-0">Handbook</span>
                <span class="badge bg-secondary ms-2">v{{ status.currentVersion }}</span>
            </div>

            <!-- Idle -->
            <div v-if="status.state === 'idle'" class="update-card">
                <p class="small mb-2">Check for new versions to keep Handbook up to date.</p>
                <button class="btn btn-sm btn-primary" @click="checkForUpdates">Check for Updates</button>
            </div>

            <!-- Checking -->
            <div v-else-if="status.state === 'checking'" class="update-card">
                <div class="d-flex align-items-center">
                    <div class="spinner-border spinner-border-sm me-2" role="status"></div>
                    <span class="small">Checking for updates...</span>
                </div>
            </div>

            <!-- Update available -->
            <div v-else-if="status.state === 'available'" class="update-card">
                <div class="d-flex align-items-center mb-2">
                    <span class="update-dot update-dot-available me-2"></span>
                    <span class="small fw-bold">Version {{ status.version }} is available!</span>
                </div>
                <button class="btn btn-sm btn-primary" @click="downloadUpdate">Download Update</button>
                <button class="btn btn-sm btn-secondary ms-2" @click="checkForUpdates">Recheck</button>
            </div>

            <!-- Downloading -->
            <div v-else-if="status.state === 'downloading'" class="update-card">
                <div class="d-flex align-items-center mb-2">
                    <div class="spinner-border spinner-border-sm me-2" role="status"></div>
                    <span class="small">Downloading update... {{ status.progress }}%</span>
                </div>
                <div class="progress" style="height: 6px">
                    <div class="progress-bar" role="progressbar"
                        :style="{ width: status.progress + '%' }"
                        :aria-valuenow="status.progress" aria-valuemin="0" aria-valuemax="100">
                    </div>
                </div>
            </div>

            <!-- Downloaded -->
            <div v-else-if="status.state === 'downloaded'" class="update-card">
                <div class="d-flex align-items-center mb-2">
                    <span class="update-dot update-dot-downloaded me-2"></span>
                    <span class="small fw-bold">Version {{ status.version }} is ready to install.</span>
                </div>
                <p class="smallest mb-2">The application will restart to apply the update.</p>
                <button class="btn btn-sm btn-primary" @click="installUpdate">Restart &amp; Install</button>
            </div>

            <!-- Up to date -->
            <div v-else-if="status.state === 'not-available'" class="update-card">
                <div class="d-flex align-items-center mb-2">
                    <span class="update-dot update-dot-uptodate me-2"></span>
                    <span class="small">You're on the latest version.</span>
                </div>
                <button class="btn btn-sm btn-secondary" @click="checkForUpdates">Check Again</button>
            </div>

            <!-- Error -->
            <div v-else-if="status.state === 'error'" class="update-card">
                <div class="d-flex align-items-center mb-2">
                    <span class="update-dot update-dot-error me-2"></span>
                    <span class="small fw-bold">Update check failed</span>
                </div>
                <p class="smallest mb-2 text-muted">{{ status.error }}</p>
                <button class="btn btn-sm btn-secondary" @click="checkForUpdates">Retry</button>
            </div>
        </div>
    `,
  inject: ['$remote', '$image'],
  data() {
    return {
      status: {
        state: 'idle',
        version: '',
        currentVersion: this.$remote.version,
        progress: 0,
        error: ''
      }
    }
  },
  mounted() {
    this.$remote.updater.onStatusChanged((status) => { this.status = status })
    this.$remote.updater.getStatus()
  },
  methods: {
    checkForUpdates() { this.$remote.updater.checkForUpdates() },
    downloadUpdate() { this.$remote.updater.downloadUpdate() },
    installUpdate() { this.$remote.updater.installUpdate() }
  }
})
