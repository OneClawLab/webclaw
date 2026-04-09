import React, { useState, useRef, useEffect, useCallback } from 'react'
import clsx from 'clsx'
import { withLogging } from '@lib/renderer/withLogging.js'

type Props = {
  direction: 'horizontal' | 'vertical'
  handlePosition?: 'start' | 'end'
  initialSize: number
  minSize?: number
  maxSize?: number
  collapsedSize?: number
  collapsible?: boolean
  onResize?: (size: number) => void
  onCollapseChange?: (collapsed: boolean) => void
  collapsed?: boolean
  className?: string
  children: React.ReactNode
}

function ResizablePanelBase({
  direction,
  handlePosition = 'end',
  initialSize,
  minSize = 100,
  maxSize = 1000,
  collapsedSize = 0,
  collapsible = false,
  onResize,
  onCollapseChange,
  collapsed = false,
  className,
  children,
}: Props): React.JSX.Element {
  const [size, setSize] = useState<number>(collapsed ? collapsedSize : initialSize)
  const panelRef = useRef<HTMLDivElement>(null)
  const isHorizontal = direction === 'horizontal'

  // 同步外部 collapsed 改变时，更新 size
  useEffect(() => {
    setSize(collapsed ? collapsedSize : initialSize)
  }, [collapsed, collapsedSize, initialSize])

  const startDragging = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (collapsed) return // 折叠时禁止拖动
      e.preventDefault()
      const start = isHorizontal
        ? 'clientX' in e
          ? e.clientX
          : e.touches[0].clientX
        : 'clientY' in e
        ? e.clientY
        : e.touches[0].clientY

      const onMove = (event: MouseEvent | TouchEvent) => {
        const current = isHorizontal
          ? 'clientX' in event
            ? event.clientX
            : (event as TouchEvent).touches[0].clientX
          : 'clientY' in event
          ? event.clientY
          : (event as TouchEvent).touches[0].clientY
        // 修正 handlePosition 为 start 时的方向
        const delta = handlePosition === 'start' ? start - current : current - start
        const newSize = Math.min(maxSize, Math.max(minSize, size + delta))
        setSize(newSize)
        onResize?.(newSize)
      }

      const onStop = () => {
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseup', onStop)
        document.removeEventListener('touchmove', onMove)
        document.removeEventListener('touchend', onStop)
      }

      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup', onStop)
      document.addEventListener('touchmove', onMove)
      document.addEventListener('touchend', onStop)
    },
    [collapsed, isHorizontal, maxSize, minSize, onResize, size, handlePosition]
  )

  const toggleCollapse = () => {
    if (!collapsible) return
    const newCollapsed = !collapsed
    onCollapseChange?.(newCollapsed)
  }

  const panelStyle = isHorizontal
    ? { width: size, minWidth: 0, transition: 'width 0.2s' }
    : { height: size, minHeight: 0, transition: 'height 0.2s' }

  // TODO ResizalbePanel的视觉样式在这里
  const handle = (
    <div id="Handle" 
      className={clsx(
        'group flex items-center justify-center z-10 bg-transparent hover:bg-blue-500 dark:hover:bg-gray-700 transition-colors select-none',
        isHorizontal ? 'w-1 cursor-col-resize' : 'h-1 cursor-row-resize'
      )}
      onMouseDown={startDragging}
      onTouchStart={startDragging}
    >
      {collapsible && (
        <button
          onClick={toggleCollapse}
          className="bg-gray-300 dark:bg-gray-600 min-w-4 w-4 h-6 rounded-xs opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label={collapsed ? 'Expand panel' : 'Collapse panel'}
          type="button"
        />
      )}
    </div>
  )

  return (
    <div
      id="ResizablePanel" 
      ref={panelRef}
      className={clsx('flex', isHorizontal ? 'flex-row' : 'flex-col', className)}
      style={panelStyle}
    >
      {handlePosition === 'start' && handle}
      <div id="Content" className="flex-1 min-h-0 min-w-0 overflow-hidden">{children}</div>
      {handlePosition === 'end' && handle}
    </div>
  )
}

export const ResizablePanel = withLogging(ResizablePanelBase, { name: 'ResizablePanel' });
