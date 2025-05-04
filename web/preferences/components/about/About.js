app.component('AboutTab', {
    template: /*html*/ `
        <div>
            <div class="mt-2 mb-4 d-flex justify-content-center">
                <img class="me-2" :src="$image.src('book-open')" style="width: 28px">
                <span class="h3">Handbook</span>
            </div>
            <pre ref="license" class="smallest text-black-50" style="
                background-color: beige;
                border: 1px dashed lightgray;
                padding: 10px;
                border-radius: 8px;
                margin: 0 -36px;
            "></pre>
        </div>
    `,
    inject: [ '$image' ],
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