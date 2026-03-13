app.component('InlineInput', {
  template: /*html*/ `
        <div class="d-flex justify-content-between my-2" :class="{ 'flex-column': data.type === 'bigtext' || data.type === 'secret' }">
            <div class="d-flex flex-column me-2">
                <label class="small">{{ input.label }}</label>
                <span v-if="input.description" class="smallest input-description">{{ input.description }}</span>
            </div>
            <div>
                <div v-if="data.type === 'text'" class="input-group input-group-sm float-end" style="width: 120px">
                    <input type="text" class="form-control pe-0" v-model="data.bindValue" @blur="emitUpdate()" :aria-label="input.label" spellcheck="false">
                    <span v-if="data.unit" class="input-group-text">{{ data.unit }}</span>
                </div>
                <div v-if="data.type === 'bigtext'" class="input-group input-group-sm float-end mt-2">
                    <input type="search" class="form-control pe-0" v-model="data.bindValue" @blur="emitUpdate()" :aria-label="input.label" spellcheck="false">
                    <span v-if="data.unit" class="input-group-text">{{ data.unit }}</span>
                </div>
                <div v-if="data.type === 'color'" class="input-group input-group-sm float-end" style="width: 120px">
                    <input type="color" class="input-group-text px-0" v-model="data.bindValue" @blur="emitUpdate()" :aria-label="input.label" style="z-index: 1; cursor: pointer">
                    <input type="text" class="form-control pe-0" v-model="data.bindValue" @blur="emitUpdate()" :aria-label="input.label" spellcheck="false">
                </div>
                <div v-if="data.type === 'number'" class="input-group input-group-sm float-end" style="width: 120px">
                    <input type="number" :min="data.min" :max="data.max" class="form-control pe-0" v-model="data.bindValue" @blur="emitUpdate()" :aria-label="input.label" spellcheck="false">
                    <span v-if="data.unit" class="input-group-text">{{ data.unit }}</span>
                </div>
                <div v-else-if="data.type === 'bool'" class="form-check form-switch" style="padding-left: 120px">
                    <input class="form-check-input" type="checkbox" role="switch" v-model="data.bindValue" @change="emitUpdate()" spellcheck="false">
                </div>
                <div v-else-if="data.type === 'select'" class="input-group-sm">
                    <select class="value-selector input-group-text" v-model="data.bindValue" @change="emitUpdate()" style="width: 120px">
                        <option v-for="(option) in data.options" :value="option.value ?? option">{{ option.label ?? option }}</option>
                    </select>
                </div>
                <div v-else-if="data.type === 'button'" class="d-flex flex-column align-items-center" style="width: 120px; gap: 8px;">
                    <input v-for="({id, label}) in data.labels" type="button" class="btn btn-sm btn-secondary w-100" v-model="label" @click="emitUpdate(id)" :aria-label="input.label" style="cursor: pointer; height: 23px; line-height: 0;">
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
                <div v-else-if="data.type === 'secret'" class="input-group input-group-sm float-end mt-2">
                  <input :type="showSecret ? 'text' : 'password'" class="form-control" v-model="data.bindValue" @blur="emitUpdate()" :aria-label="input.label" spellcheck="false">
                  <button class="btn btn-secondary btn-sm" @click="showSecret = !showSecret" :title="showSecret ? 'Hide' : 'Show'">
                    <svg v-if="showSecret" width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M16 8s-3-5.5-8-5.5S0 8 0 8s3 5.5 8 5.5S16 8 16 8zM1.173 8a13.133 13.133 0 0 1 1.66-2.043C4.12 4.668 5.88 3.5 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.133 13.133 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755C11.879 11.332 10.119 12.5 8 12.5c-2.12 0-3.879-1.168-5.168-2.457A13.134 13.134 0 0 1 1.172 8z"/><path d="M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM4.5 8a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0z"/></svg>
                    <svg v-else width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M13.359 11.238C15.06 9.72 16 8 16 8s-3-5.5-8-5.5a7.028 7.028 0 0 0-2.79.588l.77.771A5.944 5.944 0 0 1 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.134 13.134 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755-.165.165-.337.328-.517.486l.708.709z"/><path d="M11.297 9.176a3.5 3.5 0 0 0-4.474-4.474l.823.823a2.5 2.5 0 0 1 2.829 2.829l.822.822zm-2.943 1.299l.822.822a3.5 3.5 0 0 1-4.474-4.474l.823.823a2.5 2.5 0 0 0 2.829 2.829z"/><path d="M3.35 5.47c-.18.16-.353.322-.518.487A13.134 13.134 0 0 0 1.172 8l.195.288c.335.48.83 1.12 1.465 1.755C4.121 11.332 5.881 12.5 8 12.5c.716 0 1.39-.133 2.02-.36l.77.772A7.029 7.029 0 0 1 8 13.5C3 13.5 0 8 0 8s.939-1.721 2.641-3.238l.708.709z"/><path d="M13.646 14.354l-12-12 .708-.708 12 12-.708.708z"/></svg>
                  </button>
                </div>
            </div>
        </div>
    `,
  inject: ['$remote', '$const'],
  emits: ['update'],
  props: { input: Object },
  data() { return { data: this.input.data, showSecret: null } },
  beforeMount() { this.updateBindValue() },
  watch: { 'data.value': function () { this.updateBindValue() } },
  methods: {
    updateBindValue() {
      this.data.bindValue = this.data.value
      if (this.data.type === 'key') { this.updateKeyParsedValue() }
    },

    async updateKeyParsedValue() {
      this.data.parsedValue = await this.$remote.keyCapture.parseToOSKeyCombination(this.data.bindValue)
    },

    async captureKey(e, data) {
      this.preventKeyPressing(e)
      data.parsedValue = await this.$remote.keyCapture.getOSKeyCombinationByEvent(e)
    },

    emitUpdate(value) {
      if (value !== undefined) { this.data.bindValue = value }
      if (this.data.type === 'button' || this.data.value !== this.data.bindValue) {
        this.data.value = this.data.bindValue
        this.$emit('update', this.input)
      }
    },

    preventKeyPressing(e) {
      e.preventDefault()
      e.stopImmediatePropagation()
    },

    async updateInputWithTargetValue(parsedValue) {
      let accelerator = await this.$remote.keyCapture.parseToAccelerator(parsedValue)
      this.data.bindValue = parsedValue.includes('+') ? accelerator : ''
      await this.updateKeyParsedValue()
      this.emitUpdate()
    }
  }
})