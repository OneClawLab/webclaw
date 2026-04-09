import React, { useRef } from 'react'

type Props = {
  onClose?: () => void
}

function AboutDialog({ onClose }: Props): React.JSX.Element {
  const dialogRef = useRef<HTMLDivElement>(null)

  // 从 window.env 获取版本信息
  const env = (window as any).env as {
    appVer: string
    versions: {
      electron: string
      chrome: string
      node: string
      v8: string
    }
  }

  // 点击对话框外关闭
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (dialogRef.current && !dialogRef.current.contains(e.target as Node)) {
      onClose?.()
    }
  }

  // ESC键关闭
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose?.()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const handleCopyAndClose = () => {
    const text = `WebClaw
Version ${env.appVer}

Electron: ${env.versions.electron}
Chromium: ${env.versions.chrome}
Node.js: ${env.versions.node}
V8: ${env.versions.v8}`

    navigator.clipboard.writeText(text).catch(err => {
      console.error('Failed to copy:', err)
    })
    onClose?.()
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/20 flex items-center justify-center"
      onMouseDown={handleBackdropClick}
    >
      <div
        ref={dialogRef}
        className="bg-white rounded-xl shadow-lg p-6 w-100"
        onMouseDown={e => e.stopPropagation()}
      >
        {/* 应用名称和版本 */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold mb-2">WebClaw</h1>
          <p className="text-gray-600">Version {env.appVer}</p>
        </div>

        {/* 版本信息列表 */}
        <div className="space-y-2 mb-6">
          <div className="flex justify-center items-center gap-2 text-sm">
            <span className="text-gray-600">Electron:</span>
            <span className="font-mono text-gray-800">{env.versions.electron}</span>
          </div>
          <div className="flex justify-center items-center gap-2 text-sm">
            <span className="text-gray-600">Chromium:</span>
            <span className="font-mono text-gray-800">{env.versions.chrome}</span>
          </div>
          <div className="flex justify-center items-center gap-2 text-sm">
            <span className="text-gray-600">Node.js:</span>
            <span className="font-mono text-gray-800">{env.versions.node}</span>
          </div>
          <div className="flex justify-center items-center gap-2 text-sm">
            <span className="text-gray-600">V8:</span>
            <span className="font-mono text-gray-800">{env.versions.v8}</span>
          </div>
        </div>
        <span className="block text-center text-xs text-gray-400 mb-4 min-h-4"> </span>

        {/* 关闭按钮 */}
        <div className="flex justify-center gap-2">
          <button
            onClick={handleCopyAndClose}
            className="px-4 py-1 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
          >
            Copy
          </button>
          <button
            onClick={onClose}
            className="px-4 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  )
}

// Modal dialog must be exported as default to allow dynamic import
export default AboutDialog
