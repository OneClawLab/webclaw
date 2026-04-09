import { Logger } from "@lib/logast.js"
import React from "react"
import clsx from "clsx"
import { ContextMenu } from "radix-ui"
import { LucideIcon } from "@lib/renderer/LucideIcon.js"
import { path } from "@lib/path.js"
import { dispatchCommand } from "@commands/registry.js"
import { TreeNode } from "@state/slices/tree/types.js"
import { useAppDispatch, useAppSelector } from "@state/storeHolder.js"
import { treeActions } from "@state/slices/tree/slice.js"
import { TreeUtils } from '@state/slices/tree/utils.js'
import { theFocusManager } from "@view/index.js"
import { getFileIcon } from "./FileIcons.js"
import { ContextMenuItem } from "./ContextMenuItem.js"
import { useTranslation } from '@lib/renderer/useTranslation.js'

type TreeNodeContextMenuProps = {
  treeId: string;
  node: TreeNode;
};

function TreeNodeContextMenu({ treeId, node }: TreeNodeContextMenuProps): React.JSX.Element {
  const { t } = useTranslation();
  return (
    <ContextMenu.Content className="MenuContent" onCloseAutoFocus={(e) => {
      // 防止菜单关闭时把焦点抢回 Trigger
      e.preventDefault();
    }}>
      <ContextMenuItem
        title={t('ui.menus.context.tree.open')}
        tooltip={t('ui.menus.context.tree.openTooltip')}
        onSelect={() => {
          const parentId = node.isFolder ? node.id : path.dirname(node.id);
          dispatchCommand('tree/node/activate', { treeId, nodeId: node.id, type: 'doubleClick' });
        }}>
      </ContextMenuItem>

      <ContextMenu.Separator className="MenuItemSeparator" />

      <ContextMenuItem
        title={t('ui.menus.context.tree.newFile')}
        tooltip={t('ui.menus.context.tree.newFileTooltip')}
        onSelect={() => {
          const parentId = node.isFolder ? node.id : path.dirname(node.id);
          dispatchCommand('tree/node/new/start', { treeId, parentId, isFolder: false });
        }}>
      </ContextMenuItem>
      <ContextMenuItem
        title={t('ui.menus.context.tree.newFolder')}
        tooltip={t('ui.menus.context.tree.newFolderTooltip')}
        onSelect={() => {
          const parentId = node.isFolder ? node.id : path.dirname(node.id);
          dispatchCommand('tree/node/new/start', { treeId, parentId, isFolder: true });
      }}>
      </ContextMenuItem>

      <ContextMenu.Separator className="MenuItemSeparator" />

      <ContextMenuItem
        title={t('ui.menus.context.tree.rename')}
        tooltip={t('ui.menus.context.tree.renameTooltip')}
        shortcut={'F2'}
        onSelect={() => dispatchCommand('tree/node/rename/start', { treeId, nodeId: node.id })}
      />
      <ContextMenuItem
        title={t('ui.menus.context.tree.delete')}
        tooltip={t('ui.menus.context.tree.deleteTooltip')}
        shortcut={'Del'}
        onSelect={() => dispatchCommand('tree/node/delete', { treeId, nodeIds: [node.id] })}
      />

      <ContextMenu.Separator className="MenuItemSeparator" />
      <ContextMenuItem
        title={t('ui.menus.context.tree.properties')}
        tooltip={t('ui.menus.context.tree.propertiesTooltip')}
        onSelect={() => {
          Logger.debug("Info", node);
        }}
      />
    </ContextMenu.Content>
  );
}

// 编辑节点名称时，显示验证错误信息的组件
function ValidationHint({ message }: { message?: string | null }) {
  if (!message) return null
  return (
    <div className='TreeNodeEditingError'>{message}</div>
  )
}

type TreeNodeViewProps = {
  treeId: string;
  node: TreeNode;
  paddingLeft: number;
  onMouseSelect: (type: 'click' | 'doubleClick', event: React.MouseEvent, treeId: string, node: TreeNode) => void;
};

