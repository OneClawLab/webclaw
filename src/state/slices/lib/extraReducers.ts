import { Logger, Assert } from '@lib/logast.js'

import { createAsyncThunk } from '@reduxjs/toolkit'
import type { ActionReducerMapBuilder } from '@reduxjs/toolkit'

import { LibMeta, Library, LibState } from './types.js'
import { libraryStore } from '@library/LibraryStore.js'
import { dialog } from '@lib/renderer/dialog.js'
import { getState } from '@state/storeHolder.js'
import { tabActions } from '../tab/slice.js'
import { path } from '@lib/path.js'

export const createLibraryAsync = createAsyncThunk(
  'library/create',
  async ({ libPath }: { libPath: string }, thunkAPI) => {
    const state = getState();
    libPath = path.toPosixPath(libPath); // 统一使用 posix 路径

    try {
      const libModel = await libraryStore.createLibrary(libPath)

      const libMeta: LibMeta = {
        id: libModel.meta.id,
        name: libModel.meta.name,
        description: libModel.meta.description || '',
        createdAt: libModel.meta.createdAt,
        updatedAt: libModel.meta.updatedAt,
      }

      if (!libPath || typeof libPath !== 'string')
        return thunkAPI.rejectWithValue('Cancelled')

      return { libMeta, libPath }
    } catch (error) {
      Logger.error('libSlice', 'Invalid parameters for createLibraryAsync:', error)
      return thunkAPI.rejectWithValue(`Failed to create library: ${error}`)
    }
  }
)

export const openLibraryAsync = createAsyncThunk(
  'library/open',
  async ({ libPath }: { libPath: string }, thunkAPI) => {
    const state = getState();
    libPath = path.toPosixPath(libPath); // 统一使用 posix 路径

    try {
      const libModel = await libraryStore.loadLibrary(libPath)

      const libMeta: LibMeta = {
        id: libModel.meta.id,
        name: libModel.meta.name,
        description: libModel.meta.description || '',
        createdAt: libModel.meta.createdAt,
        updatedAt: libModel.meta.updatedAt,        
      }

      // 挂载资源路径 /kb/{libName}/ 到实际路径 - removed (no longer needed)

      return { libMeta, libPath }
    } catch (error) {
      Logger.error('libSlice', 'Open library failed:', error)
      return thunkAPI.rejectWithValue(`Failed to open library: ${error}`)
    }
  }
)

export const closeLibraryAsync = createAsyncThunk(
  'library/close',
  async ({ libId }: { libId: string }, thunkAPI) => {
    if (!libId) {
      Logger.warn('libSlice', 'No library to close')
      return {}
    }

    const state = getState();
    const lib = state.lib.libs[libId]!;

    try {
      if (lib._dirty) {
        // 在关闭前询问用户是否保存
        const result = await dialog.confirm({
          title: 'Save library before close',
          message: 'The library has unsaved changes. \nDo you want to save it before closing?',
          buttons: [ { label: 'Save & Close', value: 'Save' }, { label: 'Close without Saving', value: 'Discard' }, { label: 'Cancel', value: 'Cancel', isPrimary: true } ]
        });
        if (result === 'Save') {
          const libPath = lib.libPath!;
          await thunkAPI.dispatch(saveLibraryAsync({ libId })).unwrap()
        } else if (result === 'Cancel') {
          return thunkAPI.rejectWithValue('Cancelled')
        }
        // 如果选择“直接关闭”，什么都不做，直接关闭
      }

      Logger.info('libSlice', 'Closing library:', libId)
      thunkAPI.dispatch(tabActions.closeTabs({ ignorePinned: true }));
      libraryStore.removeLibrary(libId)

      return { libId }
    } catch (error) {
      if (error === 'Cancelled')
        return thunkAPI.rejectWithValue('Cancelled')
      Logger.error('libSlice', 'Failed to save library before closing:', error)
      return thunkAPI.rejectWithValue({ libId, error: `Failed to close library: ${error}` })
    }
  }
)

export const saveLibraryAsync = createAsyncThunk(
  'library/save',
  async ({ libId }: { libId: string }, thunkAPI) => {
    Logger.debug('libSlice', 'Saving library:', libId)
    
    try {
      await libraryStore.saveLibrary(libId)
      return { libId }
    } catch (error) {
      Logger.error('libSlice', 'Failed to save library:', error)
      return thunkAPI.rejectWithValue({ libId, error: `Failed to save library: ${error}` } )
    }
  }
)

export function buildExtraReducers(builder: ActionReducerMapBuilder<LibState>) {
  builder  
  // createLibraryAsync
    .addCase(createLibraryAsync.pending, (state, action) => {
      // nothing to do
    })
    .addCase(createLibraryAsync.fulfilled, (state, action) => {
      const { libMeta, libPath } = action.payload;

      // 新建一个 Library 对象, 加入 state.libs
      const lib: Library = {
        meta: libMeta,
        libPath,
        _dirty: false,
        status: 'ready',
      }

      state.libs[libMeta.id] = lib;
      Logger.info('libSlice', `Library created successfully: ${libMeta.id} at path: ${libPath}`);

      // Start watching the library directory for file system changes
      window.fsWatch?.watch(libPath)
    })
    .addCase(createLibraryAsync.rejected, (state, action) => {
      // nothing to do
    })
  // openLibraryAsync
    .addCase(openLibraryAsync.pending, (state, action) => {
      // nothing to do
    })
    .addCase(openLibraryAsync.fulfilled, (state, action) => {
      const { libMeta, libPath } = action.payload;

      // 新建一个 Library 对象, 加入 state.libs
      const lib: Library = {
        meta: libMeta,
        libPath,
        _dirty: false,
        status: 'ready',
      }

      state.libs[libMeta.id] = lib; // add or update
      Logger.info('libSlice', `Library opened successfully: ${libMeta.id} at path: ${libPath}`);

      // Start watching the library directory for file system changes
      window.fsWatch?.watch(libPath)
    })
    .addCase(openLibraryAsync.rejected, (state, action) => {
      // nothing to do
    })
  // closeLibraryAsync
    .addCase(closeLibraryAsync.pending, (state, action) => {
      // nothing to do
    })
    .addCase(closeLibraryAsync.fulfilled, (state, action) => {
      const { libId } = action.payload;
      const lib = state.libs[libId!];
      // Stop watching the library directory
      if (lib?.libPath) {
        window.fsWatch?.unwatch(lib.libPath)
      }
      delete state.libs[libId!];
      Logger.info('libSlice', `Library closed successfully: ${libId}`);
    })
    .addCase(closeLibraryAsync.rejected, (state, action) => {
      // nothing to do
    })
  // saveLibraryAsync
    .addCase(saveLibraryAsync.pending, (state, action) => {
      // nothing to do
    })
    .addCase(saveLibraryAsync.fulfilled, (state, action) => {
      const { libId } = action.payload;
      const lib = state.libs[libId]!;
      lib._dirty = false
      lib.meta!.updatedAt = Date.now() // 更新更新时间  （NOTE 注意这个没有更新到 libraryStore里）
      lib.status = 'ready'
      lib._error = undefined
      Logger.info('libSlice', 'Library saved successfully:', lib.meta!.id);
    })
    .addCase(saveLibraryAsync.rejected, (state, action) => {
      const { libId, libPath, error } = action.payload as { libId: string, libPath: string, error: string };
      const lib = state.libs[libId]!;
      lib._dirty = true
      lib.status = 'ready'    // 保存失败后恢复到 ready 状态
      lib._error = error
    })
}
