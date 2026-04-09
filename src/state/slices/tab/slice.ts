import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { buildReducers } from './reducers.js'
import { initialState, TabState } from './types.js';

const tabSlice = createSlice({
  name: 'tab',
  initialState,
  reducers: buildReducers(),
});

export const tabActions = tabSlice.actions
export default tabSlice.reducer
