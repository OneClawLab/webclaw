import { EditorView } from "@codemirror/view"
import { getSearchQuery, findNext, searchPanelOpen } from "@codemirror/search"

/**
 * 搜索行为增强
 * 提供自动跳转和焦点管理等交互优化
 */
export const searchBehavior = EditorView.updateListener.of((update) => {
  const query = getSearchQuery(update.state)
  const prevQuery = getSearchQuery(update.startState)
  
  // 检查面板打开/关闭状态
  const wasOpen = searchPanelOpen(update.startState)
  const isOpen = searchPanelOpen(update.state)
  
  // 查询变化时自动跳转到第一个匹配项（仅当面板已打开时）
  if (!query.eq(prevQuery) && query.search && query.valid && isOpen) {
    // 保存当前输入框的光标位置
    const panel = update.view.dom.querySelector('.cm-panel.cm-search')
    const searchInput = panel?.querySelector('input[name="search"]') as HTMLInputElement
    const cursorPos = searchInput?.selectionStart || 0
    
    // 检查当前焦点是否在搜索输入框中
    const inputHasFocus = document.activeElement === searchInput
    
    setTimeout(() => {
      findNext(update.view)
      
      // 只有当输入框原本有焦点时才恢复焦点，避免干扰面板的焦点管理
      if (inputHasFocus && searchInput) {
        searchInput.focus()
        searchInput.setSelectionRange(cursorPos, cursorPos)
      }
    }, 10)
  }
  
  // 面板打开时设置光标到输入框末尾
  if (!wasOpen && isOpen) {
    // 使用稍长的延迟，确保 CodeMirror 完成面板初始化和文本填充
    setTimeout(() => {
      const panel = update.view.dom.querySelector('.cm-panel.cm-search')
      const searchInput = panel?.querySelector('input[name="search"]') as HTMLInputElement
      if (searchInput) {
        // 无论输入框是否有内容，都将光标移到末尾
        const length = searchInput.value.length
        searchInput.focus()
        searchInput.setSelectionRange(length, length)
      }
    }, 50)
  }
})
