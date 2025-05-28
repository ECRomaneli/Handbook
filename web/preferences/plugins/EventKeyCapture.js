app.use({
    install: (app) => {
        if (!require) { console.warn('Require is not defined'); return }
        const KeyCapture = require('../../lib/util/event-key-capture')
        app.provide('$keyCapture', KeyCapture)
    }
})