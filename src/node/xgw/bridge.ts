import { ipcMain, BrowserWindow } from 'electron/main'
import type { XgwClient, XgwClientConfig } from './client.js'

export function registerXgwIpcHandlers(client: XgwClient, win: BrowserWindow): void {
  // ── Renderer → Main (invoke) ──────────────────────────────────────────────

  ipcMain.handle('xgw:sendMessage', (_event, conversationId: string, text: string) => {
    client.sendMessage(conversationId, text)
  })

  ipcMain.handle('xgw:openConversation', (_event, conversationId: string, agentId: string) => {
    client.openConversation(conversationId, agentId)
  })

  ipcMain.handle('xgw:closeConversation', (_event, conversationId: string) => {
    client.closeConversation(conversationId)
  })

  ipcMain.handle('xgw:getStatus', () => {
    return client.status
  })

  ipcMain.handle('xgw:updateConfig', async (_event, config: XgwClientConfig) => {
    client.disconnect()
    client.updateConfig(config)
    client.connect()
  })

  // ── Main → Renderer (push) ────────────────────────────────────────────────

  client.on('frame', (frame) => {
    if (!win.isDestroyed()) {
      win.webContents.send('xgw:frame', frame)
    }
  })

  client.on('connected', () => {
    if (!win.isDestroyed()) {
      win.webContents.send('xgw:status', 'connected')
    }
  })

  client.on('disconnected', () => {
    if (!win.isDestroyed()) {
      win.webContents.send('xgw:status', 'disconnected')
    }
  })

  client.on('reconnecting', (_attempt: number) => {
    if (!win.isDestroyed()) {
      win.webContents.send('xgw:status', 'reconnecting')
    }
  })

  client.on('authenticated', (agents: string[]) => {
    if (!win.isDestroyed()) {
      win.webContents.send('xgw:status', 'authenticated')
      win.webContents.send('xgw:agents', agents)
    }
  })

  client.on('error', (msg: string) => {
    if (!win.isDestroyed()) {
      win.webContents.send('xgw:error', msg)
    }
  })
}
