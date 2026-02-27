import { ipcMain } from 'electron'
import { join } from 'node:path'

import { createWindow } from 'lib/electron-app/factories/windows/create'
import { ENVIRONMENT } from 'shared/constants'

let settingsWindow: Electron.BrowserWindow | null = null

// --- 持久化存储 ---
let storedApiKey = ''

ipcMain.removeHandler('settings:getApiKey')
ipcMain.handle('settings:getApiKey', () => storedApiKey)

ipcMain.removeHandler('settings:saveApiKey')
ipcMain.handle('settings:saveApiKey', (_event, key: string) => {
    storedApiKey = key
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
        width: 420,
        height: 280,
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
