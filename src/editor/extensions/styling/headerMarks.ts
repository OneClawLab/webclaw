import { ViewPlugin, ViewUpdate, Decoration, DecorationSet } from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";

const REGEX_HEADER = /^(#{1,6})\s+/;

export const headerMarksVP = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view) {
      this.decorations = this.buildDecorations(view);
    }

    update(update: ViewUpdate) {
      if (
        update.docChanged ||
        update.selectionSet ||
        update.viewportChanged
      ) {
        this.decorations = this.buildDecorations(update.view);
      }
    }

    buildDecorations(view) {
      const builder = new RangeSetBuilder<Decoration>();
      const { state } = view;
      const cursorLine = state.doc.lineAt(state.selection.main.head);

      for (const { from, to } of view.visibleRanges) {
        let pos = from;
        while (pos <= to) {
          const line = state.doc.lineAt(pos);
          pos = line.to + 1;

          const match = REGEX_HEADER.exec(line.text);
          if (!match) continue;

          // 光标在当前行时，不隐藏#符号
          if (line.number === cursorLine.number) continue;

          const start = line.from;
          const end = start + match[0].length;

          builder.add(start, end, Decoration.replace({ inclusive: false }));
        }
      }

      return builder.finish();
    }
  },
  {
    decorations: v => v.decorations
  }
);
