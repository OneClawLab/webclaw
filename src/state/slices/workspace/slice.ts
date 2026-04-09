import { Logger } from '@lib/logast.js'
import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { initialState, WorkspaceState } from './types.js'
import { buildExtraReducers } from './extraReducers.js'

const workspaceSlice = createSlice({
  name: 'workspace',
  initialState: initialState,
  reducers: {
    // 添加一个库路径到当前工作区(并不同步更新 libSlice/treeSlice里的相关状态)
    addLibrary(state, action: PayloadAction<{ libPath: string }>) {
      const libPath = action.payload.libPath;
      if (!state.libPaths.includes(libPath)) {
        Logger.debug('workspaceSlice', 'addLibrary: adding new library', libPath);
        state.libPaths.push(libPath);
      } else {
        Logger.debug('workspaceSlice', 'addLibrary: library already exists', libPath);
      }
    },
    moveLibraryPosition(state, action: PayloadAction<{ fromIndex: number, toIndex: number }>) {
      const { fromIndex, toIndex } = action.payload;
      if (fromIndex < 0 || fromIndex >= state.libPaths.length || toIndex < 0 || toIndex >= state.libPaths.length) {
        Logger.warn('workspaceSlice', 'moveLibraryPosition: invalid indices', { fromIndex, toIndex });
        return;
      }
      const [movedPath] = state.libPaths.splice(fromIndex, 1);
      state.libPaths.splice(toIndex, 0, movedPath);
      Logger.debug('workspaceSlice', 'moveLibraryPosition: moved library', { movedPath, fromIndex, toIndex });
    },
  },
  extraReducers: (builder) => { buildExtraReducers(builder) },
})

export const workspaceActions = workspaceSlice.actions
export default workspaceSlice.reducer;
