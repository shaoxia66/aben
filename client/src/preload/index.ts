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
  closeSettings: () => ipcRenderer.invoke('settings:close'),
  closeChat: () => ipcRenderer.invoke('chat:close'),
}

contextBridge.exposeInMainWorld('App', API)
