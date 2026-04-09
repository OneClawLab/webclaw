import React, { useState, useEffect, useRef } from 'react'
import { AppCommand } from '@commands/types.js'
import { getAllCommandGroups } from '@commands/registry.js'
import { withLogging } from '@lib/renderer/withLogging.js'
import { a18, hkt } from '@lib/i18n.js'
import { useTranslation } from '@lib/renderer/useTranslation.js'

type Props = {
  onClose?: () => void
}

function CommandPaletteBase({ onClose }: Props): React.JSX.Element {
  const { t } = useTranslation();
  const [query, setQuery] = useState('')
  const dialogRef = useRef<HTMLDivElement>(null)

  const lowerQuery = query.toLowerCase()
  const groups = getAllCommandGroups()
    .map(group => {
      const filtered = group.commands.filter(cmd => {
        const target = [a18(cmd.title!), ...(cmd.keywords || [])].join(' ').toLowerCase()
        return target.includes(lowerQuery)
      })
      return filtered.length > 0 ? { ...group, commands: filtered } : null
    })
    .filter(Boolean) as { title: string; commands: AppCommand<any>[] }[]

  // ESC关闭
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose?.()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // 点击对话框外关闭
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (dialogRef.current && !dialogRef.current.contains(e.target as Node)) {
      onClose?.()
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/20 flex items-start justify-center"
      onMouseDown={handleBackdropClick}
    >
      <div
        ref={dialogRef}
        className="absolute top-20 left-1/5 w-200 min-w-200 min-h-30 bg-white rounded-xl shadow-lg p-4"
        onMouseDown={e => e.stopPropagation()} // 阻止冒泡，避免点击内容区也触发关闭
      >
        <input
          type="text"
          autoFocus
          placeholder={t('views.commandPalette.searchPlaceholder')}
          onChange={e => setQuery(e.target.value)}
          className="w-full border px-3 py-2 mb-3 rounded"
        />

        <div className="max-h-96 overflow-y-auto">
          <ul>
            {groups.map(group => (
              <li key={a18(group.title)}>
                <div className="text-sm font-semibold text-gray-500 mb-1 mt-2">{a18(group.title)}</div>
                {group.commands.map(cmd => (
                  <button
                    key={cmd.id}
                    className="w-full text-left py-1 hover:bg-gray-100 px-2 rounded"
                    onClick={() => cmd.run({})}
                  >
                    {a18(cmd.title!)}
                    {cmd.shortcut && (
                      <span className="float-right text-sm text-gray-400">{hkt(cmd.shortcut)}</span>
                    )}
                  </button>
                ))}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

const CommandPalette = withLogging(CommandPaletteBase, { name: 'CommandPalette' });

// Modal dialog must be exported as default to allow dynamic import
export default CommandPalette;
