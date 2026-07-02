app.component('Updates', {
  template: /*html*/ `
        <div class="updates">

            <div class="update-card">
                <p class="small mb-2">{{ $i18n.preferences.updates.currentVersion }} <span class="fw-bold">v{{ status.currentVersion }}</span>.</p>

                <!-- Idle -->
                <template v-if="status.state === 'idle'">
                    <p class="small mb-2">{{ $i18n.preferences.updates.checkDescription }}</p>
                    <button class="btn btn-sm btn-secondary " @click="checkForUpdates">{{ $i18n.preferences.updates.checkForUpdates }}</button>
                </template>

                <!-- Checking -->
                <template v-else-if="status.state === 'checking'">
                    <div class="d-flex align-items-center">
                        <div class="spinner-border spinner-border-sm me-2" role="status"></div>
                        <span class="small">{{ $i18n.preferences.updates.checking }}</span>
                    </div>
                </template>

                <!-- Update available -->
                <template v-else-if="status.state === 'available'">
                    <div class="d-flex align-items-center mb-2">
                        <span class="update-dot update-dot-available me-2"></span>
                        <span class="small fw-bold">{{ $i18n.preferences.updates.versionAvailable.replace('{version}', status.version) }}</span>
                    </div>
                    <p v-if="status.platform === 'darwin'" class="smallest mb-2 text-muted">{{ $i18n.preferences.updates.macOsUnsupported }}</p>
                    <div class="update-card-actions">
                        <button v-if="status.platform === 'darwin'" class="btn btn-sm btn-secondary" @click="openDownloadUrl">{{ $i18n.preferences.updates.openDownloadPage }}</button>
                        <button v-else class="btn btn-sm btn-secondary" @click="downloadUpdate">{{ $i18n.preferences.updates.downloadUpdate }}</button>
                        <button class="btn btn-sm btn-secondary" @click="checkForUpdates">{{ $i18n.preferences.updates.recheck }}</button>
                    </div>
                </template>

                <!-- Downloading -->
                <template v-else-if="status.state === 'downloading'">
                    <div class="d-flex align-items-center mb-2">
                        <div class="spinner-border spinner-border-sm me-2" role="status"></div>
                        <span class="small">{{ $i18n.preferences.updates.downloading.replace('{progress}', status.progress) }}</span>
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
                        <span class="small fw-bold">{{ $i18n.preferences.updates.readyToInstall.replace('{version}', status.version) }}</span>
                    </div>
                    <p class="smallest mb-2">{{ $i18n.preferences.updates.restartNotice }}</p>
                    <button class="btn btn-sm btn-secondary " @click="installUpdate">{{ $i18n.preferences.updates.restartAndInstall }}</button>
                </template>

                <!-- Up to date -->
                <template v-else-if="status.state === 'not-available'">
                    <div class="d-flex align-items-center mb-2">
                        <span class="update-dot update-dot-uptodate me-2"></span>
                        <span class="small">{{ $i18n.preferences.updates.upToDate }}</span>
                    </div>
                    <button class="btn btn-sm btn-secondary" @click="checkForUpdates">{{ $i18n.preferences.updates.checkAgain }}</button>
                </template>

                <!-- Error -->
                <template v-else-if="status.state === 'error'">
                    <div class="d-flex align-items-center mb-2">
                        <span class="update-dot update-dot-error me-2"></span>
                        <span class="small fw-bold">{{ $i18n.preferences.updates.updateFailed }}</span>
                    </div>
                    <p class="smallest mb-2 text-muted">{{ status.error }}</p>
                    <button class="btn btn-sm btn-secondary" @click="checkForUpdates">{{ $i18n.preferences.updates.retry }}</button>
                </template>
            </div>
        </div>
    `,
  inject: ['$remote', '$i18n'],
  data() {
    return {
      status: {
        state: 'idle',
        version: '',
        currentVersion: '-',
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
        status.error = this.$i18n.preferences.updates.updateError
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
