import { Logger, Assert } from '@lib/logast.js'
import type { PayloadAction } from '@reduxjs/toolkit'
import { Draft } from 'immer'
import { TreeEditState, TreeHeader, TreeNode, TreeStates, TreeState } from './types.js'
import { TreeUtils }  from './utils.js'
import { theViewManager } from '@view/index.js'

const addTree = (state: Draft<TreeStates>, action: PayloadAction<{ header: TreeHeader, nodes: TreeNode[] }>) => {
  const newHeader = action.payload.header;
  const newNodes = action.payload.nodes;

  const existingTree = state.trees.find(t => t.header.id === newHeader.id)!;

  if (existingTree) {
    Logger.debug('treeSlice', 'addTree: tree with id already exists, updating nodes instead', newHeader.id);

    const reusedNodes = TreeUtils.reuseMerge(existingTree.nodes, newNodes);
    if (reusedNodes === existingTree.nodes && newHeader.name === existingTree.header.name)
      return; // 节点和名称都没有变化，不更新 state

    const newTree = { ...existingTree, header: newHeader, nodes: reusedNodes };
    state.trees = state.trees.map(t => (t.header.id === newHeader.id) ? newTree : t);
  } else {
    Logger.debug('treeSlice', 'addTree: creating new tree with id', newHeader.id);

    const newTree = { header: newHeader, nodes: newNodes,
      filter: '', focusedNodeId: undefined, selectedNodeIds: [], _editState: undefined };
    state.trees = [...state.trees, newTree];
  }

  // 如果没有 activeTreeId，则设置为新添加的 Tree
  if (!state.activeTreeId)
    state.activeTreeId = newHeader.id;
};

const removeTree = (state: Draft<TreeStates>, action: PayloadAction<{ treeId: string }>) => {
  const treeId = action.payload.treeId;
  Logger.debug('treeSlice', 'removeTree: removing tree with id', treeId);
  state.trees = state.trees.filter(t => t.header.id !== treeId);

  // 如果被删除的 Tree 是当前活动的 Tree，则清除 activeTreeId
  if (state.activeTreeId === treeId)
    state.activeTreeId = undefined;
};

const setNodes = (state: Draft<TreeStates>, action: PayloadAction<{ header: TreeHeader, nodes: TreeNode[] }>) => {
  const newHeader = action.payload.header;
  const newNodes = action.payload.nodes;
  const treeId = newHeader.id;

  Logger.debug('treeSlice', 'setNodes: updating tree nodes');
  let tree = state.trees.find(t => t.header.id === treeId);

  // 如果没有找到对应的 Tree，则创建一个新的 Tree
  if (!tree) {
    Logger.debug('treeSlice', 'setNodes: tree not found, creating new tree');
    tree = {
      header: newHeader,      
      nodes: newNodes,
      filter: '',
      focusedNodeId: undefined,
      selectedNodeIds: [],
      _editState: undefined
    }
    state.trees = [...state.trees, tree];
    return;
  }

  // 选择状态只存储节点ID，因此基本不需要处理，只把不存在的ID移除即可
  const computedNewSelectedNodeIds = tree.selectedNodeIds.filter(nodeId => {
    return !TreeUtils.findById(newNodes, nodeId);
  });
  // 如果有变化，长度肯定不一样，只有真的变了，才更新 state
  const newSelectedNodeIds = computedNewSelectedNodeIds.length !== tree.selectedNodeIds.length
    ? computedNewSelectedNodeIds : tree.selectedNodeIds;

  // 聚焦状态类似，也需要移除不存在的ID
  const newFocusedNodeId = 
    tree.focusedNodeId && TreeUtils.findById(newNodes, tree.focusedNodeId) 
    ? tree.focusedNodeId : undefined;

  const newTree = { ...tree, header: newHeader, nodes: newNodes, selectedNodeIds: newSelectedNodeIds, focusedNodeId: newFocusedNodeId };
  state.trees = state.trees.map(t => (t.header.id === treeId) ? newTree : t);
};

const setFilter = (state: Draft<TreeStates>, action: PayloadAction<{ treeId: string, filter: string }>) => {
  const { treeId, filter } = action.payload;
  const tree = state.trees.find(t => t.header.id === treeId);
  if (!tree) return;

  const newTree = { ...tree, filter };
  state.trees = state.trees.map(t => (t.header.id === treeId) ? newTree : t);
};


