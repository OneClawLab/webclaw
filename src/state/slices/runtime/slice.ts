import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { initialState } from './types.js';

const runtimeSlice = createSlice({
  name: 'runtime',
  initialState,
  reducers: {
    set(state, action: PayloadAction<{ selection?: { from: number, to: number, total: number}, cursor?: { line: number, col: number } }>) {
      if (action.payload.selection)
        state.selection = action.payload.selection;
      if (action.payload.cursor)
        state.cursor = action.payload.cursor;
    },
  },
});

export const runtimeActions = runtimeSlice.actions
export default runtimeSlice.reducer;

