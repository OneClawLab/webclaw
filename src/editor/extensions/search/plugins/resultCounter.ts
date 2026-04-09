import { EditorView, ViewPlugin, ViewUpdate } from "@codemirror/view"
import { getSearchQuery, SearchQuery, searchPanelOpen } from "@codemirror/search"

/**
 * 搜索结果计数插件
 * 在搜索输入框中显示匹配结果的数量和当前位置
 */
export const searchResultCounter = ViewPlugin.fromClass(class {
  countElement: HTMLElement | null = null
  lastQuery: SearchQuery | null = null
  panelOpen: boolean = false
  
  constructor(public view: EditorView) {
    this.panelOpen = searchPanelOpen(view.state)
    this.updateCount()
  }

  update(update: ViewUpdate) {
    // 检查搜索面板是否打开/关闭
    const isPanelOpen = searchPanelOpen(update.state)
    const panelStateChanged = isPanelOpen !== this.panelOpen
    this.panelOpen = isPanelOpen
    
    // 检查搜索查询是否变化（包括搜索文本和所有选项）
    const currentQuery = getSearchQuery(update.state)
    const queryChanged = !this.lastQuery || !currentQuery.eq(this.lastQuery)
    
    if (queryChanged) {
      this.lastQuery = currentQuery
    }
    
    // 当文档、选区、视口、搜索查询或面板状态变化时更新计数
    if (update.docChanged || update.selectionSet || update.viewportChanged || queryChanged || panelStateChanged) {
      this.updateCount()
    }
  }

  updateCount() {
    // 延迟执行，确保搜索面板已经渲染
    setTimeout(() => {
      const panel = this.view.dom.querySelector('.cm-panel.cm-search')
      if (!panel) {
        this.countElement = null
        return
      }

      // 查找搜索输入框
      const searchInput = panel.querySelector('input[name="search"]') as HTMLInputElement
      if (!searchInput) return

      // 检查是否已经有包装容器
      let wrapper = searchInput.parentElement
      if (!wrapper || !wrapper.classList.contains('cm-search-input-wrapper')) {
        // 创建包装容器
        wrapper = document.createElement('div')
        wrapper.className = 'cm-search-input-wrapper'
        
        // 保存当前焦点状态，避免 DOM 操作影响焦点
        const hadFocus = document.activeElement === searchInput
        const cursorPos = searchInput.selectionStart || 0
        
        // 将输入框包装起来
        if (searchInput.parentNode) {
          searchInput.parentNode.insertBefore(wrapper, searchInput)
          wrapper.appendChild(searchInput)
        }
        
        // 恢复焦点状态
        if (hadFocus) {
          searchInput.focus()
          searchInput.setSelectionRange(cursorPos, cursorPos)
        }
      }

      // 查找或创建计数显示元素
      let countEl = wrapper.querySelector('.cm-search-count') as HTMLElement
      if (!countEl) {
        countEl = document.createElement('span')
        countEl.className = 'cm-search-count'
        wrapper.appendChild(countEl)
        
        // 添加输入事件监听，实时更新计数
        searchInput.addEventListener('input', () => {
          setTimeout(() => this.updateCount(), 100)
        })
      }
      
      this.countElement = countEl

      // 获取搜索查询
      const query = getSearchQuery(this.view.state)
      
      if (!query.search || !query.valid) {
        countEl.textContent = ''
        return
      }

      try {
        // 使用 getCursor 获取所有匹配项
        const cursor = query.getCursor(this.view.state)
        const matches: Array<{from: number, to: number}> = []
        
        // 收集所有匹配项（最多 10000 个）
        let result = cursor.next()
        while (!result.done && matches.length < 10000) {
          matches.push({ from: result.value.from, to: result.value.to })
          result = cursor.next()
        }
        
        if (matches.length >= 10000) {
          countEl.textContent = '10000+'
        } else if (matches.length === 0) {
          countEl.textContent = 'No results'
        } else {
          // 找到当前选中的匹配索引
          const selection = this.view.state.selection.main
          let currentIndex = 0
          
          for (let i = 0; i < matches.length; i++) {
            if (matches[i].from === selection.from && matches[i].to === selection.to) {
              currentIndex = i + 1
              break
            }
          }
          
          if (currentIndex > 0) {
            countEl.textContent = `${currentIndex} of ${matches.length}`
          } else {
            countEl.textContent = `${matches.length}`
          }
        }
      } catch (e) {
        console.error('Search count error:', e)
        countEl.textContent = ''
      }
    }, 50)
  }

  destroy() {
    if (this.countElement && this.countElement.parentNode) {
      this.countElement.parentNode.removeChild(this.countElement)
    }
  }
})
