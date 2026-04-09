import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { initialState, ConnectionState, ConnectionStatus } from './types.js'

const connectionSlice = createSlice({
  name: 'connection',
  initialState: initialState,
  reducers: {
    setStatus(state, action: PayloadAction<ConnectionStatus>) {
      state.status = action.payload
    },

    setConfig(state, action: PayloadAction<{
      host?: string
      port?: number
      channelId?: string
      peerId?: string
    }>) {
      const { host, port, channelId, peerId } = action.payload
      if (host !== undefined) state.host = host
      if (port !== undefined) state.port = port
      if (channelId !== undefined) state.channelId = channelId
      if (peerId !== undefined) state.peerId = peerId
    },

    setLastHeartbeat(state, action: PayloadAction<number>) {
      state.lastHeartbeat = action.payload
    },

    setReconnectAttempt(state, action: PayloadAction<number>) {
      state.reconnectAttempt = action.payload
    },

    setError(state, action: PayloadAction<string | null>) {
      state.error = action.payload
    },
  }
})

export const connectionActions = connectionSlice.actions
export default connectionSlice.reducer
