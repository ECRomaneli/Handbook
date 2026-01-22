const $remote = (ipc => ({
    previous: () => { ipc.send('navigation-bar/previous') },
    next: () => { ipc.send('navigation-bar/next') },
    home: () => { ipc.send('navigation-bar/home') },
    refresh: () => { ipc.send('navigation-bar/refresh') },
    copyUrl: () => { ipc.send('navigation-bar/copy-url') },
    openPermissions: () => { ipc.send('navigation-bar/open-permissions') },
    listPages: () => { ipc.send('navigation-bar/list-pages') },
    hide: () => { ipc.send('navigation-bar/hide') },
    close: () => { ipc.send('navigation-bar/close') },
    onViewUpdated: (listener) => { ipc.on('navigation-bar/view-updated', listener) },
    onDidNavigate: (listener) => { ipc.on('navigation-bar/did-navigate', listener) },
    onDidStartLoading: (listener) => { ipc.on('navigation-bar/did-start-loading', listener) },
    onDidStopLoading: (listener) => { ipc.on('navigation-bar/did-stop-loading', listener) }

})) (require('electron').ipcRenderer)

document.addEventListener('DOMContentLoaded', async () => {
    const titleInput = document.getElementById('title')
    const subtitleInput = document.getElementById('subtitle')
    const previousBtn = document.getElementById('previous')
    const nextBtn = document.getElementById('next')
    const homeBtn = document.getElementById('home')
    const refreshBtn = document.getElementById('refresh')
    const copyLinkBtn = document.getElementById('copy-link')
    const permissionsBtn = document.getElementById('permissions')
    const listBtn = document.getElementById('list')
    const hideBtn = document.getElementById('hide')
    const closeBtn = document.getElementById('close')

    previousBtn.addEventListener('click', () => { $remote.previous() })
    nextBtn.addEventListener('click', () => { $remote.next() })
    homeBtn.addEventListener('click', () => { $remote.home() })
    refreshBtn.addEventListener('click', () => { $remote.refresh() })
    copyLinkBtn.addEventListener('click', () => { $remote.copyUrl() })
    permissionsBtn.addEventListener('click', () => { $remote.openPermissions() })
    listBtn.addEventListener('click', () => { $remote.listPages() })
    hideBtn.addEventListener('click', () => { $remote.hide() })
    closeBtn.addEventListener('click', () => { $remote.close() })

    $remote.onViewUpdated((_e, title) => {  titleInput.textContent = title })

    $remote.onDidNavigate((_e, { url, canGoBack, canGoForward }) => {
        subtitleInput.textContent = url
        previousBtn.classList.toggle('disabled', !canGoBack)
        nextBtn.classList.toggle('disabled', !canGoForward)
        previousBtn.disabled = !canGoBack
        nextBtn.disabled = !canGoForward
    })

    $remote.onDidStartLoading(() => {
        refreshBtn.innerHTML = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M7 17.5L12 12.5L17 17.5"/><path d="M7 7.5L12 12.5L17 7.5"/></svg>'
    })

    $remote.onDidStopLoading(() => {
        refreshBtn.innerHTML = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M17 10C16 7.5 14 6 12 6C9 6 6.5 8.5 6.5 11.5C6.5 14.5 9 17 12 17C14 17 16 16 17 14M17 7V10H14"/></svg>'
    })
    
    console.log('Navigation bar preload loaded')
})