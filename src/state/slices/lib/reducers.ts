import { Logger } from '@lib/logast.js'
import type { PayloadAction } from '@reduxjs/toolkit'
import { Draft } from 'immer'
import { LibState } from './types.js';

const markLibraryDirty = (state: Draft<LibState>, action: PayloadAction<{ libId: string, isDirty: boolean }>) => {
  const { libId, isDirty } = action.payload;
  Logger.debug('libSlice', `marking library dirty: ${libId} -> ${isDirty}`);
  const lib = state.libs[libId];
  if (lib)
    lib._dirty = isDirty
}

export function buildReducers() {
  return {
    markLibraryDirty,
  }
}
