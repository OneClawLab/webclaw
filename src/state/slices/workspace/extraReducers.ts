// extraReducers.ts 的 通用写法：
//
// 每个 async action 分两部分：
// 1. createAsyncThunk 里可以写任何重型代码(同步或异步)，但不能改 Redux State。
//   a) 可以调用别的 普通 action: thunkAPI.dispatch(someAction(...))
//   b) 可以调用别的 async action: await thunkAPI.dispatch(someAsyncAction(...)).unwrap()
//   c) 成功时通过 return 把结果数据传递给后面的 buildExtraReducers 处理。
//   d) 取消时通过 thunkAPI.rejectWithValue(...) 来拒绝，
//      这时会触发 buildExtraReducers 里的 rejected case。
//      注意：rejectWithValue 传递的值会被放到 action.payload 里。

import { t } from '@lib/i18n.js'
//   e) 失败时抛出异常，会被自动 catch 并触发 rejected case，
//      但异常信息不会被放到 action.payload 里。
//      建议主动捕获异常，然后主动 rejectWithValue 传递出需要的错误信息
// 2. buildExtraReducers 里三种 case 处理，可以改 Redux State，但不能做重型操作。
//    一般均有三种状态：pending/fulfilled/rejected。 
//    其中 fulfilled 里可以通过 action.payload 访问到 createAsyncThunk 里 return 的数据，
//    或者 rejected 里 可以通过 action.payload 访问到 rejectWithValue 传递的错误信息。

import { Logger } from '@lib/logast.js'
import { createAsyncThunk, type ActionReducerMapBuilder } from '@reduxjs/toolkit'
import { getState } from '@state/storeHolder.js'
import { WorkspaceState } from './types.js'
import { treeActions } from '../tree/slice.js'
import { closeLibraryAsync, createLibraryAsync, openLibraryAsync } from '../lib/extraReducers.js'
import { TreeHeader } from '../tree/types.js'
import { TreeUtils } from '../tree/utils.js'
import { libraryStore } from '@library/LibraryStore.js'
import { path } from '@lib/path.js'

// export const doSomethingAsync = createAsyncThunk(
//   'demo/do/something',
//   async (_: void, thunkAPI) => {
//     const state = getState();
//     try{
//       await thunkAPI.dispatch(doSomethingAsync()).unwrap()
//     } catch (error) {
//       if (error === 'Cancelled')
//         return thunkAPI.rejectWithValue('Cancelled')
//       return thunkAPI.rejectWithValue(`${error}`)
//     }

//     await thunkAPI.dispatch(xxxActions.someAction());

//     return { ... }  // 返回结果会传递给 buildExtraReducers 里的 fulfilled case
//   }
// )

export const createLibraryAndTreeAsync = createAsyncThunk(
  'workspace/createLibraryAndTree',
  async (_, thunkAPI) => {
    let libPath = await window.ui.selectDirectoryToSave({
      title: 'Save Library',
      defaultPath: '', // window.app.getDefaultLibraryPath(),
    })

    if (!libPath) {
      thunkAPI.rejectWithValue('User cancelled directory selection')
      return
    }

    libPath = path.toPosixPath(libPath); // 统一使用 posix 路径

    const { libMeta } = await thunkAPI.dispatch(createLibraryAsync({ libPath })).unwrap();

    const header: TreeHeader = { id: libMeta.id!, name: libMeta.name!, expanded: true };
    const nodes = await TreeUtils.loadChildren(libPath, null, true);
    thunkAPI.dispatch(treeActions.addTree({ header, nodes }));

    return { libMeta, libPath, header, nodes };
  }
);

export const addLibraryAndTreeAsync = createAsyncThunk(
  'workspace/addLibraryAndTree',
  async ({ libPath }: { libPath?: string }, thunkAPI) => {
    // 如果没有提供路径，则调用打开文件对话框让用户选择
    if (!libPath) {
      const defaultPath: string = '';  // window.app.getDefaultLibraryPath();
      const filePaths = await window.ui.openDirectory({
        title: 'Open Library', allowMultiple: false, defaultPath,
      });

      if (!filePaths || filePaths.length === 0)
        return thunkAPI.rejectWithValue('Cancelled')
      libPath = filePaths[0]
    }
    libPath = path.toPosixPath(libPath); // 统一使用 posix 路径

    // 打开 Library
    const { libMeta } = await thunkAPI.dispatch(openLibraryAsync({ libPath })).unwrap();

    // 加载对应的 Tree
    const libId = libMeta.id!;
    const nodes = await libraryStore.loadTreeNodes(libId);
    const header: TreeHeader = { id: libId, name: libMeta.name!, expanded: true };
    thunkAPI.dispatch(treeActions.addTree({ header, nodes }));

    return { libMeta, libPath, header, nodes };
  }
);

export const removeLibraryAndTreeAsync = createAsyncThunk(
  'workspace/removeLibraryAndTree',
  async ({ libId } : { libId: string }, thunkAPI) => {
    const state = getState();
    const lib = state.lib.libs[libId];
    if (!lib)
      return thunkAPI.rejectWithValue(`Library not found: ${libId}`);

    await thunkAPI.dispatch(closeLibraryAsync({ libId })).unwrap();
    const treeId = libId; // treeId 就是 libId
    thunkAPI.dispatch(treeActions.removeTree({ treeId }));

    return { libId, libPath: lib.libPath!  };
  }
)

