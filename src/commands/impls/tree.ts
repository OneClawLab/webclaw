import { Logger, Assert } from '@lib/logast.js'
import { k18 } from '@lib/i18n.js';
import { defineCommand, defineCommandGroup, dispatchCommand } from '@commands/registry.js';
import { getAppDispatch, getState, useAppSelector } from '@state/storeHolder.js';
import { commitCreateTreeNodeAsync, commitRenameTreeNodeAsync, deleteTreeNodesAsync } from '@state/slices/tree/extraReducers.js';
import { treeActions } from '@state/slices/tree/slice.js';
import { TreeUtils } from '@state/slices/tree/utils.js';
import { LibraryDoc } from '@state/slices/doc/types.js';
import { DocUtils } from '@state/slices/doc/utils.js';
import { docActions } from '@state/slices/doc/slice.js';
import { path } from '@lib/path.js';

defineCommandGroup({
  id: 'tree',
  title: k18('commands.tree.title'),
  commands: []
});

// Define commands for tree view operations

defineCommand<{ treeId: string }>({
  id: 'tree/toggleHeaderExpand',
  group: 'tree',
  title: k18('commands.tree.commands.toggleHeaderExpand'),
  run(args) {
    const { treeId } = args;
    const dispatch = getAppDispatch();
    dispatch(treeActions.toggleHeaderExpand({ treeId }) );
  }
});

defineCommand<{ treeId: string, nodeIds: string[] }>({
  id: 'tree/node/toggleExpand',
  group: 'tree',
  title: k18('commands.tree.commands.toggleNodeExpand'),
  run(args) {
    const { treeId, nodeIds } = args;
    const dispatch = getAppDispatch();
    dispatch(treeActions.toggleExpand({ treeId, nodeIds }));
  }
});

defineCommand<{ treeId: string }>({
  id: 'tree/collapseOneLevel',
  group: 'tree',
  title: k18('commands.tree.commands.collapseOneLevel'),
  run(args) {
    const state = getState();
    const { treeId } = args;
    const tree = state.tree.trees.find(t => t.header.id === treeId);
    if (!tree) return;
    const nodes = tree.nodes;

    // 找到当前最大展开层级
    let maxLevel = -1;
    TreeUtils.walkTreeDFS(nodes, (node, parent, level) => {
      if (node.isFolder && node.isExpanded) {
        if (level > maxLevel)
          maxLevel = level;
      }
      return false; // just to traverse all nodes
    });

    if (maxLevel < 0) 
      return; // already fully collapsed

    // 找到当前展开层级等于maxLevel的所有节点并收缩它们
    const nodesToCollapse: string[] = [];
    TreeUtils.walkTreeDFS(nodes, (node, parent, level) => {
      if (node.isFolder && node.isExpanded && level >= maxLevel)
        nodesToCollapse.push(node.id);
      return false; // just to traverse all nodes
    });

    const dispatch = getAppDispatch();
    if (nodesToCollapse.length > 0)
      dispatch(treeActions.toggleExpand({ treeId, nodeIds: nodesToCollapse }));
  }
});

defineCommand<{ treeId: string, filter: string }>({
  id: 'tree/filter/set',
  group: 'tree',
  title: k18('commands.tree.commands.setFilter'),
  run(args) {
    const { treeId, filter } = args;
    const dispatch = getAppDispatch();
    dispatch(treeActions.setFilter({ treeId, filter: args.filter }));
  }
});

defineCommand<{ treeId: string, nodeId: string }>({
  id: 'tree/node/select',
  group: 'tree',
  title: k18('commands.tree.commands.selectNode'),
  run(args) {
    const { treeId, nodeId } = args;
    const dispatch = getAppDispatch();
    dispatch(treeActions.setSelectedNodeIds({ treeId, nodeIds: [nodeId] }));
    dispatch(treeActions.setFocusedNodeId({ treeId, nodeId, expandTo: true, makeVisible: true }) );
  }
});