const moveTreePosition = (state: Draft<TreeStates>, action: PayloadAction<{ fromIndex: number, toIndex: number }>) => {
  const { fromIndex, toIndex } = action.payload;
  if (fromIndex < 0 || fromIndex >= state.trees.length || toIndex < 0 || toIndex >= state.trees.length) {
    Logger.warn('treeSlice', 'moveTreePosition: invalid indices', { fromIndex, toIndex });
    return;
  }
  const [movedTree] = state.trees.splice(fromIndex, 1);
  state.trees.splice(toIndex, 0, movedTree);
  Logger.debug('treeSlice', 'moveTreePosition: moved tree', { movedTreeId: movedTree.header.id, fromIndex, toIndex });
};

/// edit(rename/create) actions

// 让 TreeView 进入 指定节点的 重命名模式
const startRename = (state: Draft<TreeStates>, action: PayloadAction<{ treeId: string, nodeId: string }>) => {
  const { treeId, nodeId } = action.payload;
  const tree = state.trees.find(t => t.header.id === treeId);
  if (!tree) return;
  const node = TreeUtils.findById(tree.nodes, nodeId);
  if (!node) return;

  const newEditingState = {
    mode: 'rename',
    isFolder: node.isFolder,
    parentId: node.parentId,
    editingId: node.id,
    editingName: node.name,
    error: undefined
  } as TreeEditState;

  const newTree = { ...tree, _editState: newEditingState };
  state.trees = state.trees.map(t => (t.header.id === treeId) ? newTree : t);
}

// 让 TreeView 进入 在指定父节点下新建节点的 创建模式
const startCreate = (state: Draft<TreeStates>, action: PayloadAction<{ treeId: string, parentId: string, isFolder: boolean }>) => {
  const { treeId, parentId, isFolder } = action.payload;
  const tree = state.trees.find(t => t.header.id === treeId);
  if (!tree) return;
  
  // 生成一个临时的唯一 ID
  const newId = parentId + '/' + Date.now().toString();

  // TODO 可以自动生成一个不冲突的默认名称
  // const baseName = isFolder ? 'New Folder' : 'untitled.txt';
  // const parentNode = TreeUtils.findById(state.tree.nodes, parentId);
  // const siblings = parentNode?.children || state.tree.nodes;
  // const siblingNames = siblings.map(s => s.name);
  // const fileName = TreeUtils.getUniqueNameEx(siblingNames, isFolder, baseName);

  // 生成一个临时节点
  const newNode: TreeNode = {
    parentId,
    isFolder,
    id: newId,
    name: '',
    children: isFolder ? [] : undefined,
    unsaved: true,   // **标记为未保存的临时节点**
  };

  // 把临时节点插入树中，构造新的 immutable TreeNodes 数组 并更新 state
  const newTreeNodes = TreeUtils.insertChild(tree.nodes, parentId, newNode);

  // 设置 editState 进入 create 模式
  const newEditingState = {
    mode: 'create',
    isFolder,
    parentId,
    editingId: newNode.id,
    editingName: newNode.name,
    error: undefined
  } as TreeEditState;

  const newTree = { ...tree, nodes: newTreeNodes, _editState: newEditingState };
  state.trees = state.trees.map(t => (t.header.id === treeId) ? newTree : t);
}

// 编辑名称时，将输入的名称更新到 editState 中
const changeName = (state: Draft<TreeStates>, action: PayloadAction<{ treeId: string, value: string }>) => {  
  const { treeId, value } = action.payload;
  const tree = state.trees.find(t => t.header.id === treeId);
  if (!tree) return;
  if (!tree._editState) return;

  const newEditingState = { ...tree._editState!, editingName: value };
  const newTree = { ...tree, _editState: newEditingState };
  state.trees = state.trees.map(t => (t.header.id === treeId) ? newTree : t);
}

// 编辑名称时，将输入的检验错误信息更新到 editState 中
const setError = (state: Draft<TreeStates>, action: PayloadAction<{ treeId: string, error?: string }>) => {
  const { treeId, error } = action.payload;
  const tree = state.trees.find(t => t.header.id === treeId);
  if (!tree) return;
  if (!tree._editState) return;

  const newEditingState = { ...tree._editState!, error };
  const newTree = { ...tree, _editState: newEditingState };
  state.trees = state.trees.map(t => (t.header.id === treeId) ? newTree : t);
}

// 取消 rename 编辑状态
const cancelRename = (state: Draft<TreeStates>, action: PayloadAction<{ treeId: string }>) => {
  const { treeId } = action.payload;
  const tree = state.trees.find(t => t.header.id === treeId);
  if (!tree) return;
  tree._editState = undefined;
}

// 取消 create 编辑状态，删除临时节点
const cancelCreate = (state: Draft<TreeStates>, action: PayloadAction<{ treeId: string }>) => {
  const { treeId } = action.payload;
  const tree = state.trees.find(t => t.header.id === treeId);
  if (!tree) return;

  // 有临时节点的话，删除它
  if (tree._editState) {
    const tempNodeId = tree._editState.editingId!;
    // 从树中移除临时节点
    const newTreeNodes = TreeUtils.exclude(tree.nodes, (node) => node.id === tempNodeId);
    tree.nodes = newTreeNodes;
  }
  tree._editState = undefined;
}

