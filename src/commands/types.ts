// Usage: 
// const insertText = defineCommand({
//   id: 'editor.insertText',
//   title: '插入文本',
//   run(args) {
//     console.log('插入文本:', args.text);
//   },
// });

export interface AppCommand<TArgs = void> {
  id: string                     // 全局唯一 ID，如 'editor.toggleBold'
  group?: string                 // 所属命令组 ID，如 'editor'
  title?: string                 // 展示名称，可能包含 i18n: 前缀
  description?: string           // 可选描述，可能包含 i18n: 前缀
  icon?: React.ReactNode         // 可选图标
  keywords?: string[]            // 搜索支持
  shortcut?: string | string[]   // 快捷键支持（可选）
  capture?: boolean              // 是否在捕获阶段处理热键，默认为 false（冒泡阶段）

  run(args: (TArgs extends void ? void : TArgs)): any | Promise<any>

  isEnabled?: () => boolean      // 是否可点击（如选中为空不能加粗）
  isActive?: () => boolean       // 状态（如是否当前为 bold）
  isVisible?: () => boolean      // 是否可见（如当前编辑器不支持加粗）}
}

// 运行时命令类型，只保留 id、shortcut 和 run 等字段
export type RuntimeAppCommand<TArgs = void> = Pick<
  AppCommand<TArgs>,
  'id' | 'shortcut' | 'run' | 'title'
>;

export interface AppCommandGroup {
  id: string                     // 全局唯一 ID，如 'editor'
  title: string                  // 展示名称
  icon?: React.ReactNode         // 可选图标
  commands: AppCommand<any>[]    // 包含的命令
}
