import { EditorView } from '@codemirror/view'

export interface EditorCommand<TArgs = void> {
  id: string                     // 全局唯一 ID，如 'editor.toggleBold'
  title: string                  // 展示名称
  description?: string           // 可选描述
  icon?: string                  // 可选图标, Lucide icon name
  keywords?: string[]            // 搜索支持
  shortcut?: string | string[]   // 快捷键支持（可选）,**仅用于显式tip提示，实际绑定在 keymap 里**

  run: (view: EditorView, args: TArgs extends void ? void : TArgs) => boolean | Promise<boolean>

  isEnabled?: (view: EditorView) => boolean      // 是否可点击（如选中为空不能加粗）
  isActive?: (view: EditorView) => boolean       // 状态（如是否当前为 bold）
  isVisible?: (view: EditorView) => boolean      // 是否可见（如当前编辑器不支持加粗）}
}
