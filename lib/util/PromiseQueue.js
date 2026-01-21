class PromiseQueue {
    /** @type {Promise<any>} */
    #currentTask = Promise.resolve()

    /**
     * Queues a function to be executed after previous tasks complete
     * @param {(...any) => Promise<T>} promiseFn 
     * @returns {Promise<T>}
     */
    add(promiseFn) {
        const task = this.#currentTask
        return this.#currentTask = new Promise((r, j) => {
            task.finally(() => { try { promiseFn().then(r).catch(j) } catch (e) { j(e) } })
        })
    }
}

export default PromiseQueue