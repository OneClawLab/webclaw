import * as Menubar from '@radix-ui/react-menubar'
import * as Tooltip from '@radix-ui/react-tooltip'
import { LucideIcon } from '@lib/renderer/LucideIcon.js'
import { hkt, a18 } from '@lib/i18n.js';

interface MenubarItemProps {
  title: string;
  icon?: string;
  shortcut?: string;
  tooltip?: string;
  onSelect: () => void;
}

export function MenubarItem({ title, icon, shortcut, tooltip, onSelect }: MenubarItemProps) {
  return (
    <Tooltip.Provider>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <Menubar.Item
            onSelect={onSelect}
            className="MenuItem w-full justify-between"
          >
            {/* 左侧：icon + 文字，始终占位 */}
            <span className="flex items-center">
              <span className="MenuItemIconSpace">
                {icon ? <LucideIcon name={icon} size={16} /> : null}
              </span>
              <span className='whitespace-nowrap'>{a18(title)}</span>
              <span className="MenuItemSpacer"></span>
            </span>
            {/* 右侧：快捷键，固定空隙，右对齐 */}
            {shortcut && (
              <span className="MenuItemShortcut">{hkt(shortcut)}</span>
            )}
          </Menubar.Item>
        </Tooltip.Trigger>
        {tooltip && (
          <Tooltip.Portal>
            <Tooltip.Content
              side="right"
              align="center"
              className="rounded bg-gray-200 px-2 py-1 text-black text-xs"
            >
              {a18(tooltip)}
              <Tooltip.Arrow className="fill-gray-800" />
            </Tooltip.Content>
          </Tooltip.Portal>
        )}
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
