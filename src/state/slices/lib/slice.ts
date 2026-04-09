import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { buildReducers } from './reducers.js'
import { buildExtraReducers } from './extraReducers.js';
import { initialState, LibState } from './types.js';

const libSlice = createSlice({
  name: 'libs',
  initialState,
  reducers: buildReducers(),
  extraReducers: (builder) => { buildExtraReducers(builder) },
});

export const libActions = libSlice.actions
export default libSlice.reducer
