app.component('Updates', {
  template: /*html*/ `
        <div class="updates">

            <div class="update-card">
                <p class="small mb-2">Current version: <span class="fw-bold">v{{ status.currentVersion }}</span>.</p>

                <!-- Idle -->
                <template  v-if="status.state === 'idle'">
                    <p class="small mb-2">Check for new versions to keep Handbook up to date.</p>
                    <button class="btn btn-sm btn-primary" @click="checkForUpdates">Check for Updates</button>
                </template>

                <!-- Checking -->
                <template v-else-if="status.state === 'checking'">
                    <div class="d-flex align-items-center">
                        <div class="spinner-border spinner-border-sm me-2" role="status"></div>
                        <span class="small">Checking for updates...</span>
                    </div>
                </template>

                <!-- Update available -->
                <template v-else-if="status.state === 'available'">
                    <div class="d-flex align-items-center mb-2">
                        <span class="update-dot update-dot-available me-2"></span>
                        <span class="small fw-bold">Version {{ status.version }} is available!</span>
                    </div>
                    <template v-if="status.platform === 'darwin'">
                        <p class="smallest mb-2 text-muted">Automatic updates are not supported on macOS for unsigned apps.</p>
                        <button class="btn btn-sm btn-primary" @click="openDownloadUrl">Open Download Page</button>
                    </template>
                    <template v-else>
                        <button class="btn btn-sm btn-primary" @click="downloadUpdate">Download Update</button>
                    </template>
                    <button class="btn btn-sm btn-secondary ms-2" @click="checkForUpdates">Recheck</button>
                </template>

                <!-- Downloading -->
                <template v-else-if="status.state === 'downloading'">
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
                </template>

                <!-- Downloaded -->
                <template v-else-if="status.state === 'downloaded'">
                    <div class="d-flex align-items-center mb-2">
                        <span class="update-dot update-dot-downloaded me-2"></span>
                        <span class="small fw-bold">Version {{ status.version }} is ready to install.</span>
                    </div>
                    <p class="smallest mb-2">The application will restart to apply the update.</p>
                    <button class="btn btn-sm btn-primary" @click="installUpdate">Restart &amp; Install</button>
                </template>

                <!-- Up to date -->
                <template v-else-if="status.state === 'not-available'">
                    <div class="d-flex align-items-center mb-2">
                        <span class="update-dot update-dot-uptodate me-2"></span>
                        <span class="small">You're on the latest version.</span>
                    </div>
                    <button class="btn btn-sm btn-secondary" @click="checkForUpdates">Check Again</button>
                </template>

                <!-- Error -->
                <template v-else-if="status.state === 'error'">
                    <div class="d-flex align-items-center mb-2">
                        <span class="update-dot update-dot-error me-2"></span>
                        <span class="small fw-bold">Update check failed</span>
                    </div>
                    <p class="smallest mb-2 text-muted">{{ status.error }}</p>
                    <button class="btn btn-sm btn-secondary" @click="checkForUpdates">Retry</button>
                </template>
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
    this.$remote.updater.onStatusChanged((status) => {
      this.status = status
      if (status.error) {
        console.error('Updater error:', status.error)
        status.error = 'An error occurred while checking for updates. Please try again later.'
      }
    })
    this.$remote.updater.getStatus()
  },
  methods: {
    checkForUpdates() { this.$remote.updater.checkForUpdates() },
    downloadUpdate() { this.$remote.updater.downloadUpdate() },
    installUpdate() { this.$remote.updater.installUpdate() },
    openDownloadUrl() { this.$remote.updater.openDownloadUrl() }
  }
})
