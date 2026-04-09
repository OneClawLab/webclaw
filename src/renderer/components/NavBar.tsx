import React from 'react'
import { useAppSelector } from '@state/storeHolder.js'
import { dispatchCommand } from '@commands/registry.js'
import { LucideIcon } from '@lib/renderer/LucideIcon.js'
import clsx from 'clsx'
import { SettingsMADM } from '@renderer/dropdowns/SettingsMADM.js'
import { TestMADM } from '@renderer/dropdowns/TestMADM.js'
import { useTranslation } from '@lib/renderer/useTranslation.js'

type NavIconButtonProps = {
  className?: string
  iconName: string
  active: boolean
  onClick: () => void
  title?: string
}

function NavIconButton({ className, iconName, active, onClick, title } : NavIconButtonProps): React.JSX.Element {
  return (
    <button
      title={title}
      className={clsx('NavIconButton flex items-center justify-center', { active }, className)}
      onClick={onClick}
    >
      <LucideIcon
        name={iconName}
        size={28}
        className={clsx({ active })}
      />
    </button>
  )
}

export function NavBar(): React.JSX.Element {
  const { t } = useTranslation();
  const layout = useAppSelector(state => state.ui.layout);
  const isOutlineViewVisible = layout.isOutlineViewVisible;
  const isStatusBarVisible = layout.isStatusBarVisible;

  return (
    // 竖向布局，宽度固定，高度撑满父容器
    <nav id='NavBar' className="flex flex-col items-center">
      <NavIconButton
        iconName="ListTree"
        active={isOutlineViewVisible}
        onClick={() => dispatchCommand('ui/outline-view/toggle', {})}
        title={t('commands.ui.commands.toggleOutlineView')}
      />
      <NavIconButton
        iconName="BarChart"
        active={isStatusBarVisible}
        onClick={() => dispatchCommand('ui/status-bar/toggle', {})}
        title={t('commands.ui.commands.toggleStatusBar')}
      />
      <div className="grow" />
      {/* <TestMADM/> */}
      <SettingsMADM/>
    </nav>
  )
}
