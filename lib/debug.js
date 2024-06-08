function parasiteIt(obj, parasiteFn, printMethods) {
    const methods = [];
    for (let prop in obj.__proto__) {
      if (typeof obj[prop] === 'function') {
        methods.push(prop);
      }
    }

    console.debug('Trying to parasite obj...')
    if (printMethods) { console.debug(methods) }

    methods.forEach(methodName => {
        const originalMethod = obj[methodName]
        obj[methodName] = function () {
            parasiteFn(methodName, arguments)
            return originalMethod.call(obj, ...arguments)
        }
    })
}

module.exports = { parasiteIt }