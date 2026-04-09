import { Logger, Assert } from '@lib/logast.js'
import { k18 } from '@lib/i18n.js';

import { defineCommand, defineCommandGroup } from '@commands/registry.js';
import { getAppDispatch, getState } from '@state/storeHolder.js';

import { saveLibraryAsync } from '@state/slices/lib/extraReducers.js';
import { addLibraryAndTreeAsync, createLibraryAndTreeAsync, refreshAllLibrariesAndTreesAsync, refreshLibraryAndTreeAsync, removeLibraryAndTreeAsync } from '@state/slices/workspace/extraReducers.js';
import { treeActions } from '@state/slices/tree/slice.js';
import { workspaceActions } from '@state/slices/workspace/slice.js';

defineCommandGroup({
  id: 'workspace',
  title: k18('commands.workspace.title'),
  commands: []
});

// Define commands for workspace operations

defineCommand<{void}>({
  id: 'workspace/createLibrary',
  group: 'workspace',
  title: k18('commands.workspace.commands.createLibrary'),
  description: k18('commands.workspace.commands.createLibraryDesc'),
  shortcut: 'Mod+Alt+N',
  async run(args) {
    const dispatch = getAppDispatch();
    await dispatch(createLibraryAndTreeAsync());
  }
});

// Open an existing library (没有path时会弹出文件选择对话框)
defineCommand<{ libPath?: string }>({
  id: 'workspace/addLibrary',
  group: 'workspace',
  title: k18('commands.workspace.commands.addLibrary'),
  description: k18('commands.workspace.commands.addLibraryDesc'),
  shortcut: 'Mod+Alt+O',
  async run(args) {
    const { libPath } = args;
    const dispatch = getAppDispatch();
    await dispatch(addLibraryAndTreeAsync({ libPath }));
  }
});

defineCommand<{ treeId?: string }>({
  id: 'workspace/saveLibrary',
  group: 'workspace',
  title: k18('commands.workspace.commands.saveLibrary'),
  description: k18('commands.workspace.commands.saveLibraryDesc'),
  shortcut: 'Mod+Alt+S',
  async run(args) {
    const state = getState();
    const libId = args.treeId || state.tree.activeTreeId; 
    if (!libId) {
      Logger.warn('No active library to save');
      return;
    }

    const lib = state.lib.libs[libId]!;
    const dispatch = getAppDispatch();
    await dispatch(saveLibraryAsync({ libId }));
  }
});

defineCommand<{ treeId?: string }>({
  id: 'workspace/refreshLibrary',
  group: 'workspace',
  title: k18('commands.workspace.commands.refreshLibrary'),
  description: k18('commands.workspace.commands.refreshLibraryDesc'),
  async run(args) {
    const libId = args.treeId ?? getState().tree.activeTreeId;
    if (!libId) {
      Logger.warn('No active library to refresh');
      return;
    }

    const dispatch = getAppDispatch();
    await dispatch(refreshLibraryAndTreeAsync({ libId }));
  }
});

defineCommand<{ treeId?: string }>({
  id: 'workspace/removeLibrary',
  group: 'workspace',
  title: k18('commands.workspace.commands.removeLibrary'),
  description: k18('commands.workspace.commands.removeLibraryDesc') ,
  async run(args) {
    const libId = args.treeId ?? getState().tree.activeTreeId;
    if (!libId) {
      Logger.warn('No active library to close');
      return;
    }

    const dispatch = getAppDispatch();
    await dispatch(removeLibraryAndTreeAsync({ libId }));
  }
});

defineCommand<{void}>({
  id: 'workspace/refreshAllLibraries',
  group: 'workspace',
  title: k18('commands.workspace.commands.refreshAllLibraries'),
  description: k18('commands.workspace.commands.refreshAllLibrariesDesc'),
  async run(args) {
    const dispatch = getAppDispatch();
    await dispatch(refreshAllLibrariesAndTreesAsync());
  }
});

defineCommand<{ fromIndex: number; toIndex: number }>({
  id: 'workspace/moveLibraryPosition',
  group: 'workspace',
  title: k18('commands.workspace.commands.moveLibraryPosition'),
  description: k18('commands.workspace.commands.moveLibraryPositionDesc'),
  async run(args) {
    let { fromIndex, toIndex } = args;

    const state = getState();
    const count = state.workspace.libPaths.length;
    fromIndex = Math.max(0, Math.min(fromIndex, count - 1));
    toIndex = Math.max(0, Math.min(toIndex, count - 1));  

    if (fromIndex === toIndex) 
      return;

    const dispatch = getAppDispatch();
    dispatch(workspaceActions.moveLibraryPosition({ fromIndex, toIndex }));
    dispatch(treeActions.moveTreePosition({ fromIndex, toIndex }));
  }
});
