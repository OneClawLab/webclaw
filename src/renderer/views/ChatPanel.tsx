import { LucideIcon } from '@lib/renderer/LucideIcon.js'
import { withLogging } from '@lib/renderer/withLogging.js'
import { useTranslation } from '@lib/renderer/useTranslation.js'
import React from 'react'

function ChatPanelHeader(): React.JSX.Element {
  const { t } = useTranslation();
  return (
    <div id="Header" className="p-2 border-b font-bold bg-gray-100">{t('views.chatPanel.title')}</div>
  )
}

function ChatPanelContent(): React.JSX.Element {
  const { t } = useTranslation();
  return (
    <div id="Content" className="flex-1 overflow-auto p-2">
      <div className="text-xs text-gray-500 mb-2">{t('views.chatPanel.greeting')}</div>
    </div>
  )
}

function ChatPanelInput(): React.JSX.Element {
  const { t } = useTranslation();
  return (
    <div id="Input" className="p-2 border-t-2 min-h-0 min-w-0 w-full">
      <input
        className="ChatPanelInput w-full min-h-0 min-w-0 border-2 rounded px-2 py-1 text-sm focus:outline-none"
        placeholder={t('views.chatPanel.inputPlaceholder')}
      />
    </div>
  )
}

function ChatPanelBase(): React.JSX.Element {
  return (
    <aside id="ChatPanel" className="flex flex-col h-full w-full min-h-0 min-w-0 bg-amber-50 border-l border-gray-200">
      <ChatPanelHeader />
      <ChatPanelContent />
      <ChatPanelInput />
    </aside>
  )
}

export const ChatPanel = withLogging(ChatPanelBase, { name: 'ChatPanel' });
