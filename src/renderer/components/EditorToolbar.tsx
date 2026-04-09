import { Logger, Assert } from '@lib/logast.js'
import { LucideIcon } from '@lib/renderer/LucideIcon.js'
import { DropdownMenu } from 'radix-ui'
import { getAppDispatch, getState, useAppDispatch, useAppSelector } from '@state/storeHolder.js';
import { tabActions } from '@state/slices/tab/slice.js';
import { docActions } from '@state/slices/doc/slice.js';
import { useEditorContext } from '@editor/useEditorContext.js'
import clsx from 'clsx'
import * as Toolbar from '@radix-ui/react-toolbar'
import { getEditorCommand } from '@editor/commands/registry.js'
import { dispatchCommand } from '@commands/registry.js'
import { hkt, a18 } from '@lib/i18n.js'
import { theAppEventBus } from '@event/app.js';
import { useTranslation } from '@lib/renderer/useTranslation.js';

///////////////////////////////////////////////////////////////////////////////
// React函数组件：一个编辑器的命令按钮，根据传入的 commandId 和 EditorContext 联动。
///////////////////////////////////////////////////////////////////////////////

interface EditorCommandButtonProps {
  title?: string;         // 按钮上显示的文字，显示在图标旁边
  commandId: string;
  args?: object;          // 用于传递额外的命令参数
}

function EditorCommandButton({ title, commandId, args }: EditorCommandButtonProps): React.JSX.Element {
  Assert.notEmpty(commandId, 'commandId cannot be empty');

  const ctx = useEditorContext();

  const active = ctx.isCommandActive(commandId);
  const enabled = ctx.isCommandEnabled(commandId);
  const onClick = () => { ctx.runCommand(commandId, args || {}); }

  const cmd = getEditorCommand(commandId);
  const icon = cmd?.icon || 'Unknown';
  // 如果没有传入 title，仅当没有图标时显示 cmd.title
  title = title || (!cmd?.icon ? cmd?.title : '');
  
  // 正确处理i18n翻译：先翻译description/title，再拼接快捷键
  const baseTooltip = cmd?.description || cmd?.title || (!cmd ? 'invalid command id' : '');
  const translatedTooltip = a18(baseTooltip);
  const tooltip = translatedTooltip + (cmd?.shortcut ? ` (${hkt(cmd.shortcut)})` : '');

  return (
    <Toolbar.Button
      title={tooltip}  // 直接使用已翻译的tooltip
      className={clsx('EditorCommandButton flex items-center whitespace-nowrap', { active })}
      disabled={!enabled}
      onClick={onClick}
      aria-pressed={active}
      type="button"
    >
      {icon && <LucideIcon name={icon} size={16} />}
      {title && <span className='px-1'>{a18(title)}</span>}
    </Toolbar.Button>
  );
}

///////////////////////////////////////////////////////////////////////////////
// React函数组件：一个普通的命令按钮，可以自定义图标、标题、点击事件等。
///////////////////////////////////////////////////////////////////////////////

interface NormalCommandButtonProps {
  title?: string;         // 按钮上显示的文字，显示在图标旁边
  icon?: string;          // 按钮图标名称
  tooltip?: string;       // 按钮的 tooltip 提示
  onClick?: () => void;
  isActive?: () => boolean;
}

function NormalCommandButton({ title, icon, tooltip, onClick, isActive }: NormalCommandButtonProps): React.JSX.Element {
  const active = isActive ? isActive() : false;
  return (
    <Toolbar.Button
      title={a18(tooltip ?? '')}  // 注：button的title属性就是指tooltip
      className={clsx('EditorCommandButton flex items-center whitespace-nowrap', { active })}
      disabled={false}
      onClick={onClick}
      aria-pressed={active}
      type="button"
    >
      {icon && <LucideIcon name={icon} size={16} />}
      {title && <span className='px-1'>{a18(title)}</span>}
    </Toolbar.Button>
  );
}

///////////////////////////////////////////////////////////////////////////////
// React函数组件：一个下拉菜单按钮，下拉后的每个菜单项对应一个 editor command。
///////////////////////////////////////////////////////////////////////////////