defineCommand<{void}>({
  id: 'tree/node/syncToActiveTab',
  group: 'tree',
  title: k18('commands.tree.commands.syncNodeToActiveTab'),
  run(args) {
    const state = getState();
    const tabId = state.tab.activeTabId;
    if (!tabId)
      return;

    const tab = state.tab.tabs.find(t => t.id === tabId);
    if (!tab) {
      Logger.warn('tree', `select tree node by tabId failed: tab ${tabId} not found`);
      return;
    }

    const docId = tab.docId;
    const doc = DocUtils.getDocById(docId)!;
    if (doc.origin !== 'library') {
      Logger.debug('tree', `only library doc has tree node: ${docId}`);
      return;
    }

    const treeId = doc.libId; // TreeView Id 就是 libId
    const nodeId = doc.docId; // NodeId 就是 LibraryDoc 的 (相对) docId

    const tree = state.tree.trees.find(t => t.header.id === treeId);
    if (!tree) {
      Logger.warn('tree', `select tree node by tabId failed: tree ${treeId} not found`);
      return;
    }
    const node = TreeUtils.findById(tree.nodes, nodeId);
    if (!node) {
      Logger.warn('tree', `select tree node by tabId failed: node ${nodeId} not found in tree ${treeId}`);
      return;
    }

    Logger.debug('tree', `selecting tree node ${nodeId} (${node.name}) in tree ${treeId} by active tab ${tabId}`);
    const dispatch = getAppDispatch();
    if (!tree.header.expanded)
      dispatch(treeActions.toggleHeaderExpand({ treeId }));
    dispatch(treeActions.setSelectedNodeIds({ treeId, nodeIds: [nodeId] }));
    dispatch(treeActions.setFocusedNodeId({ treeId, nodeId, expandTo: true, makeVisible: true }) );
  }
});

defineCommand<{ treeId: string, nodeId?: string }>({
  id: 'tree/node/rename/start',
  group: 'tree',
  title: k18('commands.tree.commands.startRenameNode'),
  run(args) {
    const state = getState();
    const dispatch = getAppDispatch();

    const treeId = args.treeId;
    const tree = state.tree.trees.find(t => t.header.id === treeId);
    if (!tree) return;

    // 优先使用传入的 nodeId，其次使用 focusedNodeId，再次使用最后一个选中的节点
    const nodeId = args.nodeId || tree.focusedNodeId 
      || (tree.selectedNodeIds.length ? tree.selectedNodeIds[tree.selectedNodeIds.length - 1] : undefined);
    if (!nodeId) return;

    dispatch(treeActions.startRename({ treeId, nodeId }));
  }
});

defineCommand<{ treeId: string }>({
  id: 'tree/node/rename/cancel',
  group: 'tree',
  title: k18('commands.tree.commands.cancelRenameNode'),
  run(args) {
    const { treeId } = args;
    const dispatch = getAppDispatch();
    dispatch(treeActions.cancelRename({ treeId }) );
  }
});

defineCommand<{ treeId: string }>({
  id: 'tree/node/rename/commit',
  group: 'tree',
  title: k18('commands.tree.commands.commitRenameNode'),
  run(args) {
    const dispatch = getAppDispatch();
    const state = getState();
    const { treeId } = args;
    const tree = state.tree.trees.find(t => t.header.id === treeId);
    if (!tree) return;

    const es = tree._editState;
    if (!es || es.mode !== 'rename') {
      Logger.warn('tree', 'commit rename tree node called but not in rename mode');
      return;
    }

    dispatch(commitRenameTreeNodeAsync({ 
      treeId,
      parentId: es.parentId!,
      isFolder: es.isFolder!,
      oldId: es.editingId!,
      newName: es.editingName.trim()
    }));
  }
});

defineCommand<{ treeId: string, parentId?: string, isFolder: boolean}>({
  id: 'tree/node/new/start',
  group: 'tree',
  title: k18('commands.tree.commands.startNewNode'),
  run(args) {
    const state = getState();
    const dispatch = getAppDispatch();
    const treeId = args.treeId;
    const tree = state.tree.trees.find(t => t.header.id === treeId);
    if (!tree) return;

    let parentId = args.parentId; 
    // 如果没有传入 parentId，则取最后一个选择的节点 或者 其父节点 做为 parentId    
    if (!parentId && tree.selectedNodeIds.length) {
      const lastSelectedId = tree.selectedNodeIds[tree.selectedNodeIds.length - 1];
      const lastSelectedNode = TreeUtils.findById(tree.nodes, lastSelectedId)!;
      parentId = lastSelectedNode.isFolder ? lastSelectedNode.id : lastSelectedNode.parentId;
    }
    // 没找到时，使用根目录作为 parentId
    if (!parentId)
      parentId = '';

    // 插入临时节点，并进入'create'编辑节点名称模式
    dispatch(treeActions.startCreate({ treeId, parentId, isFolder: args.isFolder }));
  }
});

