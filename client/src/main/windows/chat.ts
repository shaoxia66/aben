import { ipcMain } from 'electron'
import { join } from 'node:path'

import { createWindow } from 'lib/electron-app/factories/windows/create'
import { ENVIRONMENT } from 'shared/constants'

let chatWindow: Electron.BrowserWindow | null = null

ipcMain.removeHandler('chat:open')
ipcMain.handle('chat:open', () => {
    openChatWindow()
})

ipcMain.removeHandler('chat:close')
ipcMain.handle('chat:close', () => {
    if (chatWindow && !chatWindow.isDestroyed()) {
        chatWindow.close()
    }
})

export function openChatWindow() {
    if (chatWindow && !chatWindow.isDestroyed()) {
        chatWindow.focus()
        return
    }

    chatWindow = createWindow({
        id: 'chat',
        title: '',
        width: 520,
        height: 680,
        show: false,
        center: true,
        resizable: true,
        alwaysOnTop: false,
        autoHideMenuBar: true,
        frame: false,
        transparent: true,
        hasShadow: false,
        skipTaskbar: false,
        fullscreenable: false,
        maximizable: false,
        minimizable: true,

        webPreferences: {
            preload: join(__dirname, '../preload/index.js'),
        },
    })

    chatWindow.webContents.on('did-finish-load', () => {
        if (!chatWindow || chatWindow.isDestroyed()) return
        if (ENVIRONMENT.IS_DEV) {
            chatWindow.webContents.openDevTools({ mode: 'detach' })
        }
        chatWindow.show()
    })

    chatWindow.on('closed', () => {
        chatWindow = null
    })
}
