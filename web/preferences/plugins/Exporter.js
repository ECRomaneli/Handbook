app.use({
    install: (app) => {
        /**
         * Helper function to handle file selection changes
         * @param {Event} event - Change event from input element
         */
        function onChangeFile(event) {
            const importHelper = event.target
            const file = importHelper.files[0]
            
            if (file) {
                const reader = new FileReader()
                
                reader.onload = (e) => { 
                    importHelper.callback(true, e.target.result)
                };
                
                reader.onerror = () => {
                    importHelper.callback(false, 'Error reading file')
                    console.error('Error reading file:', reader.error)
                };
                
                reader.readAsText(file)
            } else {
                importHelper.callback(false, 'No file selected')
                console.warn('No file selected')
            }

            importHelper.remove()
        }

        /**
         * @returns {HTMLElement} A new HTML element
         */
        function createElement(type) {
            const element = document.createElement(type)
            element.style.position = 'absolute'
            element.style.opacity = '0'
            element.style.pointerEvents = 'none'
            element.style.zIndex = '-1'
            element.style.bottom = '0'
            element.style.right = '0'
            return element
        }

        app.provide('$exporter', {
            /**
             * Import data from a file.
             * 
             * Defaults to JSON or text/plain MIME types.
             * @param {string|Function} acceptOrCallback - MIME type for accepted files or callback function(success, data)
             * @param {Function?} callback - Callback function(success, data)
             * @returns {Promise} Promise that resolves with the file data
             */
            import(acceptOrCallback, callback) {
                if (callback === void 0) {
                    callback = acceptOrCallback
                    acceptOrCallback = void 0
                }
                return new Promise((resolve, reject) => {
                    const importHelper = createElement('input')
                    importHelper.type = 'file'
                    importHelper.accept = acceptOrCallback ?? 'application/json,text/plain'
                    
                    // Support both callback and promise patterns
                    importHelper.callback = (success, data) => {
                        // Clean up after click
                        importHelper.removeEventListener('change', onChangeFile)
                        importHelper.remove()

                        if (typeof callback === 'function') {
                            callback(success, data)
                        }
                        
                        success ? resolve(data) : reject(new Error(data))
                    }
                    
                    importHelper.addEventListener('change', onChangeFile)
                    document.body.appendChild(importHelper) // Avoid memory leaks in some browsers
                    importHelper.click()
                })
            },
    
            /**
             * Export data to a file
             * @param {string} type - MIME type of the data
             * @param {string|object} data - Data to export
             * @param {string} filename - Name for the downloaded file
             * @returns {Promise} Promise that resolves when export is complete
             */
            export(type, data, filename = 'data.json') {
                return new Promise((resolve) => {
                    // Format data if it's an object
                    if (typeof data === 'object') {
                        data = JSON.stringify(data, null, 2)
                    }
                    
                    // Create Blob
                    const blob = new Blob([data], { type: type || 'application/json' })
                    const exportHelper = createElement('a')
                    
                    // Create download link
                    const url = window.URL.createObjectURL(blob)
                    exportHelper.href = url
                    exportHelper.setAttribute('download', filename)
                    
                    // Trigger download
                    document.body.appendChild(exportHelper) // Ensure it works across browsers
                    exportHelper.click()
                    
                    // Clean up
                    window.URL.revokeObjectURL(url)
                    exportHelper.remove()
                    
                    resolve({ success: true, filename })
                })
            }
        })
    }
})