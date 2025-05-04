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
                        @blur="updateInputWithTargetValue($event)" 
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

        getKeyCombination2(event) {
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
        },

        updateInputWithTargetValue(event) {
            if (this.input.data.value !== event.target.value) {
                this.input.data.value = event.target.value
                this.$emit('update', this.input)
            }
        },

        getKeyCombination(event) {
            // Detect platform
            const getOS = () => {
                // Try userAgentData (modern API)
                if (navigator.userAgentData) {
                    const platform = navigator.userAgentData.platform
                    if (platform === 'macOS') return 'mac'
                    if (platform === 'Windows') return 'windows'
                    if (platform === 'Linux') return 'linux'
                }
                
                // Fallback to userAgent (more compatible)
                const userAgent = navigator.userAgent
                if (/Mac/.test(userAgent)) return 'mac'
                if (/Linux/.test(userAgent)) return 'linux'
                if (/Windows/.test(userAgent)) return 'windows'
                
                return 'unknown'
            }
            
            const os = getOS()
            const isMac = os === 'mac'
            const isLinux = os === 'linux'
            
            // Handle the "Process" key issue on Linux
            let key = event.key
            if (key === 'Process') {
                // On Linux, when IME processing occurs, try to get the real key from event.code
                if (event.code) {
                    // Convert code format (like "KeyA") to actual key value
                    if (event.code.startsWith('Key')) {
                        key = event.code.slice(3) // Extract "A" from "KeyA"
                    } else if (event.code.startsWith('Digit')) {
                        key = event.code.slice(5) // Extract "1" from "Digit1"
                    } else switch (event.code) {
                        case 'Backquote':   key = '`'; break
                        case 'Minus':       key = '-'; break
                        case 'Equal':       key = '='; break
                        case 'BracketLeft': key = '['; break
                        case 'BracketRight':key = ']'; break
                        case 'Semicolon':   key = ';'; break
                        case 'Quote':       key = "'"; break
                        case 'Backslash':   key = '\\'; break
                        case 'Comma':       key = ','; break
                        case 'Period':      key = '.'; break
                        case 'Slash':       key = '/'; break
                        // For other keys, use the code directly but format it
                        default: key = event.code.replace(/([A-Z])/g, ' $1').trim()
                    }
                } else { key = '' }
            }
            
            // Normalize key names across platforms
            if (key.toLowerCase().startsWith('arrow')) { key = key.slice(5) }
            else if (key === ' ') { key = 'Space' } 
            else if (key === 'Control') { key = 'Ctrl' }
            else if (key === 'Escape') { key = 'Esc' }
            else if (key === 'Dead') { return '' }
            
            // Format key display
            if (key.length === 1) {
                key = key.toUpperCase()
            } else if (!['Shift', 'Alt', 'Ctrl', 'Meta', 'Command', 'Option', 'Win'].includes(key)) {
                key = key.charAt(0).toUpperCase() + key.slice(1).toLowerCase()
            }
            
            // Build modifier combination with platform-specific ordering
            const modifiers = []
            
            if (event.ctrlKey && key !== 'Ctrl') modifiers.push('Ctrl')
            if (event.shiftKey && key !== 'Shift') modifiers.push('Shift')

            if (isMac) {
                if (event.altKey && key !== 'Alt' && key !== 'Option') modifiers.push('Option')
                if (event.metaKey && key !== 'Meta' && key !== 'Command') modifiers.push('Command')
            } else {
                if (event.altKey && key !== 'Alt') modifiers.push('Alt')
                if (event.metaKey && key !== 'Win' && key !== 'Super') { modifiers.push(isLinux ? 'Super' : 'Win') }
            }
            
            return modifiers.length > 0 ? [...modifiers, key].join('+') : key
        }
    }
})