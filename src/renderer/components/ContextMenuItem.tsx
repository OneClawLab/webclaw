import * as Tooltip from '@radix-ui/react-tooltip'
import { LucideIcon } from '@lib/renderer/LucideIcon.js'
import { hkt } from '@lib/i18n.js';
import { ContextMenu } from 'radix-ui';

interface ContextMenuItemProps {
  title: string;
  icon?: string;
  shortcut?: string;
  tooltip?: string;
  onSelect: () => void;
}

export function ContextMenuItem({ title, icon, shortcut, tooltip, onSelect }: ContextMenuItemProps) {
  const hasIcon = Boolean(icon);
  return (
    <Tooltip.Provider>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <ContextMenu.Item
            onSelect={onSelect}
            className="MenuItem w-full justify-between"
          >
            {/* 左侧：icon + 文字，始终占位 */}
            <span className="flex items-center">
              {hasIcon && (
                <span className="MenuItemIconSpace">
                  <LucideIcon name={icon!} size={16} />
                </span>
              )}
              <span className='whitespace-nowrap'>{title}</span>
              {hasIcon && <span className="MenuItemSpacer"></span>}
            </span>
            {/* 右侧：快捷键，固定空隙，右对齐 */}
            {shortcut && (
              <span className="MenuItemShortcut">{hkt(shortcut)}</span>
            )}
          </ContextMenu.Item>
        </Tooltip.Trigger>
        {tooltip && (
          <Tooltip.Portal>
            <Tooltip.Content
              side="right"
              align="center"
              className="rounded bg-gray-200 px-2 py-1 text-black text-xs"
            >
              {tooltip}
              <Tooltip.Arrow className="fill-gray-800" />
            </Tooltip.Content>
          </Tooltip.Portal>
        )}
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
