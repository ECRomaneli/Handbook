app.component('PageTable', {
    template: /*html*/ `
        <table class="table map-table" aria-label="map table">
            <thead v-if="!noHeader">
                <tr>
                    <th scope="col" role="column:options"></th>
                    <th scope="col" role="column:label">Label</th>
                    <th scope="col" role="column:url">URL</th>
                    <th scope="col" role="column:session">Session ID</th>
                    <th scope="col" role="column:persist" title="Persistent pages will not close when another page is selected">Persist</th>
                </tr>
            </thead>
            <tbody>
                <tr v-for="(page, index) in list" class="c-grab" :key="index" :draggable="draggable" @dragstart="drag(index)" @dragover="$event.preventDefault()" @drop="drop(index)">
                    <td class="px-0">
                        <div class="d-flex">
                            <img class="svg-icon square-24 me-1" :src="$image.src('drag')" alt="drag page">
                            <img @click="removePage(index)" class="svg-icon square-24 c-pointer" :src="$image.src('trash')" alt="remove page" title="Remove">
                        </div>
                    </td>
                    <td><input type="text" v-model="page.label"   placeholder="Label"   class="form-control" @mousedown="draggable = false" @mouseleave="draggable = true" @blur="emitUpdate(page)" spellcheck="false"></td>
                    <td><input type="text" v-model="page.url"     placeholder="URL"     class="form-control" @mousedown="draggable = false" @mouseleave="draggable = true" @blur="emitUpdate(page)" spellcheck="false"></td>
                    <td><input type="text" v-model="page.session" placeholder="Default" class="form-control" @mousedown="draggable = false" @mouseleave="draggable = true" @blur="emitUpdate(page)" spellcheck="false"></td>
                    <td><div class="form-check form-switch"><input class="form-check-input" type="checkbox" role="switch" name="persist" v-model="page.persist" @change="emitUpdate(page)"></div></td>
                </tr>
                <tr class="c-pointer" @click="addPage()">
                    <td><img class="svg-icon square-24" :src="$image.src('plus')" alt="add page"></td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                </tr>
            </tbody>
        </table>
    `,
    emits: [ 'update', 'remove' ],
    inject: ['$image', '$clone' ],
    props: {
        pages: Array, 
        noHeader: { type: Boolean, default: false }
    },
    data() { return { list: this.pages, draggingIndex: null, draggable: true } },
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

        drag(index) {
            this.draggingIndex = index
        },

        drop(index) {
            if (this.draggingIndex === null) { console.warn('Should it happen?'); return }
            if (this.draggingIndex !== index) {
                const page = this.list.splice(this.draggingIndex, 1)[0]
                this.list.splice(index, 0, page)
                this.emitUpdate(page)
            }
            this.draggingIndex = null
        }
    }
})