export function TreeNodeView({ treeId, node, paddingLeft, onMouseSelect }: TreeNodeViewProps): React.JSX.Element {
  const dispatch = useAppDispatch();
  const tree = useAppSelector((state) => state.tree.trees.find(t => t.header.id === treeId))!;

  const isFocused = tree.focusedNodeId === node.id;
  const isSelected = tree.selectedNodeIds.includes(node.id);
  const es = tree._editState;
  const isEditing = es && es.editingId === node.id;

  // rename/create 进入编辑态后自动 focus
  const editingInputRef = React.useRef<HTMLInputElement | null>(null);
  React.useEffect(() => {
    if (!isEditing) return;

    let raf1 =0;
    let raf2 = 0;
    // 推迟到 DOM 确认渲染后再聚焦，避免某些情况下 focus 失败
    raf1 = window.requestAnimationFrame(() => {
      raf2 = window.requestAnimationFrame(() => {
        const el = editingInputRef.current;
        if (!el) return;
        Logger.debug("TreeNodeView", `Focusing editing input for node ${node.id}`);
        el.focus();
        if (es.mode === 'rename')  {
          const ext = path.extname(el.value);
          el.setSelectionRange(0, el.value.length - ext.length);
        }
      });
    });

    return () => {
      window.cancelAnimationFrame(raf1);
      window.cancelAnimationFrame(raf2);
    };
  }, [isEditing, es?.mode, node.id]);

  const onClick = (type, e) => { onMouseSelect(type, e, treeId, node); };

  // 编辑状态下的处理逻辑
 
  const { t } = useTranslation();
  
  const onChange = (value: string) => {
    if (!es) return;
    dispatch(treeActions.changeName( { treeId, value }));

    const siblings = TreeUtils.findSiblings(tree.nodes, node.id)!;

    // 检查 名称的合法性
    const result = TreeUtils.checkFileName(value, node.isFolder);
    if (!result.error) {
      // 检查实际有无重名
      const conflict = siblings.some(s => s.name === result.validName && s.id !== node.id);
      result.error = (conflict ? t('ui.menus.context.tree.renameErrorDuplicate') : undefined);
    }

    // 更新错误状态
    dispatch(treeActions.setError({ treeId, error: result.error } ));
  };

  const submit = () => {
    if (!es) return;

    const siblings = TreeUtils.findSiblings(tree.nodes, node.id)!;
    const value = es.editingName.trim();

    // 如果是创建模式，但啥也没输入，则取消创建(删除临时节点)
    if (es.mode === 'create') {
      if (value.length === 0) {
        dispatchCommand('tree/node/new/cancel', { treeId });
        theFocusManager.restoreFocus();
        return;
      }
    }

    // 如果是重命名模式，且名称没有变化，则取消重命名
    if (es.mode == 'rename') {
      const originalName = TreeUtils.findById(tree.nodes, es.editingId!)?.name;
      if (value == originalName) {
        dispatchCommand('tree/node/rename/cancel', { treeId });
        theFocusManager.restoreFocus();
        return;
      }
    }

    // 检查 名称的合法性
    const result = TreeUtils.checkFileName(value, node.isFolder);
    if (!result.error) {
      // 检查实际有无重名
      const conflict = siblings.some(s => s.name === result.validName && s.id !== node.id);
      result.error = (conflict ? t('ui.menus.context.tree.renameErrorDuplicate') : undefined);
    }

    // 更新错误状态，并阻止提交
    if (result.error) {
      dispatch(treeActions.setError( { treeId, error: result.error }));
      return;
    }

    // 提交重命名或新建命令
    const command = (es.mode === 'rename') ? 'tree/node/rename/commit' : 'tree/node/new/commit';
    dispatchCommand(command, { treeId });
    // 退出编辑模式不在这里做，而是在各自的 commit 里做，确保只有在成功提交后才退出编辑模式
  };

  const onKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (!es) return;

    if (e.key === 'Escape') {
      const command = (es.mode === 'rename') ? 'tree/node/rename/cancel' : 'tree/node/new/cancel';
      dispatchCommand(command, { treeId });
      theFocusManager.restoreFocus();
    } else if (e.key === 'Enter')
      submit()
  }

  // 输入框失去焦点时尝试自动提交
  const onBlur = () => { 
    Logger.debug("TreeNodeView", "onBlur try submit");
    submit();
  };

  let iconColor;
  let iconName;
  if (node.isFolder) {
    iconName = node.isExpanded ? 'ChevronDown' : 'ChevronRight';
    iconColor = 'black';
  } else {
    const iconInfo = getFileIcon(node.name);
    iconName = iconInfo.icon;
    iconColor = iconInfo.color;
  }

  return (
    <li
      className={clsx('TreeNodeRow', isFocused && 'Focused', isSelected && 'Selected', isEditing && 'Editing') }>
      {/* 本节点 */}
      <ContextMenu.Root>
        <ContextMenu.Trigger asChild>
          <div
            style={{ paddingLeft }}
            className={clsx('TreeNode flex items-center justify-start m-2', isFocused && 'Focused', isSelected && 'Selected', isEditing && 'Editing') }
            tabIndex={0}
            data-node-id={node.id}
            onClick={(e) => onClick('click', e)}
            onDoubleClick={(e) => onClick('doubleClick', e)}
            >
            <LucideIcon name={iconName} size={14} color={iconColor} strokeWidth={1.5} />

            {isEditing ? (
              <div className="TreeNodeEditingWrapper flex flex-col flex-1">
                <input 
                  className="TreeNodeEditingInput"
                  ref={editingInputRef}
                  autoFocus
                  spellCheck={false} autoCorrect="off" autoCapitalize="off" autoComplete="off"
                  value={es?.editingName || ''}
                  onChange={(e) => onChange(e.target.value)}
                  onKeyDown={onKeyDown}
                  onBlur={onBlur}
                />
                <ValidationHint message={es?.error || ''} />
              </div>
            ) : (
              <span className='TreeNodeLabel'>{node.name}</span>
            )}

          </div>
        </ContextMenu.Trigger>
        <ContextMenu.Portal>
          <TreeNodeContextMenu treeId={treeId} node={node} />
        </ContextMenu.Portal>
      </ContextMenu.Root>

      {/* 子节点 */}
      {node.isExpanded && node.children && node.children.length > 0 && (
        <ul>
          {node.children.map(child => (
            <TreeNodeView paddingLeft={paddingLeft + 16} key={child.id} treeId={treeId} node={child} onMouseSelect={onMouseSelect}/>
          ))}
        </ul>
      )}
    </li>
  );
};
