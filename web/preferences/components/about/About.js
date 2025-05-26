app.component('AboutTab', {
    template: /*html*/ `
        <div class="about">
            <div class="mt-1 mb-3 d-flex justify-content-center">
                <img class="me-2" :src="$image.src('book-open')" style="width: 28px">
                <span class="h3">Handbook</span>
                
            </div>
            <pre ref="license" class="smallest"></pre>
            <div class="text-center mt-3">
                <span class="smallest">Visit the project on </span><a href="https://github.com/ecromaneli/Handbook" target="_blank" class="smallest">GitHub</a>
                <small style="position: fixed; bottom: 6px; right: 10px; color: var(--border-color);"> v{{ $remote.version }}</small>
            </div>
        </div>
    `,
    inject: [ '$image', '$remote' ],
    mounted() { this.fetchLicense() },
    methods: {
        async fetchLicense() {
            const licenseEl = this.$refs.license
            licenseEl.textContent = 'Loading license...'
            try {
                const response = await fetch('https://raw.githubusercontent.com/ECRomaneli/Handbook/master/LICENSE')
                if (!response.ok) {
                    throw new Error('Unknown error. Response status: ' + response.status)
                }
                licenseEl.textContent = await response.text()
            } catch (err) {
                console.error('Failed to fetch the software license. Error: ' + err)
                licenseEl.textContent = 'Failed to fetch the software license.'
            }
        }
    }
})