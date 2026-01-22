/**
 * Returns a listener that always cancel the previous call during the cancel timeout.
 * @param {Function} listener Listener to be wrapped.
 * @param {number} cancelTimeout time on which the listener can be canceled.
 * @returns {Function} Cancelable listener.
 */
function debounce(listener, cancelTimeout) {
    let timerId
    return (e) => {
        clearTimeout(timerId)
        timerId = setTimeout(() => { listener(e) }, cancelTimeout)
    }
}

export default debounce