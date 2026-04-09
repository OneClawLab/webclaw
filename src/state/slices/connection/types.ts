export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'authenticated' | 'reconnecting'

export interface ConnectionState {
  status: ConnectionStatus
  host: string
  port: number
  channelId: string
  peerId: string
  lastHeartbeat: number  // Unix timestamp ms, 0 = never
  reconnectAttempt: number
  error: string | null
}

export const initialState: ConnectionState = {
  status: 'disconnected',
  host: '127.0.0.1',
  port: 29214,
  channelId: 'webui:main',
  peerId: 'owner',
  lastHeartbeat: 0,
  reconnectAttempt: 0,
  error: null,
}
