import { Route } from 'react-router-dom'

import { Router } from 'lib/electron-router-dom'

import { MainScreen } from './screens/main'
import { SettingsScreen } from './screens/settings'
import { ChatScreen } from './screens/chat'

export function AppRoutes() {
  return (
    <Router
      main={<Route element={<MainScreen />} path="/" />}
      settings={<Route element={<SettingsScreen />} path="/" />}
      chat={<Route element={<ChatScreen />} path="/" />}
    />
  )
}