export const refreshLibraryAndTreeAsync = createAsyncThunk(
  'workspace/refreshLibraryAndTree',
  async ({ libId }: { libId: string }, thunkAPI) => {
    try {
      const state = getState();
      const lib = state.lib.libs[libId];
      if (!lib) {
        return thunkAPI.rejectWithValue(`Library not found: ${libId}`);
      }
      const filePath = lib.libPath!;
      if (!filePath) {
        return thunkAPI.rejectWithValue(t('errors.validation.libraryPathEmpty', { libId }));
      }

      const tree = state.tree.trees.find(t => t.header.id === libId);
      if (!tree) {
        return thunkAPI.rejectWithValue(`No tree found for library ID: ${libId}`);
      }

      // 打开 Library
      const { libMeta } = await thunkAPI.dispatch(openLibraryAsync({ libPath: filePath })).unwrap();

      // 加载对应的 Tree
      const nodes = await libraryStore.loadTreeNodes(libId);
      const header: TreeHeader = { ...tree.header, name: libMeta.name! };
      thunkAPI.dispatch(treeActions.addTree({ header, nodes }));

      return { libId }
    } catch (error) {
      Logger.error('libSlice', 'Refresh tree failed:', error)
      return thunkAPI.rejectWithValue(`Failed to refresh tree: ${error}`)
    }
  }
);

// 根据 当前 workspace 的 libPaths 刷新所有 Library 和 Tree。
// 使 libSlice/treeSlice 的状态和 workspace 保持一致。
export const refreshAllLibrariesAndTreesAsync = createAsyncThunk(
  'workspace/refreshAllLibrariesAndTrees',
  async (_, thunkAPI) => {
    try {
      const libPaths = getState().workspace.libPaths;

      // 添加或刷新现有的 Library 和 Tree
      for (const libPath of libPaths) {
        // libs 并不会持久化，因此启动时始终是空的，但运行期间 refresh 时是有值的。
        // 鉴于下面可能对其添加删除，因此每次都重新获取最新的 libs。
        const libs = getState().lib.libs;
        // 查找是否已有对应的 Library
        const lib = Object.values(libs).find(l => l.libPath === libPath);
        // 如果没有则添加新的 Library 和 (添加或更新) Tree
        if (!lib)
          await thunkAPI.dispatch(addLibraryAndTreeAsync({ libPath })).unwrap();
        // 否则刷新已有的 Library 和 Tree
        else {
          const libId = lib.meta!.id!;
          await thunkAPI.dispatch(refreshLibraryAndTreeAsync({ libId })).unwrap();
        }
      }

      // 删除那些没有对应路径的 Library 和 Tree
      const libs = getState().lib.libs; // 再次获取最新的 libs
      for (const libId in libs) {
        const lib = libs[libId]!;
        if (!libPaths.includes(lib.libPath!)) {
          // 关闭 Library
          await thunkAPI.dispatch(closeLibraryAsync({ libId })).unwrap();
          // 删除对应的 Tree
          thunkAPI.dispatch(treeActions.removeTree({ treeId: libId }));
        }
      }
      // 删除那些没有对应 Library 的 Tree
      const treeIds = getState().tree.trees.map(t => t.header.id);
      for (const treeId of treeIds) {
        const lib = Object.values(libs).find(l => l.meta!.id === treeId);
        if (!lib) {
          // 删除对应的 Tree
          thunkAPI.dispatch(treeActions.removeTree({ treeId }));
        }
      }

      return {};
    } catch (error) {
      Logger.error('libSlice', 'Refresh all libraries and trees failed:', error)
      return thunkAPI.rejectWithValue(`Failed to refresh all libraries and trees: ${error}`)
    }
  }
);

export function buildExtraReducers(builder: ActionReducerMapBuilder<WorkspaceState>) {
  builder  
  // createLibraryAndTree
    .addCase(createLibraryAndTreeAsync.pending, (state, action) => {
      // nothing to do
    })
    .addCase(createLibraryAndTreeAsync.fulfilled, (state, action) => {
      const { libPath } = action.payload!
      if (!state.libPaths.includes(libPath!))
        state.libPaths.push(libPath);
    })
    .addCase(createLibraryAndTreeAsync.rejected, (state, action) => {
      const error = action.payload as string
      // nothing to do
    })
  // addLibraryAndTree
    .addCase(addLibraryAndTreeAsync.pending, (state, action) => {
      // nothing to do
    })
    .addCase(addLibraryAndTreeAsync.fulfilled, (state, action) => {
      const { libPath } = action.payload!
      if (!state.libPaths.includes(libPath!))
        state.libPaths.push(libPath!);
    })
    .addCase(addLibraryAndTreeAsync.rejected, (state, action) => {
      const error = action.payload as string
      // nothing to do
    })
  // removeLibraryAndTree
    .addCase(removeLibraryAndTreeAsync.pending, (state, action) => {
      // nothing to do
    })
    .addCase(removeLibraryAndTreeAsync.fulfilled, (state, action) => {
      const { libPath } = action.payload!
      let index: number
      while((index = state.libPaths.indexOf(libPath)) >= 0)
        state.libPaths.splice(index, 1);
    })
    .addCase(removeLibraryAndTreeAsync.rejected, (state, action) => {
      const error = action.payload as string
      // nothing to do
    })
  // refreshLibraryAndTree
    .addCase(refreshLibraryAndTreeAsync.pending, (state, action) => {
      // nothing to do
    })
    .addCase(refreshLibraryAndTreeAsync.fulfilled, (state, action) => {
      // nothing to do
    })
    .addCase(refreshLibraryAndTreeAsync.rejected, (state, action) => {
      const error = action.payload as string
      // nothing to do
    })    
}
