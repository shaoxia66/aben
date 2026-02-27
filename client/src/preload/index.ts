import { contextBridge, ipcRenderer } from 'electron'

declare global {
  interface Window {
    App: typeof API
  }
}

const API = {
  sayHelloFromBridge: () => console.log('\nHello from bridgeAPI! 👋\n\n'),
  username: process.env.USER,
  setWidgetMode: (mode: 'compact' | 'expanded') =>
    ipcRenderer.invoke('widget:setMode', mode),
  widgetDrag: (payload: {
    phase: 'start' | 'move' | 'end'
    screenX: number
    screenY: number
    offsetX?: number
    offsetY?: number
  }) => ipcRenderer.send('widget:drag', payload),
  // 设置相关
  getApiKey: (): Promise<string> => ipcRenderer.invoke('settings:getApiKey'),
  saveApiKey: (key: string): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('settings:saveApiKey', key),
  deleteApiKey: (): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('settings:deleteApiKey'),
  closeSettings: () => ipcRenderer.invoke('settings:close'),
  openChat: () => ipcRenderer.invoke('chat:open'),
  closeChat: () => ipcRenderer.invoke('chat:close'),
  // Agent 对话（streaming）
  agentSend: (message: string) => ipcRenderer.invoke('agent:send', { message }),
  onAgentChunk: (cb: (chunk: string) => void) => {
    const handler = (_: Electron.IpcRendererEvent, chunk: string) => cb(chunk)
    ipcRenderer.on('agent:chunk', handler)
    return () => ipcRenderer.off('agent:chunk', handler)
  },
  onAgentDone: (cb: () => void) => {
    const handler = () => cb()
    ipcRenderer.once('agent:done', handler)
    return () => ipcRenderer.off('agent:done', handler)
  },
  onAgentError: (cb: (err: string) => void) => {
    const handler = (_: Electron.IpcRendererEvent, err: string) => cb(err)
    ipcRenderer.once('agent:error', handler)
    return () => ipcRenderer.off('agent:error', handler)
  },
}

contextBridge.exposeInMainWorld('App', API)
