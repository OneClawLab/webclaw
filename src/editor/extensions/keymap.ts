import { KeyBinding, keymap } from "@codemirror/view"

import { foldKeymap } from "@codemirror/language"
import { defaultKeymap, historyKeymap, indentWithTab } from "@codemirror/commands"
import { searchKeymap } from "@codemirror/search"
import { closeBracketsKeymap, acceptCompletion, closeCompletion, moveCompletionSelection } from "@codemirror/autocomplete" 
import { onAskAI } from "@editor/commands/impls/ai.js"
import { toggleBold, toggleCodeblock, toggleHighlight, toggleInline, toggleItalic, toggleStrikethrough, toggleUnderline } from "@editor/commands/impls/editor.js"
import { decreaseVisibleLevel, increaseVisibleLevel } from "./visibleLevel.js"

// 注: theKeymap 中的命令绑定顺序很重要，前面的选择不处理才会轮到后面的。
export const theKeymap = keymap.of([
  { key: "Mod-Enter", run: onAskAI },  // Ask AI 相关命令绑定

  // 补全菜单命令绑定，Tab 和 Enter 用于接受补全项
  { key: "Tab", run: acceptCompletion },
  { key: "Enter", run: acceptCompletion },
  { key: 'Escape', run: closeCompletion },
  { key: 'ArrowUp', run: moveCompletionSelection(false) },
  { key: 'ArrowDown', run: moveCompletionSelection(true) },

  // 文字样式命令绑定，加粗、斜体等快捷键
  { key: "Mod-b", run: toggleBold },
  { key: "Mod-i", run: toggleItalic },
  { key: "Mod-u", run: toggleUnderline },
  { key: "Mod-Shift-x", run: toggleStrikethrough },
  { key: "Mod-Shift-h", run: toggleHighlight },
  { key: "Mod-`", run: toggleInline },
  { key: "Mod-Shift-`", run: toggleCodeblock },

  // 收缩/展开
  { key: "Mod-=", run: increaseVisibleLevel },
  { key: "Mod--", run: decreaseVisibleLevel },

  ...closeBracketsKeymap, // 括号自动闭合命令绑定，支持括号相关快捷键

  indentWithTab,          // Tab 缩进命令绑定，Tab 键缩进

  ...historyKeymap,       // 撤销历史命令绑定，撤销重做快捷键
  ...searchKeymap,        // 搜索命令绑定，查找和替换相关快捷键
  ...foldKeymap,          // 折叠区命令绑定，代码折叠快捷键

  ...defaultKeymap,       // 默认命令绑定，常用编辑快捷键
]);
