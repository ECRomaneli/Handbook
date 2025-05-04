app.use({
    install: (app) => {
        if (!require) { console.warn('Require is not defined'); return }
        const { Settings, Positions } = require('../../lib/constants')
        app.provide('$const', { Settings, Positions })
    }
})