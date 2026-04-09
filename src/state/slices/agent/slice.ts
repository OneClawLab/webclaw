import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { initialState } from './types.js'

const agentSlice = createSlice({
  name: 'agent',
  initialState: initialState,
  reducers: {
    setAvailableAgents(state, action: PayloadAction<string[]>) {
      state.availableAgents = action.payload
    },

    setDefaultAgentId(state, action: PayloadAction<string>) {
      state.defaultAgentId = action.payload
    },
  }
})

export const agentActions = agentSlice.actions
export default agentSlice.reducer
