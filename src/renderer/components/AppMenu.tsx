import { Logger } from '@lib/logast.js';
import React, { useState, useEffect } from 'react';
import * as Menubar from '@radix-ui/react-menubar';
import { LucideIcon } from '@lib/renderer/LucideIcon.js';
import { dispatchCommand } from '@commands/registry.js';
import { MenubarItem } from './MenubarItem.js';
import { useTranslation } from '@lib/renderer/useTranslation.js';

//---- App Icon 组件

const AppIcon: React.FC = () => {
  return (
    // 高度撑满父容器(h-full)，flex横向布局，所有子项中对齐(items-center)
    <Menubar.Root className="h-full pl-1.5 pr-2 flex items-center">
      <Menubar.Menu>
        <Menubar.Trigger asChild>
          <LucideIcon name='Binoculars' size={20} />
        </Menubar.Trigger>
      </Menubar.Menu>
    </Menubar.Root>
  );
};

//---- 窗口控制菜单组件

type WindowControlActions = 'minimize' | 'maximize' | 'close';
interface WindowControlsProps {
  isMaximized: boolean;
  onControl: (action: WindowControlActions) => void;
}

type AppRegionStyle = React.CSSProperties & { WebkitAppRegion?: string };

const WindowControls: React.FC<WindowControlsProps> = ({ isMaximized, onControl }) => {
  const windowControls = [
    { icon: 'Minus', action: 'minimize', className: 'hover:bg-gray-200', size: 18 },
    { icon: isMaximized ? 'Layers2' : 'Square', action: 'maximize', className: 'hover:bg-gray-200', size: 14 },
    { icon: 'X', action: 'close', className: 'hover:bg-red-400', size: 18 },
  ];

  return (
    // 高度撑满父容器(h-full)，flex横向布局，所有子项中对齐(items-center)
    <Menubar.Root className="h-full flex items-center" style={{ WebkitAppRegion: 'no-drag' } as AppRegionStyle}>
      {windowControls.map(btn => (
        <Menubar.Menu key={btn.action}>
          <Menubar.Trigger asChild>
            <button
              onClick={() => onControl(btn.action as WindowControlActions)}
              className={`w-8 h-8 flex items-center justify-center ${btn.className}`}
              tabIndex={-1}
            >
              <LucideIcon name={btn.icon} size={btn.size} />
            </button>
          </Menubar.Trigger>
        </Menubar.Menu>
      ))}
    </Menubar.Root>
  );
};

//---- AppMenu (主菜单 + 窗口控制菜单 @ 应用的标题栏)

//---- 主菜单栏组件
interface MainMenuBarProps {
  menuGroups: Array<{
    title: string;
    items: Array<{
      icon?: string;
      command?: string;
      label?: string;
      tooltip?: string;
      shortcut?: string;
      separator?: boolean;
    }>;
  }>;
  onMenuClick: (commandId: string, title: string) => void;
}

const MainMenuBar: React.FC<MainMenuBarProps> = ({ menuGroups, onMenuClick }) => (
  // 高度撑满父容器(h-full)，flex横向布局，所有子项中对齐(items-center)
  <Menubar.Root className="h-full flex items-center">
    {menuGroups.map(group => (
      <Menubar.Menu key={group.title}>
        <Menubar.Trigger
          className="MenubarTrigger"
          style={{ WebkitAppRegion: 'no-drag' } as AppRegionStyle}
          onClick={e => e.stopPropagation()}
        >
          {group.title}
        </Menubar.Trigger>
        <Menubar.Portal>
          <Menubar.Content
            className="MenuContent MenubarContent absolute left-0 top-full z-30"
            style={{ WebkitAppRegion: 'no-drag' } as AppRegionStyle}
            onClick={e => e.stopPropagation()}
          >
            {group.items.map((item, idx) =>
              item.separator ? (
                <Menubar.Separator key={idx} className="MenuItemSeparator" />
              ) : (
                <MenubarItem
                  key={idx}
                  title={item.label!}
                  icon={item.icon}
                  tooltip={item.tooltip}
                  shortcut={item.shortcut}
                  onSelect={() => onMenuClick(item.command!, item.label!)}
                />
              )
            )}
          </Menubar.Content>
        </Menubar.Portal>
      </Menubar.Menu>
    ))}
  </Menubar.Root>
);

