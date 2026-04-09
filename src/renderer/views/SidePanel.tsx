import { withLogging } from '@lib/renderer/withLogging.js'
import React, { useState } from 'react'
import { ChatPanel } from './ChatPanel.js'
import { DebugWindow } from './DebugWindow.js'
import { ThreadBrowser } from './ThreadBrowser.js'
import { LucideIcon } from '@lib/renderer/LucideIcon.js'
import { dispatchCommand } from '@commands/registry.js'

function RightActions(): React.JSX.Element {
  return (
    <div className="flex items-center space-x-2 pr-2 flex-1 justify-end">
      <button className="p-1 hover:bg-gray-200 rounded">
        <LucideIcon name="Info" size={16} />
      </button>
      <button className="p-1 hover:bg-gray-200 rounded" onClick={() => dispatchCommand('ui/side-panel/toggle', {})}>
        <LucideIcon name="X" size={16} />
      </button>
    </div>
  )
}

function SidePanelBase(): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<'debug' | 'chat' | 'threads'>('debug')

  return (
    <aside id="SidePanel" className="flex flex-col h-full w-full min-h-0 min-w-0 bg-amber-50 border-l border-gray-200">
      <div id="SidePanelHeader" className="flex items-center border-b border-gray-200 bg-white">
        <div className="flex border-b">
          <button
            className={`px-4 py-2 ${activeTab === 'debug' ? 'font-bold border-b-2 border-amber-500' : ''}`}
            onClick={() => setActiveTab('debug')}
          >
            Debug
          </button>
          <button
            className={`px-4 py-2 ${activeTab === 'chat' ? 'font-bold border-b-2 border-amber-500' : ''}`}
            onClick={() => setActiveTab('chat')}
          >
            Chat
          </button>
          <button
            className={`px-4 py-2 ${activeTab === 'threads' ? 'font-bold border-b-2 border-amber-500' : ''}`}
            onClick={() => setActiveTab('threads')}
          >
            Threads
          </button>
        </div>
        <RightActions />
      </div>

      <div id='SidePanelContent' className="flex-1 min-h-0">
        {activeTab === 'chat' && <ChatPanel />}
        {activeTab === 'debug' && <DebugWindow />}
        {activeTab === 'threads' && <ThreadBrowser />}
      </div>
    </aside>
  )
}

export const SidePanel = withLogging(SidePanelBase, { name: 'SidePanel' });
