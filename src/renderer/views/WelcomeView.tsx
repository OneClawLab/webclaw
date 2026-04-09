import React from 'react'
import { withLogging } from '@lib/renderer/withLogging.js';
import { useTranslation } from '@lib/renderer/useTranslation.js';

export function WelcomeView(): React.JSX.Element {
  const { t } = useTranslation();
  return (
    <div id="WelcomeView" className="flex flex-col w-full h-full min-w-0 min-h-0 items-center justify-center">
      <div className="ml-2">{t('ui.welcome.title')}</div>
      <div className="ml-2">{t('ui.welcome.subtitle')}</div>
    </div>
  )
}