// tree navigation actions

// 一路展开直到指定节点
const expandPathToNode = (state: Draft<TreeStates>, action: PayloadAction<{ treeId: string, nodeId: string }>) => {
  const { treeId, nodeId } = action.payload;  
  _expandPathToNode(state, treeId, nodeId);
};

const setFocusedNodeId = (state: Draft<TreeStates>, action: PayloadAction<{ treeId: string, nodeId?: string, expandTo: boolean, makeVisible: boolean }>) => {
  const { treeId, nodeId, expandTo, makeVisible } = action.payload;
  _setFocusedNodeId(state, treeId, nodeId, expandTo, makeVisible);
};

const setSelectedNodeIds = (state: Draft<TreeStates>, action: PayloadAction<{ treeId:string, nodeIds: string[] }>) => {
  const { treeId, nodeIds } = action.payload;
  const tree = state.trees.find(t => t.header.id === treeId);
  if (!tree) return;
  tree.selectedNodeIds = nodeIds;
};

// 切换 Header 的展开/收起状态，其实也就是整棵树的展开/收起状态
const toggleHeaderExpand = (state: Draft<TreeStates>, action: PayloadAction<{ treeId: string }>) => {
  const { treeId } = action.payload;
  const tree = state.trees.find(t => t.header.id === treeId);
  if (!tree) return;
  tree.header.expanded = !tree.header.expanded;
};

const toggleExpand = (state: Draft<TreeStates>, action: PayloadAction<{ treeId: string, nodeIds: string[]}>) => {
  const { treeId, nodeIds } = action.payload;
  const tree = state.trees.find(t => t.header.id === treeId);
  if (!tree) return;

  for (const nodeId of nodeIds) {
    const node = TreeUtils.findById(tree.nodes, nodeId);
    if (!node || !node.isFolder) continue;
    node.isExpanded = !node.isExpanded;
  }
};

const navigateNext = (state: Draft<TreeStates>, action: PayloadAction<{ treeId: string }>) => {
  const treeId = action.payload.treeId;
  const tree = state.trees.find(t => t.header.id === treeId);
  if (!tree) return;

  const flatNodes = TreeUtils.flatten(tree.nodes, true);
  if (flatNodes.length === 0) return;

  let nextFocusId: string | undefined;

  const currentId = tree.focusedNodeId;
  if (!currentId)
    nextFocusId =  tree.selectedNodeIds[0] || flatNodes[0].id;
  else {
    const currentIndex = flatNodes.findIndex(node => node.id === currentId);
    if (currentIndex === -1) {
      // 当前聚焦节点不在列表中，聚焦第一个节点
      nextFocusId = flatNodes[0].id;
    } else if (currentIndex === flatNodes.length - 1) {
      // 已经是最后一个节点，保持不变
      nextFocusId = currentId;
    } else {
      const nextNode = flatNodes[currentIndex + 1];
      nextFocusId = nextNode.id;
    }
  }

  _setFocusedNodeId(state, treeId, nextFocusId, false, true);
};

const navigatePrev = (state: Draft<TreeStates>, action: PayloadAction<{ treeId: string }>) => {
  const treeId = action.payload.treeId;
  const tree = state.trees.find(t => t.header.id === treeId);
  if (!tree) return;

  const flatNodes = TreeUtils.flatten(tree.nodes, true);
  if (flatNodes.length === 0) return;

  let nextFocusId: string | undefined;

  const currentId = tree.focusedNodeId;
  if (!currentId) {
    nextFocusId = tree.selectedNodeIds?.at(-1) ?? flatNodes.at(-1)?.id;
  } else {
    const currentIndex = flatNodes.findIndex(node => node.id === currentId);
    if (currentIndex === -1) {
      // 当前聚焦节点不在列表中，聚焦最后一个节点
      nextFocusId = flatNodes[flatNodes.length - 1].id;
    } else if (currentIndex === 0) {
      // 已经是第一个节点，保持不变
      nextFocusId = currentId;
    } else { 
      const prevNode = flatNodes[currentIndex - 1];
      nextFocusId = prevNode.id;
    }
  }

  _setFocusedNodeId(state, treeId, nextFocusId, false, true);
};