defineCommand<{ treeId: string }>({
  id: 'tree/node/new/cancel',
  group: 'tree',
  title: k18('commands.tree.commands.cancelNewNode'),
  run(args) {
    const { treeId } = args;
    const dispatch = getAppDispatch();
    dispatch(treeActions.cancelCreate({ treeId }));
  }
});

defineCommand<{ treeId: string }>({
  id: 'tree/node/new/commit',
  group: 'tree',
  title: k18('commands.tree.commands.commitNewNode'),
  run(args) {
    const state = getState();
    const { treeId } = args;
    const tree = state.tree.trees.find(t => t.header.id === treeId);
    if (!tree) return;

    const es = tree._editState;
    if (!es || es.mode !== 'create') {
      Logger.warn('tree', 'commit new tree node called but not in create mode');
      return;
    }

    const dispatch = getAppDispatch();
    dispatch(commitCreateTreeNodeAsync({ 
      treeId,
      parentId: es.parentId!,
      isFolder: es.isFolder!,
      oldId: es.editingId!,
      newName: es.editingName.trim()
    }));
  }
});

defineCommand<{ treeId: string, nodeIds?: string[] }>({
  id: 'tree/node/delete',
  group: 'tree',
  title: k18('commands.tree.commands.deleteNode'),
  run(args) {
    const state = getState();
    const treeId = args.treeId;
    const tree = state.tree.trees.find(t => t.header.id === treeId);
    if (!tree) return;

    // 编辑状态下不处理删除
    const es = tree._editState;
    if (es) return;

    // 没有传入 nodeIds 时，使用当前选中的节点们
    const nodeIds = args.nodeIds || tree.selectedNodeIds;
    if (!nodeIds || !nodeIds.length ) return;

    const dispatch = getAppDispatch();
    dispatch(deleteTreeNodesAsync({ treeId, nodeIds }));
  }
});

defineCommand<{ treeId: string }>({
  id: 'tree/navigation/next',
  group: 'tree',
  title: k18('commands.tree.commands.navigateNext'),
  run(args) {
    const { treeId } = args;
    const dispatch = getAppDispatch();
    dispatch(treeActions.navigateNext({ treeId }));
  }
});

defineCommand<{ treeId: string }>({
  id: 'tree/navigation/prev', 
  group: 'tree',
  title: k18('commands.tree.commands.navigatePrev'),
  run(args) {
    const { treeId } = args;
    const dispatch = getAppDispatch();
    dispatch(treeActions.navigatePrev({ treeId }));
  }
});

defineCommand<{ treeId: string }>({
  id: 'tree/navigation/first',
  group: 'tree',
  title: k18('commands.tree.commands.navigateFirst'),
  run(args) {
    const { treeId } = args;
    const dispatch = getAppDispatch();
    dispatch(treeActions.navigateFirst({ treeId }));
  }
});

defineCommand<{ treeId: string }>({
  id: 'tree/navigation/last',
  group: 'tree',
  title: k18('commands.tree.commands.navigateLast'),
  run(args) {
    const { treeId } = args;
    const dispatch = getAppDispatch();
    dispatch(treeActions.navigateLast({ treeId }));
  }
});

defineCommand<{ treeId: string }>({
  id: 'tree/navigation/left',
  group: 'tree',
  title: k18('commands.tree.commands.navigateLeft'),
  run(args) {
    const { treeId } = args;
    const dispatch = getAppDispatch();
    dispatch(treeActions.navigateLeft({ treeId }));
  }
});

defineCommand<{ treeId: string }>({
  id: 'tree/navigation/right',
  group: 'tree',
  title: k18('commands.tree.commands.navigateRight'),
  run(args) {
    const { treeId } = args;
    const dispatch = getAppDispatch();
    dispatch(treeActions.navigateRight({ treeId }));
  }
});

