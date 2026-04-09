import { dispatchAppCommand, dispatchCommand } from "@commands/registry.js";
import { useTranslation } from '@lib/renderer/useTranslation.js';
import { LucideIcon } from "@lib/renderer/LucideIcon.js"
import { getState } from "@state/storeHolder.js";
import { DropdownMenu } from "radix-ui"

type Props = {
  treeId?: string | null
};

// MADM = More Actions Dropdown Menu
export const TreeMADM = ({ treeId } : Props) => {
  const { t } = useTranslation();
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
      <button className="MenuTriggerButton" title={t('ui.common.moreActions')}>
        <LucideIcon name="Ellipsis" size={16} />
      </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="MenuContent"
          sideOffset={5}
        >
          <DropdownMenu.Item className="MenuItem" onClick={() => {
            dispatchCommand('tree/node/activate', { treeId, nodeId: '', type: 'doubleClick' });
          }}>
            {t('ui.menus.context.tree.open')}
          </DropdownMenu.Item>
          <DropdownMenu.Item className="MenuItem" onClick={() => {
            if (!treeId) return;
            // 找到对应的 libPath
            const lib = getState().lib.libs[treeId]; // treeId 就是 library 的 id
            const fullPath = lib.libPath;
            dispatchAppCommand('system/showInExplorer', { fullPath });
          }}>
            {t('ui.menus.context.tree.showInExplorer')}
          </DropdownMenu.Item>

          <DropdownMenu.Separator className="MenuItemSeparator" />

          <DropdownMenu.Item className="MenuItem" onClick={() => {
            if (!treeId) return;
              const libIndex = getState().tree.trees.findIndex(t => t.header.id === treeId);
            dispatchAppCommand('workspace/moveLibraryPosition', { fromIndex: libIndex, toIndex: libIndex - 1 });
          }}>
            {t('ui.menus.context.tree.moveLibraryUp')}
          </DropdownMenu.Item>
          <DropdownMenu.Item className="MenuItem" onClick={() => {
            if (!treeId) return;
            const libIndex = getState().tree.trees.findIndex(t => t.header.id === treeId);
            dispatchAppCommand('workspace/moveLibraryPosition', { fromIndex: libIndex, toIndex: libIndex + 1 });
          }}>
            {t('ui.menus.context.tree.moveLibraryDown')}
          </DropdownMenu.Item>

          <DropdownMenu.Separator className="MenuItemSeparator" />

          <DropdownMenu.Item className="MenuItem" onClick={() => {
            if (!treeId) return;
            dispatchAppCommand('workspace/removeLibrary', { treeId });
          }}>
            {t('ui.menus.context.tree.removeLibrary')}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
};
