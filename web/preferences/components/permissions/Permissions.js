const SearchEngine = require("@ecromaneli/search-engine")

app.component('Permissions', {
    template: /*html*/ `
        <div v-if="permissions" class="d-flex flex-column">
            <input v-if="Object.keys(permissions).length > 0" type="search" class="form-control mb-3 w-100" placeholder="Search permissions..." v-model="searchQuery" @input="filterPermissions" spellcheck="false" style="font-size: small">

            <!-- Session accordion -->
            <div class="accordion" id="permissionsAccordion">
                <div v-for="(sessionData, session) in filteredPermissions" :key="session" class="accordion-item">
                    <h2 class="accordion-header d-flex align-items-center" :id="'session-heading-' + sanitizeId(session)">
                        
                        <button class="accordion-button py-2 px-3" :class="[isFiltered() ? '' : 'collapsed']" type="button" data-bs-toggle="collapse" :data-bs-target="'#session-collapse-' + sanitizeId(session)" :aria-controls="'session-collapse-' + sanitizeId(session)">
                            <img @click.stop="revokeSessionPermissions(session)" class="svg-icon square-24 c-pointer me-2" :src="$image.src('trash')" alt="revoke" title="Revoke Session Permissions">
                            <span class="badge permission-badge me-2">Session</span>
                            <small>{{ session }}</small>
                        </button>
                        
                    </h2>

                    <div :id="'session-collapse-' + sanitizeId(session)" class="accordion-collapse collapse" :class="[isFiltered() ? 'show' : '']" :aria-labelledby="'session-heading-' + sanitizeId(session)" data-bs-parent="#permissionsAccordion">
                        <div class="accordion-body">
                            
                            <!-- URL accordion within each session -->
                            <div class="accordion" :id="'urlAccordion-' + sanitizeId(session)">
                                <div v-for="(urlData, url) in sessionData" :key="url" class="accordion-item">
                                    <h2 class="accordion-header d-flex align-items-center" :id="'url-heading-' + sanitizeId(session) + '-' + sanitizeId(url)">
                                        <button class="accordion-button py-2 px-3" :class="[isSingle() ? '' : 'collapsed']" type="button" data-bs-toggle="collapse" :data-bs-target="'#url-collapse-' + sanitizeId(session) + '-' + sanitizeId(url)" aria-expanded="false" :aria-controls="'url-collapse-' + sanitizeId(session) + '-' + sanitizeId(url)">
                                            <img @click.stop="revokeUrlPermissions(session, url)" class="svg-icon square-24 c-pointer me-2" :src="$image.src('trash')" alt="revoke" title="Revoke URL Permissions">
                                            <!-- <span class="badge permission-badge me-2">URL</span> -->
                                            <small>{{ url }}</small>
                                        </button>
                                    </h2>

                                    <div :id="'url-collapse-' + sanitizeId(session) + '-' + sanitizeId(url)" class="accordion-collapse collapse" :class="[isSingle() ? 'show' : '']" :aria-labelledby="'url-heading-' + sanitizeId(session) + '-' + sanitizeId(url)" :data-bs-parent="'#urlAccordion-' + sanitizeId(session)">
                                        <div class="accordion-body">
                                            
                                            <!-- Permission items -->
                                            <div v-for="(_, permission, index) in urlData" :key="permission">
                                                <hr v-if="index !== 0" class="input-divider my-2">
                                                <div class="d-flex justify-content-between">
                                                    <div class="d-flex me-2">
                                                    <img @click.stop="revokePermission(session, url, permission)" class="svg-icon square-24 c-pointer me-2" :src="$image.src('trash')" alt="revoke" title="Revoke">
                                                        <label class="small">{{ permission }}</label>
                                                    </div>
                                                    <div>
                                                        <div class="input-group-sm">
                                                            <select class="value-selector input-group-text" v-model="urlData[permission]" @change="updatePermission(session, url, permission, urlData[permission])" style="width: 90px">
                                                                <!--<option value="" disabled>Select</option>-->
                                                                <option value="ask">Ask</option>
                                                                <option value="allow">Allow</option>
                                                                <option value="deny">Deny</option>
                                                            </select>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            <div v-if="Object.keys(urlData).length === 0" class="text-muted fst-italic">
                                                No permissions
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div v-if="Object.keys(filteredPermissions).length === 0" class="text-center p-3 text-muted">
                    No permissions have been granted
                </div>
            </div>
        </div>
        <span v-else>Loading...</span>
    `,
    inject: ['$remote', '$image'],
    data() {
        return {
            permissions: null,
            filteredPermissions: null,
            searchQuery: ''
        }
    },
    created() {
        this.setupEventListeners()
        this.loadPermissions()
    },
    methods: {
        setupEventListeners() {
            this.$remote.preferences.onPermissionsUpdated((permissions) => {
                this.permissions = permissions
                this.filterPermissions()
            })

            this.$remote.preferences.onPermissionsQuery((query) => {
                this.searchQuery = query
                this.filterPermissions()
            })
        },

        filterPermissions() {
            const filterableList = []
            for (const session in this.permissions) {
                const sessionData = this.permissions[session]
                for (const url in sessionData) {
                    const permissions = sessionData[url]
                    filterableList.push({ session, url, permissions, permission: Object.keys(permissions) })
                }
            }
            const filteredPermissions = {}
            SearchEngine.search(filterableList, this.searchQuery).forEach(item => {
                filteredPermissions[item.session] = filteredPermissions[item.session] || {}
                filteredPermissions[item.session][item.url] = item.permissions
            })
            this.filteredPermissions = filteredPermissions
        },

        async loadPermissions() {
            try {
                this.permissions = await this.$remote.storage.getPermissions()
                this.filterPermissions()
            } catch (error) {
                console.error("Error loading permissions:", error)
                this.permissions = {}
            }
        },
        
        sanitizeId(str) {
            // Replace invalid characters for use in HTML ids
            return String(str).replace(/[^a-zA-Z0-9]/g, '_')
        },
        
        revokeSessionPermissions(session) {
            if (confirm(`Revoke all permissions for session "${session}"?`)) {
                delete this.permissions[session]
                this.revokePermissions(session)
            }
        },
        
        revokeUrlPermissions(session, url) {
            if (confirm(`Revoke all permissions for ${url}?`)) {
                delete this.permissions[session][url]
                if (Object.keys(this.permissions[session]).length === 0) {
                    delete this.permissions[session]
                }
                this.revokePermissions(session, url)
            }
        },
        
        revokePermission(session, url, permission) {
            delete this.permissions[session][url][permission]
            if (Object.keys(this.permissions[session][url]).length === 0) {
                delete this.permissions[session][url]
                if (Object.keys(this.permissions[session]).length === 0) {
                    delete this.permissions[session]
                }
            }
            this.revokePermissions(session, url, permission)
        },
        
        updatePermission(session, url, permission, value) {
            this.$remote.storage.setPermission(session, url, permission, value)
            this.filterPermissions()
        },

        revokePermissions(session, url, permission) {
            this.$remote.storage.revokePermissions(session, url, permission)
            this.filterPermissions()
        },

        isFiltered() {
            if (!this.permissions || !this.filteredPermissions) { return false }
            const total = Object.keys(this.permissions).length
            return total === 1 || total > Object.keys(this.filteredPermissions).length
        },

        isSingle() {
            return Object.keys(this.filteredPermissions).length === 1
        }
    }
})