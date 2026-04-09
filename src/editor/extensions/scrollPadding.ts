import { Logger } from "@lib/logast.js"
import { EditorView, ViewUpdate } from "@codemirror/view"

/**
 * VS Code 风格的光标滚动逻辑：
 *  - 光标上下方始终保留 scrollPadding 行的缓冲
 *  - 不等到光标离开视口才滚动
 */
export function scrollPadding(scrollPaddingLines = 5) {
  let lastCursorPos: number | null = null
  return EditorView.updateListener.of((update: ViewUpdate) => {
    // 仅在 选区(光标)变化且视口变化时处理
    if (!update.selectionSet)
      return

    // update.transactions.map(tr => {
    //   Logger.debug('scrollPaddingExtension', 'Transaction user event:', tr.annotation(Transaction.userEvent) || 'none');
    // })

    // 如果是鼠标点击设置光标，不触发滚动逻辑
    if (update.transactions.some(tr => tr.isUserEvent("select.pointer")))
      return

    if (!update.view) {
      Logger.warn('scrollPadding', 'No view in update, cannot proceed.');
      return;
    }

    const view = update.view
    const scrollDOM = view.scrollDOM

    const cursorPos = view.state.selection.main.head

    const lastCursorLine = (lastCursorPos && lastCursorPos < view.state.doc.length)
       ? view.lineBlockAt(lastCursorPos) : null
    const cursorLine = view.lineBlockAt(cursorPos)

    lastCursorPos = cursorPos // 更新 lastCursorPos

    const lineHeight = view.defaultLineHeight
    const gapHeight = scrollPaddingLines * lineHeight

    const topVisible = scrollDOM.scrollTop
    const bottomVisible = topVisible + scrollDOM.clientHeight

    // 判断光标移动的 上下方向 (左右移动我们不管)
    const movingUp = lastCursorLine ? lastCursorLine.top > cursorLine.top : false;
    const movingDown = lastCursorLine ? lastCursorLine.top < cursorLine.top : false;

    // 光标上方不足 padding 时，并且此刻光标是在向上移动，那么向上滚动
    if (!movingDown && cursorLine.top < topVisible + gapHeight) {
      scrollDOM.scrollTop = Math.max(cursorLine.top - gapHeight, 0)
      return
    }

    // 光标下方不足 padding 时，，并且此刻光标是在向下移动，那么向下滚动
    if (!movingUp && cursorLine.bottom > bottomVisible - gapHeight) {
      scrollDOM.scrollTop = cursorLine.bottom - scrollDOM.clientHeight + gapHeight
      return
    }
  })
}
