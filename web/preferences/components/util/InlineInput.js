app.component('InlineInput', {
    template: /*html*/ `
        <div class="d-flex justify-content-between my-2" :class="{ 'flex-column': data.type === 'bigtext' }">
            <div class="d-flex flex-column me-2">
                <label class="small">{{ input.label }}</label>
                <span v-if="input.description" class="smallest input-description">{{ input.description }}</span>
            </div>
            <div>
                <div v-if="data.type === 'text'" class="input-group input-group-sm float-end" style="width: 120px">
                    <input type="text" class="form-control pe-0" v-model="data.value" @blur="emitUpdate()" :aria-label="input.label" spellcheck="false">
                    <span v-if="data.unit" class="input-group-text">{{ data.unit }}</span>
                </div>
                <div v-if="data.type === 'bigtext'" class="input-group input-group-sm float-end mt-2">
                    <input type="search" class="form-control pe-0" v-model="data.value" @blur="emitUpdate()" :aria-label="input.label" spellcheck="false">
                    <span v-if="data.unit" class="input-group-text">{{ data.unit }}</span>
                </div>
                <div v-if="data.type === 'color'" class="input-group input-group-sm float-end" style="width: 120px">
                    <input type="color" class="input-group-text px-0" v-model="data.value" @blur="emitUpdate()" :aria-label="input.label" style="z-index: 1; cursor: pointer">
                    <input type="text" class="form-control pe-0" v-model="data.value" @blur="emitUpdate()" :aria-label="input.label" spellcheck="false">
                </div>
                <div v-if="data.type === 'number'" class="input-group input-group-sm float-end" style="width: 120px">
                    <input type="number" :min="data.min" :max="data.max" class="form-control pe-0" v-model="data.value" @blur="emitUpdate()" :aria-label="input.label" spellcheck="false">
                    <span v-if="data.unit" class="input-group-text">{{ data.unit }}</span>
                </div>
                <div v-else-if="data.type === 'bool'" class="form-check form-switch" style="padding-left: 120px">
                    <input class="form-check-input" type="checkbox" role="switch" v-model="data.value" @change="emitUpdate()" spellcheck="false">
                </div>
                <div v-else-if="data.type === 'select'" class="input-group-sm">
                    <select class="value-selector input-group-text" v-model="data.value" @change="emitUpdate()" style="width: 120px">
                        <option v-for="(option) in data.options" :value="option.value ?? option">{{ option.label ?? option }}</option>
                    </select>
                </div>
                <div v-else-if="data.type === 'key'" class="input-group input-group-sm float-end" style="width: 120px">
                    <input type="search" class="form-control"
                        @focus="updateInputWithTargetValue('')"
                        @keydown="captureKey($event, data)" 
                        @keypress="preventKeyPressing($event)" 
                        @keyup="preventKeyPressing($event)"
                        @blur="updateInputWithTargetValue($event.target.value)" 
                        :value="data.parsedValue" 
                        :aria-label="input.label"
                        spellcheck="false">
                </div>
            </div>
        </div>
    `,
    inject: [ '$const', '$keyCapture' ],
    emits: [ 'update' ],
    props: { input: Object },
    data() { return { data: this.input.data } },
    beforeMount() {
        this.data.originalValue = this.data.value
        if (this.data.type === 'key') {
            this.data.parsedValue = this.$keyCapture.parseToOSKeyCombination(this.data.value)
        }
    },
    methods: {
        captureKey(e, data) {
            this.preventKeyPressing(e)
            data.parsedValue = this.$keyCapture.getOSKeyCombinationByEvent(e)
        },

        emitUpdate() {
            if (this.data.originalValue === this.data.value) { return }
            this.$emit('update', this.input)
            this.data.originalValue = this.data.value
        },

        preventKeyPressing(e) {
            e.preventDefault()
            e.stopImmediatePropagation()
        },

        updateInputWithTargetValue(parsedValue) {
            let value = this.$keyCapture.parseToAccelerator(parsedValue)
            if (this.data.value === value) { return }
            if (!parsedValue.includes('+')) { value = parsedValue = '' }

            this.data.value = value
            this.data.parsedValue = parsedValue
            this.$emit('update', this.input)
        }
    }
})