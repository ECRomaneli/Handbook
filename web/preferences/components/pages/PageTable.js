app.component('PageTable', {
  template: /*html*/ `
    <div class="page-list">
      <div v-for="(page, index) in list" :key="page.id || index"
           class="page-card"
           :class="{ 'page-card-drop-target': dropTargetIndex === index }"
           :draggable="!readonly && draggable"
           @dragstart="drag($event, index)"
           @dragover.prevent="dragOver(index)"
           @dragleave="dragLeave"
           @dragend="dragEnd"
           @drop="drop(index)">

        <div class="page-card-handle" :class="{ 'page-card-handle-disabled': readonly }" :title="!readonly ? $i18n.preferences.pages.drag : undefined">
          <i class="icon icon-grip"></i>
        </div>

        <div class="page-card-content">
          <div class="page-card-top">
            <div class="page-card-field page-card-field-grow">
              <label class="page-card-label">{{ $i18n.preferences.pages.label }}</label>
              <input type="text" v-model="page.label" :placeholder="$i18n.preferences.pages.labelPlaceholder" class="page-card-input page-card-input-title"
                @mousedown="draggable = false" @mouseleave="draggable = true" @blur="emitUpdate(page)" spellcheck="false">
            </div>
            <div class="page-card-field page-card-field-session">
              <label class="page-card-label">{{ $i18n.preferences.pages.sessionId }}</label>
              <input type="text" v-model="page.session" :placeholder="$i18n.preferences.pages.defaultSession" class="page-card-input"
                @mousedown="draggable = false" @mouseleave="draggable = true" @blur="emitUpdate(page)" spellcheck="false">
            </div>
          </div>
          <div class="page-card-bottom">
            <div class="page-card-field page-card-field-grow">
              <label class="page-card-label">{{ $i18n.preferences.pages.url }}</label>
              <input type="text" v-model="page.url" :placeholder="$i18n.preferences.pages.urlPlaceholder" class="page-card-input page-card-input-url"
                @mousedown="draggable = false" @mouseleave="draggable = true" @blur="emitUpdate(page)" spellcheck="false">
            </div>
          </div>
        </div>

        <div class="page-card-actions">
          <button class="page-card-action-btn" :class="{ 'page-card-pin-active': page.persist }" :title="$i18n.preferences.pages.persistTooltip" @mousedown.prevent @click="page.persist = !page.persist; emitUpdate(page)">
            <i class="icon" :class="page.persist ? 'icon-pin-filled' : 'icon-pin'"></i>
          </button>
          <button tabindex="-1" class="page-card-action-btn page-card-remove-btn" :title="$i18n.preferences.pages.remove" @mousedown.prevent @click="removePage(index)">
            <i class="icon icon-trash"></i>
          </button>
        </div>
      </div>

      <div v-if="!readonly" tabindex="-1" class="page-card page-card-add" @click="addPage()">
        <i class="icon icon-plus"></i>
        <span>{{ $i18n.preferences.pages.addPage }}</span>
      </div>
    </div>
    `,
  emits: ['update', 'remove'],
  inject: ['$image', '$clone', '$i18n'],
  props: {
    pages: Array,
    readonly: { type: Boolean, default: false },
  },
  data() { return { list: this.pages, draggingIndex: null, dropTargetIndex: null, draggable: true } },
  watch: {
    pages(newPages) { this.list = newPages; }
  },
  methods: {
    addPage() {
      if (this.list.length !== 0) {
        const last = this.list[this.list.length - 1]
        if (!last.label && !last.url) { return }
      }
      this.list.push({ id: `${Date.now()}${this.list.length}`, label: '', url: '', session: '', persist: false })
      this.$nextTick(() => {
        const inputs = this.$el.querySelectorAll('.page-card-input-title')
        inputs.length && inputs[inputs.length - 1]?.focus()
      })
    },

    removePage(index) { this.$emit('remove', this.$clone(this.list.splice(index, 1)[0])) },
    emitUpdate(page) { this.$emit('update', this.$clone(page)) },

    drag(event, index) {
      this.draggingIndex = index
      event.dataTransfer.effectAllowed = 'move'
    },

    dragOver(index) {
      if (this.draggingIndex !== null && this.draggingIndex !== index) {
        this.dropTargetIndex = index
      }
    },

    dragLeave() {
      this.dropTargetIndex = null
    },

    dragEnd() {
      this.draggingIndex = null
      this.dropTargetIndex = null
    },

    drop(index) {
      this.dropTargetIndex = null
      if (this.draggingIndex === null) { return }
      if (this.draggingIndex !== index) {
        const page = this.list.splice(this.draggingIndex, 1)[0]
        this.list.splice(index, 0, page)
        this.emitUpdate(page)
      }
      this.draggingIndex = null
    }
  }
})