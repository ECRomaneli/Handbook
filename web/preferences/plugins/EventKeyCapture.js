app.use({
    install: (app) => {
        if (!require) { console.warn('Require is not defined'); return }
        const KeyCapture = require('../vendor/EventKeyCapture')
        app.provide('$keyCapture', KeyCapture)
    }
})