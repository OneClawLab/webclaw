import { Logger, Assert } from '@lib/logast.js'
import clsx from 'clsx'
import React, { useCallback, useLayoutEffect, useMemo, useState } from 'react'
import { LucideIcon } from '@lib/renderer/LucideIcon.js'
import { useAppDispatch, useAppSelector } from '@state/storeHolder.js'
import { TreeNode } from '@state/slices/tree/types.js'
import { dispatchCommand } from '@commands/registry.js'
import { theFocusManager, theViewManager } from '@view/index.js'
import { TreeUtils } from '@state/slices/tree/utils.js'
import { TreeNodeView } from '../components/TreeNodeView.js'
import { TreeMADM } from '@renderer/dropdowns/TreeMADM.js'
import { treeActions } from '@state/slices/tree/slice.js'
import { selectTree } from '@state/slices/workspace/selectors.js'
import { useTranslation } from '@lib/renderer/useTranslation.js'

type TreeProps = {
  treeId: string
};

// TreeView 的 Header 右侧的操作按钮部分
function RightActions({ treeId }: TreeProps): React.JSX.Element {
  const { t } = useTranslation();
  return (
    <div id='RightActions' className="flex items-center space-x-2 pr-0">
      <button
        className="p-1 hover:bg-gray-200 rounded"
        title={t('ui.components.treeView.rightActions.newFile')}
        onClick={(e) => {
          e.stopPropagation();
          dispatchCommand('tree/node/new/start', { treeId, isFolder: false });
        }}>
        <LucideIcon name="FilePlus" size={16} />
      </button>
      <button
        className="p-1 hover:bg-gray-200 rounded"
        title={t('ui.components.treeView.rightActions.newFolder')}
        onClick={(e) => {
          e.stopPropagation();
          dispatchCommand('tree/node/new/start', { treeId, isFolder: true });
        }}>
        <LucideIcon name="FolderPlus" size={16} />
      </button>
      <button
        className="p-1 hover:bg-gray-200 rounded"
        title={t('ui.components.treeView.rightActions.refresh')}
        onClick={(e) => {
          e.stopPropagation();
          dispatchCommand('workspace/refreshLibrary', { treeId });
        }}>
        <LucideIcon name="RefreshCcw" size={16} />
      </button>
      <button
        className="p-1 hover:bg-gray-200 rounded"
        title={t('ui.components.treeView.rightActions.collapseOneLevel')}
        onClick={(e) => {
          e.stopPropagation();
          dispatchCommand('tree/collapseOneLevel', { treeId });
        }}>
        <LucideIcon name="CopyMinus" size={16} />
      </button>
      <TreeMADM treeId={treeId} />
    </div>
  )
}

type TreeHeaderProps = {
  treeId: string
  isFocused: boolean
};

// TreeView 的 Header 部分 (包含标题和右侧操作按钮)
function TreeHeader({ treeId, isFocused }: TreeHeaderProps): React.JSX.Element {
  const tree = useAppSelector(selectTree(treeId))!;
  const collapsed = !tree.header.expanded;
  const icon = collapsed ? 'ChevronRight' : 'ChevronDown';

  const onClick = (e) => { 
    e.stopPropagation();
    dispatchCommand('tree/toggleHeaderExpand', { treeId });
  };

  return (
    <div id="TreeHeader" className="TreeHeader flex items-center w-full">
      <div 
        className="flex flex-row flex-1 items-center justify-start overflow-x-hidden min-w-0"
        onClick={onClick}
      >
        <LucideIcon name={icon} size={14}/>
        <span className="TreeHeaderLabel">
          {tree.header.name}
        </span>
        <div className="flex-1" onClick={onClick}/>
      </div>
      {!collapsed && (
        <div id="RightActionsWrapper" className="ml-auto flex justify-end">
          <RightActions treeId={treeId}/>
        </div>
      )}
    </div>
  )
}

function makeNodeVisibleInView(parent: HTMLDivElement, nodeId: string) {
  //Logger.debug('TreeView', `makeNodeVisibleInView: ${nodeId}`);
  const nodeElement = parent.querySelector(`[data-node-id="${nodeId}"]`);
  if (nodeElement) nodeElement.scrollIntoView({ block: 'nearest' });
}

