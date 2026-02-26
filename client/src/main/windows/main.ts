import { BrowserWindow, Menu, MenuItem, ipcMain, screen } from 'electron'
import { join } from 'node:path'

import { createWindow } from 'lib/electron-app/factories/windows/create'
import { ENVIRONMENT } from 'shared/constants'
import { displayName } from '~/package.json'
import { openSettingsWindow } from './settings'

export async function MainWindow() {
  const window = createWindow({
    id: 'main',
    title: displayName,
    width: 180,
    height: 180,
    show: false,
    center: false,
    movable: true,
    resizable: false,
    alwaysOnTop: true,
    autoHideMenuBar: true,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    skipTaskbar: true,
    fullscreenable: false,
    maximizable: false,
    minimizable: false,

    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
    },
  })

  const placeAtBottomRight = (w: number, h: number) => {
    const display = screen.getPrimaryDisplay()
    const { x, y, width, height } = display.workArea
    const margin = 24
    window.setBounds(
      {
        x: x + width - w - margin,
        y: y + height - h - margin,
        width: w,
        height: h,
      },
      false
    )
  }

  placeAtBottomRight(180, 180)

  // 右键菜单
  window.webContents.on('context-menu', () => {
    const menu = new Menu()
    menu.append(
      new MenuItem({
        label: '⚙️  设置',
        click: () => openSettingsWindow(),
      })
    )
    menu.popup({ window })
  })

  const resizeWindow = (w: number, h: number) => {
    if (window.isDestroyed()) return
    // 始终以窗口右下角（助手图标所在角）为锚点调整尺寸，位置不变
    const bounds = window.getBounds()
    const rightEdge = bounds.x + bounds.width
    const bottomEdge = bounds.y + bounds.height
    window.setBounds({ x: rightEdge - w, y: bottomEdge - h, width: w, height: h }, false)
  }

  ipcMain.removeHandler('widget:setMode')
  ipcMain.handle(
    'widget:setMode',
    async (_event, mode: 'compact' | 'expanded') => {
      if (window.isDestroyed()) return
      if (mode === 'expanded') resizeWindow(460, 340)
      else resizeWindow(180, 180)
    }
  )

  ipcMain.removeAllListeners('widget:drag')
  const dragState: { dragging: boolean; offsetX: number; offsetY: number; moved: boolean } = {
    dragging: false,
    offsetX: 0,
    offsetY: 0,
    moved: false,
  }
  ipcMain.on(
    'widget:drag',
    (
      _event,
      payload: {
        phase: 'start' | 'move' | 'end'
        screenX: number
        screenY: number
        offsetX?: number
        offsetY?: number
      }
    ) => {
      if (window.isDestroyed()) return
      if (payload.phase === 'start') {
        dragState.dragging = true
        dragState.moved = false
        dragState.offsetX =
          typeof payload.offsetX === 'number' ? payload.offsetX : 0
        dragState.offsetY =
          typeof payload.offsetY === 'number' ? payload.offsetY : 0
        return
      }
      if (payload.phase === 'end') {
        dragState.dragging = false
        return
      }
      if (!dragState.dragging) return
      const nextX = Math.round(payload.screenX - dragState.offsetX)
      const nextY = Math.round(payload.screenY - dragState.offsetY)
      dragState.moved = true
      window.setPosition(nextX, nextY, false)
    }
  )

  window.webContents.on('did-finish-load', () => {
    if (ENVIRONMENT.IS_DEV) {
      window.webContents.openDevTools({ mode: 'detach' })
    }

    window.show()
  })

  window.on('close', () => {
    for (const window of BrowserWindow.getAllWindows()) {
      window.destroy()
    }
  })

  return window
}
