import { combineReducers } from '@reduxjs/toolkit'

import settingsReducer from '@state/slices/settings/slice.js'
import workspaceReducer from '@state/slices/workspace/slice.js'
import uiReducer from '@state/slices/ui/slice.js'
import libReducer from '@state/slices/lib/slice.js'
import docReducer from '@state/slices/doc/slice.js'
import tabReducer from '@state/slices/tab/slice.js'
import treeReducer from '@state/slices/tree/slice.js'
import dialogReducer from '@state/slices/dialog/slice.js'
import runtimeReducer from '@state/slices/runtime/slice.js'
import userReducer from '@state/slices/user/slice.js'
import connectionReducer from '@state/slices/connection/slice.js'
import agentReducer from '@state/slices/agent/slice.js'

// Combine all reducers to create the root reducer
export const rootReducer = combineReducers({
  settings: settingsReducer,
  workspace: workspaceReducer,
  ui: uiReducer,  
  lib: libReducer,
  doc: docReducer,
  tab: tabReducer,
  tree: treeReducer,
  dialog: dialogReducer,
  runtime: runtimeReducer,
  user: userReducer,
  connection: connectionReducer,
  agent: agentReducer,
})

export type RootState = ReturnType<typeof rootReducer>
