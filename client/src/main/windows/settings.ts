import { app, ipcMain } from 'electron'
import { join } from 'node:path'
import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'node:fs'

import { createWindow } from 'lib/electron-app/factories/windows/create'
import { ENVIRONMENT } from 'shared/constants'

let settingsWindow: Electron.BrowserWindow | null = null

// ── 持久化存储（userData/aben-key.json） ──────────────────────────
function getKeyFilePath() {
    return join(app.getPath('userData'), 'aben-key.json')
}

function readPersistedKey(): string {
    try {
        const file = getKeyFilePath()
        if (!existsSync(file)) return ''
        const data = JSON.parse(readFileSync(file, 'utf-8')) as { key?: string }
        return typeof data.key === 'string' ? data.key : ''
    } catch {
        return ''
    }
}

function writePersistedKey(key: string) {
    writeFileSync(getKeyFilePath(), JSON.stringify({ key }), 'utf-8')
}

function deletePersistedKey() {
    try {
        const file = getKeyFilePath()
        if (existsSync(file)) unlinkSync(file)
    } catch {
        /* ignore */
    }
}

// ── IPC Handlers ───────────────────────────────────────────────────
ipcMain.removeHandler('settings:getApiKey')
ipcMain.handle('settings:getApiKey', () => readPersistedKey())

ipcMain.removeHandler('settings:saveApiKey')
ipcMain.handle('settings:saveApiKey', (_event, key: string) => {
    writePersistedKey(key.trim())
    return { success: true }
})

ipcMain.removeHandler('settings:deleteApiKey')
ipcMain.handle('settings:deleteApiKey', () => {
    deletePersistedKey()
    return { success: true }
})

ipcMain.removeHandler('settings:close')
ipcMain.handle('settings:close', () => {
    if (settingsWindow && !settingsWindow.isDestroyed()) {
        settingsWindow.close()
    }
})

export function openSettingsWindow() {
    if (settingsWindow && !settingsWindow.isDestroyed()) {
        settingsWindow.focus()
        return
    }

    settingsWindow = createWindow({
        id: 'settings',
        title: '',
        width: 440,
        height: 340,
        show: false,
        center: true,
        resizable: false,
        alwaysOnTop: false,
        autoHideMenuBar: true,
        frame: false,
        transparent: true,
        hasShadow: false,
        skipTaskbar: false,
        fullscreenable: false,
        maximizable: false,
        minimizable: false,

        webPreferences: {
            preload: join(__dirname, '../preload/index.js'),
        },
    })

    settingsWindow.webContents.on('did-finish-load', () => {
        if (!settingsWindow || settingsWindow.isDestroyed()) return
        if (ENVIRONMENT.IS_DEV) {
            settingsWindow.webContents.openDevTools({ mode: 'detach' })
        }
        settingsWindow.show()
    })

    settingsWindow.on('closed', () => {
        settingsWindow = null
    })
}
