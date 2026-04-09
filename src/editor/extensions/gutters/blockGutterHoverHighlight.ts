import { Logger } from "@lib/logast.js";
import { EditorView, ViewPlugin, Decoration, DecorationSet, ViewUpdate, BlockInfo } from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";
import { getFoldableBlockAt } from "@editor/CmUtils.js";

// 一个 ViewPlug 扩展，当鼠标悬停在 blockActionGutter 上时，高亮显示该折叠区域的所有行
// 必须通过 DOM 事件处理器才能触发，所以需要配合 其他的 block gutter 一起使用
export const blockGutterHoverHighlightVP = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet = Decoration.none;
    hoveredRange: { from: number; to: number } | null = null;

    constructor(public view: EditorView) {}

    update(update: ViewUpdate) {
      // 只要文档或视口变化，就保留现有装饰
      if (update.docChanged || update.viewportChanged) {
        // decorations 不需要改变，保持已有
      }
    }

    // 高亮指定 range
    highlightRange(from: number, to: number) {
      const builder = new RangeSetBuilder<Decoration>();
      const doc = this.view.state.doc;
      let line = doc.lineAt(from);
      while (line.from <= to) {
        // Logger.debug("Highlighting line:", line.number);
        builder.add(line.from, line.from, Decoration.line({ class: "cm-block-hover-highlight" }));
        if (line.to >= to) break;
        line = doc.line(line.number + 1);
      }
      this.decorations = builder.finish();
      this.hoveredRange = { from, to };
      this.view.update([]); // 触发视图刷新
    }

    // 清除高亮
    clearHighlight() {
      this.decorations = Decoration.none;
      this.hoveredRange = null;
      this.view.update([]); // 触发视图刷新
    }
  },
  {
    decorations: (v) => v.decorations,
  }
);

export const hoverHighlightDOMEventHandlers = {
  mousemove: (view: EditorView, line: BlockInfo, event: Event): boolean => {
    const block = getFoldableBlockAt(view, line.from, line.to);
    const range = block?.range;
    if (range) {
      const plugin = view.plugin(blockGutterHoverHighlightVP);
      if (!plugin) {
        Logger.warn("blockGutterHoverHighlight plugin not found");
        return false;
      }
      plugin.highlightRange(range.from, range.to);
      return false;
    } else {
      const plugin = view.plugin(blockGutterHoverHighlightVP);
      plugin?.clearHighlight();
      return false;
    }
  },

  mouseleave: (view: EditorView, line: BlockInfo, event: Event): boolean => {
    const plugin = view.plugin(blockGutterHoverHighlightVP);
    plugin?.clearHighlight();
    return false;
  }
}
