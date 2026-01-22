const $remote = (ipc => ({
    previous: () => { ipc.send('navigation-bar/previous') },
    next: () => { ipc.send('navigation-bar/next') },
    home: () => { ipc.send('navigation-bar/home') },
    copyUrl: () => { ipc.send('navigation-bar/copy-url') },
    refresh: () => { ipc.send('navigation-bar/refresh') },
    openPermissions: () => { ipc.send('navigation-bar/open-permissions') },
    toggleMute: () => { ipc.send('navigation-bar/toggle-mute') },
    listPages: () => { ipc.send('navigation-bar/list-pages') },
    hide: () => { ipc.send('navigation-bar/hide') },
    close: () => { ipc.send('navigation-bar/close') },
    onViewUpdated: (listener) => { ipc.on('navigation-bar/view-updated', listener) },
    onDidNavigate: (listener) => { ipc.on('navigation-bar/did-navigate', listener) },
    onDidStartLoading: (listener) => { ipc.on('navigation-bar/did-start-loading', listener) },
    onDidStopLoading: (listener) => { ipc.on('navigation-bar/did-stop-loading', listener) },
    muteStatusChanged: (listener) => { ipc.on('navigation-bar/mute-status-changed', listener) }
})) (require('electron').ipcRenderer)

const icons = {
    copy: '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"></rect><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path></svg>',
    check: '<svg width="12" height="12" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z" fill="currentColor"/></svg>',
    stop: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M7 17.5L12 12.5L17 17.5"/><path d="M7 7.5L12 12.5L17 7.5"/></svg>',
    refresh: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M17 10C16 7.5 14 6 12 6C9 6 6.5 8.5 6.5 11.5C6.5 14.5 9 17 12 17C14 17 16 16 17 14M17 7V10H14"/></svg>',
    mute: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M5 9V15H9L14 20V4L9 9H5Z"/></svg>',
    unmute: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><mask id="slashMask"><rect width="24" height="24" fill="white"/><path d="M4 20L20 4" stroke="black" stroke-width="4"/></mask><path d="M5 9V15H9L14 20V4L9 9H5Z" mask="url(#slashMask)"/><path d="M4 20L20 4"/></svg>'
}

document.addEventListener('DOMContentLoaded', async () => {
    const titleInput = document.getElementById('title')
    const subtitleInput = document.getElementById('subtitle')
    const previousBtn = document.getElementById('previous')
    const nextBtn = document.getElementById('next')
    const homeBtn = document.getElementById('home')
    const copyLinkBtn = document.getElementById('copy-link')
    const refreshBtn = document.getElementById('refresh')
    const permissionsBtn = document.getElementById('permissions')
    const muteBtn = document.getElementById('mute')
    const listBtn = document.getElementById('list')
    const hideBtn = document.getElementById('hide')
    const closeBtn = document.getElementById('close')
    // const subtitleBox = document.getElementById('subtitle-box')
    // const subtitleIcons = subtitleBox.querySelectorAll('button')

    // subtitleIcons.forEach(btn => { btn.style.opacity = '0' })
    // subtitleBox.addEventListener('mouseover', () => {
    //     subtitleIcons.forEach(btn => { btn.style.opacity = '1' })
    // })
    // subtitleBox.addEventListener('mouseout', () => {
    //     subtitleIcons.forEach(btn => { btn.style.opacity = '0' })
    // })

    previousBtn.addEventListener('click', () => { $remote.previous() })
    nextBtn.addEventListener('click', () => { $remote.next() })
    homeBtn.addEventListener('click', () => { $remote.home() })
    refreshBtn.addEventListener('click', () => { $remote.refresh() })
    copyLinkBtn.addEventListener('click', () => {
        $remote.copyUrl()
        copyLinkBtn.innerHTML = icons.check
        setTimeout(() => { copyLinkBtn.innerHTML = icons.copy }, 2000)
    })
    permissionsBtn.addEventListener('click', () => { $remote.openPermissions() })
    listBtn.addEventListener('click', () => { $remote.listPages() })
    hideBtn.addEventListener('click', () => { $remote.hide() })
    closeBtn.addEventListener('click', () => { $remote.close() })
    muteBtn.addEventListener('click', () => { $remote.toggleMute() })
    $remote.onViewUpdated((_e, title) => {  titleInput.textContent = title })

    $remote.onDidNavigate((_e, { url, canGoBack, canGoForward }) => {
        subtitleInput.textContent = url
        previousBtn.classList.toggle('disabled', !canGoBack)
        nextBtn.classList.toggle('disabled', !canGoForward)
        previousBtn.disabled = !canGoBack
        nextBtn.disabled = !canGoForward
    })

    $remote.onDidStartLoading(() => {
        refreshBtn.innerHTML = icons.stop
    })

    $remote.onDidStopLoading(() => {
        refreshBtn.innerHTML = icons.refresh
    })

    $remote.muteStatusChanged((_e, isMuted) => {
        muteBtn.title = isMuted ? "Unmute" : "Mute"
        muteBtn.innerHTML = isMuted ? icons.unmute : icons.mute
    })

    refreshBtn.innerHTML = icons.refresh;
    copyLinkBtn.innerHTML = icons.copy;
    muteBtn.title = "Unmute"
    muteBtn.innerHTML = icons.unmute;
    
    console.log('Navigation bar preload loaded')
})