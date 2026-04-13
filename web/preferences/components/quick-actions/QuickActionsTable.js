app.component('QuickActionsTable', {
  template: /*html*/ `
    <div class="item-list" ref="list">
      <div v-for="(item, index) in list" :key="item.id || index"
           class="item-card item-entry"
           :class="{ 'item-card-drop-target': dropTargetIndex === index, 'selected': selectedId === item.id }"
           :draggable="!readonly && draggable"
           @click="selectedId !== item.id && (selectedId = item.id)"
           @dragstart="drag($event, index)"
           @dragover.prevent="dragOver(index)"
           @dragleave="dragLeave"
           @dragend="dragEnd"
           @drop="drop(index)">

        <div class="item-card-handle" :class="{ 'item-card-handle-disabled': readonly }" :title="!readonly ? $i18n.preferences.quickActions.drag : undefined" @mouseover="draggable = true" @mouseleave="draggable = false">
          <i class="icon icon-grip"></i>
        </div>

        <div class="item-card-content">
          <div class="item-card-top">
            <div class="item-card-field item-card-field-grow">
              <label class="item-card-label">{{ $i18n.preferences.quickActions.label }}</label>
              <input type="text" v-model="item.label" :placeholder="$i18n.preferences.quickActions.labelPlaceholder" class="item-card-input item-card-input-title"
                 @blur="emitUpdate()" spellcheck="false">
            </div>
          </div>
          <div class="item-card-bottom">
            <div class="item-card-field item-card-field-grow">
              <label class="item-card-label">{{ $i18n.preferences.quickActions.url }}</label>
              <input type="text" v-model="item.url" :placeholder="$i18n.preferences.quickActions.urlPlaceholder" class="item-card-input item-card-input-url"
                 @blur="emitUpdate()" spellcheck="false">
            </div>
          </div>
        </div>

        <div class="item-card-actions">
          <button class="item-card-action-btn item-card-remove-btn" :title="$i18n.preferences.quickActions.remove" @click="removeItem($event, index)">
            <i class="icon icon-trash"></i>
          </button>
        </div>
      </div>

      <div v-if="!readonly" tabindex="-1" class="item-card item-card-add" @click="addItem()">
        <i class="icon icon-plus"></i>
        <span>{{ $i18n.preferences.quickActions.addItem }}</span>
      </div>
    </div>
  `,
  emits: ['update', 'remove'],
  inject: ['$i18n'],
  props: {
    items: Array,
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
      list: this.items,
      draggingIndex: null,
      dropTargetIndex: null,
      draggable: false,
      selectedId: null,
    }
  },
  watch: {
    items(newItems) { this.list = newItems; },
  },
  methods: {
    addItem() {
      if (this.list.length !== 0) {
        const last = this.list[this.list.length - 1]
        if (!last.label && !last.url) { return }
      }
      const newItem = { id: `${Date.now()}${this.list.length}`, label: '', url: '' }
      this.list.push(newItem)
      this.selectedId = newItem.id
      this.$nextTick(() => {
        const cards = this.$el.querySelectorAll('.item-entry')
        cards[cards.length - 1].getElementsByTagName('input')[0].focus()
      })
    },

    removeItem(event, index) {
      event.stopPropagation()
      const removed = this.list.splice(index, 1)[0]
      this.$emit('remove', removed)
    },

    emitUpdate() { this.$emit('update') },

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
        const item = this.list.splice(this.draggingIndex, 1)[0]
        this.list.splice(index, 0, item)
        this.emitUpdate()
      }
      this.draggingIndex = null
    },
  }
})
