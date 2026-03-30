(function () {
  const PAGE_ICON = '<svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>'
  const PREFS_ICON = '<svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.49.49 0 0 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>'

  const $bridge = ((ipc, EventEmitter) => {
    const $bus = new EventEmitter()
    ipc.on('quickMenu:open', (_e, data) => { $bus.emit('open', data) })
    ipc.on('quickMenu:filterResults', (_e, data) => { $bus.emit('filterResults', data) })
    return {
      onOpen: (fn) => $bus.on('open', fn),
      onFilterResults: (fn) => $bus.on('filterResults', fn),
      close: () => ipc.send('quickMenu:close'),
      select: (item) => ipc.send('quickMenu:select', item),
      filter: (query) => ipc.send('quickMenu:filter', query)
    }
  })(require('electron').ipcRenderer, require('node:events'))

  let filteredPages = []
  let selectedIndex = 0
  let strings = {}

  function render(els) {
    els.results.innerHTML = ''

    if (filteredPages.length === 0) {
      const noResults = document.createElement('div')
      noResults.className = 'no-results'
      noResults.textContent = strings.noResults || 'No results'
      els.results.appendChild(noResults)
      return
    }

    filteredPages.forEach((page, i) => {
      const item = document.createElement('div')
      item.className = 'result-item' + (i === selectedIndex ? ' selected' : '')
      item.dataset.index = i

      const icon = document.createElement('div')
      icon.className = 'result-item-icon'
      icon.innerHTML = page.isPreferences ? PREFS_ICON : PAGE_ICON

      const content = document.createElement('div')
      content.className = 'result-item-content'

      const label = document.createElement('div')
      label.className = 'result-item-label'
      label.textContent = page.label

      content.appendChild(label)

      if (page.url && !page.isPreferences) {
        const url = document.createElement('div')
        url.className = 'result-item-url'
        url.textContent = page.url
        content.appendChild(url)
      }

      item.appendChild(icon)
      item.appendChild(content)

      item.addEventListener('mouseenter', () => {
        selectedIndex = i
        updateSelection(els)
      })

      item.addEventListener('click', () => {
        selectCurrent()
      })

      els.results.appendChild(item)
    })
  }

  function updateSelection(els) {
    const items = els.results.querySelectorAll('.result-item')
    items.forEach((item, i) => {
      item.classList.toggle('selected', i === selectedIndex)
    })

    // Scroll selected item into view
    const selected = items[selectedIndex]
    if (selected) {
      selected.scrollIntoView({ block: 'nearest' })
    }
  }

  function selectCurrent() {
    if (filteredPages.length === 0) { return }
    const page = filteredPages[selectedIndex]
    if (page) {
      $bridge.select(page)
    }
  }

  document.addEventListener('keydown', e => {
    if (e.code === 'Escape') {
      e.preventDefault()
      $bridge.close()
    }
  })

  document.addEventListener('DOMContentLoaded', () => {
    const els = {
      input: document.getElementById('search-input'),
      results: document.getElementById('results')
    }
    currentEls = els

    if (process.platform === 'linux') {
      document.body.style.background = 'transparent'
      document.body.classList.add('linux-modal')
    }

    $bridge.onOpen((data) => {
      strings = data.strings || {}
      filteredPages = data.items || []
      selectedIndex = 0

      els.input.placeholder = strings.placeholder || 'Search pages...'
      els.input.value = ''
      render(els)
      els.input.focus()
    })

    $bridge.onFilterResults((pages) => {
      filteredPages = pages || []
      selectedIndex = 0
      render(els)
    })

    els.input.addEventListener('input', () => {
      $bridge.filter(els.input.value)
    })

    els.input.addEventListener('keydown', (e) => {
      if (e.code === 'ArrowDown') {
        e.preventDefault()
        if (filteredPages.length > 0) {
          selectedIndex = (selectedIndex + 1) % filteredPages.length
          updateSelection(els)
        }
      } else if (e.code === 'ArrowUp') {
        e.preventDefault()
        if (filteredPages.length > 0) {
          selectedIndex = (selectedIndex - 1 + filteredPages.length) % filteredPages.length
          updateSelection(els)
        }
      } else if (e.code === 'Enter') {
        e.preventDefault()
        selectCurrent()
      }
    })
  }, true)
})()
