import { BrowserWindow, Menu, MenuItem, ipcMain, net, screen } from 'electron'
import { join } from 'node:path'
import { readFileSync, existsSync } from 'node:fs'
import { app } from 'electron'

import { createWindow } from 'lib/electron-app/factories/windows/create'
import { ENVIRONMENT } from 'shared/constants'
import { displayName } from '~/package.json'
import { openSettingsWindow } from './settings'
import { openChatWindow } from './chat'

/** 读取本地持久化的客户端密钥 */
function readLocalAuthKey(): string {
  try {
    const file = join(app.getPath('userData'), 'aben-key.json')
    if (!existsSync(file)) return ''
    const data = JSON.parse(readFileSync(file, 'utf-8')) as { key?: string }
    return typeof data.key === 'string' ? data.key : ''
  } catch {
    return ''
  }
}

/** 从管理端拉取 LLM 配置并打印到控制台 */
async function fetchAndLogLlmConfig() {
  const authKey = readLocalAuthKey()
  const adminUrl = process.env.VITE_ADMIN_API_URL ?? ''

  console.log('\n──────────────────────────────────────────')
  console.log('🔍 [Aben] 本地密钥:', authKey ? `${authKey.slice(0, 10)}...` : '(未设置)')
  console.log('🌐 [Aben] 管理端地址:', adminUrl || '(未配置 VITE_ADMIN_API_URL)')

  if (!authKey) {
    console.warn('⚠️  [Aben] 未设置密钥，请先在设置中配置 ck_... 密钥')
    console.log('──────────────────────────────────────────\n')
    return
  }
  if (!adminUrl) {
    console.warn('⚠️  [Aben] 未配置管理端地址，请在 .env 中设置 VITE_ADMIN_API_URL')
    console.log('──────────────────────────────────────────\n')
    return
  }

  try {
    console.log('⏳ [Aben] 正在请求管理端...')
    const res = await net.fetch(`${adminUrl}/api/client-auth/llm-config`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${authKey}`,
        'Content-Type': 'application/json',
      },
    })

    const json = await res.json() as Record<string, unknown>

    if (!res.ok) {
      console.error('❌ [Aben] 请求失败 HTTP', res.status, json)
      console.log('──────────────────────────────────────────\n')
      return
    }

    console.log('✅ [Aben] 获取成功！')
    console.log('👤 客户端信息:', JSON.stringify(json['client'], null, 2))
    console.log('🤖 默认 LLM 配置:')

    type LlmConfig = { provider: string; modelName: string | null; baseUrl: string | null; apiKey: string | null; apiKeyLast4: string | null; isDefault: boolean }
    const def = json['defaultConfig'] as LlmConfig
    if (def) {
      console.log(`   provider  : ${def.provider}`)
      console.log(`   modelName : ${def.modelName ?? '(SDK 默认)'}`)
      console.log(`   baseUrl   : ${def.baseUrl ?? '(SDK 默认)'}`)
      console.log(`   apiKey    : ${def.apiKey ? `${def.apiKey.slice(0, 8)}...${def.apiKeyLast4}` : '(无)'}`)
      console.log(`   isDefault : ${def.isDefault}`)
    }

    console.log('\n📋 全部配置:')
    const configs = json['configs'] as LlmConfig[]
    configs?.forEach((c, i) => {
      console.log(`   [${i + 1}] ${c.provider} | model: ${c.modelName ?? '-'} | key末4: ${c.apiKeyLast4 ?? '-'} | default: ${c.isDefault}`)
    })
  } catch (err) {
    console.error('❌ [Aben] 网络请求异常:', err)
  }

  console.log('──────────────────────────────────────────\n')
}


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
        label: '💬  打开对话',
        click: () => openChatWindow(),
      })
    )
    menu.append(
      new MenuItem({
        label: '⚙️  设置',
        click: () => openSettingsWindow(),
      })
    )
    menu.append(new MenuItem({ type: 'separator' }))
    menu.append(
      new MenuItem({
        label: '🔌  获取 LLM 配置（打印）',
        click: () => void fetchAndLogLlmConfig(),
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