const navigateFirst = (state: Draft<TreeStates>, action: PayloadAction<{ treeId: string }>) => {
  const treeId = action.payload.treeId;
  const tree = state.trees.find(t => t.header.id === treeId);
  if (!tree) return;

  const flatNodes = TreeUtils.flatten(tree.nodes, true);
  let nextFocusId: string | undefined;
  if (flatNodes.length > 0)
    nextFocusId = flatNodes[0].id;
  _setFocusedNodeId(state, treeId, nextFocusId, false, true);
};

const navigateLast = (state: Draft<TreeStates>, action: PayloadAction<{ treeId: string }>) => {
  const treeId = action.payload.treeId;
  const tree = state.trees.find(t => t.header.id === treeId);
  if (!tree) return;

  const flatNodes = TreeUtils.flatten(tree.nodes, true);
  let nextFocusId: string | undefined;
  if (flatNodes.length > 0)
    nextFocusId = flatNodes[flatNodes.length - 1].id;
  _setFocusedNodeId(state, treeId, nextFocusId, false, true);
};

const navigateLeft = (state: Draft<TreeStates>, action: PayloadAction<{ treeId: string }>) => {
  const treeId = action.payload.treeId;
  const tree = state.trees.find(t => t.header.id === treeId);
  if (!tree) return;

  let nextFocusId: string | undefined = tree.focusedNodeId;

  const currentId = tree.focusedNodeId;
  const currentNode = currentId && TreeUtils.findById(tree.nodes, currentId);

  if (!currentId || !currentNode)
    nextFocusId = tree.nodes.length > 0 ? tree.nodes[0].id : undefined;
  else {
    if (currentNode.isFolder && currentNode.isExpanded) {
      // 如果是展开的文件夹，收起它
      currentNode.isExpanded = false;
    } else {
      // 否则移动到父节点
      const parent = TreeUtils.findParent(tree.nodes, currentId);
      if (parent)
        nextFocusId = parent.id;
    }
  }

  _setFocusedNodeId(state, treeId, nextFocusId, false, true);
};

const navigateRight = (state: Draft<TreeStates>, action: PayloadAction<{ treeId: string }>) => {
  const treeId = action.payload.treeId;
  const tree = state.trees.find(t => t.header.id === treeId);
  if (!tree) return;

  let nextFocusId: string | undefined = tree.focusedNodeId;

  const currentId = tree.focusedNodeId;
  const currentNode = currentId && TreeUtils.findById(tree.nodes, currentId);
  if (!currentId || !currentNode)
    nextFocusId = tree.nodes.length > 0 ? tree.nodes[0].id : undefined;
  else {
    if (currentNode.isFolder) {
      if (!currentNode.isExpanded) {
        // 如果是未展开的文件夹，展开它
        currentNode.isExpanded = true;
      } else if (currentNode.children && currentNode.children.length > 0) {
        // 如果已展开且有子节点，移动到第一个子节点
        nextFocusId = currentNode.children[0].id;
      }
    }
  }

  _setFocusedNodeId(state, treeId, nextFocusId, false, true);
};

// utility functions

function _expandPathToNode(state: Draft<TreeStates>, treeId: string, nodeId: string) {
  const tree = state.trees.find(t => t.header.id === treeId);
  if (!tree) return;

  const path = TreeUtils.getPathToNode(tree.nodes, nodeId);
  if (!path) return;

  // 展开路径上的所有父节点
  for (const node of path) {
    if (node.isFolder && !node.isExpanded)
      node.isExpanded = true;
  }
};

function _setFocusedNodeId(state: Draft<TreeStates>, treeId: string, nodeId: string | undefined, expandTo: boolean, makeVisible: boolean) {
  const tree = state.trees.find(t => t.header.id === treeId);
  if (!tree) return;

  // 设置 focusedNodeId
  tree.focusedNodeId = nodeId;

  if (nodeId) {
    if (expandTo)
      _expandPathToNode(state, treeId, nodeId);
    if (makeVisible)
      theViewManager.getView('TreeView', treeId)?.methods.makeNodeVisible!(nodeId);
  }

  // 更新 activeTreeId
  if (state.activeTreeId !== treeId)
    state.activeTreeId = treeId;
};

// 导出所有 reducers

export function buildReducers() {
  return {
    addTree,
    removeTree,

    setNodes,
    setFilter,
    moveTreePosition,

// edit(rename/create) actions

    startRename,
    startCreate,
    changeName,
    setError,

    cancelRename,
    cancelCreate,

    // commitRename == commitRenameTreeNodeAsync,
    // commitCreate == commitCreateTreeNodeAsync,

// tree navigation actions
    toggleHeaderExpand,
    toggleExpand,

    setFocusedNodeId,
    setSelectedNodeIds,

    navigateNext,
    navigatePrev,
    navigateFirst,
    navigateLast,
    navigateLeft,
    navigateRight,

    expandPathToNode,
  };
}
