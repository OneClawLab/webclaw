import {EditorView, Decoration, WidgetType, ViewPlugin, ViewUpdate, DecorationSet} from "@codemirror/view";
import {RangeSetBuilder} from "@codemirror/state";

// Widget: 渲染 checkbox
class TaskWidget extends WidgetType {
  constructor(readonly isChecked: boolean, readonly onClick: () => void) { super() }

  toDOM() {
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = this.isChecked;
    input.style.pointerEvents = "auto";

    input.onclick = (e) => {
      e.preventDefault();
      this.onClick();
    };

    return input;
  }

  ignoreEvent() { return false; }
}

export const checklistVP = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = this.buildDecorations(view);
    }

    buildDecorations(view: EditorView): DecorationSet {
      const builder = new RangeSetBuilder<Decoration>();
      const doc = view.state.doc;

      for (let i = 0; i < doc.lines; i++) {
        const line = doc.line(i + 1);
        const text = line.text;

        // 支持：
        //  - 无序列表: - [ ] / * [x] / + [ ]
        //  - 有序列表: 1. [ ] / 2) [x]
        // 要点：仅匹配行首的 list marker，后面紧跟 [ ] 或 [x]，并至少有一个空格分隔
        const m = /^\s*(?:[-*+]|(?:\d+[.)]))\s+\[([ xX])\]\s+/.exec(text);
        if (!m) continue;

        const isChecked = m[1] !== " ";

        // 定位 "[ ]"/"[x]" 在该行的绝对范围
        const bracketOpenInPrefix = m[0].lastIndexOf("[");
        const bracketFrom = line.from + bracketOpenInPrefix; // '['
        const checkCharPos = bracketFrom + 1;                // ' ' / 'x'
        const bracketTo = bracketFrom + 3;                   // 覆盖 "[ ]" / "[x]"（3 chars）

        const deco = Decoration.replace({
          widget: new TaskWidget(isChecked, () => {
            const transaction = view.state.update({
              changes: { from: checkCharPos, to: checkCharPos + 1, insert: isChecked ? " " : "x" }
            });
            view.dispatch(transaction);
          }),
        });

        builder.add(bracketFrom, bracketTo, deco);
      }

      return builder.finish();
    }

    update(update: ViewUpdate) {
      if (update.docChanged)
        this.decorations = this.buildDecorations(update.view);
    }
  },
  { decorations: v => v.decorations }
);
