import React, { useEffect, useState } from 'react'

interface ThreadInfo {
  agentId: string
  threadId: string
  path: string
  createdAt?: string
  lastActivity?: string
  eventCount?: number
}

export function ThreadBrowser(): React.JSX.Element {
  const [threads, setThreads] = useState<ThreadInfo[]>([])
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null)
  const [selectedThread, setSelectedThread] = useState<ThreadInfo | null>(null)
  const [threadContent, setThreadContent] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadThreads()
  }, [])

  async function loadThreads() {
    setLoading(true)
    setError(null)
    try {
      const homeDir = window.env?.homeDir ?? ''
      const agentsPath = `${homeDir}/.theclaw/agents`

      const exists = await window.fs.exists(agentsPath)
      if (!exists) {
        setError('~/.theclaw/agents/ 目录不存在。请检查 TheClaw 是否已安装并运行过。')
        setLoading(false)
        return
      }

      const agentDirs = await window.fs.listDir(agentsPath)
      const allThreads: ThreadInfo[] = []

      for (const agentDir of agentDirs) {
        if (!agentDir.isDirectory) continue
        const threadsPath = `${agentDir.path}/threads`
        const threadsExist = await window.fs.exists(threadsPath)
        if (!threadsExist) continue

        const threadDirs = await window.fs.listDir(threadsPath)
        for (const threadDir of threadDirs) {
          if (!threadDir.isDirectory) continue
          const eventsPath = `${threadDir.path}/events.jsonl`
          let eventCount = 0
          let createdAt: string | undefined
          let lastActivity: string | undefined

          try {
            const eventsExist = await window.fs.exists(eventsPath)
            if (eventsExist) {
              const content = await window.fs.readText(eventsPath)
              const lines = content.split('\n').filter(l => l.trim())
              eventCount = lines.length
              if (lines.length > 0) {
                try {
                  const first = JSON.parse(lines[0]!)
                  createdAt = first.timestamp ?? first.created_at
                } catch {}
                try {
                  const last = JSON.parse(lines[lines.length - 1]!)
                  lastActivity = last.timestamp ?? last.created_at
                } catch {}
              }
            }
          } catch {}

          allThreads.push({
            agentId: agentDir.name,
            threadId: threadDir.name,
            path: threadDir.path,
            createdAt,
            lastActivity,
            eventCount,
          })
        }
      }

      setThreads(allThreads)
    } catch (err) {
      setError(`加载失败: ${(err as Error).message}`)
    } finally {
      setLoading(false)
    }
  }

  async function selectThread(thread: ThreadInfo) {
    setSelectedThread(thread)
    try {
      const eventsPath = `${thread.path}/events.jsonl`
      const content = await window.fs.readText(eventsPath)
      const lines = content.split('\n').filter(l => l.trim())
      const md = lines.map(line => {
        try {
          const event = JSON.parse(line)
          const ts = event.timestamp ?? event.created_at ?? ''
          const type = event.type ?? event.event_type ?? 'event'
          const text = event.text ?? event.content ?? JSON.stringify(event)
          return `### [${ts}] ${type}\n\n${text}\n`
        } catch {
          return `\`\`\`\n${line}\n\`\`\`\n`
        }
      }).join('\n---\n\n')
      setThreadContent(md)
    } catch (err) {
      setThreadContent(`> 读取失败: ${(err as Error).message}`)
    }
  }

  const agents = [...new Set(threads.map(t => t.agentId))]
  const filteredThreads = selectedAgent
    ? threads.filter(t => t.agentId === selectedAgent)
    : threads

  if (loading) {
    return <div className="p-4 text-gray-500 text-sm">加载中...</div>
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="text-red-500 text-sm mb-2">{error}</div>
        <button
          onClick={loadThreads}
          className="px-3 py-1 bg-gray-100 rounded hover:bg-gray-200 text-sm"
        >
          重试
        </button>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0">
      {/* Left: thread list */}
      <div className="w-56 flex flex-col border-r border-gray-200 min-h-0 shrink-0">
        {/* Agent filter */}
        <div className="p-2 border-b border-gray-200">
          <select
            value={selectedAgent ?? ''}
            onChange={e => setSelectedAgent(e.target.value || null)}
            className="w-full text-xs border border-gray-300 rounded px-2 py-1"
          >
            <option value="">全部 Agent</option>
            {agents.map(a => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>
        {/* Thread list */}
        <div className="flex-1 overflow-y-auto">
          {filteredThreads.length === 0 && (
            <div className="p-3 text-gray-400 text-xs">暂无 Thread</div>
          )}
          {filteredThreads.map(t => (
            <div
              key={`${t.agentId}/${t.threadId}`}
              className={`p-2 cursor-pointer hover:bg-gray-100 border-b border-gray-100 ${selectedThread?.threadId === t.threadId && selectedThread?.agentId === t.agentId ? 'bg-blue-50' : ''}`}
              onClick={() => selectThread(t)}
            >
              <div className="text-xs font-medium truncate">{t.threadId}</div>
              <div className="text-xs text-gray-400 truncate">{t.agentId}</div>
              {t.eventCount !== undefined && (
                <div className="text-xs text-gray-400">{t.eventCount} 事件</div>
              )}
              {t.lastActivity && (
                <div className="text-xs text-gray-400 truncate">{t.lastActivity}</div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Right: thread content */}
      <div className="flex-1 overflow-y-auto p-3 min-h-0">
        {!selectedThread && (
          <div className="text-gray-400 text-sm">选择一个 Thread 查看内容</div>
        )}
        {selectedThread && (
          <pre className="text-xs whitespace-pre-wrap font-mono">{threadContent}</pre>
        )}
      </div>
    </div>
  )
}
