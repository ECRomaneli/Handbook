/**
 * Bridge to communicate with main process
 * Encapsulates IPC communication in a clean API
 */
const $remote = ((ipc, EventEmitter) => {
  const $bus = new EventEmitter()
  ipc.on('view:settings-updated', (_e, id, value) => $bus.emit(`view:settings:${id}:updated`, value))
  return {
    onSettingsUpdated: (id, fn) => $bus.on(`view:settings:${id}:updated`, fn),
    getSettings: async (id) => await ipc.invoke('preferences:get-settings', id),
    toggleMaximize: () => ipc.send('navbar:maximize'),
    dragStart: () => ipc.send('navbar:dragStart'),
    dragging: () => ipc.send('navbar:dragging')
  }
})(require('electron').ipcRenderer, require('node:events'))

/**
 * Initialize preload functionality after DOM is ready
 */
async function initialize() {
  const showFrame = await $remote.getSettings('show_frame')
  if (!showFrame) { registerActions() }

  console.trace('Preloaded')
}

/**
 * Registers all window action handlers
 */
async function registerActions() {
  let actionArea = await $remote.getSettings('action_area')
  $remote.onSettingsUpdated('action_area', (value) => actionArea = value)
  const actionAreaProvider = () => actionArea

  setupMaximizeOnDoubleClick(actionAreaProvider)
  setupWindowDrag(actionAreaProvider)
}

/**
 * Registers maximize on double click
 * @param {number} actionArea - Height of the action area
 */
function setupMaximizeOnDoubleClick(actionAreaProvider) {
  document.addEventListener('dblclick', (e) => {
    if (!isLeftClickInActionArea(e, actionAreaProvider())) { return }
    e.preventDefault()
    e.stopImmediatePropagation()
    $remote.toggleMaximize();
  }, true)
}

function setOverlay(status) {
  const id = 'handbook-drag-overlay'
  let overlay = document.getElementById(id)
  if (status && !overlay) {
    overlay = document.createElement('div')
    overlay.id = id
    overlay.style.position = 'fixed'
    overlay.style.top = '0'
    overlay.style.left = '0'
    overlay.style.width = '100%'
    overlay.style.height = '100%'
    overlay.style.zIndex = '2147483647'
    overlay.style.cursor = 'move'
    overlay.style.userSelect = 'none'
    document.body.appendChild(overlay)
  } else if (!status && overlay) {
    document.body.removeChild(overlay)
  }
}

/**
 * Registers window drag handlers
 * @param {() => number} actionAreaProvider - Function that provides the height of the action area
 */
function setupWindowDrag(actionAreaProvider) {
  let isDragging = false

  document.addEventListener('mousedown', (e) => {
    if (!isLeftClickInActionArea(e, actionAreaProvider()) || isDragging) { return }

    const style = document.body.style
    const originalUserSelect = style.userSelect

    const onMouseMove = (e) => {
      if ((e.buttons & 1) === 0) { onMouseUp(e); return }
      e.preventDefault()
      e.stopImmediatePropagation()
      if (!isDragging) {
        setOverlay(true)
        style.setProperty('user-select', 'none', 'important')
        isDragging = true
        $remote.dragStart()
      }

      $remote.dragging()
    }

    const onMouseUp = (e) => {
      e.preventDefault()
      e.stopImmediatePropagation()
      style.setProperty('user-select', originalUserSelect)
      document.removeEventListener('mousemove', onMouseMove, true)
      document.removeEventListener('mouseup', onMouseUp, true)
      isDragging = false
      setOverlay(false)
    }

    document.addEventListener('mousemove', onMouseMove, true)
    document.addEventListener('mouseup', onMouseUp, true)
  }, true)
}

/**
 * Checks if the click event is in the action area
 * @param {MouseEvent} e - Mouse event
 * @param {number} height - Height of action area
 * @returns {boolean} True if event is a left click in action area
 */
function isLeftClickInActionArea(e, height) {
  return e.button === 0 && e.clientY <= height;
}

document.addEventListener('DOMContentLoaded', initialize, true)