import React from 'react'
import { DropdownMenu } from 'radix-ui'
import { useAppDispatch, useAppSelector } from '@state/storeHolder.js'
import { docActions } from '@state/slices/doc/slice.js'
import { LucideIcon } from '@lib/renderer/LucideIcon.js'
import clsx from 'clsx'

interface AgentSelectorProps {
  docId: string
}

/**
 * Standalone Agent selector component.
 * - Reads available agents from Redux agent slice
 * - Reads current doc's agentId/agentLocked from Redux doc slice
 * - When locked: shows read-only label
 * - When not locked: shows dropdown to switch agent
 */
export function AgentSelector({ docId }: AgentSelectorProps): React.JSX.Element {
  const dispatch = useAppDispatch()

  const availableAgents = useAppSelector((state) => state.agent.availableAgents)
  const doc = useAppSelector((state) => state.doc.docs[docId])
  const agentId = doc?.agentId ?? 'admin'
  const agentLocked = doc?.agentLocked ?? false

  const handleAgentChange = (name: string) => {
    if (agentLocked) return
    dispatch(docActions.setAgentId({ docId, agentId: name }))
  }

  if (agentLocked) {
    return (
      <div
        title={`Agent: ${agentId} (已锁定)`}
        className={clsx('flex items-center gap-1 px-2 py-1 text-sm opacity-60 cursor-default')}
      >
        <LucideIcon name="Zap" size={14} />
        <span>{agentId}</span>
      </div>
    )
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          title={`当前Agent: ${agentId}`}
          className={clsx('flex items-center gap-1 px-2 py-1 text-sm rounded hover:bg-gray-100 cursor-pointer')}
        >
          <LucideIcon name="Zap" size={14} />
          <span>{agentId}</span>
          <LucideIcon name="ChevronDown" size={12} />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          side="bottom"
          align="start"
          sideOffset={4}
          className="MenuContent"
        >
          {availableAgents.length === 0 && (
            <div className="px-2 py-1 text-zinc-400 text-sm">(未连接)</div>
          )}
          {availableAgents.map((name) => (
            <DropdownMenu.Item
              key={name}
              className="MenuItem"
              disabled={name === agentId}
              onSelect={() => handleAgentChange(name)}
            >
              <LucideIcon name={name === agentId ? 'Check' : 'Empty'} size={16} />
              <span className="px-1">{name}</span>
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
