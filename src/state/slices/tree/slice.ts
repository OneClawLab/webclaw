import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { initialState, TreeNode, TreeStates } from './types.js'
import { buildReducers } from './reducers.js'
import { buildExtraReducers } from './extraReducers.js'

const treeSlice = createSlice({
  name: 'tree',
  initialState,
  reducers: buildReducers(),
  extraReducers: (builder) => { buildExtraReducers(builder) },
});

export const treeActions = treeSlice.actions
export default treeSlice.reducer
