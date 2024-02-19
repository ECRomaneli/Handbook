app.use({
    install: (app) => {
        function onChangeFile(event) {
            const importHelper = event.target
                  file = importHelper.files[0]
    
            if (file) {
                const reader = new FileReader()
                reader.onload = (e) => { importHelper.callback(true, e.target.result) }
                reader.readAsText(file)
            } else {
                importHelper.callback(false)
                console.error('No file selected.')
            }

            importHelper.remove()
        }

        app.provide('$exporter', {
            import(accept, callback) {
                const importHelper = document.createElement('input')
                importHelper.type = 'file'
                importHelper.accept = accept ?? 'plain/text'
                importHelper.callback = callback
                importHelper.addEventListener('change', onChangeFile)
                importHelper.click()
            },
    
            export(type, data) {            
                // Create Blob
                const exportHelper = document.createElement('a')
                      blob = new Blob([data], { type: type })
            
                // Create download link
                exportHelper.href = window.URL.createObjectURL(blob)
                exportHelper.setAttribute('download', 'pages.json')
            
                // Trigger download
                exportHelper.click()
                window.URL.revokeObjectURL(this.exportHelper.href)
                exportHelper.remove()
            }
        })
    }
})