export function AppMenu(): React.JSX.Element {
  const { t } = useTranslation();
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [isMaximized, setMaximized] = useState(false);

  //---- 主菜单定义（加上 tooltip 字段）
  const menuGroups = [
    {
      title: t('ui.menus.app.library.title'),
      items: [
        { icon: 'File', command: 'workspace/createLibrary', 
          label: t('ui.menus.app.library.createLibrary'), 
          tooltip: t('ui.menus.app.library.createLibraryTooltip'), 
          shortcut: t('ui.menus.app.library.createLibraryShortcut') 
        },
        { icon: 'FolderOpen', command: 'workspace/addLibrary', 
          label: t('ui.menus.app.library.addLibrary'), 
          tooltip: t('ui.menus.app.library.addLibraryTooltip'), 
          shortcut: t('ui.menus.app.library.addLibraryShortcut') 
        },
        { separator: true },
        { icon: 'Save', command: 'workspace/saveLibrary', 
          label: t('ui.menus.app.library.saveLibrary'), 
          tooltip: t('ui.menus.app.library.saveLibraryTooltip'), 
          shortcut: t('ui.menus.app.library.saveLibraryShortcut') 
        },
        { icon: 'FolderClosed', command: 'workspace/removeLibrary', 
          label: t('ui.menus.app.library.removeLibrary'), 
          tooltip: t('ui.menus.app.library.removeLibraryTooltip'), 
          shortcut: t('ui.menus.app.library.removeLibraryShortcut') 
        },
        { separator: true },
        { icon: 'X', command: 'main-window/close', 
          label: t('ui.menus.app.library.quit'), 
          tooltip: t('ui.menus.app.library.quitTooltip'), 
          shortcut: t('ui.menus.app.library.quitShortcut') 
        },
      ],
    },
    {
      title: t('ui.menus.app.document.title'),
      items: [
        { 
          command: 'tab/new', 
          label: t('ui.menus.app.document.newDocument'), 
          tooltip: t('ui.menus.app.document.newDocumentTooltip'), 
          shortcut: t('ui.menus.app.document.newDocumentShortcut') 
        },
        { 
          icon: 'File', 
          command: 'document/open', 
          label: t('ui.menus.app.document.openDocument'), 
          tooltip: t('ui.menus.app.document.openDocumentTooltip'), 
          shortcut: t('ui.menus.app.document.openDocumentShortcut') 
        },
        { 
          icon: 'Save', 
          command: 'tab/save', 
          label: t('ui.menus.app.document.saveDocument'), 
          tooltip: t('ui.menus.app.document.saveDocumentTooltip'), 
          shortcut: t('ui.menus.app.document.saveDocumentShortcut') 
        },
        {
          command: 'tab/close', 
          label: t('ui.menus.app.document.closeDocument'), 
          tooltip: t('ui.menus.app.document.closeDocumentTooltip'), 
          shortcut: t('ui.menus.app.document.closeDocumentShortcut') 
        },
      ],
    },
  ];

  useEffect(() => {
    const onClick = () => setOpenMenu(null);
    window.addEventListener('click', onClick);
    return () => window.removeEventListener('click', onClick);
  }, []);

  const handleWindowControl = (action: 'minimize' | 'maximize' | 'close') => {
    setMaximized(action === 'maximize' ? !isMaximized : isMaximized);
    dispatchCommand(`main-window/${action}`, {});
  };

  const handleMenuClick = (commandId: string | undefined, title: string) => {
    setOpenMenu(null);
    if (commandId) {
      Logger.debug(`Menu Command Clicked: ${commandId}`);
      dispatchCommand(commandId, {});
    } else {
      Logger.warn(`Menu item "${title}" has no command defined.`);
    }
  };

  return (
    // 固定高度，flex横向布局，所有子项中对齐(items-center)
    <div id='AppMenu' className="AppMenuContainer h-8 flex items-center px-2 select-none"
      style={{ WebkitAppRegion: 'drag', userSelect: 'none' } as AppRegionStyle}
    >
      <AppIcon/>
      <MainMenuBar menuGroups={menuGroups} onMenuClick={handleMenuClick}/>
      <div className="flex-1" /> {/* 占位符，占据所有中间未分配空白 */}
      <WindowControls isMaximized={isMaximized} onControl={handleWindowControl}/>
    </div>
  );
}
