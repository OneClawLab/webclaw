import { withLogging } from '@lib/renderer/withLogging.js'
import React, { useState } from 'react'

type Props = {
  onDrag: (newWidth: number) => void
  getStartWidth: () => number
  direction: 'ltr' | 'rtl'
}

function ResizerBase(props: Props): React.JSX.Element {
  const [dragging, setDragging] = useState(false)

  function onMouseDown(e: React.MouseEvent) {
    e.preventDefault()

    setDragging(true)

    const startX = e.clientX
    const startWidth = props.getStartWidth()

    document.body.style.cursor = 'col-resize'
    document.body.classList.add('no-select')

    function onMouseMove(ev: MouseEvent) {
      const dx = ev.clientX - startX
      const effectiveDx = props.direction === 'rtl' ? -dx : dx
      props.onDrag(startWidth + effectiveDx)
    }

    function onMouseUp() {
      setDragging(false)

      document.body.style.cursor = 'default'
      document.body.classList.remove('no-select')

      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }

  return (
    <div className={`Resizer transition-colors duration-150 ${dragging ? 'Dragging' : ''}`}
      onMouseDown={onMouseDown}
    />
  )
}

export const Resizer = withLogging(ResizerBase, { name: 'Resizer' });