export function TreeView({ treeId }: TreeProps): React.JSX.Element {
  const { t } = useTranslation();
  const appDispatch = useAppDispatch();

  const tree = useAppSelector(selectTree(treeId))!;

  const collapsed = !tree.header.expanded;
  const allNodes = tree.nodes;
  const selectedIds = tree.selectedNodeIds;
  const editState = tree._editState;
  const filter = tree.filter;

  const nodes = useMemo(() => {
    return filter ? TreeUtils.filter(allNodes, (node) => node.name.includes(filter)) : allNodes;
  }, [allNodes, filter]);

  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);

  const viewRef = React.useRef<HTMLDivElement>(null);

  // 注册 TreeView 到 theViewManager
  useLayoutEffect(() => {
    theViewManager.onCreated('TreeView', treeId, {
      focus: () => {
        requestAnimationFrame(() => {
          if (viewRef.current)
            viewRef.current.focus();
        });
      },
      makeNodeVisible: (nodeId: string) => {
        // viewRef.current 不应该 为 null，因为 我们是在 useLayoutEffect 里调用的
        Assert.notNull(viewRef.current, 'TreeView.makeNodeVisible: viewRef is null');
        // 延迟到下一帧，确保节点已经渲染出来
        requestAnimationFrame(() => {
          if (viewRef.current) {
            // 等待下一帧再滚动，确保节点已经渲染出来
            requestAnimationFrame(() => {
              if (viewRef.current)
                makeNodeVisibleInView(viewRef.current, nodeId);
            });
          }
        });
      }
    });

    return () => { 
      theViewManager.onDestroyed('TreeView', treeId);
    } 
  }, [treeId]);

  // 简化的键盘事件处理 - 只对接到命令
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // 如果正在编辑，不处理键盘导航
    if (editState) return;

    // 如果事件已被 HotkeyManager 处理，则不处理
    if ((e as any).__handledByHotkeyManager) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        dispatchCommand('tree/navigation/next', { treeId });
        break;
      case 'ArrowUp':
        e.preventDefault();
        dispatchCommand('tree/navigation/prev', { treeId });
        break;
      case 'ArrowRight':
        e.preventDefault();
        dispatchCommand('tree/navigation/right', { treeId });
        break;
      case 'ArrowLeft':
        e.preventDefault();
        dispatchCommand('tree/navigation/left', { treeId });
        break;
      case 'Home':
        e.preventDefault();
        dispatchCommand('tree/navigation/first', { treeId });
        break;
      case 'End':
        e.preventDefault();
        dispatchCommand('tree/navigation/last', { treeId });
        break;
      case ' ':
        e.preventDefault();
        dispatchCommand('tree/node/activate', { treeId, type: 'space' });
        break;
      case 'Enter':
        e.preventDefault();
        dispatchCommand('tree/node/activate', { treeId, type: 'enter' });
        break;
      default:
        break;
    }
  }, [editState, treeId]);

  function onMouseSelect(type: 'click' | 'doubleClick', e: React.MouseEvent, treeId: string, node: TreeNode) {
    let newSelectedIds: string[];

    // Ctrl 逐个多选/取消选中
    if (e.ctrlKey || e.metaKey) {
      // 根据节点之前的选中状态，决定是添加到选中列表，还是从选中列表移除
      newSelectedIds = selectedIds.includes(node.id) ? selectedIds.filter(id => id !== node.id) : [...selectedIds, node.id];
      setLastSelectedId(node.id);
    // Shift 连选区间
    } else if (e.shiftKey && lastSelectedId) {
      const flatList = TreeUtils.flatten(nodes, true);
      const idx1 = flatList.findIndex(n => n.id === lastSelectedId);
      const idx2 = flatList.findIndex(n => n.id === node.id);
      // 如果两个节点都找得到，则选中它们之间的所有节点
      if (idx1 !== -1 && idx2 !== -1) {
        const [start, end] = [idx1, idx2].sort((a, b) => a - b);
        const rangeIds = flatList.slice(start, end + 1).map(n => n.id);
        newSelectedIds = rangeIds;
      // 否则退化为单选
      } else {
        newSelectedIds = [node.id];
      }
    // 没按任何修饰键，单选
    } else {
      newSelectedIds = [node.id];
      setLastSelectedId(node.id);
    }

    appDispatch(treeActions.setSelectedNodeIds({ treeId, nodeIds: newSelectedIds }));

    // 按住修饰键时是多选，此时不要触发打开/展开
    if (e.ctrlKey || e.metaKey || e.shiftKey)
      return;

    dispatchCommand('tree/node/activate', { treeId, type, nodeId: node.id });
  }

  const [ isFocused, setFocused ] = useState(false);

  const onFocus = (e: React.FocusEvent) => {
    setFocused(true);
    theFocusManager.onFocused('TreeView', treeId);
  };

  const onBlur = (e: React.FocusEvent) => {
    setFocused(false);
  };

  // 暂时没人用这些事件，先注释掉
  // useEffect(() => {
  //   emitAppEvent('tree:refreshed')
  //   requestAnimationFrame(() => {
  //     emitAppEvent('tree:rendered')
  //   })
  // }, [nodes])

  return (
    <div
      id='TreeView' ref={viewRef} tabIndex={0}
      className={clsx('TreeView flex flex-col min-w-0 pl-1 overflow-auto scrollbar-fade-parent', collapsed ? 'flex-none' : 'flex-1 min-h-0', isFocused && 'Focused') }
      onFocus={onFocus}
      onBlur={onBlur}
      onKeyDown={handleKeyDown}
    >
      <TreeHeader treeId={treeId} isFocused={isFocused}/>
      {!collapsed && (
        <ul className="overflow-auto scrollbar-fade">
          {nodes.map(node => (
            <TreeNodeView paddingLeft={16} key={node.id} treeId={treeId} node={node} onMouseSelect={onMouseSelect}/>
          ))}
        </ul>
      )}
    </div>
  );
};
