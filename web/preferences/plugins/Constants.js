app.use({
    install: (app) => {
        if (!require) { console.warn('Require is not defined'); return }
        const { OS, Settings, Positions, Permission } = require('../../lib/constants')
        app.provide('$const', { OS, Settings, Positions, Permission })
    }
})