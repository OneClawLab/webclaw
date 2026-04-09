import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate, WidgetType } from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";
import { ChatSectionUtils } from "@editor/ChatSectionUtils.js";
import { isWhitespace } from "@lib/utils.js";
import { hkt, t } from "@lib/i18n.js";

// i18n text with Mod+Enter hotkey
function tModEnter(id: string) { return t(id, { ModEnter: hkt('Mod+Enter') }); }

class SmartHintWidget extends WidgetType {
  constructor(readonly text: string) { super(); }
  toDOM() {
    const span = document.createElement("span");
    span.textContent = this.text;
    span.className = "cm-inlineSmartHint";
    return span;
  }
  ignoreEvent() { return true; }
}

// 智能提示扩展
export const inlineSmartHintVP = ViewPlugin.fromClass(
class {
  decorations: DecorationSet;

  constructor(view: EditorView) {
    this.decorations = this.buildDecorations(view);
  }

  update(update: ViewUpdate) {
    if (update.docChanged || update.selectionSet)
      this.decorations = this.buildDecorations(update.view);
  }

  buildDecorations(view: EditorView) {
    const builder = new RangeSetBuilder<Decoration>();
    const cursor = view.state.selection.main.head;
    const line = view.state.doc.lineAt(cursor);
    const text = line.text.trim();

    // 最终要插入的提示内容, null 表示不显示提示
    let hint: string | null = null;

    const atLineStart = (cursor === line.from);
    const blankLine = (text.length === 0);
    const atBlackLineStart = blankLine && atLineStart;
    const hasSelection = !view.state.selection.main.empty;

    // 当前策略为：只有光标在 空行首时，才显示提示
    if (atBlackLineStart) {
      const section = ChatSectionUtils.getLastChatSection(view.state);

      // 文档中还没有任何 chat section，并且没有选中文本
      if (section.type === 'invalid' && !hasSelection) {
        hint = tModEnter('ai.hints.inline.emptyDocStart');
      // 光标在最后一个 question chat section 内
      } else if (section.type === 'question' && cursor > section.headerFrom) {
        const prompt = view.state.doc.sliceString(section.textFrom, section.textTo);
        if (isWhitespace(prompt))
          hint = t('ai.hints.inline.noPromptYet');
        else
          hint = tModEnter('ai.hints.inline.hasPrompt');
      // 光标在最后一个 answer chat section 的所有文本的后面
      } else if (section.type === 'answer' && cursor > section.textTo) {
        hint = tModEnter('ai.hints.inline.insertNewQuestion');
      // 其他情况，如果有选中的文本，则提示可以引用选中的内容
      } else {
        if (hasSelection)
          hint = tModEnter('ai.hints.inline.quoteSelection');
        else
          hint = null;
      }
    }

    // 如果有提示，插入到光标起始处往后的位置
    if (hint)
      builder.add(cursor, cursor, Decoration.widget({ widget: new SmartHintWidget(hint), side: 1 }));

    return builder.finish();
  }
}, {
  decorations: v => v.decorations
});
