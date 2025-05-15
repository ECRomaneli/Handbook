app.use({
    install: (app) => {
        app.provide('$clone', (obj) => structuredClone(Vue.isProxy(obj) ? Vue.toRaw(obj) : obj))
    }
})