type EditorDropdownItem =
  | { type?: 'item'; commandId: string; icon?: string, title?: string; args?: object; disabled?: boolean }
  | { type: 'separator' };

interface EditorCommandDropdownProps {
  title: string;              // 按钮上显示文字
  tooltip?: string;           // 按钮的 tooltip
  icon?: string;              // 按钮图标（左侧）
  items: EditorDropdownItem[]; // 下拉项
}

/**
 * 编辑器命令下拉菜单：按钮在 Toolbar 里，展开后执行多个 editor command。
 * - 未显式传 title 的菜单项，会从 command registry 自动取 cmd.title
 * - disabled 会叠加 ctx.isCommandEnabled(commandId)
 */
function EditorCommandDropdown({ title, tooltip, icon, items }: EditorCommandDropdownProps): React.JSX.Element {
  const ctx = useEditorContext();

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Toolbar.Button
          type="button"
          title={a18(tooltip ?? title)}
          className={clsx('EditorCommandButton flex items-center whitespace-nowrap')}
        >
          {icon && <LucideIcon name={icon} size={16} />}
          <span className='px-1'>{a18(title)}</span>
          <LucideIcon name="ChevronDown" size={16} />
        </Toolbar.Button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          side="bottom"
          align="start"
          sideOffset={6}
          className="MenuContent"
        >
          {items.map((it, idx) => {
            if (it.type === 'separator') {
              return <DropdownMenu.Separator key={`sep-${idx}`} className="MenuItemSeparator" />;
            }

            const cmd = getEditorCommand(it.commandId);
            const itemIcon = it.icon || cmd?.icon;
            const itemTitle = it.title ?? cmd?.title ?? it.commandId;

            const enabledByCtx = ctx.isCommandEnabled(it.commandId);
            const disabled = (it.disabled ?? false) || !enabledByCtx;

            return (
              <DropdownMenu.Item
                key={`${it.commandId}-${idx}`}
                className="MenuItem"
                disabled={disabled}
                onSelect={() => ctx.runCommand(it.commandId, it.args ?? {})}
              >
                {itemIcon && <LucideIcon name={itemIcon} size={16} />}
                {itemTitle && <span className='px-1'>{a18(itemTitle)}</span>}
              </DropdownMenu.Item>
            );
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

///////////////////////////////////////////////////////////////////////////////
// React函数组件：Agent 切换下拉菜单，可以选择当前文档编辑器使用的 AI Agent名称。
///////////////////////////////////////////////////////////////////////////////

// Agent 切换下拉菜单组件
function AgentSwitcher(): React.JSX.Element {
  const dispatch = useAppDispatch();

  const ctx = useEditorContext();
  const docId = ctx.docId;

  // Read available agents from Redux agent slice
  const availableAgents = useAppSelector((state) => state.agent.availableAgents);
  // Read current doc's agentId and agentLocked from Redux doc slice
  const doc = useAppSelector((state) => docId ? state.doc.docs[docId] : undefined);
  const agentId = doc?.agentId ?? 'admin';
  const agentLocked = doc?.agentLocked ?? false;

  const handleAgentChange = (name: string) => {
    if (!docId || agentLocked) return;
    dispatch(docActions.setAgentId({ docId, agentId: name }));
  };

  // When locked: show read-only label
  if (agentLocked) {
    return (
      <Toolbar.Button
        type="button"
        title={`Agent: ${agentId} (已锁定)`}
        className={clsx('EditorCommandButton flex items-center whitespace-nowrap opacity-60 cursor-default')}
        disabled
      >
        <LucideIcon name="Zap" size={16} />
        <span className='px-1'>{agentId}</span>
      </Toolbar.Button>
    );
  }

  // When not locked: show dropdown
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Toolbar.Button
          type="button"
          title={`当前Agent: ${agentId}`}
          className={clsx('EditorCommandButton flex items-center whitespace-nowrap')}
        >
          <LucideIcon name="Zap" size={16} />
          <span className='px-1'>{agentId}</span>
          <LucideIcon name="ChevronDown" size={16} />
        </Toolbar.Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          side="bottom"
          align="start"
          sideOffset={6}
          className="MenuContent"
        >
          {availableAgents.length === 0 && (
            <div className="px-2 py-1 text-zinc-400 text-sm">(未连接)</div>
          )}
          {availableAgents.map((name) => (
            <DropdownMenu.Item
              key={name}
              className="MenuItem"
              disabled={name === agentId}
              onSelect={() => handleAgentChange(name)}
            >
              <LucideIcon name={name === agentId ? 'Check' : 'Empty'} size={16} />
              <span className='px-1'>{name}</span>
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

///////////////////////////////////////////////////////////////////////////////
// React函数组件：LinkTo 下拉菜单，可以将当前Tab 链接到 其它 Tab，用于让两个AI互聊。
///////////////////////////////////////////////////////////////////////////////

theAppEventBus.once('editor:destroyed', ({ docId, tabId }) => {
  const state = getState();
  const dispatch = getAppDispatch();

  /// 关闭 Tab 时，清除 Tab 之间的链接关系

  // 删除所有 linkTo 指向被关闭 Tab 的链接
  const tabsLinkTo = state.tab.tabs.filter(tab => tab.id !== tabId && tab.meta?.linkTo?.peerViewId === tabId);
  tabsLinkTo.forEach(tab => { dispatch(tabActions.updateTabMeta({ tabId: tab.id, meta: { linkTo: null } })); });

  // 删除所有 linkedBy 指向被关闭 Tab 的链接
  const tabsLinkedBy = state.tab.tabs.filter(tab => tab.id !== tabId && tab.meta?.linkedBy?.peerViewId === tabId);
  tabsLinkedBy.forEach(tab => { dispatch(tabActions.updateTabMeta({ tabId: tab.id, meta: { linkedBy: null } })); });
});

function LinkToDropdown(): React.JSX.Element {
  const dispatch = useAppDispatch();

  const ctx = useEditorContext();
  const tabId = ctx.viewId;

  const tabs = useAppSelector((state) => state.tab.tabs);
  const thisTab = tabs.find(tab => tab.id === tabId);
  const linkTo = thisTab?.meta?.linkTo;

  const otherTabs = tabs.filter(tab => tab.id !== tabId);

  const handleSelect = (peer: { id: string, docId: string }) => {
    // 给自己的 Tab 设置 linkTo 元信息
    dispatch(tabActions.updateTabMeta({ tabId, meta: { linkTo: { peerViewId: peer.id, peerDocId: peer.docId } }}));
    // 给对方的 Tab 设置 linkedBy 元信息
    dispatch(tabActions.updateTabMeta({ tabId: peer.id, meta: { linkedBy: { peerViewId: tabId, peerDocId: thisTab?.docId } }}));
  };

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className={clsx('EditorCommandButton flex items-center whitespace-nowrap px-2 rounded', { 'bg-yellow-200': !!linkTo })}
          title='链接两个Tab，让它们的AI互相对话'
        >
          <LucideIcon name="Link" size={16} />
          <span className="px-1">LinkTo</span>
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          side="bottom"
          align="start"
          sideOffset={6}
          className="MenuContent"
        >
          {otherTabs.length === 0 && (
            <div className="px-2 py-1 text-zinc-400 text-sm">(空)</div>
          )}
          {otherTabs.map(peer => (
            <DropdownMenu.Item
              key={peer.id}
              className="MenuItem"
              onSelect={() => handleSelect(peer)}
            >
              <span className="w-5 flex justify-center">
                {linkTo?.peerViewId === peer.id ? (
                  <LucideIcon name="Check" size={16} className="text-green-500" />
                ) : null}
              </span>
              <span className="w-24 font-mono truncate">{peer.id}</span>
              <span className="flex-1 ml-2 truncate">{peer.title}</span>
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

///////////////////////////////////////////////////////////////////////////////
// React函数组件：AutoCommit 下拉菜单，可以设置当前Tab的自动提交延迟时间。
///////////////////////////////////////////////////////////////////////////////

function AutoCommitDropdown(): React.JSX.Element {
  const dispatch = useAppDispatch();
  const ctx = useEditorContext();
  const tabId = ctx.viewId;

  const tabs = useAppSelector((state) => state.tab.tabs);
  const thisTab = tabs.find(tab => tab.id === tabId);
  const autoCommit = thisTab?.meta?.autoCommit ?? 0;

  const options = [
    { value: 0, label: '不自动提交' },
    { value: 1, label: '延迟1秒' },
    { value: 3, label: '延迟3秒' },
    { value: 5, label: '延迟5秒' },
    { value: 10, label: '延迟10秒' },
    { value: 30, label: '延迟30秒' },
  ];

  const handleSelect = (value: number) => {
    dispatch(tabActions.updateTabMeta({ tabId, meta: { autoCommit: value } }));
  };

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className={clsx(
            'EditorCommandButton flex items-center whitespace-nowrap px-2 rounded',
            { 'bg-yellow-200': !!autoCommit }
          )}
          title="设置自动提交延迟"
        >
          <LucideIcon name="Clock" size={16} />
          <span className="px-1">
            {options.find(opt => opt.value === autoCommit)?.label || '自动提交'}
          </span>
          <LucideIcon name="ChevronDown" size={16} />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          side="bottom"
          align="start"
          sideOffset={6}
          className="MenuContent"
        >
          {options.map(opt => (
            <DropdownMenu.Item
              key={opt.value}
              className="MenuItem"
              disabled={autoCommit === opt.value}
              onSelect={() => handleSelect(opt.value)}
            >
              <LucideIcon name={autoCommit === opt.value ? 'Check' : 'Empty'} size={16} />
              <span className="px-1">{opt.label}</span>
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

export function EditorToolbar(): React.JSX.Element {
  const { t } = useTranslation();
  const ctx = useEditorContext();
  const tabId = ctx.viewId;
  const docId = ctx.docId;

  return (
    <Toolbar.Root
      id='EditorToolbar'
      className="h-8 flex flex-row items-center gap-2 p-1"
    >
      <EditorCommandButton commandId="editor/default/refresh"/>
      <NormalCommandButton 
        icon="Save" 
        tooltip="保存文档 (Ctrl+S)" 
        onClick={() => dispatchCommand('tab/save', { tabId })}
      />
      <Toolbar.Separator className="h-6 border-l border-2 border-amber-500 items-center" />
      <EditorCommandButton commandId="editor/visible.level/increase"/>
      <EditorCommandButton commandId="editor/visible.level/decrease"/>
      <Toolbar.Separator className="h-6 border-l border-2 border-amber-500 items-center" />
      <EditorCommandButton commandId="editor/mark/bold"/>
      <EditorCommandButton commandId="editor/mark/italic"/>
      <EditorCommandButton commandId="editor/mark/underline"/>
      <EditorCommandButton commandId="editor/mark/strikethrough" />
      <EditorCommandButton commandId="editor/mark/highlight"/>
      <Toolbar.Separator className="h-4 border-l border-blue-500 items-center" />
      <EditorCommandButton commandId="editor/mark/inline"/>
      <EditorCommandButton commandId="editor/mark/codeblock"/>
      <Toolbar.Separator className="h-4 border-l border-blue-500 items-center" />
      <EditorCommandButton commandId="editor/indent/more"/>
      <EditorCommandButton commandId="editor/indent/less"/>
      <Toolbar.Separator className="h-6 border-l border-2 border-amber-500 items-center" />
      <EditorCommandButton title='Ask AI' commandId="editor/ai/ask"/>
      <Toolbar.Separator className="h-4 border-l border border-blue-500 items-center" />

      {/* Agent 切换下拉菜单 */}
      <AgentSwitcher />

      {/* LinkTo 下拉菜单 */}
      <LinkToDropdown />

      {/* AutoCommit 下拉菜单 */}
      <AutoCommitDropdown />

      {/* 调试功能的下拉菜单 */}
      <EditorCommandDropdown
        title=""
        tooltip="Debug Commands"
        icon="Bug"
        items={[
          { commandId: 'editor/debug/exportSyntaxTree', title: 'Export Document Syntax Tree' },
        ]}
      />
    </Toolbar.Root>
  );
}
