app.provide('$clipboard', {
    async writeText(text) {
        return await navigator.clipboard.writeText(text)
    },

    async write(data) {
        return await navigator.clipboard.write(data)
    },

    async readText(text) {
        return await navigator.clipboard.readText(text)
    },

    async read(data) {
        return await navigator.clipboard.read(data)
    }
});