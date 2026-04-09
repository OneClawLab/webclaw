import { Logger } from '@lib/logast.js';
import { k18 } from '@lib/i18n.js'
import { EditorState } from '@codemirror/state'
import { indentLess, indentMore  } from "@codemirror/commands"
import { defineCommand } from '@editor/commands/registry.js'
import { dispatchCommand as dispatchAppCommand } from '@commands/registry.js'
import { decreaseVisibleLevel, increaseVisibleLevel } from '@editor/extensions/visibleLevel.js';
import type { Command } from "@codemirror/view";
import type { EditorView } from "@codemirror/view";

function toggleSurroundingSymbols(state: EditorState, dispatch, symbol: string): boolean {
  const { from, to, empty } = state.selection.main;
  if (empty) return false;

  const text = state.sliceDoc(from, to);
  let newText;
  if (text.startsWith(symbol) && text.endsWith(symbol)) {
    // 去掉符号
    newText = text.slice(symbol.length, text.length - symbol.length);
  } else {
    // 加上符号
    newText = `${symbol}${text}${symbol}`;
  }

  if (dispatch)
    dispatch({ changes: { from, to, insert: newText } });
  return true;
}

export const toggleBold: Command = (view: EditorView) => toggleSurroundingSymbols(view.state, view.dispatch, "**");
export const toggleItalic: Command = (view: EditorView) => toggleSurroundingSymbols(view.state, view.dispatch, "*");
export const toggleUnderline: Command = (view: EditorView) => toggleSurroundingSymbols(view.state, view.dispatch, "__");
export const toggleStrikethrough: Command = (view: EditorView) => toggleSurroundingSymbols(view.state, view.dispatch, "~~");
export const toggleHighlight: Command = (view: EditorView) => toggleSurroundingSymbols(view.state, view.dispatch, "==");
export const toggleInline: Command = (view: EditorView) => toggleSurroundingSymbols(view.state, view.dispatch, "`");
export const toggleCodeblock: Command = (view: EditorView) => toggleSurroundingSymbols(view.state, view.dispatch, "```");

// 判断某个 mark 是否在当前选区内 active（即 selection 包含该 mark）
export function isMarkActive(state: EditorState, type: string): boolean {
  const { from, to, empty } = state.selection.main;
  if (empty) return false;

  const text = state.sliceDoc(from, to);
 
  // 根据 mark 类型获取对应的符号
  let symbol: string;
  switch (type) {
    case 'bold':
      symbol = '**';
      break;
    case 'italic':
      symbol = '*';
      break;
    case 'underline':
      symbol = '__';
      break;
    case 'strikethrough':
      symbol = '~~';
      break;
    case 'highlight':
      symbol = '==';
      break;
    case 'inline':
      symbol = '`';
      break;
    case 'codeblock':
      symbol = '```';
      break;
    default:
      return false;
  }

  // 检查选中的文本是否被对应的符号包围
  return text.startsWith(symbol) && text.endsWith(symbol);
}

////////////////////////////////////////////////////////////////////////////

defineCommand<{ path?: string }>({
  id: 'editor/default/refresh',
  title: k18('commands.editor.commands.refresh'),
  description: k18('commands.editor.commands.refreshDesc'),
  icon: 'RotateCw',
  run(view, args): boolean {
    dispatchAppCommand<{ tabId?: string }>('tab/refresh', {});
    return false;
  },
  isActive: (state) => false,
  isEnabled: (state) => true,
});

// ---- 文本标记命令

defineCommand<{void}>({
  id: 'editor/mark/bold',
  title: k18('commands.editor.commands.toggleBold'),
  description: k18('commands.editor.commands.toggleBoldDesc'),
  icon: 'Bold',
  shortcut: 'Mod+B',
  run(view, args): boolean {
    return toggleBold(view);
  },
  isActive: (view) => isMarkActive(view.state, 'bold'),
  isEnabled: (view) => true,
});

defineCommand<{void}>({
  id: 'editor/mark/italic',
  title: k18('commands.editor.commands.toggleItalic'),
  description: k18('commands.editor.commands.toggleItalicDesc'),
  icon: 'Italic',
  shortcut: 'Mod+I',
  run(view, args): boolean {
    return toggleItalic(view);
  },
  isActive: (view) => isMarkActive(view.state, 'italic'),
  isEnabled: (view) => true,
});

