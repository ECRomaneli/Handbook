app.component('InlineInput', {
    template: /*html*/ `
        <div class="d-flex justify-content-between my-2">
            <div class="d-flex flex-column me-2">
                <label class="small">{{ input.label }}</label>
                <span v-if="input.description" class="smallest text-black-50">{{ input.description }}</span>
            </div>
            <div>
                <div v-if="data.type === 'text'" class="input-group input-group-sm float-end" style="width: 120px">
                    <input type="text" class="form-control pe-0" v-model="data.value" @blur="$emit('update', input)" :aria-label="input.label">
                    <span v-if="data.unit" class="input-group-text">{{ data.unit }}</span>
                </div>
                <div v-if="data.type === 'color'" class="input-group input-group-sm float-end" style="width: 120px">
                    <input type="text" class="form-control pe-0" v-model="data.value" @blur="$emit('update', input)" :aria-label="input.label">
                    <span class="input-group-text" :style="'background-color:'+data.value+';border-color:'+data.value">&nbsp;</span>
                </div>
                <div v-if="data.type === 'number'" class="input-group input-group-sm float-end" style="width: 120px">
                    <input type="number" :min="data.min" :max="data.max" class="form-control pe-0" v-model="data.value" @blur="$emit('update', input)" :aria-label="input.label">
                    <span v-if="data.unit" class="input-group-text">{{ data.unit }}</span>
                </div>
                <div v-else-if="data.type === 'bool'" class="form-check form-switch" style="padding-left: 120px">
                    <input class="form-check-input" type="checkbox" role="switch" v-model="data.value" @change="$emit('update', input)">
                </div>
                <div v-else-if="data.type === 'select'" class="input-group-sm">
                    <select class="value-selector input-group-text" v-model="data.value" @change="$emit('update', input)" style="width: 120px">
                        <option v-for="(option) in data.options" :value="option.value ?? option">{{ option.label ?? option }}</option>
                    </select>
                </div>
                <div v-else-if="data.type === 'key'" class="input-group input-group-sm float-end" style="width: 120px">
                    <input type="search" class="form-control" 
                        @keydown="captureKey($event)" 
                        @keypress="preventKeyPressing($event)" 
                        @keyup="preventKeyPressing($event)"
                        @blur="data.value = $event.target.value; $emit('update', input)" 
                        :value="data.value" 
                        :aria-label="input.label">
                </div>
            </div>
        </div>
    `,
    emits: [ 'update' ],
    props: { input: Object },
    data() { return { data: this.input.data } },
    methods: {
        captureKey(e) {
            e.preventDefault()
            e.target.keyComb = this.getKeyCombination(e)
            e.target.value = e.target.keyComb
        },

        preventKeyPressing(e) {
            e.preventDefault()
            e.target.value = e.target.keyComb
        },

        getKeyCombination(event) {
            let key = event.key.toLowerCase()
        
            // Handle arrows (e.g. ArrowLeft => Left)
            if (key.indexOf('arrow') === 0) { key = key.slice(5) }
            
            key = key.charAt(0).toUpperCase() + key.slice(1)
        
            // Handle dead keys that needs a second key to work properly
            if (key === 'Dead') { return '' }
            
            // Format some keys
            if (key === 'Control') { key = 'Ctrl' }
            else if (key === 'Escape') { key = 'Esc' }
        
            // Handle combinations
            let keyComb = key
            if (event.shiftKey && key !== 'Shift')  { keyComb = 'Shift+' + keyComb }
            if (event.metaKey && key !== 'Meta')    { keyComb = 'Meta+' + keyComb  }
            if (event.altKey && key !== 'Alt')      { keyComb = 'Alt+' + keyComb   }
            if (event.ctrlKey && key !== 'Ctrl')    { keyComb = 'Ctrl+' + keyComb  } 
        
            return keyComb
        }
    }
})