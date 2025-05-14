app.component('InlineInput', {
    template: /*html*/ `
        <div class="d-flex justify-content-between my-2">
            <div class="d-flex flex-column me-2">
                <label class="small">{{ input.label }}</label>
                <span v-if="input.description" class="smallest input-description">{{ input.description }}</span>
            </div>
            <div>
                <div v-if="data.type === 'text'" class="input-group input-group-sm float-end" style="width: 120px">
                    <input type="text" class="form-control pe-0" v-model="data.value" @blur="$emit('update', input)" :aria-label="input.label" spellcheck="false">
                    <span v-if="data.unit" class="input-group-text">{{ data.unit }}</span>
                </div>
                <div v-if="data.type === 'color'" class="input-group input-group-sm float-end" style="width: 120px">
                    <input type="color" class="input-group-text px-0" v-model="data.value" @blur="$emit('update', input)" :aria-label="input.label" style="z-index: 1; cursor: pointer">
                    <input type="text" class="form-control pe-0" v-model="data.value" @blur="$emit('update', input)" :aria-label="input.label" spellcheck="false">
                </div>
                <div v-if="data.type === 'number'" class="input-group input-group-sm float-end" style="width: 120px">
                    <input type="number" :min="data.min" :max="data.max" class="form-control pe-0" v-model="data.value" @blur="$emit('update', input)" :aria-label="input.label" spellcheck="false">
                    <span v-if="data.unit" class="input-group-text">{{ data.unit }}</span>
                </div>
                <div v-else-if="data.type === 'bool'" class="form-check form-switch" style="padding-left: 120px">
                    <input class="form-check-input" type="checkbox" role="switch" v-model="data.value" @change="$emit('update', input)" spellcheck="false">
                </div>
                <div v-else-if="data.type === 'select'" class="input-group-sm">
                    <select class="value-selector input-group-text" v-model="data.value" @change="$emit('update', input)" style="width: 120px">
                        <option v-for="(option) in data.options" :value="option.value ?? option">{{ option.label ?? option }}</option>
                    </select>
                </div>
                <div v-else-if="data.type === 'key'" class="input-group input-group-sm float-end" style="width: 120px">
                    <input type="search" class="form-control"
                        @focus="updateInputWithTargetValue($event, '')"
                        @keydown="captureKey($event)" 
                        @keypress="preventKeyPressing($event)" 
                        @keyup="preventKeyPressing($event)"
                        @blur="updateInputWithTargetValue($event)" 
                        :value="data.value" 
                        :aria-label="input.label"
                        spellcheck="false">
                </div>
            </div>
        </div>
    `,
    inject: [ '$const' ],
    emits: [ 'update' ],
    props: { input: Object },
    data() { return {
        data: this.input.data,
        keyMap: {
            'Meta': this.$const.OS.IS_DARWIN ? 'Command' : this.$const.OS.IS_LINUX ? 'Super' : 'Win',
            'Alt': this.$const.OS.IS_DARWIN ? 'Option' : 'Alt'
        }
    } },
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

        updateInputWithTargetValue(event, value = event.target.value) {
            if (this.input.data.value !== value) {
                this.input.data.value = value
                this.$emit('update', this.input)
            }
        },

        getKeyCombination(event) {            
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

            if (key === 'Meta') { key = this.keyMap['Meta'] }
            else if (key === 'Alt') { key = this.keyMap['Alt'] }
        
            if (event.ctrlKey && key !== 'Ctrl') modifiers.push('Ctrl')
            if (event.shiftKey && key !== 'Shift') modifiers.push('Shift')
            if (event.metaKey && key !== this.keyMap['Meta']) { modifiers.push(this.keyMap['Meta']) }
            if (event.altKey && key !== this.keyMap['Alt']) modifiers.push(this.keyMap['Alt'])
            
            return modifiers.length > 0 ? [...modifiers, key].join('+') : ""
        }
    }
})