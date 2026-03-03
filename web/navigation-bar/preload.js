const $remote = (ipc => ({
  back: () => { ipc.send('navbar:back') },
  forward: () => { ipc.send('navbar:forward') },
  home: () => { ipc.send('navbar:home') },
  copyUrl: () => { ipc.send('navbar:copy-url') },
  refresh: () => { ipc.send('navbar:refresh') },
  openPermissions: () => { ipc.send('navbar:open-permissions') },
  toggleMute: () => { ipc.send('navbar:toggle-mute') },
  listPages: () => { ipc.send('navbar:list-pages') },
  hide: () => { ipc.send('navbar:hide') },
  close: () => { ipc.send('navbar:close') },
  dragStart: () => { ipc.send('navbar:dragStart') },
  dragging: () => { ipc.send('navbar:dragging') },
  maximize: () => { ipc.send('navbar:maximize') },
  onLabelUpdated: (listener) => { ipc.on('navbar:label-updated', listener) },
  onDidNavigate: (listener) => { ipc.on('navbar:did-navigate', listener) },
  onDidStartLoading: (listener) => { ipc.on('navbar:did-start-loading', listener) },
  onDidStopLoading: (listener) => { ipc.on('navbar:did-stop-loading', listener) },
  muteStatusChanged: (listener) => { ipc.on('navbar:mute-status-changed', listener) }
}))(require('electron').ipcRenderer)

const icons = {
  copy: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 4H6A2 2 0 004 6V16"/></svg>',
  check: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M5 12L10 17L19 7"/></svg>',
  stop: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M7 17.5L12 12.5L17 17.5"/><path d="M7 7.5L12 12.5L17 7.5"/></svg>',
  refresh: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M17 10C16 7.5 14 6 12 6C9 6 6.5 8.5 6.5 11.5C6.5 14.5 9 17 12 17C14 17 16 16 17 14M17 7V10H14"/></svg>',
  mute: '<svg viewBox="2 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M6 9.5V14.5H9.5L16 18.5V5.5L9.5 9.5H6Z"/><path d="M18.5 9.5C19.5 11 19.5 13 18.5 14.5"/><path d="M20.5 7.5C22 10 22 14 20.5 16.5"/></svg>',
  unmute: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><mask id="slashMask"><rect width="24" height="24" fill="white"/><path d="M4.5 19.5L19.5 4.5" stroke="black" stroke-width="4"/></mask><path d="M6 9.5V14.5H9.5L16 18.5V5.5L9.5 9.5H6Z" mask="url(#slashMask)"/><path d="M4.5 19.5L19.5 4.5"/></svg>'
}

function setupActionArea() {
  let isDragging = void 0

  document.addEventListener('mousedown', (e) => {
    if (e.button === 0 && !e.target.matches('button, button *')) {
      isDragging = false
    }
  })
  document.addEventListener('mousemove', (e) => {
    if (isDragging === void 0) { return }
    if ((e.buttons & 1) === 0) {
      isDragging = void 0
      return
    }
    e.preventDefault()
    if (isDragging === false) {
      isDragging = true
      $remote.dragStart()
    }
    $remote.dragging()
  }, true);
  document.addEventListener('mouseup', (e) => {
    if (isDragging !== void 0 && e.button === 0) {
      isDragging = void 0
      e.preventDefault()
    }
  }, true)
  document.addEventListener('dblclick', (e) => {
    if (e.target.matches('button, button *')) { return }
    e.preventDefault()
    $remote.maximize()
  }, true)
}

setupActionArea()

document.addEventListener('DOMContentLoaded', async () => {
  const titleInput = document.getElementById('title')
  const subtitleInput = document.getElementById('subtitle')
  const backBtn = document.getElementById('back')
  const forwardBtn = document.getElementById('forward')
  const homeBtn = document.getElementById('home')
  const copyLinkBtn = document.getElementById('copy-link')
  const refreshBtn = document.getElementById('refresh')
  const permissionsBtn = document.getElementById('permissions')
  const muteBtn = document.getElementById('mute')
  const listBtn = document.getElementById('list')
  const hideBtn = document.getElementById('hide')
  const closeBtn = document.getElementById('close')
  const details = document.getElementById('details')
  const subtitleIcons = details.querySelectorAll('button')

  subtitleIcons.forEach(btn => { btn.style.opacity = '0' })
  details.addEventListener('mouseover', () => {
    subtitleIcons.forEach(btn => { btn.style.opacity = '1' })
  })
  details.addEventListener('mouseout', () => {
    subtitleIcons.forEach(btn => { btn.style.opacity = '0' })
  })

  backBtn.addEventListener('click', () => { $remote.back() })
  forwardBtn.addEventListener('click', () => { $remote.forward() })
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
  $remote.onLabelUpdated((_e, title) => { titleInput.textContent = title })

  $remote.onDidNavigate((_e, { url, canGoBack, canGoForward }) => {
    subtitleInput.textContent = url
    backBtn.classList.toggle('disabled', !canGoBack)
    forwardBtn.classList.toggle('disabled', !canGoForward)
    backBtn.disabled = !canGoBack
    forwardBtn.disabled = !canGoForward
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