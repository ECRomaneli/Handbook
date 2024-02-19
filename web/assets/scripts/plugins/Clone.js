app.use({
    install: (app) => {
        function clone(obj, memo = new WeakMap()) {
            if (obj === null || typeof obj !== 'object') {
                return obj
            }
        
            // Check if the object has already been cloned to avoid infinite loops
            if (memo.has(obj)) {
                return memo.get(obj)
            }
        
            if (Array.isArray(obj)) {
                // If the object is an array, create a new array and clone each element
                const arrCopy = []
                memo.set(obj, arrCopy)
            
                for (let i = 0; i < obj.length; i++) {
                    arrCopy[i] = clone(obj[i], memo)
                }
            
                return arrCopy
            }

            // If the object is a plain object, create a new object and clone each property
            const objCopy = {}
            memo.set(obj, objCopy)
        
            for (const key in obj) {
                if (obj.hasOwnProperty(key)) {
                    objCopy[key] = clone(obj[key], memo)
                }
            }
    
            return objCopy
        }

        app.provide('$clone', clone)
    }
})