// 激活的类型和行为之交互设计：
// 
// type:
//    click: 鼠标左键单击节点
//    enter: 在节点有焦点时按键盘回车键
//    doubleClick: 鼠标左键双击节点
//    space: 在节点有焦点时按空格键
// 行为：
//   节点是 folder：
//     type:
//       click: toggle折叠状态 + 选中
//       enter: (以动态生成的Tab文档形式)打开并显示目录内容 + 选中 + 切换焦点到Editor
//       doubleClick: 同enter
//       space: toggle折叠状态
//   节点是 file：
//     type:
//       click: 选中 + 打开
//       enter: 选中 + 打开 + 切换焦点到Editor
//       doubleClick: 同enter
//       space: 同 click

defineCommand<{ type: string, treeId: string, nodeId?: string }>({
  id: 'tree/node/activate',
  group: 'tree',
  title: k18('commands.tree.commands.activateNode'),
  async run(args) {
    const state = getState();
    const dispatch = getAppDispatch();

    const treeId = args.treeId;
    const tree = getState().tree.trees.find(t => t.header.id === treeId);
    if (!tree) {
      Logger.warn('tree', `activate node failed: tree ${treeId} not found`);
      return;
    }
    // 注: 不是 undefined 就使用，即使是 空字符串 也使用 (代表根目录)
    const nodeId = args.nodeId !== undefined ? args.nodeId : tree.focusedNodeId;
    if (nodeId === undefined) {
      Logger.warn('tree', 'activate node failed: no nodeId specified and no focused node');
      return;
    }
    // node === undefined 表示根节点，null 表示是子节点但未找到
    const node = nodeId === '' ? undefined : TreeUtils.findById(tree.nodes, nodeId);
    if (node === null) {
      Logger.warn('tree', `activate node failed: node ${nodeId} not found`);
      return;
    }

    Logger.debug('tree', `activating node ${nodeId} (${node ? node.name : 'root'}), type=${args.type}`);

    // 计算行为:
    //   1. 是否切换选中状态
    //   2. 是否切换焦点状态
    //   3. 是否切换折叠状态 (仅folder)
    //   4. 是否打开文档 (file 或 folder, folder以动态生成的Tab文档形式打开)
    // patch: click 类型的选中操作，已在React组件里处理过了，这里不要再次处理以免反选
    const doToggleSelected = (args.type !== 'click');
    const doToggleFocused = true;
    const doToggleExpanded = node && node.isFolder && (args.type === 'space' || args.type === 'click');
    const doOpenTab = node === undefined || (node && node.isFolder) ?
      (args.type === 'enter' || args.type === 'doubleClick') :
      (args.type === 'click' || args.type === 'enter' || args.type === 'doubleClick');
    const switchFocusToNewTab = (args.type === 'enter' || args.type === 'doubleClick');

    if (doToggleSelected) {
      const selectedIds = tree.selectedNodeIds;
      const newSelectedIds = selectedIds.includes(nodeId) ? selectedIds.filter(id => id !== nodeId) : [...selectedIds, nodeId];
      dispatch(treeActions.setSelectedNodeIds({ treeId, nodeIds: newSelectedIds }));
    }

    if (doToggleFocused) {
      dispatch(treeActions.setFocusedNodeId({ treeId, nodeId, expandTo: false, makeVisible: true }) );
    }

    if (doToggleExpanded) {
      dispatch(treeActions.toggleExpand({ treeId, nodeIds: [nodeId] }));
    }

    if (doOpenTab) {
      // 构造将要打开的 LibraryDoc 对象
      const libId = treeId; // treeId 就是 LibId
      const lib = state.lib.libs[libId]!;

      const libraryDoc: LibraryDoc = {
        origin: 'library',
        libId: libId,
        docId: node === undefined ? '' : (node.isFolder ? node.id + '/' : node.id),
        docPath: path.join(lib.libPath!, node === undefined ? '' : node.id),
        title: node === undefined ? lib.meta?.name ?? '' : node.name,
      };
      // 获取文档唯一ID
      const docId = DocUtils.docId(libraryDoc);

      // 先将 doc 加入 docSlice 的 state 中
      dispatch(docActions.addDoc({ doc: libraryDoc }));
      dispatchCommand('tab/open', { docId, switchTo: true, switchFocus: switchFocusToNewTab });
    }
  }
});
