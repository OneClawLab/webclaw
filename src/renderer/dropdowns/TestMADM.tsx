import { dispatchCommand } from "@commands/registry.js";
import { useTranslation } from '@lib/renderer/useTranslation.js';
import { LucideIcon } from "@lib/renderer/LucideIcon.js"
import clsx from "clsx";
import React from "react";
import { DropdownMenu } from "radix-ui"
import { useHoverSubmenu } from "@renderer/components/useHoverSubmenu.js";

interface Props {
  className?: string;
}

export const TestMADM = ({ className }: Props) => {
  const { t } = useTranslation();
  const exportSubmenu = useHoverSubmenu();
  
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          title={t('ui.components.navbar.test')}
          className={clsx('NavIconButton flex items-center justify-center', className)}
        >
          <LucideIcon
            name='FlaskConical'
            size={28}
          />
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="MenuContent"
          side="right"    // 控制弹出方向
          align="end"     // 与 trigger 对齐，可选 "start" | "center" | "end"
          sideOffset={0}  // 与 trigger 之间的像素间距
        >
          <DropdownMenu.Sub {...exportSubmenu.subProps}>
            <DropdownMenu.SubTrigger className="MenuItem" {...exportSubmenu.triggerProps}>
              {t('commands.ui.commands.export')}
              <div className="MenuItemSuffix">
                <LucideIcon name="ChevronRight" size={16} />
              </div>
            </DropdownMenu.SubTrigger>
            <DropdownMenu.Portal>
              <DropdownMenu.SubContent
                className="MenuContent"
                sideOffset={2}
                alignOffset={-5}
                {...exportSubmenu.contentProps}
              >
                <DropdownMenu.Item 
                  className="MenuItem"
                  onSelect={() => dispatchCommand('recorder/exportAppState', {})}>
                  App State
                </DropdownMenu.Item>
              </DropdownMenu.SubContent>
            </DropdownMenu.Portal>
          </DropdownMenu.Sub>

        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
};
