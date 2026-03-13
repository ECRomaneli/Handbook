app.component('AboutTab', {
  template: /*html*/ `
        <div class="about">
            <div class="mt-1 mb-3 d-flex justify-content-center">
                <img class="me-2" :src="$image.src('book-open')" style="width: 28px">
                <span class="h3">Handbook</span>
            </div>
            <pre ref="license" class="smallest"></pre>
            <div class="text-center mt-3">
                <span class="smallest">{{ $i18n.preferences.about.visitProject }} </span><a href="https://github.com/ecromaneli/Handbook" target="_blank" class="smallest">GitHub</a>
            </div>
        </div>
    `,
  inject: ['$image', '$i18n'],
  mounted() { this.fetchLicense() },
  methods: {
    async fetchLicense() {
      const licenseEl = this.$refs.license
      licenseEl.textContent = `
                    MIT License

                    Copyright (c) ${new Date().getFullYear()} Emerson Capuchi Romaneli

                    Permission is hereby granted, free of charge, to any person obtaining a copy
                    of this software and associated documentation files (the "Software"), to deal
                    in the Software without restriction, including without limitation the rights
                    to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
                    copies of the Software, and to permit persons to whom the Software is
                    furnished to do so, subject to the following conditions:

                    The above copyright notice and this permission notice shall be included in all
                    copies or substantial portions of the Software.

                    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
                    IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
                    FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
                    AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
                    LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
                    OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
                    SOFTWARE.
                `.replace(/^( |\t)+/gm, '').trim()
      try {
        const response = await fetch('https://raw.githubusercontent.com/ECRomaneli/Handbook/master/LICENSE')
        if (!response.ok) {
          throw new Error('Unknown error. Response status: ' + response.status)
        }
        licenseEl.textContent = await response.text()
      } catch (err) {
        console.error('Failed to fetch the software license. Error: ' + err)
      }
    }
  }
})