defineCommand<{void}>({
  id: 'editor/mark/underline',
  title: k18('commands.editor.commands.toggleUnderline'),
  description: k18('commands.editor.commands.toggleUnderlineDesc'),
  icon: 'Underline',
  shortcut: 'Mod+U',
  run(view, args): boolean {
    return toggleUnderline(view);
  },
  isActive: (view) => isMarkActive(view.state, 'underline'),
  isEnabled: (view) => true,
});

defineCommand<{void}>({
  id: 'editor/mark/strikethrough',
  title: k18('commands.editor.commands.toggleStrikethrough'),
  description: k18('commands.editor.commands.toggleStrikethroughDesc'),
  icon: 'Strikethrough',
  shortcut: 'Mod+Shift+X',
  run(view, args): boolean {
    return toggleStrikethrough(view);
  },
  isActive: (view) => isMarkActive(view.state, 'strikethrough'),
  isEnabled: (view) => true,
});

defineCommand<{void}>({
  id: 'editor/mark/highlight',
  title: k18('commands.editor.commands.toggleHighlight'),
  description: k18('commands.editor.commands.toggleHighlightDesc'),
  icon: 'Highlighter',
  shortcut: 'Mod+Shift+H',
  run(view, args): boolean {
    return toggleHighlight(view);
  },
  isActive: (view) => isMarkActive(view.state, 'highlight'),
  isEnabled: (view) => true,
});

defineCommand<{void}>({
  id: 'editor/mark/inline',
  title: k18('commands.editor.commands.toggleInlineCode'),
  description: k18('commands.editor.commands.toggleInlineCodeDesc'),
  icon: 'ChevronsLeftRightEllipsis',
  shortcut: 'Mod+`',
  run(view, args): boolean {
    return toggleInline(view);
  },
  isActive: (view) => isMarkActive(view.state, 'inline'),
  isEnabled: (view) => true,
});

defineCommand<{void}>({
  id: 'editor/mark/codeblock',
  title: k18('commands.editor.commands.toggleCodeBlock'),
  description: k18('commands.editor.commands.toggleCodeBlockDesc'),
  icon: 'Braces',
  shortcut: 'Mod+Shift+`',
  run(view, args): boolean {
    return toggleCodeblock(view);
  },
  isActive: (view) => isMarkActive(view.state, 'codeblock'),
  isEnabled: (view) => true,
});

defineCommand<{void}>({
  id: 'editor/indent/more',
  title: k18('commands.editor.commands.indentMore'),
  description: k18('commands.editor.commands.indentMoreDesc'),
  icon: 'IndentIncrease',
  shortcut: 'Tab',
  run(view, args): boolean {
    return indentMore({ state: view.state, dispatch: view.dispatch});
  },
  isActive: (state) => false,
  isEnabled: (state) => true,
});

defineCommand<{void}>({
  id: 'editor/indent/less',
  title: k18('commands.editor.commands.indentLess'),
  icon: 'IndentDecrease',
  shortcut: 'Shift+Tab',
  description: k18('commands.editor.commands.indentLessDesc'),
  run(view, args): boolean {
    return indentLess({ state: view.state, dispatch: view.dispatch});
  },
  isActive: (view) => false,
  isEnabled: (view) => true,
});

defineCommand<{void}>({
  id: 'editor/visible.level/increase',
  title: k18('commands.editor.commands.expandMore'),
  description: k18('commands.editor.commands.expandMoreDesc'),
  icon: 'CopyPlus',
  shortcut: ['Mod++','Mod+='],
  run(view, args): boolean {
    return increaseVisibleLevel(view);
  },
  isActive: (state) => false,
  isEnabled: (state) => true,
});

defineCommand<{void}>({
  id: 'editor/visible.level/decrease',
  title: k18('commands.editor.commands.collapseMore'),
  description: k18('commands.editor.commands.collapseMoreDesc'),
  icon: 'CopyMinus',
  shortcut: ['Mod+-','Mod+_'],
  run(view, args): boolean {
    return decreaseVisibleLevel(view);
  },
  isActive: (view) => false,
  isEnabled: (view) => true,
});
