import { dispatchCommand } from "@commands/registry.js";
import { SUPPORTED_LANGUAGES, resolveLanguage } from "@lib/i18n.js";
import { useTranslation } from "@lib/renderer/useTranslation.js";
import { LucideIcon } from "@lib/renderer/LucideIcon.js"
import { settingsActions } from "@state/slices/settings/slice.js";
import { isFeatureEnabled, VERSION_CHECK_FOR_UPDATES } from "@state/slices/settings/types.js";
import { useAppDispatch, useAppSelector } from "@state/storeHolder.js";
import clsx from "clsx";
import React from "react";
import { DropdownMenu } from "radix-ui"
import { useHoverSubmenu } from "@renderer/components/useHoverSubmenu.js";

interface Props {
  className?: string;
}

export const SettingsMADM = ({ className }: Props) => {
  const { t } = useTranslation();
  const checkForUpdates = isFeatureEnabled(useAppSelector(state => state.settings.checkForUpdates), VERSION_CHECK_FOR_UPDATES);
  const languageSetting = useAppSelector(state => state.settings.language);
  const appDispatch = useAppDispatch();
  
  const languageSubmenu = useHoverSubmenu();
  const toolsSubmenu = useHoverSubmenu();

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          title={t('ui.components.navbar.settings')}
          className={clsx('NavIconButton flex items-center justify-center', className)}
        >
          <LucideIcon
            name='Settings'
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
          <DropdownMenu.Item className="MenuItem" onClick={() => {
            dispatchCommand('ui/command-palette/show', {});
          }}>
            {t('commands.ui.commands.commandPalette')}
          </DropdownMenu.Item>
          <DropdownMenu.Item className="MenuItem justify-between">
            {t('commands.ui.commands.settings')}
            <span className="MenuItemShortcut">
              ⌘+N
            </span>
          </DropdownMenu.Item>
          <DropdownMenu.Sub {...languageSubmenu.subProps}>
            <DropdownMenu.SubTrigger className="MenuItem" {...languageSubmenu.triggerProps}>
              {t('settings.language.title')}
              <div className="MenuItemSuffix">
                <LucideIcon name="ChevronRight" size={16} />
              </div>
            </DropdownMenu.SubTrigger>
            <DropdownMenu.Portal>
              <DropdownMenu.SubContent
                className="MenuContent"
                sideOffset={2}
                alignOffset={-5}
                {...languageSubmenu.contentProps}
              >
                <DropdownMenu.RadioGroup 
                  value={languageSetting} 
                  onValueChange={(value) => {
                    appDispatch(settingsActions.setLanguage(value));
                  }}
                >
                  <DropdownMenu.RadioItem className="MenuItem MenuItemWithIndicator" value="auto">
                    <DropdownMenu.ItemIndicator className="MenuItemIndicator">             
                      ●
                    </DropdownMenu.ItemIndicator>
                    {t('settings.language.auto')}
                  </DropdownMenu.RadioItem>
                  {Object.entries(SUPPORTED_LANGUAGES).map(([code, name]) => (
                    <DropdownMenu.RadioItem key={code} className="MenuItem MenuItemWithIndicator" value={code}>
                      <DropdownMenu.ItemIndicator className="MenuItemIndicator">             
                        ●
                      </DropdownMenu.ItemIndicator>
                      {t(`settings.language.${code}`)}
                    </DropdownMenu.RadioItem>
                  ))}
                </DropdownMenu.RadioGroup>
              </DropdownMenu.SubContent>
            </DropdownMenu.Portal>
          </DropdownMenu.Sub>

          <DropdownMenu.Sub {...toolsSubmenu.subProps}>
            <DropdownMenu.SubTrigger className="MenuItem" {...toolsSubmenu.triggerProps}>
              {t('commands.ui.commands.moreTools')}
              <div className="MenuItemSuffix">
                <LucideIcon name="ChevronRight" size={16} />
              </div>
            </DropdownMenu.SubTrigger>
            <DropdownMenu.Portal>
              <DropdownMenu.SubContent
                className="MenuContent"
                sideOffset={2}
                alignOffset={-5}
                {...toolsSubmenu.contentProps}
              >
                <DropdownMenu.Item className="MenuItem">
                  {t('commands.ui.commands.developerTools')}
                </DropdownMenu.Item>
              </DropdownMenu.SubContent>
            </DropdownMenu.Portal>
          </DropdownMenu.Sub>

          <DropdownMenu.Separator className="MenuItemSeparator" />

          <DropdownMenu.CheckboxItem
            className="MenuItem MenuItemIndicatorOverlay"
            checked={checkForUpdates}
            onCheckedChange={value => {
              appDispatch(settingsActions.setCheckForUpdates(value));
            }}
          >
            <DropdownMenu.ItemIndicator className="MenuItemIndicator">             
              ✓
            </DropdownMenu.ItemIndicator>
            {t("commands.ui.commands.checkForUpdates")}
          </DropdownMenu.CheckboxItem>
          <DropdownMenu.Separator className="MenuItemSeparator" />

          <DropdownMenu.Item className="MenuItem" onClick={() => {
            dispatchCommand('ui/about-dialog/show', {});
          }}>
            About
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
};
