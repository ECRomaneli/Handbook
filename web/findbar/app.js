const { ipcRenderer } = require('electron')

const $remote = {
    getInitialInput: async () => ipcRenderer.invoke('findbar.initial-input'),
    inputChange: (value) => { ipcRenderer.send('findbar.input-change', value) },
    previous: () => { ipcRenderer.send('findbar.previous') },
    next: () => { ipcRenderer.send('findbar.next') },
    close: () => { ipcRenderer.send('findbar.close') },
    onMatchesChange: (listener) => { ipcRenderer.on('findbar.matches', listener) }
}

function inputChange(e) {
    $remote.inputChange(e.target.value)
}

document.addEventListener('DOMContentLoaded', () => {
    const matchesEl = document.getElementById('matches')
    $remote.onMatchesChange((_e, m) => matchesEl.innerText = m.total ? m.active + '/' + m.total : '')
})