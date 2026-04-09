import { Logger, Assert } from '@lib/logast.js'
import { t } from '@lib/i18n.js'

import { createAsyncThunk } from '@reduxjs/toolkit'
import type { ActionReducerMapBuilder } from '@reduxjs/toolkit'

import { libraryStore } from '@library/LibraryStore.js'
import { getState } from '@state/storeHolder.js'
import { treeActions } from './slice.js'
import { TreeUtils } from './utils.js'
import { TreeNode, TreeStates } from './types.js'
import { dialog } from '@lib/renderer/dialog.js'
import { Tab } from '@state/slices/tab/types.js'
import { path } from '@lib/path.js'
import { tabActions } from '../tab/slice.js'
import { DocUtils } from '../doc/utils.js'
import { LibraryDoc } from '../doc/types.js'
import { theDocManager } from '@editor/DocManager.js'
import { docActions } from '../doc/slice.js'

// 目前这里只包括 异步操作，和 reducers 的相关操作配合使用
export const commitCreateTreeNodeAsync = createAsyncThunk(
  'tree/node/new/commit',
  async ({ treeId, parentId, isFolder, oldId, newName }: { treeId: string, parentId: string, isFolder: boolean, oldId: string, newName: string }, thunkAPI) => {
    Logger.debug('tree', `commitCreateTreeNodeAsync: treeId=${treeId}, parentId=${parentId}, isFolder=${isFolder}, oldId=${oldId}, newName=${newName}`);

    const libId = treeId; // treeId 就是 libId
    const state = getState();
    const lib = state.lib.libs[libId]!;

    // 创建实际的文件或目录, 要以新的名称创建
    const newId = path.join(parentId, newName);
    const docPath = path.join(lib.libPath!, newId);
    isFolder ? await window.fs.ensureDir(docPath) : await window.fs.ensureFile(docPath);

    return { treeId, parentId, isFolder, oldId, newId, newName, docPath };
  }
)

export const commitRenameTreeNodeAsync = createAsyncThunk(
  'tree/node/rename/commit',
  async ({ treeId, parentId, isFolder, oldId, newName }: { treeId: string, parentId: string, isFolder: boolean, oldId: string, newName: string }, thunkAPI) => {
    Logger.debug('tree', `commitRenameTreeNodeAsync: treeId=${treeId}, parentId=${parentId}, isFolder=${isFolder}, oldId=${oldId}, newName=${newName}`);

    const state = getState();
    const libId = treeId; // treeId 就是 libId
    const lib = state.lib.libs[libId]!;

    const oldPath = path.join(lib.libPath!, oldId);
    const newId = path.join(path.dirname(oldId), newName);
    const newPath = path.join(lib.libPath!, newId);

    // 重命名实际的文件或目录
    await window.fs.rename(oldPath, newPath);

    // 更新 theDocManager/docSlice/tabSlice 中对应的 docId。
    //   theDocManager: 管理了已打开的 docId -> EditorView 映射
    //   docSlice: 管理了 docId -> Doc 映射
    //   tabSlice: 管理了 tabId -> docId 映射
    // 注意：这里只处理被重命名的节点及其子节点，其他节点不受影响
    {
      const invalidDocs: { oldDocId: string, newDocId: string }[] = [];

      const docs = state.doc.docs;
      Object.values(docs).forEach((doc) => {
        // 这里只检查 LibraryDocs，因为 tree 目前只管理 library 下的文件
        if (DocUtils.docOrigin(DocUtils.docId(doc)) !== 'library') return;
        const libDoc = doc as LibraryDoc;
        if (libDoc.docId.startsWith(oldId)) {
          const postfix = libDoc.docId.substring(oldId.length);
          const newDocId = newId + postfix;

          const oldAbsDocId = DocUtils.makeDocId('library', { libId, docId: libDoc.docId } );
          const newAbsDocId = DocUtils.makeDocId('library', { libId, docId: newDocId } );

          invalidDocs.push({ oldDocId: oldAbsDocId, newDocId: newAbsDocId });
        }
      });

      invalidDocs.forEach(({ oldDocId, newDocId }) => {
        theDocManager.updateDocId(oldDocId, newDocId);
        const oldDoc = DocUtils.getDocById(oldDocId);
        const newDoc = DocUtils.changeLibraryDocId(oldDoc as LibraryDoc, newDocId);
        thunkAPI.dispatch(docActions.updateDoc({ docId: oldDocId, doc: newDoc }));
        thunkAPI.dispatch(tabActions.updateTabsDocId({ oldDocId, newDocId }));
      });
    }

    // TreeState 的更新在 reducer 阶段去做
    return { treeId, parentId, isFolder, oldId, newId, newName, oldPath, newPath };
  }
)

