import { useTranslation } from '@lib/renderer/useTranslation.js';
import { LucideIcon } from "@lib/renderer/LucideIcon.js"
import { DropdownMenu } from "radix-ui"

interface OutlineMADMProps {
  className?: string;
}

// MADM = More Actions Dropdown Menu
export const OutlineMADM = ({ className }: OutlineMADMProps) => {
  const { t } = useTranslation();
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
      <button className={`MenuTriggerButton ${className || ''}`} title={t('ui.common.moreActions')}>
        <LucideIcon name="Ellipsis" size={16} />
      </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content className="MenuContent" sideOffset={5}>
          <DropdownMenu.Item className="MenuItem">
            Action 1
            <div className="MenuItemShortcut">⌘+T</div>
          </DropdownMenu.Item>
          <DropdownMenu.Item className="MenuItem">
            Action 2
            <div className="MenuItemShortcut">⌘+N</div>
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
};
