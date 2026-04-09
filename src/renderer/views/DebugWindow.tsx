import React, { useImperativeHandle, useState, forwardRef } from 'react'
import { useTranslation } from '@lib/renderer/useTranslation.js'

function DebugWindowHeader(): React.JSX.Element {
  const { t } = useTranslation();
  return (
    <div id="Header" className="p-2 border-b font-bold bg-gray-100">{t('views.debugWindow.title')}</div>
  );
}

function DebugWindowContent(): React.JSX.Element {
  const { t } = useTranslation();
  return (
    <div id="Content" className="flex-1 overflow-auto p-2 whitespace-pre-wrap">
      <div className="text-xs text-gray-700 mb-2">{t('views.debugWindow.empty')}</div>
    </div>
  );
}

export function DebugWindow() : React.JSX.Element {
  return (
    <aside id="DebugWindow" className="flex flex-col h-full w-full min-h-0 min-w-0 bg-amber-50 border-l border-gray-200">
      <DebugWindowHeader />
      <DebugWindowContent />
    </aside>
  );
}
