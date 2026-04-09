import { Logger } from "@lib/logast.js"
import { ContextMenu } from "radix-ui"
import { LucideIcon } from "@lib/renderer/LucideIcon.js"
import { dispatchCommand } from "@commands/registry.js"
import { Tab } from "@state/slices/tab/types.js"
import { DocUtils } from "@state/slices/doc/utils.js"
import clsx from "clsx"
import { useTranslation } from '@lib/renderer/useTranslation.js'
import { hkt } from "@lib/i18n.js"
import { toast } from "@lib/renderer/dialog.js"

interface Props {
  tab: Tab
  activeTabId?: string
}

function TabHandleContentMenu({ tab, activeTabId }: Props): React.JSX.Element {
  const { t } = useTranslation();
  return (
    <ContextMenu.Content 
      className="MenuContent">
      <ContextMenu.Item className="MenuItem" onSelect={() => {
        dispatchCommand('tab/close', { tabId: tab.id });
      }}>
        {t('ui.menus.context.tab.close')}
      </ContextMenu.Item>
      <ContextMenu.Item className="MenuItem" onSelect={() => {
        dispatchCommand('tab/closeOthers', { tabId: tab.id });
      }}>
        {t('ui.menus.context.tab.closeOthers')}
      </ContextMenu.Item>
      <ContextMenu.Item className="MenuItem" onSelect={() => {
        dispatchCommand('tab/closeAll', {});
      }}>
        {t('ui.menus.context.tab.closeAll')}
      </ContextMenu.Item>
      <ContextMenu.Separator className="MenuItemSeparator" />
      <ContextMenu.Item className="MenuItem" onSelect={() => {
        dispatchCommand('tab/refresh', { tabId: tab.id });
      }}>
        {t('ui.menus.context.tab.refresh')}
      </ContextMenu.Item>
      <ContextMenu.Separator className="MenuItemSeparator" />
      <ContextMenu.Item className="MenuItem" onSelect={() => {
        dispatchCommand('tab/pin', { tabId: tab.id, status: !tab.pinned });
      }}>
        { tab.pinned ? t('ui.menus.context.tab.unpin') : t('ui.menus.context.tab.pin') }
      </ContextMenu.Item>
      <ContextMenu.Separator className="MenuItemSeparator" />
      <ContextMenu.Item className="MenuItem" onSelect={() => {
        const fullPath = DocUtils.docPath(tab.docId);
        if (fullPath === undefined) { // unsaved doc 文档没有路径
          toast.show(t('commands.system.commands.showInExplorerErrorUnsaved'));
          return;
        }
        dispatchCommand('system/showInExplorer', { fullPath }); 
      }}>
        {t('ui.menus.context.tab.showInExplorer')}
      </ContextMenu.Item>
    </ContextMenu.Content>
  )
}

export function TabHandle({ tab, activeTabId }: Props): React.JSX.Element {
  const { t } = useTranslation();
  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>
        <div 
          tabIndex={0} data-tab-id={tab.id}
          className={clsx('TabHandle flex items-center', (activeTabId === tab.id) && 'Active')}
          onClick={() => dispatchCommand('tab/switch', { tabId: tab.id, switchFocus: true })}
        >
          {/* 文档类型图标 */}
          <LucideIcon  name={tab.icon} size={16} 
            className={clsx('mr-1', { editing: tab._editing })} />
          {/* 标题 TODO 最大长度 */}
          <span className={clsx('TabHandleTitle', 
            tab.hasChatMemory && 'HasChatMemory', 
            tab._dirty && 'Dirty', 
            (tab.status.toString() === 'outdated') && 'Outdated', 
            (tab.status.toString() === 'deleted') && 'Deleted',
            tab._highlight && 'Highlight'
            )}>
            { tab.title }
          </span>
          {/* unpin 或 close 图标 */}
          {tab.closable ? (
            tab.pinned ? (
              <span
                className="TabHandleActionButtonStatic"
                title={t('ui.components.tabHandle.unpin')}
                onClick={e => {
                  e.stopPropagation()
                  dispatchCommand('tab/pin', { tabId: tab.id, status: !tab.pinned })
                }}
              >
                <LucideIcon name="Pin" size={16} />
              </span>
            ) : (
            <span
                className="TabHandleActionButton" 
                title={t('ui.components.tabHandle.close') + '\t(' +hkt(['Mod+F4','Mod+W']) + ')'}
                onClick={e => {
                  e.stopPropagation()
                  dispatchCommand('tab/close', { tabId: tab.id })
                }}
              >
                <LucideIcon name="X" size={16} />
              </span>
            )
          ) : null}
        </div>
      </ContextMenu.Trigger>
      <ContextMenu.Portal>
        <TabHandleContentMenu tab={tab} activeTabId={activeTabId} />
      </ContextMenu.Portal>
    </ContextMenu.Root>    
  )
}