export const deleteTreeNodesAsync = createAsyncThunk(
  'tree/node/delete',
  async ({ treeId, nodeIds }: { treeId: string, nodeIds: string[] }, thunkAPI) => {
    if (nodeIds.length === 0)
      return thunkAPI.rejectWithValue('No nodes to delete');

    // 弹出对话框让用户确认
    const result = await dialog.confirm({
      title: t('errors.general.deleteConfirmationTitle'),
      message: t('errors.general.deleteConfirmationMessage', { count: nodeIds.length }),
      buttons: [ 
        { label: t('errors.general.deleteButton'), value: 'Delete' }, 
        { label: t('errors.general.cancelButton'), value: 'Cancel' } 
      ]
    });
    if (!result || result === 'Cancel') {
      Logger.debug('tree', 'User cancelled delete operation');
      return thunkAPI.rejectWithValue('User cancelled');
    }

    Logger.debug('tree', `deleteTreeNodesAsync: ${nodeIds.length} nodes`);

    const state = getState();
    const libId = treeId; // treeId 就是 libId
    const lib = state.lib.libs[libId]!;
    const tree = state.tree.trees.find(t => t.header.id === treeId)!;

    // 删除实际的文档或目录, 以及每个文档 相关联的 Chat Memory
    try {
      TreeUtils.walkTreeBFS(tree.nodes, (node) => {
        if (nodeIds.includes(node.id)) {
          if (node.isFolder) 
            libraryStore.deleteFolder(libId, node.id);
          else {
            libraryStore.deleteDocument(libId, node.id);
          }
        }
      });
    } catch (error) {
      Logger.error('tree', 'Delete nodes failed:', error);
      return thunkAPI.rejectWithValue(`Failed to delete nodes: ${error}`);
    }

    // 找到下一个邻近的可见节点，删除后会选中之
    const nextAdjacentVisibleNodeId = TreeUtils.findNextVisibleAdjacentNodeId(tree.nodes, nodeIds);

    // 从 state.tree.nodes 中移除这些节点
    let newNodes: TreeNode[] = tree.nodes;
    nodeIds.forEach((nodeId) => {
      // 排除掉被删除的节点及其子节点
      newNodes = TreeUtils.exclude(newNodes, (node) => node.id.startsWith(nodeId));
    });
    thunkAPI.dispatch(treeActions.setNodes({ header: tree.header, nodes: newNodes }));

    // 关闭已删除文档对应的所有已打开Tabs
    const invalidTabs: Tab[] = [];
    nodeIds.map((nodeId) => {
      // 注：子目录下的文档也都被删除了，因此对应的Tab也要被关闭
      // 这里只检查 LibraryDocs，因为 tree 目前只管理 library 下的文件
      const tabs = state.tab.tabs.filter((tab) => {
        if (DocUtils.docOrigin(tab.docId) !== 'library') return false;
        const doc = DocUtils.getDocById(tab.docId) as LibraryDoc;
        return doc?.docId.startsWith(nodeId) ?? false;
      });
      invalidTabs.push(...tabs);
    });
    invalidTabs.forEach((tab) =>
      thunkAPI.dispatch(tabActions.closeTab({ tabId: tab.id! })) );

    // 选中的节点都被删除了，清空 现有的 selectedNodeIds，然后选中下一个邻近的可见节点（如果有的话）
    thunkAPI.dispatch(treeActions.setSelectedNodeIds({ treeId, nodeIds: [] }));
    if (nextAdjacentVisibleNodeId)
      thunkAPI.dispatch(treeActions.setSelectedNodeIds({ treeId, nodeIds: [ nextAdjacentVisibleNodeId ] }));

    return { treeId, deletedIds: nodeIds };
  }
)

export function buildExtraReducers(builder: ActionReducerMapBuilder<TreeStates>) {
  builder  
  // deleteTreeNodesAsync
    .addCase(deleteTreeNodesAsync.pending, (state, action) => {
    })
    .addCase(deleteTreeNodesAsync.fulfilled, (state, action) => {
    })
    .addCase(deleteTreeNodesAsync.rejected, (state, action) => {
    })
  // addNewTreeNodeAsync
    .addCase(commitCreateTreeNodeAsync.pending, (state, action) => {
    })
    .addCase(commitCreateTreeNodeAsync.fulfilled, (state, action) => {
      const { treeId, parentId, isFolder, oldId, newId, newName, docPath } = action.payload;

      const newNode: TreeNode = {
        parentId,
        name: newName,
        id: newId,
        isFolder,
        unsaved: false,  // **标记为已保存**
      };

      const tree = state.trees.find(t => t.header.id === treeId)!;
      Assert.notNull(tree, 'Tree not found during create node');

      // 把TreeView里的临时节点替换为正式节点
      const newTreeNodes = TreeUtils.replaceNode(tree.nodes, oldId, newNode);

      // 更新 TreeState，同时选中新创建的节点
      const newTree = { ...tree, nodes: newTreeNodes, _editState: undefined, selectedNodeIds: [newId] };
      state.trees = state.trees.map(t => (t.header.id === treeId) ? newTree : t);
    })
    .addCase(commitCreateTreeNodeAsync.rejected, (state, action) => {
      // 啥也不要干，还会保留在编辑状态
    })
  // renameTreeNodeAsync
    .addCase(commitRenameTreeNodeAsync.pending, (state, action) => {
    })
    .addCase(commitRenameTreeNodeAsync.fulfilled, (state, action) => {
      const { treeId, parentId, isFolder, oldId, newId, newName, oldPath, newPath } = action.payload;

      const tree = state.trees.find(t => t.header.id === treeId)!;
      Assert.notNull(tree, 'Tree not found during create node');

      const node = TreeUtils.findById(tree.nodes, oldId)!;
      Assert.notNull(node, 'Node not found during rename');

      // 更新 node 和其所有子节点的 ID (和 name)
      const newTreeNodes = TreeUtils.updateNodeId(tree.nodes, oldId, newId);

      // 更新 TreeState，同时选中重命名后的节点
      const newTree = { ...tree, nodes: newTreeNodes, _editState: undefined, selectedNodeIds: [newId] };
      state.trees = state.trees.map(t => (t.header.id === treeId) ? newTree : t);

      // 更新 treeSlice 里的 focusedNodeId 和 selectedNodeIds
      if (tree.focusedNodeId === oldId)
        tree.focusedNodeId = newId;
      if (tree.selectedNodeIds.includes(oldId)) {
        tree.selectedNodeIds = tree.selectedNodeIds.filter(id => id !== oldId);
        tree.selectedNodeIds.push(newId);
      }

    })
    .addCase(commitRenameTreeNodeAsync.rejected, (state, action) => {
      // 啥也不要干，还会保留在编辑状态
    });
}
