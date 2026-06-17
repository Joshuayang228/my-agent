import { ipcMain } from 'electron'
import * as store from '../storage/session-store'

export function registerSessionIPC(): void {
  ipcMain.handle('session:list', async () => store.listSessions())

  ipcMain.handle('session:create', async () => store.createSession())

  ipcMain.handle('session:get', async (_event, sessionId: string) =>
    store.getSession(sessionId))

  ipcMain.handle('session:delete', async (_event, sessionId: string) =>
    store.deleteSession(sessionId))

  ipcMain.handle('session:rename', async (_event, sessionId: string, title: string) =>
    store.updateSessionTitle(sessionId, title))

  ipcMain.handle('message:delete', async (_event, messageId: string) =>
    store.deleteMessage(messageId))
}
