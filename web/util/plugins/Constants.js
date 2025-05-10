app.use({
    install: (app) => {
        if (!require) { console.warn('Require is not defined'); return }
        const { OS, Settings, Positions } = require('../../lib/constants')
        app.provide('$const', { OS, Settings, Positions })
    }
})