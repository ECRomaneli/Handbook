app.component('PageTable', {
  template: /*html*/ `
    <div class="item-list" ref="list">
      <div v-for="(page, index) in list" :key="page.id || index"
           class="item-card item-entry"
           :class="{ 'item-card-drop-target': dropTargetIndex === index, 'selected': selectedId === page.id }"
           :draggable="!readonly && draggable"
           @click="this.selectedId !== page.id && (this.selectedId = page.id)"
           @dragstart="drag($event, index)"
           @dragover.prevent="dragOver(index)"
           @dragleave="dragLeave"
           @dragend="dragEnd"
           @drop="drop(index)">

        <div class="item-card-handle" :class="{ 'item-card-handle-disabled': readonly }" :title="!readonly ? $i18n.preferences.pages.drag : undefined" @mouseover="draggable = true" @mouseleave="draggable = false">
          <i class="icon icon-grip"></i>
        </div>

        <div class="item-card-content">
          <div class="item-card-top">
            <div class="item-card-field item-card-field-grow">
              <label class="item-card-label">{{ $i18n.preferences.pages.label }}</label>
              <input type="text" v-model="page.label" :placeholder="$i18n.preferences.pages.labelPlaceholder" class="item-card-input item-card-input-title"
                 @blur="emitUpdate(page)" spellcheck="false">
            </div>
            <div class="item-card-field item-card-field-session">
              <label class="item-card-label">{{ $i18n.preferences.pages.sessionId }}</label>
              <input type="text" v-model="page.session" :placeholder="$i18n.preferences.pages.defaultSession" class="item-card-input"
                @blur="emitUpdate(page)" spellcheck="false">
            </div>
          </div>
          <div class="item-card-bottom">
            <div class="item-card-field item-card-field-grow">
              <label class="item-card-label">{{ $i18n.preferences.pages.url }}</label>
              <input type="text" v-model="page.url" :placeholder="$i18n.preferences.pages.urlPlaceholder" class="item-card-input item-card-input-url"
                @blur="emitUpdate(page)" spellcheck="false">
            </div>
          </div>
        </div>

        <div class="item-card-actions">
          <button class="item-card-action-btn" :class="{ 'item-card-pin-active': page.persist }" :title="$i18n.preferences.pages.persistTooltip" @click="persistPage($event,page)">
            <i class="icon" :class="page.persist ? 'icon-pin-filled' : 'icon-pin'"></i>
          </button>
          <button class="item-card-action-btn item-card-remove-btn" :title="$i18n.preferences.pages.remove" @click="removePage($event, index)">
            <i class="icon icon-trash"></i>
          </button>
        </div>
      </div>

      <div v-if="!readonly" tabindex="-1" class="item-card item-card-add" @click="addPage()">
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
  mounted() {
    this._deselectHandler = (e) => { this.selectedId !== null && !e.target.closest('.item-card') && (this.selectedId = null) }
    document.addEventListener('click', this._deselectHandler)
  },
  unmounted() {
    document.removeEventListener('click', this._deselectHandler)
  },
  data() {
    return {
      list: this.pages,
      draggingIndex: null,
      dropTargetIndex: null,
      draggable: false,
      selectedId: null,
    }
  },
  watch: {
    pages(newPages) { this.list = newPages; },
  },
  methods: {
    addPage() {
      if (this.list.length !== 0) {
        const last = this.list[this.list.length - 1]
        if (!last.label && !last.url) { return }
      }
      const newPage = { id: `${Date.now()}${this.list.length}`, label: '', url: '', session: '', persist: false }
      this.list.push(newPage)
      this.selectedId = newPage.id
      this.$nextTick(() => {
        const inputs = this.$el.querySelectorAll('.item-entry')
        inputs[inputs.length - 1].getElementsByTagName('input')[0].focus()
      })
    },

    persistPage(event, page) {
      event.stopPropagation()
      page.persist = !page.persist
      this.emitUpdate(page)
    },

    removePage(event, index) {
      event.stopPropagation()
      this.$emit('remove', this.$clone(this.list.splice(index, 1)[0]))
    },

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
    },
  }
})