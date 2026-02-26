import { ipcMain } from 'electron'
import { join } from 'node:path'

import { createWindow } from 'lib/electron-app/factories/windows/create'
import { ENVIRONMENT } from 'shared/constants'
import { displayName } from '~/package.json'

let settingsWindow: Electron.BrowserWindow | null = null

// --- 持久化存储 ---
// 未来可替换为 electron-store 等方案
let storedApiKey = ''

// 注册 IPC handlers（只注册一次）
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
    // 如果窗口已存在则聚焦
    if (settingsWindow && !settingsWindow.isDestroyed()) {
        settingsWindow.focus()
        return
    }

    settingsWindow = createWindow({
        id: 'settings',
        title: `${displayName} — 设置`,
        width: 480,
        height: 360,
        show: false,
        center: true,
        resizable: false,
        alwaysOnTop: false,
        autoHideMenuBar: true,
        frame: false, // 去掉系统边框
        transparent: true, // 允许透明背景，支持前端画圆角
        hasShadow: false, // 由前端画阴影
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
