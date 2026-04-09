import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { DocState, initialState } from './types.js';
import { buildReducers } from './reducers.js'
import { buildExtraReducers } from './extraReducers.js';

const docSlice = createSlice({
  name: 'doc',
  initialState,
  reducers: buildReducers(),
  extraReducers: (builder) => { buildExtraReducers(builder) },
});

export const docActions = docSlice.actions
export default docSlice.reducer
