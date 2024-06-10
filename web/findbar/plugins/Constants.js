app.use({
    install: (app) => {
        if (!require) { console.warn('Require is not defined'); return }
        const { WindowSettings, Positions } = require('../../lib/constants')
        app.provide('$const', { WindowSettings, Positions })
    }
})