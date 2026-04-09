import { ViewPlugin, ViewUpdate, Decoration, DecorationSet } from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";
import { syntaxTree } from "@codemirror/language";

const INLINE_MARK_NODES = new Set([
  "Emphasis",
  "StrongEmphasis",
  "InlineCode",
  "Strikethrough",
  "Highlight",
]);

type PendingDeco = { from: number; to: number; deco: Decoration };

export const inlineMarksVP = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view) {
      this.decorations = this.build(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.selectionSet || update.viewportChanged) {
        this.decorations = this.build(update.view);
      }
    }

    build(view) {
      const { state } = view;
      const cursor = state.selection.main.head;

      const pending: PendingDeco[] = [];
      const tree = syntaxTree(state);

      tree.iterate({
        from: view.viewport.from,
        to: view.viewport.to,
        enter: (node) => {
          if (!INLINE_MARK_NODES.has(node.name)) return;

          const { from, to } = node;
          // Cursor inside node => show marks
          if (cursor >= from && cursor <= to) return;

          this.hideMarks(node, pending, state);
        },
      });

      // Sort by from, then by to to stabilize ordering.
      // (RangeSetBuilder primary requirement is increasing `from`/side;
      // sorting eliminates out-of-order additions caused by traversal/nesting.)
      pending.sort((a, b) => (a.from - b.from) || (a.to - b.to));

      const builder = new RangeSetBuilder<Decoration>();
      for (const r of pending) builder.add(r.from, r.to, r.deco);

      return builder.finish();
    }

    hideMarks(node, pending: PendingDeco[], state) {
      const text = state.doc.sliceString(node.from, node.to);

      // **hello** / *hello* / `code` / ~~del~~ / ==highlight==
      const match = /^([*_~`=]+)([\s\S]*?)(\1)$/.exec(text);
      if (!match) return;

      const openLen = match[1].length;
      const closeLen = match[3].length;

      // Collect, don't add directly (keeps builder additions sorted)
      pending.push({
        from: node.from,
        to: node.from + openLen,
        deco: Decoration.replace({}),
      });
      pending.push({
        from: node.to - closeLen,
        to: node.to,
        deco: Decoration.replace({}),
      });
    }
  },
  {
    decorations: (v) => v.decorations,
  }
);
