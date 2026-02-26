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
}

contextBridge.exposeInMainWorld('App', API)
