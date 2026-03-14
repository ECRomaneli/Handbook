app.component('PageTable', {
  template: /*html*/ `
    <div class="page-list">
      <div v-for="(page, index) in list" :key="index"
           class="page-card"
           :class="{ 'page-card-drop-target': dropTargetIndex === index }"
           :draggable="draggable"
           @dragstart="drag($event, index)"
           @dragover.prevent="dragOver(index)"
           @dragleave="dragLeave"
           @dragend="dragEnd"
           @drop="drop(index)">

        <div class="page-card-handle" :title="$i18n.preferences.pages.drag">
          <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor">
            <circle cx="5" cy="3" r="1.5"/><circle cx="11" cy="3" r="1.5"/>
            <circle cx="5" cy="8" r="1.5"/><circle cx="11" cy="8" r="1.5"/>
            <circle cx="5" cy="13" r="1.5"/><circle cx="11" cy="13" r="1.5"/>
          </svg>
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
          <button class="page-card-action-btn" :class="{ 'page-card-pin-active': page.persist }" :title="$i18n.preferences.pages.persistTooltip" @click="page.persist = !page.persist; emitUpdate(page)">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path v-if="page.persist" d="M4.146.146A.5.5 0 0 1 4.5 0h7a.5.5 0 0 1 .5.5c0 .68-.342 1.174-.646 1.479-.126.125-.25.224-.354.298v4.431l.078.048c.203.127.476.314.751.555C12.36 7.775 13 8.527 13 9.5a.5.5 0 0 1-.5.5h-4v4.5a.5.5 0 0 1-1 0V10h-4A.5.5 0 0 1 3 9.5c0-.973.64-1.725 1.17-2.189A5.921 5.921 0 0 1 5 6.708V2.277a2.77 2.77 0 0 1-.354-.298C4.342 1.674 4 1.179 4 .5a.5.5 0 0 1 .146-.354z"/>
              <path v-else d="M4.146.146A.5.5 0 0 1 4.5 0h7a.5.5 0 0 1 .5.5c0 .68-.342 1.174-.646 1.479-.126.125-.25.224-.354.298v4.431l.078.048c.203.127.476.314.751.555C12.36 7.775 13 8.527 13 9.5a.5.5 0 0 1-.5.5h-4v4.5a.5.5 0 0 1-1 0V10h-4A.5.5 0 0 1 3 9.5c0-.973.64-1.725 1.17-2.189A5.921 5.921 0 0 1 5 6.708V2.277a2.77 2.77 0 0 1-.354-.298C4.342 1.674 4 1.179 4 .5a.5.5 0 0 1 .146-.354zm1.58 1.408l-.002-.001.002.001zm-.002-.001A1.13 1.13 0 0 1 5.375 1h5.25a1.13 1.13 0 0 1 .351.574l.002.001a.5.5 0 0 1-.078.186 2.054 2.054 0 0 1-.174.163V6.75a.5.5 0 0 1-.218.412l-.168.103a4.96 4.96 0 0 0-.625.463c-.336.292-.592.609-.746.906H7.032a3.01 3.01 0 0 0-.746-.906 4.96 4.96 0 0 0-.625-.463l-.168-.103A.5.5 0 0 1 5.275 6.75V1.723A2.054 2.054 0 0 1 5.1 1.56a.5.5 0 0 1-.078-.186z"/>
            </svg>
          </button>
          <button class="page-card-action-btn page-card-remove-btn" :title="$i18n.preferences.pages.remove" @click="removePage(index)">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
              <path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H5.5l1-1h3l1 1h2.5a1 1 0 0 1 1 1v1zM4.118 4L4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
            </svg>
          </button>
        </div>
      </div>

      <div class="page-card page-card-add" @click="addPage()">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path fill-rule="evenodd" d="M8 2a.5.5 0 0 1 .5.5v5h5a.5.5 0 0 1 0 1h-5v5a.5.5 0 0 1-1 0v-5h-5a.5.5 0 0 1 0-1h5v-5A.5.5 0 0 1 8 2z"/>
        </svg>
        <span>{{ $i18n.preferences.pages.addPage }}</span>
      </div>
    </div>
    `,
  emits: ['update', 'remove'],
  inject: ['$image', '$clone', '$i18n'],
  props: {
    pages: Array,
  },
  data() { return { list: this.pages, draggingIndex: null, dropTargetIndex: null, draggable: true } },
  methods: {
    addPage() {
      if (this.list.length !== 0) {
        const last = this.list[this.list.length - 1]
        if (!last.label && !last.url) { return }
      }
      this.list.push({ id: `${Date.now()}${this.list.length}`, label: '', url: '', session: '', persist: false })
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