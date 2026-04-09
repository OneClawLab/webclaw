import { EditorView, ViewPlugin, ViewUpdate } from "@codemirror/view"
import { searchPanelOpen } from "@codemirror/search"

/**
 * 替换行展开/收起控制插件
 * 默认隐藏替换行，通过左侧按钮控制显示/隐藏
 */
export const replaceToggle = ViewPlugin.fromClass(class {
  panelOpen: boolean = false
  toggleButton: HTMLElement | null = null
  buttonInjected: boolean = false
  
  constructor(public view: EditorView) {
    this.panelOpen = searchPanelOpen(view.state)
  }

  update(update: ViewUpdate) {
    const isPanelOpen = searchPanelOpen(update.state)
    const wasJustOpened = !this.panelOpen && isPanelOpen
    const wasJustClosed = this.panelOpen && !isPanelOpen
    this.panelOpen = isPanelOpen
    
    if (wasJustOpened) {
      // 面板刚打开，注入按钮（CSS 默认已经是收起状态）
      setTimeout(() => {
        const panel = this.view.dom.querySelector('.cm-panel.cm-search')
        if (panel && !this.buttonInjected) {
          this.injectToggleButton(panel as HTMLElement)
          this.buttonInjected = true
        }
      }, 10)
    }
    
    if (wasJustClosed) {
      // 面板关闭，重置状态
      this.buttonInjected = false
      this.toggleButton = null
    }
  }

  injectToggleButton(panel: HTMLElement) {
    // 创建展开/收起按钮
    const button = document.createElement('button')
    button.className = 'cm-search-toggle-replace'
    button.innerHTML = '<span style="display: inline-block;">›</span>' // 使用 span 包裹以便精确控制
    button.title = '展开替换'
    button.setAttribute('type', 'button')
    
    // 点击事件
    button.addEventListener('click', (e) => {
      e.preventDefault()
      this.toggleReplaceRow()
    })
    
    // 插入到面板最前面
    panel.insertBefore(button, panel.firstChild)
    this.toggleButton = button
  }

  toggleReplaceRow() {
    const panel = this.view.dom.querySelector('.cm-panel.cm-search')
    if (!panel || !this.toggleButton) return
    
    const isExpanded = panel.classList.contains('cm-search-replace-expanded')
    
    if (isExpanded) {
      // 收起
      panel.classList.remove('cm-search-replace-expanded')
      this.toggleButton.innerHTML = '<span style="display: inline-block;">›</span>'
      this.toggleButton.title = '展开替换'
    } else {
      // 展开
      panel.classList.add('cm-search-replace-expanded')
      this.toggleButton.innerHTML = '<span style="display: inline-block;">⌄</span>'
      this.toggleButton.title = '收起替换'
    }
  }

  destroy() {
    // 清理
    this.toggleButton = null
    this.buttonInjected = false
  }
})
