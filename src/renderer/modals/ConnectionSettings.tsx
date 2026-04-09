import React, { useRef, useState } from 'react'
import { useAppDispatch, useAppSelector } from '@state/storeHolder.js'
import { connectionActions } from '@state/slices/connection/slice.js'

type Props = {
  onClose?: () => void
}

const statusLabel: Record<string, string> = {
  disconnected: '未连接',
  connecting: '连接中...',
  connected: '已连接',
  authenticated: '已认证',
  reconnecting: '重连中...',
}

const statusColor: Record<string, string> = {
  disconnected: 'text-red-500',
  connecting: 'text-yellow-500',
  connected: 'text-green-500',
  authenticated: 'text-green-500',
  reconnecting: 'text-yellow-500',
}

function ConnectionSettings({ onClose }: Props): React.JSX.Element {
  const dispatch = useAppDispatch()
  const dialogRef = useRef<HTMLDivElement>(null)

  const connection = useAppSelector((state) => state.connection)

  const [host, setHost] = useState(connection.host)
  const [port, setPort] = useState(String(connection.port))
  const [channelId, setChannelId] = useState(connection.channelId)
  const [peerId, setPeerId] = useState(connection.peerId)

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (dialogRef.current && !dialogRef.current.contains(e.target as Node)) {
      onClose?.()
    }
  }

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const handleSave = () => {
    const portNum = parseInt(port, 10)
    const config = {
      host: host.trim(),
      port: isNaN(portNum) ? connection.port : portNum,
      channelId: channelId.trim(),
      peerId: peerId.trim(),
    }
    dispatch(connectionActions.setConfig(config))
    ;(window as any).xgw?.updateConfig(config)
    onClose?.()
  }

  const status = connection.status

  return (
    <div
      className="fixed inset-0 z-50 bg-black/20 flex items-center justify-center"
      onMouseDown={handleBackdropClick}
    >
      <div
        ref={dialogRef}
        className="bg-white rounded-xl shadow-lg p-6 w-96"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold mb-4">连接设置</h2>

        {/* Connection status */}
        <div className="mb-4 flex items-center gap-2 text-sm">
          <span className="text-gray-500">状态:</span>
          <span className={statusColor[status] ?? 'text-gray-500'}>
            {statusLabel[status] ?? status}
          </span>
        </div>

        <div className="space-y-3 mb-6">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Host</label>
            <input
              type="text"
              value={host}
              onChange={(e) => setHost(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400"
              placeholder="127.0.0.1"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Port</label>
            <input
              type="number"
              value={port}
              onChange={(e) => setPort(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400"
              placeholder="29212"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Channel ID</label>
            <input
              type="text"
              value={channelId}
              onChange={(e) => setChannelId(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400"
              placeholder="webui:default"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Peer ID</label>
            <input
              type="text"
              value={peerId}
              onChange={(e) => setPeerId(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400"
              placeholder="owner"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-sm bg-gray-100 rounded hover:bg-gray-200 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-1.5 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  )
}

export default ConnectionSettings
