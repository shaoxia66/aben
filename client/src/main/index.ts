import { app } from 'electron'
import { join } from 'node:path'

import { makeAppWithSingleInstanceLock } from 'lib/electron-app/factories/app/instance'
import { makeAppSetup } from 'lib/electron-app/factories/app/setup'
import { loadReactDevtools } from 'lib/electron-app/utils'
import { ENVIRONMENT } from 'shared/constants'
import { MainWindow } from './windows/main'
import { waitFor } from 'shared/utils'
import { registerAgentIpc } from './agent'

registerAgentIpc()

app.commandLine.appendSwitch('no-sandbox')
if (ENVIRONMENT.IS_DEV) {
  app.setPath('userData', join(app.getPath('temp'), 'aben-electron-user-data'))
}

makeAppWithSingleInstanceLock(async () => {
  await app.whenReady()
  const window = await makeAppSetup(MainWindow)

  if (ENVIRONMENT.IS_DEV) {
    await loadReactDevtools()
    /* This trick is necessary to get the new
      React Developer Tools working at app initial load.
      Otherwise, it only works on manual reload.
    */
    window.webContents.once('devtools-opened', async () => {
      await waitFor(1000)
      window.webContents.reload()
    })
  }

  app.on('will-quit', async () => {
    try {
      const { closeMcp } = await import('./tools/mcp')
      await closeMcp()
    } catch { }
  })
})
