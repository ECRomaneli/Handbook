app.use({
    install: (app) => {
        if (!require) { console.warn('Require is not defined'); return }
        const KeyCapture = require('../../lib/util/EventKeyCapture')
        app.provide('$keyCapture', KeyCapture)
    }
})